import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Mail, AlertCircle } from 'lucide-react';

export default function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeMagicLink } = useAuth();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const userId = searchParams.get('userId');
      const secret = searchParams.get('secret');
      if (!userId || !secret) {
        setStatus('error');
        setError('Missing invite parameters.');
        return;
      }
      try {
        await completeMagicLink(userId, secret);
        navigate('/account/setup', { replace: true });
      } catch (err: any) {
        setStatus('error');
        setError(err?.message ?? 'Failed to accept invite.');
      }
    };
    void run();
  }, [searchParams, completeMagicLink, navigate]);

  return (
    <div className="login-layout">
      <div className="login-card">
        {status === 'working' ? (
          <>
            <div className="flex items-center justify-center mb-8">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center shadow-xl">
                <Mail className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <Loader2 className="w-12 h-12 text-[#0ea5e9] animate-spin" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Accepting Your Invite</h1>
              <p className="text-slate-400">Please wait while we complete your login</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center mb-8">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-xl">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Invite Error</h1>
              <p className="text-slate-400">
                {error ?? 'There was a problem accepting your invite. You might already be logged in.'}
              </p>
            </div>
            {error && (
              <div className="alert error">
                <strong>Error</strong>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
