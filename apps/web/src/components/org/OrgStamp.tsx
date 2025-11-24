import { useState } from 'react';
import { computeSha256 } from '@/lib/hash';
import { useApi } from '@/lib/api';
import { FileCheck2, Upload, Hash, CheckCircle2, AlertCircle, FileText, Image, Film, FileSpreadsheet, FileCode, Music, Archive, Download } from 'lucide-react';
import { useOrgUsage } from '@/hooks/useOrgUsage';
import { Badge } from '@/components/ui/badge';
import { generateCertificateOfAuthenticity } from '@/lib/certificate-generator';

interface StampResponse {
  proof: {
    id: string;
    status: string;
    hash: string;
  };
  validators: string[];
}

interface OrgStampProps {
  orgId: string;
}

type StampingStep = 'idle' | 'hashing' | 'stamping' | 'generating-cert' | 'complete' | 'error';

// File type helpers
const getFileIcon = (fileName: string) => {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return FileText;
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'heic', 'tiff'].includes(ext)) return Image;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'].includes(ext)) return Film;
  if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext)) return FileSpreadsheet;
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml', 'srt', 'vtt', 'md'].includes(ext)) return FileCode;
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'].includes(ext)) return Music;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return Archive;
  return FileText;
};

const getFileCategory = (fileName: string): string => {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'Document';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'heic', 'tiff'].includes(ext)) return 'Image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'].includes(ext)) return 'Video';
  if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext)) return 'Spreadsheet';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml', 'srt', 'vtt', 'md'].includes(ext)) return 'Code/Text';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'].includes(ext)) return 'Audio';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'Archive';
  return 'File';
};

export default function OrgStamp({ orgId }: OrgStampProps) {
  const api = useApi();
  const { usage, loading: usageLoading, error: usageError, refetch, isOpsAtLimit } = useOrgUsage(orgId);
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState('');
  const [result, setResult] = useState<StampResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<StampingStep>('idle');
  const [certificateBlob, setCertificateBlob] = useState<Blob | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setHash('');
    setResult(null);
    setError(null);
    setStep('idle');
    setCertificateBlob(null);
  };

  const handleStamp = async () => {
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
    setStep('hashing');
    
    try {
      // Step 1: Compute hash
      const h = await computeSha256(file);
      setHash(h);
      
      // Step 2: Create stamp
      setStep('stamping');
      const data = await api.post<StampResponse>('/api/stamp', {
        orgId,
        hash: h,
        artifactType: getFileCategory(file.name).toLowerCase(),
        artifactId: file.name,
      });
      setResult(data);
      
      // Step 3: Generate certificate
      setStep('generating-cert');
      const certificateBuffer = await generateCertificateOfAuthenticity({
        orgId,
        hash: h,
        fileName: file.name,
        artifactType: getFileCategory(file.name),
        timestamp: new Date()
      });
      
      const certBlob = new Blob([certificateBuffer as any], { type: 'application/pdf' });
      setCertificateBlob(certBlob);
      
      // Step 4: Complete
      setStep('complete');
      await refetch();
      
    } catch (err: any) {
      setStep('error');
      if (err.message === 'LIMIT_REACHED') {
        setError('You have reached the monthly operations limit for your plan.');
      } else {
        setError(err.message ?? 'Stamp failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCertificate = () => {
    if (!certificateBlob || !file) return;
    
    const url = URL.createObjectURL(certificateBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.split('.')[0]}_proofmesh_certificate.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (usageLoading) {
    return <div className="text-slate-400">Loading usage data...</div>;
  }

  if (usageError) {
    return <div className="text-red-400">Error loading usage: {usageError}</div>;
  }

  if (!usage) {
    return <div className="text-slate-400">No usage data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Usage Limit Alert */}
      <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400 mb-1">Monthly Operations (Stamps + Verifications)</div>
            <div className="text-2xl font-bold text-slate-100">
              {usage.monthly_ops.current} {usage.monthly_ops.limit === -1 ? '/ Unlimited' : `/ ${usage.monthly_ops.limit}`}
            </div>
            <div className="text-xs text-slate-400 mt-1 capitalize">{usage.plan} Plan</div>
          </div>
          {isOpsAtLimit && (
            <div className="flex items-center gap-2 text-amber-400 bg-amber-950/30 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Limit Reached</span>
            </div>
          )}
        </div>
        {usage.monthly_ops.limit !== -1 && (
          <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${isOpsAtLimit ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((usage.monthly_ops.current / usage.monthly_ops.limit) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center">
              <FileCheck2 className="w-5 h-5 text-white" />
            </div>
            Stamp File
          </h2>
          <span className="text-sm text-slate-400">Create cryptographic proof of file authenticity</span>
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
                    Upgrade to continue stamping files.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Upload className="w-4 h-4 text-slate-400" />
              Select File (All types supported)
            </label>
            {file && (
              <div className="flex items-center gap-2 mb-2">
                {(() => {
                  const FileIcon = getFileIcon(file.name);
                  return <FileIcon className="w-4 h-4 text-slate-400" />;
                })()}
                <Badge variant="secondary">{getFileCategory(file.name)}</Badge>
                <span className="text-sm text-slate-400">{file.name}</span>
              </div>
            )}
            <input
              type="file"
              onChange={handleFileChange}
              className="w-full"
              disabled={isOpsAtLimit}
            />
            <p className="text-xs text-slate-500">
              Supports all file types: documents, images, videos, audio, code, archives, and more
            </p>
          </div>

          <button onClick={handleStamp} disabled={loading || !file || isOpsAtLimit}>
            {loading 
              ? step === 'hashing' 
                ? '⏳ Computing hash...' 
                : step === 'stamping' 
                  ? '🔒 Creating proof...' 
                  : step === 'generating-cert'
                    ? '📄 Generating certificate...'
                    : 'Processing...'
              : isOpsAtLimit 
                ? 'Limit Reached - Upgrade Required' 
                : 'Stamp File'}
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

          {result && step === 'complete' && (
            <div className="alert success">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="font-semibold text-lg mb-2">✅ File Successfully Stamped!</div>
                    <p className="text-sm text-slate-300">
                      Your file has been cryptographically stamped and a Certificate of Authenticity has been generated.
                    </p>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-3 rounded-lg bg-slate-900/50">
                      <span className="text-slate-400">File:</span>
                      <code className="font-mono text-xs text-slate-200">{file?.name}</code>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-slate-900/50">
                      <span className="text-slate-400">Proof ID:</span>
                      <code className="font-mono text-xs text-slate-200">{result.proof.id}</code>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-slate-900/50">
                      <span className="text-slate-400">Status:</span>
                      <span className="font-semibold uppercase text-emerald-400">{result.proof.status}</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-slate-900/50">
                      <span className="text-slate-400">Validators:</span>
                      <span className="font-semibold text-slate-200">
                        {result.validators.length > 0 ? result.validators.length : 'Pending confirmation'}
                      </span>
                    </div>
                  </div>

                  {certificateBlob && (
                    <div className="pt-3 border-t border-slate-700">
                      <button 
                        onClick={handleDownloadCertificate}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
                      >
                        <Download className="w-5 h-5" />
                        Download Certificate of Authenticity
                      </button>
                      <p className="text-xs text-slate-400 text-center mt-2">
                        This PDF certificate proves your file was stamped on the blockchain
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
