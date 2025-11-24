import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, User, Mail, ArrowRight } from 'lucide-react';

export default function AccountSetupPage() {
  const { user, updateProfile, sendPasswordSetupEmail } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name to continue.');
      return;
    }
    if (!user?.email) {
      setError('Your account has no email address.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateProfile({ name: trimmed });
      await sendPasswordSetupEmail();
      navigate('/account/setup/done', { replace: true });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to finish account setup.');
      setBusy(false);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-card">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center shadow-xl">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Welcome to ProofMesh</h1>
          <p className="text-slate-400">Finish setting up your account</p>
        </div>

        {/* Form */}
        <form className="form" onSubmit={(e) => { e.preventDefault(); handleContinue(); }}>
          <label>
            <span className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-slate-400" />
              Email
            </span>
            <input
              type="email"
              value={user?.email ?? ''}
              readOnly
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            />
          </label>

          <label>
            <span className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-slate-400" />
              Name
            </span>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={busy}>
            {busy ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" style={{ display: 'inline-block' }}></div>
                Working…
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" style={{ display: 'inline-block' }} />
              </>
            )}
          </button>
        </form>

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
