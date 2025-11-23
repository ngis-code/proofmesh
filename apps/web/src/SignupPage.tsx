import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const SignupPage: React.FC = () => {
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
      setError('Passwords do not match.');
      return;
    }
    try {
      await signup(name, email, password);
      navigate('/orgs');
    } catch (err: any) {
      setError(err.message ?? 'Signup failed.');
    }
  };

  return (
    <div className="login-layout">
      <div className="login-card">
        <h1>Create your ProofMesh account</h1>
        <p>Sign up to create your first org and become its owner.</p>

        <form className="form" onSubmit={handleSubmit}>
          <label htmlFor="name">
            Name
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </label>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </label>

          <label htmlFor="passwordConfirm">
            Confirm password
            <input
              id="passwordConfirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Repeat password"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        {error && (
          <div className="alert error">
            <strong>Error: </strong>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};


