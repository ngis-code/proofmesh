import React from 'react';
import { useAuth } from './AuthContext';

export const AccountSetupDonePage: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="login-layout">
      <div className="login-card">
        <h1>Check your email</h1>
        <p>
          {user?.email
            ? `We’ve sent a password setup email to ${user.email}.`
            : 'We’ve sent a password setup email to your address.'}
        </p>
        <p className="muted">
          Follow the link in your inbox to choose a secure password. You can close this window.
        </p>
      </div>
    </div>
  );
};


