import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

interface Org {
  id: string;
  name: string;
  created_at: string;
}

interface Validator {
  id: string;
  name: string;
  region: string;
  enabled: boolean;
  created_at: string;
}

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

interface OrgsResponse {
  orgs: Org[];
}

interface ValidatorsResponse {
  validators: Validator[];
}

interface ProofsResponse {
  proofs: Proof[];
}

interface ValidatorRunsResponse {
  validatorRuns: ValidatorRun[];
}

export const ProofsPage: React.FC = () => {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [validatorRuns, setValidatorRuns] = useState<ValidatorRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgRes, valRes, proofRes, runsRes] = await Promise.all([
        fetch(`${API_BASE}/api/orgs`),
        fetch(`${API_BASE}/api/validators`),
        fetch(`${API_BASE}/api/proofs?limit=100`),
        fetch(`${API_BASE}/api/validator-runs?limit=100`),
      ]);

      if (!orgRes.ok || !valRes.ok || !proofRes.ok || !runsRes.ok) {
        throw new Error('One or more debug queries failed');
      }

      const orgData = (await orgRes.json()) as OrgsResponse;
      const valData = (await valRes.json()) as ValidatorsResponse;
      const proofData = (await proofRes.json()) as ProofsResponse;
      const runsData = (await runsRes.json()) as ValidatorRunsResponse;

      setOrgs(orgData.orgs);
      setValidators(valData.validators);
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

  return (
    <section>
      <h2>Debug Data (CockroachDB)</h2>
      <button
        type="button"
        onClick={loadAll}
        disabled={loading}
      >
        {loading ? 'Refreshing…' : 'Refresh all'}
      </button>

      {error && (
        <div className="panel error" style={{ marginTop: '1rem' }}>
          <strong>Error:</strong>
          {' '}
          {error}
        </div>
      )}

      <div className="panel" style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <h3>Orgs</h3>
        {orgs.length === 0 ? (
          <p>No orgs.</p>
        ) : (
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">ID</th>
                <th align="left">Name</th>
                <th align="left">Created</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.name}</td>
                  <td>{new Date(o.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <h3>Validators</h3>
        {validators.length === 0 ? (
          <p>No validators.</p>
        ) : (
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">ID</th>
                <th align="left">Name</th>
                <th align="left">Region</th>
                <th align="left">Enabled</th>
                <th align="left">Created</th>
              </tr>
            </thead>
            <tbody>
              {validators.map((v) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.name}</td>
                  <td>{v.region}</td>
                  <td>{v.enabled ? 'true' : 'false'}</td>
                  <td>{new Date(v.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <h3>Proofs (latest 100)</h3>
        {proofs.length === 0 ? (
          <p>No proofs yet.</p>
        ) : (
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Created</th>
                <th align="left">Status</th>
                <th align="left">Org</th>
                <th align="left">Hash</th>
                <th align="left">Type</th>
                <th align="left">Artifact ID</th>
                <th align="left">Version Of</th>
              </tr>
            </thead>
            <tbody>
              {proofs.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td>{p.status}</td>
                  <td>{p.org_id}</td>
                  <td>
                    <code>{p.hash}</code>
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

      <div className="panel" style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <h3>Validator Runs (latest 100)</h3>
        {validatorRuns.length === 0 ? (
          <p>No validator runs yet.</p>
        ) : (
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Signed</th>
                <th align="left">Validator</th>
                <th align="left">Proof</th>
                <th align="left">Result</th>
                <th align="left">Latency (ms)</th>
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
    </section>
  );
};



