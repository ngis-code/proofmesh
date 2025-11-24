import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, ArrowRight, User, Mail, Lock } from 'lucide-react';

export default function SignupPage() {
  const { signup, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (password !== passwordConfirm) {
      setError('Passwords do not match. Please try again.');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    
    try {
      await signup(name, email, password);
      navigate('/create-org');
    } catch (err: any) {
      setError(err.message ?? 'Signup failed. Please try again.');
    }
  };

  return (
    <div className="login-layout">
      <div className="login-card">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center shadow-xl">
            <User className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Create Account</h1>
          <p className="text-slate-400">Join ProofMesh and secure your digital assets</p>
        </div>

        {/* Form */}
        <form className="form" onSubmit={handleSubmit}>
          <label>
            <span className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-slate-400" />
              Full Name
            </span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </label>

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
              autoComplete="new-password"
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
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Repeat your password"
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" style={{ display: 'inline-block' }}></div>
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-4 h-4 ml-2" style={{ display: 'inline-block' }} />
              </>
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="alert error">
            <strong>Signup Failed</strong>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="login-footer">
          <p className="text-center text-slate-400 text-sm">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="link-button"
            >
              Sign in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
