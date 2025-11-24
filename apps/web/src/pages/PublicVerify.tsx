import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { computeSha256 } from '@/lib/hash';
import { useApi } from '@/lib/api';
import { ShieldCheck, Upload, Hash, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

type Mode = 'db_only' | 'db_plus_validators';

interface VerifyResponse {
  mode: Mode;
  status: 'valid' | 'unknown' | 'tampered' | 'low_confidence';
  validators_confirmed: number;
  validators_total: number;
}

export default function PublicVerifyPage() {
  const api = useApi();
  const [searchParams] = useSearchParams();
  const initialOrgId = (searchParams.get('orgId') || '').trim();
  const initialHash = (searchParams.get('hash') || '').trim();
  const [file, setFile] = useState<File | null>(null);
  const [orgId, setOrgId] = useState(initialOrgId);
  const [hash, setHash] = useState(initialHash);
  const [mode, setMode] = useState<Mode>('db_plus_validators');
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoVerified, setAutoVerified] = useState(false);

  // Auto-verify when URL has both orgId and hash
  useEffect(() => {
    if (initialOrgId && initialHash && !autoVerified) {
      setAutoVerified(true);
      handleAutoVerify(initialOrgId, initialHash);
    }
  }, [initialOrgId, initialHash, autoVerified]);

  const handleAutoVerify = async (orgIdParam: string, hashParam: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.postPublic<VerifyResponse>('/api/verify', {
        orgId: orgIdParam,
        hash: hashParam,
        mode,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Verify failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (!initialHash) {
      setHash('');
    }
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

  const getStatusIcon = () => {
    if (!result) return null;
    switch (result.status) {
      case 'valid':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'tampered':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    }
  };

  const getStatusClass = () => {
    if (!result) return '';
    switch (result.status) {
      case 'valid':
        return 'success';
      case 'tampered':
        return 'error';
      default:
        return '';
    }
  };

  // Show loading screen during auto-verify
  if (loading && autoVerified && !result && !error) {
    return (
      <div className="login-layout">
        <div className="login-card" style={{ maxWidth: '600px' }}>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#06b6d4] flex items-center justify-center shadow-xl mb-6 animate-pulse">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <Loader2 className="w-8 h-8 text-[#0ea5e9] animate-spin mb-4" />
            <h2 className="text-xl font-bold mb-2">Verifying Document</h2>
            <p className="text-slate-400 text-center">Checking authenticity with ProofMesh validators...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-layout">
      <div className="login-card" style={{ maxWidth: '600px' }}>
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#06b6d4] flex items-center justify-center shadow-xl">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">
            {initialHash ? 'Document Verification' : 'Public Verification'}
          </h1>
          <p className="text-slate-400">
            {initialHash 
              ? 'Verification results from ProofMesh network' 
              : 'Anyone can verify a file against a published organization using the ProofMesh network'}
          </p>
        </div>

        {/* Show results immediately for QR code scans */}
        {initialHash && result && (
          <div className={`alert ${getStatusClass()} mb-6`}>
            <div className="flex items-start gap-3">
              {getStatusIcon()}
              <div className="flex-1 space-y-3">
                <div className="font-semibold text-lg">
                  {result.status === 'valid' ? '✓ Document Verified' : '✗ Verification Failed'}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-3 rounded-lg bg-slate-900/50">
                    <span className="text-slate-400">Status:</span>
                    <span className={`pill ${result.status === 'valid' ? 'text-emerald-400' : 'text-red-400'} font-bold uppercase`}>
                      {result.status}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-slate-900/50">
                    <span className="text-slate-400">Verification Mode:</span>
                    <span className="text-slate-200 capitalize">{mode.replace('_', ' ')}</span>
                  </div>
                  {result.mode === 'db_plus_validators' && (
                    <div className="flex justify-between p-3 rounded-lg bg-slate-900/50">
                      <span className="text-slate-400">Validators Confirmed:</span>
                      <span className="text-slate-200 font-semibold">
                        {result.validators_confirmed} of {result.validators_total}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {initialHash && error && (
          <div className="alert error mb-6">
            <strong>Verification Error</strong>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Form - only show if not auto-verified from QR code */}
        {!initialHash && (
          <div className="form">
            <label>
              <span>Organization ID</span>
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Org UUID (published by the issuer)"
                readOnly={!!initialOrgId}
                className={initialOrgId ? 'bg-slate-900/60 text-slate-400 cursor-not-allowed' : undefined}
              />
            </label>

            <label>
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-slate-400" />
                Select File
              </span>
              <input
                type="file"
                onChange={handleFileChange}
              />
            </label>

            <label>
              <span>Verification Mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="db_only">Database Only (Fast)</option>
                <option value="db_plus_validators">Database + Validators (Thorough)</option>
              </select>
            </label>

            <button onClick={handleVerify} disabled={loading || !file || !orgId}>
              {loading ? 'Verifying…' : 'Verify File'}
            </button>
          </div>
        )}

        {/* Hash display - show for manual uploads */}
        {hash && !initialHash && (
          <div className="alert">
            <div className="flex items-start gap-3">
              <Hash className="w-5 h-5 text-[#0ea5e9] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold mb-2">Computed Hash:</div>
                <code className="text-xs break-all block p-3 bg-slate-900/70 rounded-lg border border-slate-700 text-slate-300">
                  {hash}
                </code>
              </div>
            </div>
          </div>
        )}

        {/* Hash display for QR code scans */}
        {initialHash && (
          <div className="alert">
            <div className="flex items-start gap-3">
              <Hash className="w-5 h-5 text-[#0ea5e9] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold mb-2">Document Hash:</div>
                <code className="text-xs break-all block p-3 bg-slate-900/70 rounded-lg border border-slate-700 text-slate-300">
                  {hash}
                </code>
              </div>
            </div>
          </div>
        )}

        {/* Error for manual uploads */}
        {error && !initialHash && (
          <div className="alert error">
            <strong>Error</strong>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Results for manual uploads */}
        {result && !initialHash && (
          <div className={`alert ${getStatusClass()}`}>
            <div className="flex items-start gap-3">
              {getStatusIcon()}
              <div className="flex-1 space-y-3">
                <div className="font-semibold">Verification Complete</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-3 rounded-lg bg-slate-900/50">
                    <span className="text-slate-400">Status:</span>
                    <span className={`pill ${result.status === 'valid' ? 'text-emerald-400' : 'text-red-400'} font-bold uppercase`}>
                      {result.status}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 rounded-lg bg-slate-900/50">
                    <span className="text-slate-400">Mode:</span>
                    <span className="text-slate-200 capitalize">{mode.replace('_', ' ')}</span>
                  </div>
                  {result.mode === 'db_plus_validators' && (
                    <div className="flex justify-between p-3 rounded-lg bg-slate-900/50">
                      <span className="text-slate-400">Validators:</span>
                      <span className="text-slate-200">
                        {result.validators_confirmed}/{result.validators_total} confirmed
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
