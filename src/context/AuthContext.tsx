import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type SwitchableFeature = 'whatsapp' | 'comment_sentinel' | 'analytics' | 'transcribe';

export interface MeUser {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  role: 'user' | 'admin';
  disabledFeatures?: SwitchableFeature[];
}

interface AuthContextType {
  loading: boolean;
  isAuthenticated: boolean;
  me: MeUser | null;
  /** True when the user has granted gmail.modify (mail skills + suggestions). */
  gmailConnected: boolean;
  disabledFeatures: SwitchableFeature[];
  hasFeature: (feature: SwitchableFeature) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  googleSignInUrl: string;
  googleGmailUpgradeUrl: string;
  googleCalendarUpgradeUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [me, setMe] = useState<MeUser | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${PIOVRA_BASE_URL}/auth/me`, { credentials: 'include' });
      if (!res.ok) {
        setMe(null);
        setGmailConnected(false);
        return;
      }
      const data = (await res.json()) as MeUser;
      setMe(data);
      try {
        const connRes = await fetch(`${PIOVRA_BASE_URL}/v1/me/connections`, {
          credentials: 'include',
        });
        if (connRes.ok) {
          const conn = (await connRes.json()) as { google?: { scopes?: string[] } };
          setGmailConnected(conn.google?.scopes?.includes(GMAIL_SCOPE) ?? false);
        } else {
          setGmailConnected(false);
        }
      } catch {
        setGmailConnected(false);
      }
    } catch {
      setMe(null);
      setGmailConnected(false);
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
    setGmailConnected(false);
  }, []);

  const returnTo = typeof window !== 'undefined' ? window.location.href : '/';
  const googleSignInUrl = `${PIOVRA_BASE_URL}/auth/google?return_to=${encodeURIComponent(returnTo)}`;
  const googleGmailUpgradeUrl = `${PIOVRA_BASE_URL}/auth/google/upgrade?scopes=${encodeURIComponent(GMAIL_SCOPE)}&return_to=${encodeURIComponent(returnTo)}`;
  const googleCalendarUpgradeUrl = `${PIOVRA_BASE_URL}/auth/google/upgrade?scopes=${encodeURIComponent(CALENDAR_EVENTS_SCOPE)}&return_to=${encodeURIComponent(returnTo)}`;

  const disabledFeatures = (me?.disabledFeatures ?? []) as SwitchableFeature[];

  const hasFeature = useCallback(
    (feature: SwitchableFeature) => {
      if (me?.role === 'admin') return true;
      return !disabledFeatures.includes(feature);
    },
    [me?.role, disabledFeatures],
  );

  return (
    <AuthContext.Provider
      value={{
        loading,
        isAuthenticated: me !== null,
        me,
        gmailConnected,
        disabledFeatures,
        hasFeature,
        refresh,
        signOut,
        googleSignInUrl,
        googleGmailUpgradeUrl,
        googleCalendarUpgradeUrl,
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
