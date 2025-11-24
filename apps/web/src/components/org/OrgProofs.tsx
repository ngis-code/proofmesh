import { useEffect, useState } from 'react';
import { useApi } from '@/lib/api';
import { FileText, RefreshCcw } from 'lucide-react';

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

interface ProofsResponse {
  proofs: Proof[];
}

interface OrgProofsProps {
  orgId: string;
}

export default function OrgProofs({ orgId }: OrgProofsProps) {
  const api = useApi();
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const proofData = await api.get<ProofsResponse>('/api/proofs?limit=100');
      setProofs(proofData.proofs);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load proofs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const visibleProofs = proofs.filter((p) => p.org_id === orgId);

  return (
    <div className="space-y-6">
      {error && (
        <div className="alert error">
          <strong>Error</strong>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ec4899] to-[#db2777] flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            Proofs
          </h2>
          <button onClick={loadAll} disabled={loading} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} style={{ display: 'inline-block' }} />
            Refresh
          </button>
        </div>
        <div className="card-body">
          {visibleProofs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No proofs yet. Start by stamping a file.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Hash</th>
                  <th>Type</th>
                  <th>Artifact ID</th>
                </tr>
              </thead>
              <tbody>
                {visibleProofs.map((p) => (
                  <tr key={p.id}>
                    <td className="text-sm text-slate-400">{new Date(p.created_at).toLocaleString()}</td>
                    <td>
                      <span className="pill bg-emerald-500/20 text-emerald-300">{p.status}</span>
                    </td>
                    <td className="font-mono text-xs text-slate-400">{p.hash.slice(0, 16)}...</td>
                    <td>{p.artifact_type}</td>
                    <td className="font-mono text-xs text-slate-400">
                      {p.artifact_id?.slice(0, 8) ?? '-'}
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
}
