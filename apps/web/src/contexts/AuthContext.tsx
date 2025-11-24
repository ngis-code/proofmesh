import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Client, Account, Models } from 'appwrite';

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT as string | undefined;
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID as string | undefined;

export interface SubscriptionStatus {
  subscribed: boolean;
  productId: string | null;
  status: string;
  subscriptionEnd: string | null;
  plan: {
    id: string;
    name: string;
    maxOrganizations: number;
    maxVerificationsPerMonth: number;
  };
  currentUsage: {
    organizations: number;
    maxOrganizations: number;
  };
}

export interface AuthState {
  user: Models.User<Models.Preferences> | null;
  jwt: string | null;
  loading: boolean;
  subscriptionStatus: SubscriptionStatus | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshJwt: () => Promise<string>;
  refreshSubscription: () => Promise<void>;
  completeMagicLink: (userId: string, secret: string) => Promise<void>;
  sendMagicLinkInvite: (userId: string, email: string) => Promise<void>;
  sendPasswordSetupEmail: () => Promise<void>;
  updateProfile: (params: { name?: string }) => Promise<void>;
  resetPasswordWithToken: (userId: string, secret: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function createAppwriteClient(): { client: Client; account: Account } {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
    throw new Error('Appwrite env vars VITE_APPWRITE_ENDPOINT and VITE_APPWRITE_PROJECT_ID must be set');
  }
  const client = new Client();
  client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
  const account = new Account(client);
  return { client, account };
}

const JWT_STORAGE_KEY = 'proofmesh_jwt';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [{ user, jwt, loading, subscriptionStatus }, setState] = useState<AuthState>({
    user: null,
    jwt: null,
    loading: true,
    subscriptionStatus: null,
  });

  const { account } = useMemo(createAppwriteClient, []);

