import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/lib/api';
import { Users, UserPlus, Trash2, Eye, AlertCircle } from 'lucide-react';
import { useOrgUsage } from '@/hooks/useOrgUsage';

interface OrgUsersResponse {
  users: {
    org_id: string;
    user_id: string;
    email: string | null;
    role: string;
    created_at: string;
  }[];
}

interface OrgUsersProps {
  orgId: string;
  isAdmin: boolean;
}

export default function OrgUsers({ orgId, isAdmin }: OrgUsersProps) {
  const api = useApi();
  const { sendMagicLinkInvite } = useAuth();
  const { usage, loading: usageLoading, error: usageError, refetch, isTeamAtLimit } = useOrgUsage(orgId);
  const [users, setUsers] = useState<OrgUsersResponse['users']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const usersData = await api.get<OrgUsersResponse>(`/api/orgs/${orgId}/users`);
      setUsers(usersData.users);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [orgId]);

  const handleAdd = async () => {
    if (!isAdmin) return;
    if (!orgId || !email.trim()) return;
    
    // Check team member limit
    if (isTeamAtLimit) {
      setError(`Team member limit reached (${usage?.team.limit} members). Upgrade your plan to add more users.`);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<{
        user: OrgUsersResponse['users'][number];
        appwriteUser: { id: string; email: string };
      }>(`/api/orgs/${orgId}/users`, { email: email.trim(), role });
      setEmail('');
      try {
        await sendMagicLinkInvite(data.appwriteUser.id, data.appwriteUser.email);
        setInviteStatus(`Invite email sent to ${data.appwriteUser.email}.`);
      } catch (inviteErr: any) {
        setInviteStatus(null);
        setError(
          inviteErr?.message ??
            'User was linked to org, but sending the magic-link email failed. Check Appwrite logs.',
        );
      }
      await load();
      await refetch();
    } catch (err: any) {
      if (err.message === 'LIMIT_REACHED') {
        setError('You have reached the maximum team member limit for your plan.');
      } else {
        setError(err.message ?? 'Failed to add user');
      }
      setLoading(false);
    }
  };

  const handleRemove = async (targetUserId: string) => {
    if (!isAdmin) return;
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/orgs/${orgId}/users/${targetUserId}/remove`, {});
      await load();
      await refetch();
    } catch (err: any) {
      setError(err.message ?? 'Failed to remove user');
      setLoading(false);
    }
  };

  if (usageLoading) {
    return <div className="text-slate-400">Loading usage data...</div>;
  }

  if (usageError) {
    return <div className="text-red-400">Error loading usage: {usageError}</div>;
  }

  if (!usage) {
    return <div className="text-slate-400">No usage data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Usage Limit Alert */}
      <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400 mb-1">Team Members</div>
            <div className="text-2xl font-bold text-slate-100">
              {usage.team.current} {usage.team.limit === -1 ? '/ Unlimited' : `/ ${usage.team.limit}`}
            </div>
            <div className="text-xs text-slate-400 mt-1 capitalize">{usage.plan} Plan</div>
          </div>
          {isTeamAtLimit && (
            <div className="flex items-center gap-2 text-amber-400 bg-amber-950/30 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Limit Reached</span>
            </div>
          )}
        </div>
        {usage.team.limit !== -1 && (
          <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${isTeamAtLimit ? 'bg-amber-500' : 'bg-cyan-500'}`}
              style={{ width: `${Math.min((usage.team.current / usage.team.limit) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="card">
          <div className="card-title">
            <h2 className="text-xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              Invite User
            </h2>
          </div>
          <div className="card-body">
          {isTeamAtLimit && (
            <div className="mb-4 bg-amber-950/30 border border-amber-900/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-400 mb-1">Team Member Limit Reached</p>
                  <p className="text-sm text-slate-300">
                    You've reached the maximum of {usage.team.limit} team members for your {usage.plan} plan.
                    Upgrade to add more users.
                  </p>
                </div>
              </div>
            </div>
          )}
            <div className="form">
              <div className="form-row">
                <label>
                  <span>Email Address</span>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isTeamAtLimit}
                  />
                </label>
                <label>
                  <span>Role</span>
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value as 'admin' | 'viewer')}
                    disabled={isTeamAtLimit}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
              <button onClick={handleAdd} disabled={loading || !email.trim() || isTeamAtLimit}>
                <UserPlus className="w-4 h-4 mr-2" style={{ display: 'inline-block' }} />
                {isTeamAtLimit ? 'Limit Reached - Upgrade Required' : 'Invite User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="alert">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-[#0ea5e9] flex-shrink-0 mt-0.5" />
            <p>You are a viewer for this organization. Only admins can invite or remove users.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="alert error">
          <strong>Error</strong>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {inviteStatus && (
        <div className="alert success">
          <p>{inviteStatus}</p>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            Organization Members
          </h2>
        </div>
        <div className="card-body">
          {users.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No users linked to this organization yet.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>User ID</th>
                  <th>Role</th>
                  <th>Linked At</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={`${u.org_id}-${u.user_id}`}>
                    <td className="font-medium">{u.email ?? 'unknown'}</td>
                    <td className="font-mono text-xs text-slate-400">{u.user_id.slice(0, 12)}...</td>
                    <td>
                      <span className={`pill ${u.role === 'admin' ? 'bg-[#8b5cf6]/20 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="text-sm text-slate-400">{new Date(u.created_at).toLocaleString()}</td>
                    {isAdmin && (
                      <td>
                        <button
                          onClick={() => handleRemove(u.user_id)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
