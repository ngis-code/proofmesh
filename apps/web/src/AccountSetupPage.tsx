import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const AccountSetupPage: React.FC = () => {
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
        <h1>Welcome to ProofMesh</h1>
        <p>Finish setting up your account.</p>

        <div className="form">
          <label htmlFor="email">
            Email
            <input id="email" type="email" value={user?.email ?? ''} readOnly />
          </label>

          <label htmlFor="name">
            Name
            <input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <button type="button" onClick={handleContinue} disabled={busy}>
            {busy ? 'Working…' : 'Continue'}
          </button>
        </div>

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


