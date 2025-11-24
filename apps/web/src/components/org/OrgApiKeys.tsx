import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';
import { Key, Plus, Copy, XCircle, Eye } from 'lucide-react';

interface ApiKeysResponse {
  apiKeys: {
    id: string;
    org_id: string;
    label: string | null;
    scopes: string[];
    rate_limit_per_minute: number | null;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
  }[];
}

interface CreateApiKeyResponse {
  apiKey: ApiKeysResponse['apiKeys'][number];
  rawKey: string;
}

interface OrgApiKeysProps {
  orgId: string;
  isAdmin: boolean;
}

export default function OrgApiKeys({ orgId, isAdmin }: OrgApiKeysProps) {
  const api = useApi();
  const [keys, setKeys] = useState<ApiKeysResponse['apiKeys']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [rateLimit, setRateLimit] = useState('600');
  const [showRawKey, setShowRawKey] = useState<string | null>(null);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ApiKeysResponse>(`/api/orgs/${orgId}/api-keys`);
      setKeys(data.apiKeys);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [orgId]);

  const handleCreateKey = async () => {
    if (!orgId || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const rate = rateLimit ? Number(rateLimit) : null;
      const data = await api.post<CreateApiKeyResponse>(`/api/orgs/${orgId}/api-keys`, {
        label: label || null,
        scopes: ['read', 'write'],
        rateLimitPerMinute: rate,
      });
      setLabel('');
      setRateLimit('600');
      setShowRawKey(data.rawKey);
      await load();
    } catch (err: any) {
      setError(err.message ?? 'Failed to create API key');
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/orgs/${orgId}/api-keys/${id}/revoke`, {});
      await load();
    } catch (err: any) {
      setError(err.message ?? 'Failed to revoke API key');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="card">
          <div className="card-title">
            <h2 className="text-xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              Create New API Key
            </h2>
          </div>
          <div className="card-body">
            <div className="form">
              <div className="form-row">
                <label>
                  <span>Label</span>
                  <input
                    type="text"
                    placeholder="backend-1 / ci / data-pipeline"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </label>
                <label>
                  <span>Rate Limit (per minute)</span>
                  <input
                    type="text"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                  />
                </label>
              </div>
              <button onClick={handleCreateKey} disabled={loading}>
                <Plus className="w-4 h-4 mr-2" style={{ display: 'inline-block' }} />
                Create API Key
              </button>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="alert">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-[#0ea5e9] flex-shrink-0 mt-0.5" />
            <p>You are a viewer for this organization. Only admins can create and revoke API keys.</p>
          </div>
        </div>
      )}

      {showRawKey && (
        <div className="alert success">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div className="font-semibold">New API Key Created</div>
              <p className="text-sm text-slate-400">Copy this key now – it won't be shown again:</p>
              <div className="relative">
                <code className="block p-3 bg-slate-900/70 rounded-lg text-xs break-all text-slate-300 border border-slate-700">
                  {showRawKey}
                </code>
                <button
                  className="absolute top-2 right-2 p-1 hover:bg-slate-800 rounded"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onClick={() => navigator.clipboard.writeText(showRawKey)}
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="mt-4">
                <div className="text-sm font-semibold mb-2">Example usage (Node.js):</div>
                <pre className="p-3 bg-slate-900/70 rounded-lg text-xs overflow-x-auto border border-slate-700 text-slate-300">
{`const res = await fetch('https://api.proofmesh.com/api/stamp', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': '${showRawKey}',
  },
  body: JSON.stringify({
    orgId: '${orgId}',
    hash: 'SHA256:...',
    artifactType: 'file',
  }),
});`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert error">
          <strong>Error</strong>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] flex items-center justify-center">
              <Key className="w-5 h-5 text-white" />
            </div>
            Active API Keys
          </h2>
        </div>
        <div className="card-body">
          {keys.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No API keys created yet.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Scopes</th>
                  <th>Rate/min</th>
                  <th>Created</th>
                  <th>Status</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="font-medium">{k.label ?? '-'}</td>
                    <td>
                      <div className="flex gap-1">
                        {k.scopes.map((s) => (
                          <span key={s} className="pill" style={{ fontSize: '0.7rem' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{k.rate_limit_per_minute ?? '-'}</td>
                    <td className="text-slate-400 text-sm">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={`pill ${k.revoked_at ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {k.revoked_at ? 'Revoked' : 'Active'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        {!k.revoked_at && (
                          <button
                            onClick={() => handleRevoke(k.id)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
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
