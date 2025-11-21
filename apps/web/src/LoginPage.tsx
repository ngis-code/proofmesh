import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const LoginPage: React.FC = () => {
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
      setError('Login failed. Check your credentials.');
    }
  };

  return (
    <div className="login-layout">
      <div className="login-card">
        <h1>Sign in to ProofMesh</h1>
        <p>Use your Appwrite email and password to access your orgs.</p>

        <form className="form" onSubmit={handleSubmit}>
          <label htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {error && (
          <div className="alert error">
            <strong>Error: </strong>
            {error}
          </div>
        )}

        <div className="login-footer">
          Authentication is powered by Appwrite. User creation / password reset is managed outside this demo UI.
        </div>
      </div>
    </div>
  );
};


