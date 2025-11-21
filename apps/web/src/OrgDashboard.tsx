import React, { useEffect, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useApi } from './api';
import { StampPage } from './StampPage';
import { VerifyPage } from './VerifyPage';
import { ProofsPage } from './ProofsPage';

interface Org {
  id: string;
  name: string;
  created_at: string;
}

interface OrgUsersResponse {
  users: {
    org_id: string;
    user_id: string;
    role: string;
    created_at: string;
  }[];
}

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

interface OrgsResponse {
  orgs: Org[];
}

interface MyOrgEntry extends Org {
  role: string;
}

interface MyOrgsResponse {
  orgs: MyOrgEntry[];
}

interface ValidatorsResponse {
  validators: {
    id: string;
    name: string;
    region: string;
    enabled: boolean;
    online?: boolean;
    created_at: string;
    last_seen_at?: string | null;
  }[];
}

interface ProofsResponse {
  proofs: {
    id: string;
    org_id: string;
    hash: string;
    artifact_type: string;
    artifact_id: string | null;
    version_of: string | null;
    status: string;
    created_at: string;
  }[];
}

export const OrgDashboard: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const api = useApi();
  const navigate = useNavigate();
  const [org, setOrg] = useState<Org | null>(null);
  const [role, setRole] = useState<'admin' | 'viewer' | null>(null);
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
        const [allOrgs, myOrgs, validators, proofs] = await Promise.all([
          api.get<OrgsResponse>('/api/orgs'),
          api.get<MyOrgsResponse>('/api/my-orgs'),
          api.get<ValidatorsResponse>('/api/validators'),
          api.get<ProofsResponse>('/api/proofs?limit=100'),
        ]);

        const foundOrg = allOrgs.orgs.find((o) => o.id === orgId) ?? null;
        setOrg(foundOrg);
        if (!foundOrg) {
          setError('Org not found');
        }

        const myEntry = myOrgs.orgs.find((o) => o.id === orgId) ?? null;
        setRole((myEntry?.role as 'admin' | 'viewer') ?? 'viewer');

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

  return (
    <>
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-title">
          <h2>{org ? org.name : 'Org'}</h2>
          <span>
            <span className="tag" style={{ marginRight: '0.35rem' }}>
              {role ?? 'viewer'}
            </span>
            <span className="muted">
              Org ID:
              {' '}
              <span className="code">{orgId}</span>
            </span>
          </span>
        </div>
        <div className="card-body">
          <div className="card-grid">
            <div>
              <div className="muted">Recent proofs (last 100)</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 500 }}>
                {recentProofs ?? '…'}
              </div>
            </div>
            <div>
              <div className="muted">Validators online (all regions)</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 500 }}>
                {onlineValidators ?? '…'}
              </div>
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

      {loading && !org && <div className="muted">Loading org…</div>}

      <div className="tabs" style={{ marginBottom: '0.85rem' }}>
        <button
          type="button"
          className="tab"
          onClick={() => navigate(`/orgs/${orgId}`)}
        >
          Overview
        </button>
        <button
          type="button"
          className="tab"
          onClick={() => navigate(`/orgs/${orgId}/keys`)}
        >
          API keys
        </button>
        <button
          type="button"
          className="tab"
          onClick={() => navigate(`/orgs/${orgId}/users`)}
        >
          Users
        </button>
        <button
          type="button"
          className="tab"
          onClick={() => navigate(`/orgs/${orgId}/stamp`)}
        >
          Stamp
        </button>
        <button
          type="button"
          className="tab"
          onClick={() => navigate(`/orgs/${orgId}/verify`)}
        >
          Verify
        </button>
        <button
          type="button"
          className="tab"
          onClick={() => navigate(`/orgs/${orgId}/proofs`)}
        >
          Proofs
        </button>
      </div>

      <Routes>
        <Route
          index
          element={(
            <div className="card-grid">
              <div className="card">
                <div className="card-title">
                  <h2>Org overview</h2>
                  <span>Metadata</span>
                </div>
                <div className="card-body">
                  {org ? (
                    <>
                      <p>
                        <strong>Name:</strong>
                        {' '}
                        {org.name}
                      </p>
                      <p>
                        <strong>Created:</strong>
                        {' '}
                        {new Date(org.created_at).toLocaleString()}
                      </p>
                      <p className="muted">
                        This org is backed by CockroachDB and participates in the ProofMesh validator mesh.
                      </p>
                    </>
                  ) : (
                    <p className="muted">No org metadata loaded.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        />
        <Route path="keys" element={<OrgApiKeysTab isAdmin={role === 'admin'} />} />
        <Route path="users" element={<OrgUsersTab isAdmin={role === 'admin'} />} />
        <Route path="stamp" element={<StampPage orgId={orgId} />} />
        <Route path="verify" element={<VerifyPage orgId={orgId} />} />
        <Route path="proofs" element={<ProofsPage filterOrgId={orgId} />} />
      </Routes>
    </>
  );
};

const OrgUsersTab: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const api = useApi();
  const { orgId } = useParams<{ orgId: string }>();
  const [users, setUsers] = useState<OrgUsersResponse['users']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<OrgUsersResponse>(`/api/orgs/${orgId}/users`);
      setUsers(data.users);
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
    if (!orgId || !userId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/orgs/${orgId}/users`, { userId: userId.trim(), role });
      setUserId('');
      await load();
    } catch (err: any) {
      setError(err.message ?? 'Failed to add user');
      setLoading(false);
    }
  };

  const handleRemove = async (targetUserId: string) => {
    if (!isAdmin) return;
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/orgs/${orgId}/users/${targetUserId}/remove`);
      await load();
    } catch (err: any) {
      setError(err.message ?? 'Failed to remove user');
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <h2>Users & roles</h2>
        <span>Appwrite user IDs</span>
      </div>
      <div className="card-body">
        {isAdmin ? (
          <div className="form">
            <div className="form-row">
              <label htmlFor="userId">
                Appwrite user ID
                <input
                  id="userId"
                  type="text"
                  placeholder="Appwrite $id"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </label>
              <label htmlFor="role">
                Role
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'viewer')}
                >
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
            <button type="button" onClick={handleAdd} disabled={loading || !userId.trim()}>
              Add / update user
            </button>
          </div>
        ) : (
          <p className="muted">
            You are a viewer for this org. Only admins can add or remove org users.
          </p>
        )}

        {error && (
          <div className="alert error">
            <strong>Error: </strong>
            {error}
          </div>
        )}

        <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
          {users.length === 0 ? (
            <p className="muted">No users linked to this org yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Role</th>
                  <th>Linked at</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={`${u.org_id}-${u.user_id}`}>
                    <td className="code">{u.user_id}</td>
                    <td>
                      <span className="tag">{u.role}</span>
                    </td>
                    <td>{new Date(u.created_at).toLocaleString()}</td>
                    <td>
                      {isAdmin && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleRemove(u.user_id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const OrgApiKeysTab: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const api = useApi();
  const { orgId } = useParams<{ orgId: string }>();
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
      await api.post(`/api/orgs/${orgId}/api-keys/${id}/revoke`);
      await load();
    } catch (err: any) {
      setError(err.message ?? 'Failed to revoke API key');
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <h2>Org API keys</h2>
        <span>Server-to-server access</span>
      </div>
      <div className="card-body">
        {isAdmin ? (
          <div className="form">
            <div className="form-row">
              <label htmlFor="key-label">
                Label
                <input
                  id="key-label"
                  type="text"
                  placeholder="backend-1 / ci / data-pipeline"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              <label htmlFor="rate">
                Rate limit (per minute)
                <input
                  id="rate"
                  type="text"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                />
              </label>
            </div>
            <button type="button" onClick={handleCreateKey} disabled={loading}>
              Create API key
            </button>
          </div>
        ) : (
          <p className="muted">
            You are a viewer for this org. Only admins can create and revoke API keys.
          </p>
        )}

        {showRawKey && (
          <div className="alert success">
            <strong>New API key created.</strong>
            {' '}
            Copy this now – it won&apos;t be shown again:
            <div className="code" style={{ marginTop: '0.25rem' }}>{showRawKey}</div>
            <div className="muted" style={{ marginTop: '0.35rem' }}>
              Example usage (Node.js):
            </div>
            <pre className="code" style={{ marginTop: '0.15rem' }}>
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
        )}

        {error && (
          <div className="alert error">
            <strong>Error: </strong>
            {error}
          </div>
        )}

        <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
          {keys.length === 0 ? (
            <p className="muted">No API keys yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Scopes</th>
                  <th>Rate/min</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>{k.label ?? '-'}</td>
                    <td>
                      {k.scopes.map((s) => (
                        <span key={s} className="tag" style={{ marginRight: '0.25rem' }}>
                          {s}
                        </span>
                      ))}
                    </td>
                    <td>{k.rate_limit_per_minute ?? '-'}</td>
                    <td>{new Date(k.created_at).toLocaleString()}</td>
                    <td>{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '-'}</td>
                    <td>
                      {k.revoked_at ? (
                        <span className="tag red">revoked</span>
                      ) : (
                        <span className="tag green">active</span>
                      )}
                    </td>
                    <td>
                      {isAdmin && !k.revoked_at && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleRevoke(k.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};


