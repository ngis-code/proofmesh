import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApi } from '@/lib/api';
import { Activity, Code, Key, Users, Shield, FileCheck, Database, CreditCard } from 'lucide-react';
import OrgOverview from '@/components/org/OrgOverview';
import OrgApiKeys from '@/components/org/OrgApiKeys';
import OrgUsers from '@/components/org/OrgUsers';
import OrgStamp from '@/components/org/OrgStamp';
import OrgVerify from '@/components/org/OrgVerify';
import OrgProofs from '@/components/org/OrgProofs';
import OrgSDK from '@/components/org/OrgSDK';
import OrgBillingStatus from '@/components/org/OrgBillingStatus';

interface Org {
  id: string;
  name: string;
  created_at: string;
}

interface MyOrgEntry extends Org {
  role: string;
}

interface BillingInfo {
  stripe_product_id: string | null;
  subscription_status: string;
}

interface MyOrgsResponse {
  orgs: MyOrgEntry[];
}

interface OrgsResponse {
  orgs: Org[];
}

interface ValidatorsResponse {
  validators: { online?: boolean }[];
}

interface ProofsResponse {
  proofs: { org_id: string }[];
}

export default function OrgDashboard() {
  const { orgId } = useParams<{ orgId: string }>();
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [org, setOrg] = useState<Org | null>(null);
  const [role, setRole] = useState<'admin' | 'viewer' | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [onlineValidators, setOnlineValidators] = useState<number | null>(null);
  const [recentProofs, setRecentProofs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const [allOrgs, myOrgs, validators, proofs, billingData] = await Promise.all([
          api.get<OrgsResponse>('/api/orgs'),
          api.get<MyOrgsResponse>('/api/my-orgs'),
          api.get<ValidatorsResponse>('/api/validators'),
          api.get<ProofsResponse>('/api/proofs?limit=100'),
          api.get<{ billing: BillingInfo }>(`/api/orgs/${orgId}/billing`).catch(() => ({ billing: null })),
        ]);

        const foundOrg = allOrgs.orgs.find((o) => o.id === orgId) ?? null;
        setOrg(foundOrg);
        if (!foundOrg) {
          setError('Org not found');
        }

        const myEntry = myOrgs.orgs.find((o) => o.id === orgId) ?? null;
        setRole((myEntry?.role as 'admin' | 'viewer') ?? 'viewer');

        setBilling(billingData.billing);

        const onlineCount = validators.validators.filter((v) => v.online).length;
        setOnlineValidators(onlineCount);

        const orgProofs = proofs.proofs.filter((p) => p.org_id === orgId);
        setRecentProofs(orgProofs.length);
      } catch (err: any) {
        setError(err.message ?? 'Failed to load org');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [orgId]);

  if (!orgId) return null;

  const isAdmin = role === 'admin';
  const isPaidPlan = billing?.subscription_status === 'active' && billing?.stripe_product_id;
  const canAccessFeatures = isAdmin && isPaidPlan;
  const currentTab = location.pathname.split('/').pop() || 'overview';

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="card">
        <div className="card-title">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0ea5e9] to-[#22c55e] flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-[#020617]" />
            </div>
            <div>
              <h2 className="text-xl">{org ? org.name : 'Organization'}</h2>
              <p className="text-xs text-[#6b7280] code">{orgId}</p>
            </div>
          </div>
          <span className={`tag ${isAdmin ? 'green' : ''}`}>{role ?? 'viewer'}</span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0f172a] border border-[#1f2937] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-[#0ea5e9]" />
                <span className="text-xs text-[#9ca3af]">Recent Proofs</span>
              </div>
              <div className="text-2xl font-bold">{recentProofs ?? '…'}</div>
              <p className="text-xs text-[#6b7280] mt-1">Last 100 records</p>
            </div>
            <div className="bg-[#0f172a] border border-[#1f2937] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-[#22c55e]" />
                <span className="text-xs text-[#9ca3af]">Validators Online</span>
              </div>
              <div className="text-2xl font-bold">{onlineValidators ?? '…'}</div>
              <p className="text-xs text-[#6b7280] mt-1">All regions</p>
            </div>
            <div className="bg-[#0f172a] border border-[#1f2937] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-[#0ea5e9]" />
                <span className="text-xs text-[#9ca3af]">Security Status</span>
              </div>
              <div className="text-2xl font-bold text-[#22c55e]">Active</div>
              <p className="text-xs text-[#6b7280] mt-1">All systems operational</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert error">
          <strong>Error: </strong>
          {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          className={currentTab === 'overview' || currentTab === orgId ? 'tab active' : 'tab'}
          onClick={() => navigate(`/orgs/${orgId}`)}
        >
          <Shield className="w-4 h-4" />
          Overview
        </button>
        {isAdmin && (
          <button
            type="button"
            className={currentTab === 'billing' ? 'tab active' : 'tab'}
            onClick={() => navigate(`/orgs/${orgId}/billing`)}
          >
            <CreditCard className="w-4 h-4" />
            Billing
          </button>
        )}
        {canAccessFeatures && (
          <>
            <button
              type="button"
              className={currentTab === 'sdk' ? 'tab active' : 'tab'}
              onClick={() => navigate(`/orgs/${orgId}/sdk`)}
            >
              <Code className="w-4 h-4" />
              SDK
            </button>
            <button
              type="button"
              className={currentTab === 'keys' ? 'tab active' : 'tab'}
              onClick={() => navigate(`/orgs/${orgId}/keys`)}
            >
              <Key className="w-4 h-4" />
              API Keys
            </button>
            <button
              type="button"
              className={currentTab === 'users' ? 'tab active' : 'tab'}
              onClick={() => navigate(`/orgs/${orgId}/users`)}
            >
              <Users className="w-4 h-4" />
              Users
            </button>
            <button
              type="button"
              className={currentTab === 'stamp' ? 'tab active' : 'tab'}
              onClick={() => navigate(`/orgs/${orgId}/stamp`)}
            >
              <Shield className="w-4 h-4" />
              Stamp
            </button>
            <button
              type="button"
              className={currentTab === 'verify' ? 'tab active' : 'tab'}
              onClick={() => navigate(`/orgs/${orgId}/verify`)}
            >
              <FileCheck className="w-4 h-4" />
              Verify
            </button>
            <button
              type="button"
              className={currentTab === 'proofs' ? 'tab active' : 'tab'}
              onClick={() => navigate(`/orgs/${orgId}/proofs`)}
            >
              <Database className="w-4 h-4" />
              Proofs
            </button>
          </>
        )}
      </div>

      {/* Tab Content */}
      <Routes>
        <Route index element={<OrgOverview org={org} />} />
        {isAdmin && <Route path="billing" element={<OrgBillingStatus orgId={orgId} />} />}
        {canAccessFeatures && (
          <>
            <Route path="sdk" element={<OrgSDK orgId={orgId} />} />
            <Route path="keys" element={<OrgApiKeys orgId={orgId} isAdmin={isAdmin} />} />
            <Route path="users" element={<OrgUsers orgId={orgId} isAdmin={isAdmin} />} />
            <Route path="stamp" element={<OrgStamp orgId={orgId} />} />
            <Route path="verify" element={<OrgVerify orgId={orgId} />} />
            <Route path="proofs" element={<OrgProofs orgId={orgId} />} />
          </>
        )}
      </Routes>
    </div>
  );
}
