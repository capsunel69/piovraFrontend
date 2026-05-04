import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface MeUser {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  role: 'user' | 'admin';
}

interface AuthContextType {
  loading: boolean;
  isAuthenticated: boolean;
  me: MeUser | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Where to send the browser to start a Google sign-in flow. */
  googleSignInUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${PIOVRA_BASE_URL}/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as MeUser;
        setMe(data);
      } else {
        setMe(null);
      }
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await fetch(`${PIOVRA_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* best effort */
    }
    setMe(null);
  }, []);

  const returnTo = typeof window !== 'undefined' ? window.location.href : '/';
  const googleSignInUrl = `${PIOVRA_BASE_URL}/auth/google?return_to=${encodeURIComponent(returnTo)}`;

  return (
    <AuthContext.Provider
      value={{
        loading,
        isAuthenticated: me !== null,
        me,
        refresh,
        signOut,
        googleSignInUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
