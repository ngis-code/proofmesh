import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Plus, ArrowRight, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SUBSCRIPTION_PLANS, FREE_PLAN } from '@/lib/subscriptionPlans';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OrgWithRole {
  id: string;
  name: string;
  created_at: string;
  role: string;
}

interface BillingInfo {
  stripe_product_id: string | null;
  subscription_status: string;
}

interface MyOrgsResponse {
  orgs: OrgWithRole[];
}

interface CreateOrgResponse {
  org: { id: string; name: string; created_at: string };
}

export default function MyOrgsPage() {
  const api = useApi();
  const navigate = useNavigate();
  const { refreshSubscription } = useAuth();
  const [orgs, setOrgs] = useState<OrgWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [billingData, setBillingData] = useState<Record<string, BillingInfo>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<OrgWithRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadOrgs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<MyOrgsResponse>('/api/my-orgs');
      setOrgs(data.orgs);
      
      // Fetch billing info for each org
      const billingPromises = data.orgs.map(async (org) => {
        try {
          const response = await api.get<{ billing: BillingInfo }>(`/api/orgs/${org.id}/billing`);
          return { orgId: org.id, billing: response.billing };
        } catch {
          return { orgId: org.id, billing: null };
        }
      });
      
      const billingResults = await Promise.all(billingPromises);
      const billingMap: Record<string, BillingInfo> = {};
      billingResults.forEach(({ orgId, billing }) => {
        if (billing) billingMap[orgId] = billing;
      });
      setBillingData(billingMap);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load orgs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrgs();
  }, []);

  const handleCreateOrg = () => {
    navigate('/create-org');
  };

  const handleRefreshSubscription = async () => {
    setRefreshing(true);
    try {
      await refreshSubscription();
      await loadOrgs();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteClick = async (org: OrgWithRole) => {
    // Check if org has other users
    try {
      const usersResponse = await api.get<{ users: { user_id: string }[] }>(`/api/orgs/${org.id}/users`);
      if (usersResponse.users.length > 1) {
        toast.error('Cannot delete organization with multiple users. Remove all other users first.');
        return;
      }
    } catch (err) {
      console.error('Failed to check users:', err);
    }

    // Check for active subscription
    const billing = billingData[org.id];
    if (billing?.subscription_status === 'active') {
      toast.error('Cannot delete organization with active subscription. Cancel subscription first via "Manage Subscription".');
      return;
    }

    setOrgToDelete(org);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orgToDelete) return;
    
    setDeleting(true);
    try {
      await api.post(`/api/orgs/${orgToDelete.id}/delete`, {});
      toast.success(`Organization "${orgToDelete.name}" deleted successfully`);
      setDeleteDialogOpen(false);
      setOrgToDelete(null);
      await loadOrgs();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to delete organization';
      toast.error(errorMsg);
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#06b6d4] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            Your Organizations
          </h2>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-slate-400">{orgs.length} organizations</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshSubscription}
              disabled={refreshing}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
      <div className="card-body">
        <button 
          type="button" 
          onClick={handleCreateOrg}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <Plus className="w-4 h-4" />
          Create New Organization
        </button>

        {error && (
          <div className="alert error">
            <strong>Error</strong>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        <div className="table-wrapper" style={{ marginTop: '1.5rem' }}>
          {orgs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No organizations yet. Create one to get started.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Plan</th>
                  <th>Created</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => {
                  const billing = billingData[org.id];
                const plan = billing?.stripe_product_id && billing?.subscription_status === 'active'
                    ? Object.values(SUBSCRIPTION_PLANS).find(p => p.productId === billing.stripe_product_id) || FREE_PLAN
                    : FREE_PLAN;
                  const isActive = billing?.subscription_status === 'active';
                  
                  return (
                    <tr key={org.id}>
                      <td className="font-medium">{org.name}</td>
                      <td>
                        <span className={`pill ${org.role === 'admin' ? 'bg-[#0ea5e9]/20 text-[#0ea5e9]' : 'bg-slate-700 text-slate-300'}`}>
                          {org.role}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${isActive ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-slate-700 text-slate-300'}`}>
                          {plan.name}
                        </span>
                      </td>
                      <td className="text-sm text-slate-400">{new Date(org.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/orgs/${org.id}`)}
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          <span className="flex items-center gap-1">
                            Open
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </button>
                      </td>
                      <td>
                        {org.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(org)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to delete "{orgToDelete?.name}"?</p>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. The organization will be permanently removed.
              </p>
              <div className="text-sm text-amber-500 font-medium mt-2 space-y-1">
                <p>⚠️ Deletion requirements:</p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  <li>No other users in the organization</li>
                  <li>No active subscriptions</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
