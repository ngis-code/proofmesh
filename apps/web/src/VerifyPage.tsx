import React, { useState } from 'react';
import { computeSha256 } from './hash';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

type Mode = 'db_only' | 'db_plus_validators';

interface VerifyResponse {
  mode: Mode;
  status: 'valid' | 'unknown' | 'tampered' | 'low_confidence';
  validators_confirmed: number;
  validators_total: number;
}

export const VerifyPage: React.FC = () => {
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
    if (!orgId) {
      setError('Please enter an orgId');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const h = await computeSha256(file);
      setHash(h);
      const res = await fetch(`${API_BASE}/api/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId,
          hash: h,
          mode,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with ${res.status}`);
      }
      const data = (await res.json()) as VerifyResponse;
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Verify failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Verify</h2>
      <div className="form">
        <label htmlFor="orgId">
          Org ID
          <input
            id="orgId"
            type="text"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="Enter org UUID"
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
        <div className="panel">
          <h3>Computed Hash</h3>
          <code>{hash}</code>
        </div>
      )}

      {error && (
        <div className="panel error">
          <strong>Error:</strong>
          {' '}
          {error}
        </div>
      )}

      {result && (
        <div className="panel">
          <h3>Verification Result</h3>
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
    </section>
  );
};


