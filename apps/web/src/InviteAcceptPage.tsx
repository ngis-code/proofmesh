import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const InviteAcceptPage: React.FC = () => {
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
            <h1>Accepting your invite…</h1>
            <p>Please wait while we complete your login.</p>
          </>
        ) : (
          <>
            <h1>Invite error</h1>
            <p className="muted">
              {error ?? 'There was a problem accepting your invite. You might already be logged in.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};


