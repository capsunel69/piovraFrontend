const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const BASE = `${PIOVRA_BASE_URL}/v1/analytics-dashboard`;

export type AdPlatform = 'youtube' | 'facebook' | 'instagram' | 'tiktok';

export interface AdDataPoint {
  date: string;
  platform: AdPlatform;
  views: number;
  posts: number;
  likes: number;
  shares: number;
  comments: number;
}

export interface AdAnalyticsResponse {
  data: AdDataPoint[];
  errors?: Record<string, string>;
}

export interface AdProject {
  id: string;
  name: string;
  slug: string;
  notes?: string | null;
  isDefault?: boolean;
}

export interface AdSocialAccount {
  id: string;
  projectId: string;
  platform: AdPlatform;
  label: string;
  handle: string;
  youtubeDataSource?: string | null;
}

export interface AdWorkspace {
  activeProjectId: string | null;
  activeProject: AdProject | null;
  projects: AdProject[];
  accounts: AdSocialAccount[];
}

export interface AdConnectedAccount {
  platform: AdPlatform;
  connected: boolean;
  label: string;
  username?: string;
  connectedAt?: string;
  authMethod?: 'oauth' | 'env' | 'scrapecreators';
  dataSource?: string;
}

export interface AdConnectionsResponse {
  accounts: AdConnectedAccount[];
  oauthConfigured: boolean;
  tiktokOAuthConfigured: boolean;
  scrapeCreatorsConfigured: boolean;
  scrapeCreatorsTokenSet: boolean;
}

export interface AdSocialProfiles {
  tiktok?: string;
  instagram?: string;
  facebook?: string;
}

async function adFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Analytics API ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function adOAuthUrl(platform: 'youtube' | 'tiktok'): string {
  return `${BASE}/auth/${platform}`;
}

export async function fetchAdWorkspace(): Promise<AdWorkspace> {
  return adFetch<AdWorkspace>('/workspace');
}

export async function setAdActiveProject(projectId: string): Promise<void> {
  await adFetch('/workspace/active-project', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function fetchAdAnalytics(params: {
  startDate: string;
  endDate: string;
  refresh?: boolean;
  platforms?: AdPlatform[];
  projectId?: string;
}): Promise<AdAnalyticsResponse> {
  const qs = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });
  if (params.refresh) qs.set('refresh', '1');
  if (params.projectId) qs.set('projectId', params.projectId);
  if (params.platforms?.length) qs.set('platforms', params.platforms.join(','));
  return adFetch<AdAnalyticsResponse>(`/analytics?${qs}`);
}

export async function fetchAdConnections(): Promise<AdConnectionsResponse> {
  return adFetch<AdConnectionsResponse>('/connections');
}

export async function fetchAdSocialProfiles(): Promise<{
  profiles: AdSocialProfiles;
  tokenConfigured: boolean;
}> {
  return adFetch('/social/profiles');
}

export async function saveAdSocialProfiles(profiles: AdSocialProfiles): Promise<void> {
  await adFetch('/social/profiles', {
    method: 'POST',
    body: JSON.stringify(profiles),
  });
}

export async function createAdProject(name: string, notes?: string): Promise<AdProject> {
  const res = await adFetch<{ project: AdProject }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, notes }),
  });
  return res.project;
}

export async function createAdAccount(
  projectId: string,
  input: { platform: AdPlatform; handle: string; label?: string },
): Promise<AdSocialAccount> {
  const res = await adFetch<{ account: AdSocialAccount }>(`/projects/${projectId}/accounts`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.account;
}

export function adDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

export const AD_PLATFORM_COLORS: Record<AdPlatform, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  instagram: '#E4405F',
  tiktok: '#69C9D0',
};
