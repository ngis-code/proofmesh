import React, { useState } from 'react';
import { computeSha256 } from './hash';
import { useApi } from './api';

interface StampResponse {
  proof: {
    id: string;
    status: string;
    hash: string;
  };
  validators: string[];
}

export const StampPage: React.FC<{ orgId: string }> = ({ orgId }) => {
  const api = useApi();
  const [file, setFile] = useState<File | null>(null);
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
    setLoading(true);
    setError(null);
    try {
      const h = await computeSha256(file);
      setHash(h);
      const data = await api.post<StampResponse>('/api/stamp', {
        orgId,
        hash: h,
        artifactType: 'file',
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Stamp failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <h2>Stamp file</h2>
        <span>Hash + send to validators</span>
      </div>
      <div className="card-body">
        <div className="form">
          <label htmlFor="file">
            File
            <input id="file" type="file" onChange={handleFileChange} />
          </label>

          <button type="button" onClick={handleStamp} disabled={loading}>
            {loading ? 'Stamping…' : 'Stamp'}
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
            <strong>Proof created.</strong>
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
      </div>
    </div>
  );
};

