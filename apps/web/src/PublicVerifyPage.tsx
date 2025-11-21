import React, { useState } from 'react';
import { computeSha256 } from './hash';
import { useApi } from './api';

type Mode = 'db_only' | 'db_plus_validators';

interface VerifyResponse {
  mode: Mode;
  status: 'valid' | 'unknown' | 'tampered' | 'low_confidence';
  validators_confirmed: number;
  validators_total: number;
}

export const PublicVerifyPage: React.FC = () => {
  const api = useApi();
  const [file, setFile] = useState<File | null>(null);
  const [orgId, setOrgId] = useState('');
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
    if (!orgId.trim()) {
      setError('Please enter the orgId to verify against');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const h = await computeSha256(file);
      setHash(h);
      const data = await api.postPublic<VerifyResponse>('/api/verify', {
        orgId: orgId.trim(),
        hash: h,
        mode,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Verify failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-card">
        <h1>Public verify</h1>
        <p>Anyone can verify a file against a published orgId using the ProofMesh network.</p>

        <div className="form">
          <label htmlFor="orgId">
            Org ID
            <input
              id="orgId"
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Org UUID (published by the issuer)"
            />
          </label>

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
          </div>
        )}
      </div>
    </div>
  );
};


