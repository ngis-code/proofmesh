import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const PasswordResetPage: React.FC = () => {
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
        <h1>Set a new password</h1>
        <p>Choose a strong password to secure your account.</p>

        <div className="form">
          <label htmlFor="password">
            New password
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
            />
          </label>
          <label htmlFor="passwordConfirm">
            Confirm password
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Repeat password"
            />
          </label>
          <button type="button" onClick={handleReset} disabled={working}>
            {working ? 'Updating…' : 'Update password'}
          </button>
        </div>

        {message && (
          <div className="alert success" style={{ marginTop: '0.75rem' }}>
            {message}
          </div>
        )}

        {error && (
          <div className="alert error" style={{ marginTop: '0.75rem' }}>
            <strong>Error: </strong>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};


