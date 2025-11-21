import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from './api';

interface OrgWithRole {
  id: string;
  name: string;
  created_at: string;
  role: string;
}

interface MyOrgsResponse {
  orgs: OrgWithRole[];
}

interface CreateOrgResponse {
  org: { id: string; name: string; created_at: string };
}

export const MyOrgsPage: React.FC = () => {
  const api = useApi();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<OrgWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');

  const loadOrgs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<MyOrgsResponse>('/api/my-orgs');
      setOrgs(data.orgs);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load orgs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrgs();
  }, []);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<CreateOrgResponse>('/api/orgs', { name: orgName.trim() });
      setOrgName('');
      // Refresh my-orgs and navigate into the new one.
      await loadOrgs();
      navigate(`/orgs/${data.org.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create org');
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <h2>Your organizations</h2>
        <span>{orgs.length || 'No'} orgs</span>
      </div>
      <div className="card-body">
        <div className="form">
          <label htmlFor="new-org">
            Create new org
            <div className="form-row">
              <input
                id="new-org"
                type="text"
                placeholder="Acme Inc."
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <button type="button" onClick={handleCreateOrg} disabled={loading || !orgName.trim()}>
                Create
              </button>
            </div>
          </label>
        </div>

        {error && (
          <div className="alert error">
            <strong>Error: </strong>
            {error}
          </div>
        )}

        <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
          {orgs.length === 0 ? (
            <p className="muted">No orgs yet. Create one to get started.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td>{org.name}</td>
                    <td>
                      <span className="tag">{org.role}</span>
                    </td>
                    <td>{new Date(org.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => navigate(`/orgs/${org.id}`)}
                      >
                        Open
                      </button>
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


