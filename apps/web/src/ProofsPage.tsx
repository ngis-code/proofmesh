import React, { useEffect, useState } from 'react';
import { useApi } from './api';

interface Proof {
  id: string;
  org_id: string;
  hash: string;
  artifact_type: string;
  artifact_id: string | null;
  version_of: string | null;
  status: string;
  created_at: string;
}

interface ValidatorRun {
  id: string;
  proof_id: string;
  validator_id: string;
  result: string;
  signed_at: string;
  latency_ms: number | null;
}

interface ProofsResponse {
  proofs: Proof[];
}

interface ValidatorRunsResponse {
  validatorRuns: ValidatorRun[];
}

export const ProofsPage: React.FC<{ filterOrgId?: string }> = ({ filterOrgId }) => {
  const api = useApi();
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [validatorRuns, setValidatorRuns] = useState<ValidatorRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [proofData, runsData] = await Promise.all([
        api.get<ProofsResponse>('/api/proofs?limit=100'),
        api.get<ValidatorRunsResponse>('/api/validator-runs?limit=100'),
      ]);

      setProofs(proofData.proofs);
      setValidatorRuns(runsData.validatorRuns);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load debug data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const visibleProofs = filterOrgId ? proofs.filter((p) => p.org_id === filterOrgId) : proofs;

  return (
    <div className="card">
      <div className="card-title">
        <h2>Proofs & validator runs</h2>
        <span>Latest 100 records</span>
      </div>
      <div className="card-body">
        <button type="button" onClick={loadAll} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>

        {error && (
          <div className="alert error" style={{ marginTop: '0.5rem' }}>
            <strong>Error: </strong>
            {error}
          </div>
        )}

        <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.35rem' }}>Proofs</h3>
          {visibleProofs.length === 0 ? (
            <p className="muted">No proofs yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  {!filterOrgId && <th>Org</th>}
                  <th>Status</th>
                  <th>Hash</th>
                  <th>Type</th>
                  <th>Artifact ID</th>
                  <th>Version Of</th>
                </tr>
              </thead>
              <tbody>
                {visibleProofs.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.created_at).toLocaleString()}</td>
                    {!filterOrgId && <td>{p.org_id}</td>}
                    <td>{p.status}</td>
                    <td>
                      <span className="code">{p.hash}</span>
                    </td>
                    <td>{p.artifact_type}</td>
                    <td>{p.artifact_id ?? '-'}</td>
                    <td>{p.version_of ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.35rem' }}>Validator runs</h3>
          {validatorRuns.length === 0 ? (
            <p className="muted">No validator runs yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Signed</th>
                  <th>Validator</th>
                  <th>Proof</th>
                  <th>Result</th>
                  <th>Latency (ms)</th>
                </tr>
              </thead>
              <tbody>
                {validatorRuns.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.signed_at).toLocaleString()}</td>
                    <td>{r.validator_id}</td>
                    <td>{r.proof_id}</td>
                    <td>{r.result}</td>
                    <td>{r.latency_ms ?? '-'}</td>
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



