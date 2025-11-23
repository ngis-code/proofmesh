import React, { useState } from 'react';
import { computeSha256 } from './hash';
import { useApi } from './api';

type Mode = 'db_only' | 'db_plus_validators';

interface ProofSummary {
  id: string;
  hash: string;
  artifact_type: string;
  artifact_id: string | null;
  version_of: string | null;
  status: string;
  created_at: string;
}

interface VerifyResponse {
  mode: Mode;
  status: 'valid' | 'unknown' | 'tampered' | 'low_confidence';
  validators_confirmed: number;
  validators_total: number;
  proofs?: ProofSummary[];
}

export const VerifyPage: React.FC<{ orgId: string }> = ({ orgId }) => {
  const api = useApi();
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState('');
  const [mode, setMode] = useState<Mode>('db_only');
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setHash('');
    setResult(null);
    setError(null);
  };

  const handleVerify = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const h = await computeSha256(file);
      setHash(h);
      // /api/verify is public; use postPublic.
      const data = await api.postPublic<VerifyResponse>('/api/verify', {
        orgId,
        hash: h,
        mode,
      });
      // Collapse any duplicate proofs with identical logical keys so the
      // UI remains readable even if historical data contains dupes.
      if (data.proofs && data.proofs.length > 1) {
        const seen = new Map<string, ProofSummary>();
        for (const p of data.proofs) {
          const key = [
            p.hash,
            p.artifact_type,
            p.artifact_id ?? '',
            p.version_of ?? '',
          ].join('|');
          const existing = seen.get(key);
          if (!existing) {
            seen.set(key, p);
          } else {
            // Keep the most recent proof by created_at for this logical key.
            if (new Date(p.created_at).getTime() > new Date(existing.created_at).getTime()) {
              seen.set(key, p);
            }
          }
        }
        data.proofs = Array.from(seen.values());
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Verify failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <h2>Verify file</h2>
        <span>Check against known proofs</span>
      </div>
      <div className="card-body">
        <div className="form">
          <label htmlFor="file">
            File
            <input id="file" type="file" onChange={handleFileChange} />
          </label>

          <label htmlFor="mode">
            Mode
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="db_only">DB only</option>
              <option value="db_plus_validators">DB + validators</option>
            </select>
          </label>

          <button type="button" onClick={handleVerify} disabled={loading}>
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </div>

        {hash && (
          <div className="alert">
            <div className="muted">Computed hash:</div>
            <div className="code">{hash}</div>
          </div>
        )}

        {error && (
          <div className="alert error">
            <strong>Error: </strong>
            {error}
          </div>
        )}

        {result && (
          <div className="alert success">
            <strong>Verification result:</strong>
            <p>
              <strong>Status:</strong>
              {' '}
              {result.status}
            </p>
            <p>
              <strong>Validators confirmed:</strong>
              {' '}
              {result.validators_confirmed}
              /
              {result.validators_total}
            </p>
            {result.proofs && result.proofs.length > 0 && (
              <div className="mt-2">
                <strong>Matching proofs:</strong>
                <ul>
                  {result.proofs.map((p) => (
                    <li key={p.id}>
                      <span className="code">{p.id}</span>
                      {' '}
                      (
                      {p.status}
                      , created
                      {' '}
                      {new Date(p.created_at).toLocaleString()}
                      )
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

