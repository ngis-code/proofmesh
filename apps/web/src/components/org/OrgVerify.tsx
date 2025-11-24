import { useState } from 'react';
import { computeSha256 } from '@/lib/hash';
import { useApi } from '@/lib/api';
import { ShieldCheck, Upload, Hash, CheckCircle2, XCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { useOrgUsage } from '@/hooks/useOrgUsage';

type Mode = 'db_only' | 'db_plus_validators';

interface VerifyResponse {
  mode: Mode;
  status: 'valid' | 'unknown' | 'tampered' | 'low_confidence';
  validators_confirmed: number;
  validators_total: number;
}

interface OrgVerifyProps {
  orgId: string;
}

export default function OrgVerify({ orgId }: OrgVerifyProps) {
  const api = useApi();
  const { usage, loading: usageLoading, error: usageError, refetch, isOpsAtLimit } = useOrgUsage(orgId);
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
    
    if (isOpsAtLimit) {
      setError(`Monthly verification limit reached (${usage?.monthly_ops.limit} verifications). Upgrade your plan for more.`);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const h = await computeSha256(file);
      setHash(h);
      const data = await api.postPublic<VerifyResponse>('/api/verify', {
        orgId,
        hash: h,
        mode,
      });
      setResult(data);
      await refetch();
    } catch (err: any) {
      if (err.message === 'LIMIT_REACHED') {
        setError('You have reached the monthly operations limit for your plan.');
      } else {
        setError(err.message ?? 'Verify failed');
      }
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

  if (usageLoading) {
    return <div className="text-slate-400">Loading...</div>;
  }

  if (usageError) {
    return <div className="text-red-400">Error: {usageError}</div>;
  }

  if (!usage) {
    return <div className="text-slate-400">No data available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-title">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#06b6d4] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            Verify File
          </h2>
          <span className="text-sm text-slate-400">Check file authenticity against blockchain records</span>
        </div>

        <div className="card-body space-y-4">
          {isOpsAtLimit && (
            <div className="mb-2 bg-amber-950/30 border border-amber-900/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-400 mb-1">Monthly Verification Limit Reached</p>
                  <p className="text-sm text-slate-300">
                    You've used all {usage.monthly_ops.limit} verifications for your {usage.plan} plan this month.
                    Upgrade to continue verifying files.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Upload className="w-4 h-4 text-slate-400" />
              Select File
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              className="w-full"
              disabled={isOpsAtLimit}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="mode" className="text-sm font-medium text-slate-300">
              Verification Mode
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              disabled={isOpsAtLimit}
            >
              <option value="db_only">Database Only (Fast)</option>
              <option value="db_plus_validators">Database + Validators (Thorough)</option>
            </select>
          </div>

          <button onClick={handleVerify} disabled={loading || !file || isOpsAtLimit}>
            {loading ? 'Verifying…' : isOpsAtLimit ? 'Limit Reached - Upgrade Required' : 'Verify File'}
          </button>

          {hash && (
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

          {error && (
            <div className="alert error">
              <strong>Error</strong>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {result && (
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
    </div>
  );
}
