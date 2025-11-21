import React, { useEffect, useState } from 'react';
import { useApi } from './api';

interface Validator {
  id: string;
  name: string;
  region: string;
  enabled: boolean;
  online: boolean;
  created_at: string;
  last_seen_at: string | null;
}

interface ValidatorsResponse {
  validators: Validator[];
}

interface ValidatorStatsRow {
  validator_id: string;
  total_runs: number;
  total_valid: number;
  total_invalid: number;
  total_unknown: number;
  last_seen_at: string | null;
}

interface ValidatorStatsResponse {
  stats: ValidatorStatsRow[];
}

interface HealthResponse {
  status: string;
}

export const NetworkPage: React.FC = () => {
  const api = useApi();
  const [validators, setValidators] = useState<Validator[]>([]);
  const [stats, setStats] = useState<ValidatorStatsRow[]>([]);
  const [health, setHealth] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, validatorsRes, statsRes] = await Promise.all([
        api.get<HealthResponse>('/api/health'),
        api.get<ValidatorsResponse>('/api/validators'),
        api.get<ValidatorStatsResponse>('/api/validator-stats'),
      ]);
      setHealth(healthRes.status);
      setValidators(validatorsRes.validators);
      setStats(statsRes.stats);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load network data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onlineCount = validators.filter((v) => v.online).length;

  return (
    <div className="card">
      <div className="card-title">
        <h2>Network health</h2>
        <span>Validators & stats</span>
      </div>
      <div className="card-body">
        <button type="button" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>

        {error && (
          <div className="alert error" style={{ marginTop: '0.5rem' }}>
            <strong>Error: </strong>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
          <div className="pill">
            <span className="pill-dot" />
            API health:
            {' '}
            {health ?? 'unknown'}
          </div>
          <div className="pill">
            Validators online:
            {' '}
            {onlineCount}
            /
            {validators.length}
          </div>
        </div>

        <div className="table-wrapper" style={{ marginTop: '0.5rem' }}>
          <h3 style={{ margin: '0 0 0.35rem' }}>Validators</h3>
          {validators.length === 0 ? (
            <p className="muted">No validators registered.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Region</th>
                  <th>Status</th>
                  <th>Enabled</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {validators.map((v) => (
                  <tr key={v.id}>
                    <td className="code">{v.id}</td>
                    <td>{v.name}</td>
                    <td>{v.region}</td>
                    <td>
                      <span className={`tag ${v.online ? 'green' : 'red'}`}>
                        {v.online ? 'online' : 'offline'}
                      </span>
                    </td>
                    <td>{v.enabled ? 'true' : 'false'}</td>
                    <td>{v.last_seen_at ? new Date(v.last_seen_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.35rem' }}>Validator stats</h3>
          {stats.length === 0 ? (
            <p className="muted">No validator stats yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Validator</th>
                  <th>Total runs</th>
                  <th>Valid</th>
                  <th>Invalid</th>
                  <th>Unknown</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.validator_id}>
                    <td className="code">{s.validator_id}</td>
                    <td>{s.total_runs}</td>
                    <td>{s.total_valid}</td>
                    <td>{s.total_invalid}</td>
                    <td>{s.total_unknown}</td>
                    <td>{s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : '-'}</td>
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


