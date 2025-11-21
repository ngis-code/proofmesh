import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Client, Account, Models } from 'appwrite';

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT as string | undefined;
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID as string | undefined;

export interface AuthState {
  user: Models.User<Models.Preferences> | null;
  jwt: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshJwt: () => Promise<string>;
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
  const [{ user, jwt, loading }, setState] = useState<AuthState>({
    user: null,
    jwt: null,
    loading: true,
  });

  const { account } = useMemo(createAppwriteClient, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // If the user still has a valid Appwrite session (cookies), restore it
        // and mint a fresh JWT.
        const me = await account.get();
        const jwtResp = await account.createJWT();
        localStorage.setItem(JWT_STORAGE_KEY, jwtResp.jwt);
        setState({ user: me, jwt: jwtResp.jwt, loading: false });
        return;
      } catch {
        // ignore
      }
      setState({ user: null, jwt: null, loading: false });
    };
    void bootstrap();
  }, [account]);

  const login = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      // Create a session (sets secure cookies for Appwrite domain)
      await account.createEmailPasswordSession(email, password);
      const me = await account.get();
      const jwtResp = await account.createJWT();
      localStorage.setItem(JWT_STORAGE_KEY, jwtResp.jwt);
      setState({ user: me, jwt: jwtResp.jwt, loading: false });
    } catch (err) {
      console.error('Login failed', err);
      setState({ user: null, jwt: null, loading: false });
      throw err;
    }
  };

  const logout = async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      await account.deleteSessions();
    } catch {
      // ignore
    } finally {
      localStorage.removeItem(JWT_STORAGE_KEY);
      setState({ user: null, jwt: null, loading: false });
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
      setState({ user: null, jwt: null, loading: false });
      throw err;
    }
  };

  const value: AuthContextValue = {
    user,
    jwt,
    loading,
    login,
    logout,
    refreshJwt,
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


