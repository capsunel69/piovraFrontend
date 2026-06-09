import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchAdWorkspace,
  setAdActiveProject,
  type AdPlatform,
  type AdProject,
  type AdSocialAccount,
} from '../services/analyticsDashboard';

const ACCOUNT_STORAGE = 'piovra-ad-active-accounts';

interface ActiveAccounts {
  youtube: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
}

interface AdWorkspaceContextValue {
  loading: boolean;
  error: string | null;
  projects: AdProject[];
  accounts: AdSocialAccount[];
  activeProjectId: string | null;
  activeAccounts: ActiveAccounts;
  setActiveProject: (projectId: string) => Promise<void>;
  setActiveAccount: (platform: AdPlatform, accountId: string | null) => void;
  refresh: () => Promise<void>;
  accountsForPlatform: (platform: AdPlatform) => AdSocialAccount[];
}

const AdWorkspaceContext = createContext<AdWorkspaceContextValue | null>(null);

function loadActiveAccounts(): ActiveAccounts {
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE);
    if (!raw) return { youtube: null, facebook: null, instagram: null, tiktok: null };
    return { ...{ youtube: null, facebook: null, instagram: null, tiktok: null }, ...JSON.parse(raw) };
  } catch {
    return { youtube: null, facebook: null, instagram: null, tiktok: null };
  }
}

function saveActiveAccounts(accounts: ActiveAccounts): void {
  localStorage.setItem(ACCOUNT_STORAGE, JSON.stringify(accounts));
}

export const AdWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<AdProject[]>([]);
  const [accounts, setAccounts] = useState<AdSocialAccount[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [activeAccounts, setActiveAccountsState] = useState<ActiveAccounts>(loadActiveAccounts);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const ws = await fetchAdWorkspace();
      setProjects(ws.projects);
      setAccounts(ws.accounts);
      setActiveProjectIdState(ws.activeProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveProject = useCallback(async (projectId: string) => {
    await setAdActiveProject(projectId);
    setActiveAccountsState({ youtube: null, facebook: null, instagram: null, tiktok: null });
    saveActiveAccounts({ youtube: null, facebook: null, instagram: null, tiktok: null });
    await refresh();
  }, [refresh]);

  const setActiveAccount = useCallback((platform: AdPlatform, accountId: string | null) => {
    setActiveAccountsState((prev) => {
      const next = { ...prev, [platform]: accountId };
      saveActiveAccounts(next);
      return next;
    });
  }, []);

  const accountsForPlatform = useCallback(
    (platform: AdPlatform) => accounts.filter((a) => a.platform === platform),
    [accounts],
  );

  const value = useMemo(
    () => ({
      loading,
      error,
      projects,
      accounts,
      activeProjectId,
      activeAccounts,
      setActiveProject,
      setActiveAccount,
      refresh,
      accountsForPlatform,
    }),
    [
      loading,
      error,
      projects,
      accounts,
      activeProjectId,
      activeAccounts,
      setActiveProject,
      setActiveAccount,
      refresh,
      accountsForPlatform,
    ],
  );

  return <AdWorkspaceContext.Provider value={value}>{children}</AdWorkspaceContext.Provider>;
};

export function useAdWorkspace(): AdWorkspaceContextValue {
  const ctx = useContext(AdWorkspaceContext);
  if (!ctx) throw new Error('useAdWorkspace must be used within AdWorkspaceProvider');
  return ctx;
}

export function useAdActiveAccount(platform: AdPlatform): string | null {
  const { activeAccounts, accountsForPlatform } = useAdWorkspace();
  const stored = activeAccounts[platform];
  const list = accountsForPlatform(platform);
  if (stored && list.some((a) => a.id === stored)) return stored;
  return list[0]?.id ?? null;
}
