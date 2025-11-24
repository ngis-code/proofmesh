import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Lock, ArrowRight } from 'lucide-react';

export default function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPasswordWithToken } = useAuth();

  const [userId, setUserId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = searchParams.get('userId');
    const s = searchParams.get('secret');
    setUserId(u);
    setSecret(s);
  }, [searchParams]);

  const handleReset = async () => {
    if (!userId || !secret) {
      setError('Invalid or expired reset link.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      await resetPasswordWithToken(userId, secret, password);
      setMessage('Your password has been updated. You can now sign in.');
      setTimeout(() => {
        navigate('/orgs', { replace: true });
      }, 1500);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to reset password.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-card">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#06b6d4] flex items-center justify-center shadow-xl">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Set a New Password</h1>
          <p className="text-slate-400">Choose a strong password to secure your account</p>
        </div>

        {/* Form */}
        <form className="form" onSubmit={(e) => { e.preventDefault(); handleReset(); }}>
          <label>
            <span className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-slate-400" />
              New Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </label>

          <label>
            <span className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-slate-400" />
              Confirm Password
            </span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Repeat your password"
              required
            />
          </label>

          <button type="submit" disabled={working}>
            {working ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" style={{ display: 'inline-block' }}></div>
                Updating…
              </>
            ) : (
              <>
                Update Password
                <ArrowRight className="w-4 h-4 ml-2" style={{ display: 'inline-block' }} />
              </>
            )}
          </button>
        </form>

        {/* Success Message */}
        {message && (
          <div className="alert success">
            <p>{message}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="alert error">
            <strong>Error</strong>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
