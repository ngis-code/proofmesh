import React, { useState } from 'react';
import { computeSha256 } from './hash';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

interface StampResponse {
  proof: {
    id: string;
    status: string;
    hash: string;
  };
  validators: string[];
}

export const StampPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [orgId, setOrgId] = useState('');
  const [hash, setHash] = useState('');
  const [result, setResult] = useState<StampResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setHash('');
    setResult(null);
    setError(null);
  };

  const handleStamp = async () => {
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
      const res = await fetch(`${API_BASE}/api/stamp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId,
          hash: h,
          artifactType: 'file',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with ${res.status}`);
      }
      const data = (await res.json()) as StampResponse;
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Stamp failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Stamp</h2>
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

        <button type="button" onClick={handleStamp} disabled={loading}>
          {loading ? 'Stamping…' : 'Stamp'}
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
          <h3>Proof Result</h3>
          <p>
            <strong>Proof ID:</strong>
            {' '}
            {result.proof.id}
          </p>
          <p>
            <strong>Status:</strong>
            {' '}
            {result.proof.status}
          </p>
          <p>
            <strong>Validators:</strong>
            {' '}
            {result.validators.length > 0 ? result.validators.join(', ') : 'None'}
          </p>
        </div>
      )}
    </section>
  );
};


