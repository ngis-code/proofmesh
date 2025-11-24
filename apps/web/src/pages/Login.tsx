import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, ArrowRight, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/orgs');
    } catch (err: any) {
      setError('Invalid credentials. Please check your email and password.');
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
          <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
          <p className="text-slate-400">Sign in to access your organizations</p>
        </div>

        {/* Form */}
        <form className="form" onSubmit={handleSubmit}>
          <label>
            <span className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-slate-400" />
              Email Address
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>

          <label>
            <span className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-slate-400" />
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" style={{ display: 'inline-block' }}></div>
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" style={{ display: 'inline-block' }} />
              </>
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="alert error">
            <strong>Authentication Failed</strong>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="login-footer">
          <p className="text-center text-slate-400 text-sm">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="link-button"
            >
              Create one now
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