  const fetchSubscriptionStatus = async (jwtToken: string): Promise<SubscriptionStatus | null> => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
      const response = await fetch(`${API_BASE}/api/subscription/status`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.error('Failed to fetch subscription status:', response.status);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      return null;
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const me = await account.get();
        const jwtResp = await account.createJWT();
        localStorage.setItem(JWT_STORAGE_KEY, jwtResp.jwt);
        
        // Fetch subscription status
        const subscription = await fetchSubscriptionStatus(jwtResp.jwt);
        
        setState({ user: me, jwt: jwtResp.jwt, loading: false, subscriptionStatus: subscription });
        return;
      } catch {
        // ignore
      }
      setState({ user: null, jwt: null, loading: false, subscriptionStatus: null });
    };
    void bootstrap();
  }, [account]);

  const login = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      await account.createEmailPasswordSession(email, password);
      const me = await account.get();
      const jwtResp = await account.createJWT();
      localStorage.setItem(JWT_STORAGE_KEY, jwtResp.jwt);
      
      // Fetch subscription status after login
      const subscription = await fetchSubscriptionStatus(jwtResp.jwt);
      
      setState({ user: me, jwt: jwtResp.jwt, loading: false, subscriptionStatus: subscription });
    } catch (err) {
      console.error('Login failed', err);
      setState({ user: null, jwt: null, loading: false, subscriptionStatus: null });
      throw err;
    }
  };

  const refreshSubscription = async () => {
    if (!jwt) return;
    
    try {
      const subscription = await fetchSubscriptionStatus(jwt);
      setState((s) => ({ ...s, subscriptionStatus: subscription }));
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
      throw new Error('Appwrite config missing in frontend.');
    }
    if (!name.trim() || !email.trim() || password.length < 8) {
      throw new Error('Name, email, and a password of at least 8 characters are required.');
    }

    const res = await fetch(`${APPWRITE_ENDPOINT}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_PROJECT_ID,
      },
      body: JSON.stringify({
        userId: 'unique()',
        email,
        password,
        name,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Signup failed', { status: res.status, body: text });
      let message = 'Signup failed';
      try {
        const parsed = JSON.parse(text);
        if (parsed?.message) message = parsed.message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    await login(email, password);
  };

  const logout = async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      await account.deleteSessions();
    } catch {
      // ignore
    } finally {
      localStorage.removeItem(JWT_STORAGE_KEY);
      setState({ user: null, jwt: null, loading: false, subscriptionStatus: null });
    }
  };

  const refreshJwt = async (): Promise<string> => {
    try {
      const jwtResp = await account.createJWT();
      localStorage.setItem(JWT_STORAGE_KEY, jwtResp.jwt);
      setState((s) => ({ ...s, jwt: jwtResp.jwt }));
      return jwtResp.jwt;
    } catch (err) {
      console.error('Failed to refresh JWT', err);
      localStorage.removeItem(JWT_STORAGE_KEY);
      setState({ user: null, jwt: null, loading: false, subscriptionStatus: null });
      throw err;
    }
  };

  const completeMagicLink = async (userId: string, secret: string) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      await (account as any).updateMagicURLSession(userId, secret);
      const me = await account.get();
      const jwtResp = await account.createJWT();
      localStorage.setItem(JWT_STORAGE_KEY, jwtResp.jwt);
      setState({ user: me, jwt: jwtResp.jwt, loading: false, subscriptionStatus: null });
    } catch (err) {
      console.error('Failed to complete magic link', err);
      localStorage.removeItem(JWT_STORAGE_KEY);
      setState({ user: null, jwt: null, loading: false, subscriptionStatus: null });
      throw err;
    }
  };

  const sendMagicLinkInvite = async (userId: string, email: string) => {
    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
      throw new Error('Appwrite config missing in frontend (endpoint/projectId)');
    }

    const res = await fetch(`${APPWRITE_ENDPOINT}/account/tokens/magic-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_PROJECT_ID,
      },
      body: JSON.stringify({
        userId,
        email,
        url: window.location.origin + '/invite',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Failed to send magic URL invite', { status: res.status, body: text });
      let message = 'Failed to send magic-link email';
      try {
        const parsed = JSON.parse(text);
        if (parsed?.message) message = parsed.message;
      } catch {
        // ignore JSON parse errors
      }
      throw new Error(message);
    }
  };

  const sendPasswordSetupEmail = async (): Promise<void> => {
    if (!user?.email) {
      throw new Error('No email found for current user.');
    }
    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !jwt) {
      throw new Error('Appwrite config or JWT missing in frontend.');
    }

    const res = await fetch(`${APPWRITE_ENDPOINT}/account/recovery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_PROJECT_ID,
        'X-Appwrite-JWT': jwt,
      },
      body: JSON.stringify({
        email: user.email,
        url: window.location.origin + '/password/reset',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Failed to send password setup email', { status: res.status, body: text });
      let message = 'Failed to send password setup email';
      try {
        const parsed = JSON.parse(text);
        if (parsed?.message) message = parsed.message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
  };

  const resetPasswordWithToken = async (
    userId: string,
    secret: string,
    password: string,
  ): Promise<void> => {
    try {
      await (account as any).updateRecovery(userId, secret, password, password);
    } catch (err) {
      console.error('Failed to reset password with token', err);
      throw err;
    }
  };

  const updateProfile = async (params: { name?: string }): Promise<void> => {
    setState((s) => ({ ...s, loading: true }));
    try {
      if (params.name && params.name.trim()) {
        await (account as any).updateName(params.name.trim());
      }
      const me = await account.get();
      const jwtResp = await account.createJWT();
      localStorage.setItem(JWT_STORAGE_KEY, jwtResp.jwt);
      setState({ user: me, jwt: jwtResp.jwt, loading: false, subscriptionStatus: null });
    } catch (err) {
      console.error('Failed to update profile', err);
      setState((s) => ({ ...s, loading: false }));
      throw err;
    }
  };

  const value: AuthContextValue = {
    user,
    jwt,
    loading,
    subscriptionStatus,
    login,
    signup,
    logout,
    refreshJwt,
    refreshSubscription,
    completeMagicLink,
    sendMagicLinkInvite,
    sendPasswordSetupEmail,
    updateProfile,
    resetPasswordWithToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
