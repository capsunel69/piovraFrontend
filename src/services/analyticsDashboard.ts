const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined)?.trim() ?? '';

function resolveBase(): string {
  if (!PIOVRA_BASE_URL) {
    throw new Error(
      'VITE_PIOVRA_BASE_URL is not set. Add it in Netlify env (e.g. https://backend.piovra-op.com).',
    );
  }
  return `${PIOVRA_BASE_URL.replace(/\/$/, '')}/v1/analytics-dashboard`;
}

export type AdPlatform = 'youtube' | 'facebook' | 'instagram' | 'tiktok';
export type AdMetricKey = 'views' | 'posts' | 'likes' | 'shares' | 'comments';

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

export interface AdMetricTotals {
  views: number;
  posts: number;
  likes: number;
  shares: number;
  comments: number;
}

export interface AdMasterOverview {
  totals: AdMetricTotals;
  previousTotals: AdMetricTotals;
  comparisons: Record<AdMetricKey, { current: number; previous: number; delta: number; percentChange: number | null }>;
  projects: Array<{
    projectId: string;
    projectName: string;
    accountCount: number;
    totals: AdMetricTotals;
    previousTotals: AdMetricTotals;
  }>;
  topAccounts: Array<{
    accountId: string;
    projectName: string;
    accountLabel: string;
    handle: string;
    platform: AdPlatform;
    totals: AdMetricTotals;
  }>;
  rankingMetric: AdMetricKey;
}

export interface AdFetchOptions {
  refresh?: boolean;
  projectId?: string | null;
  accountIds?: Partial<Record<AdPlatform, string | null>>;
  platforms?: AdPlatform[];
}

function parseApiError(text: string, status: number): string {
  try {
    const body = JSON.parse(text) as { error?: string; details?: string; feature?: string };
    if (status === 404 && body.error === 'not found') {
      return 'Analytics API not found on server — deploy latest piovra with `sudo bash deploy/release.sh --migrate --sync-env`';
    }
    if (body.error === 'feature_disabled') {
      return 'Analytics Dashboard is disabled for your account. Ask an admin to enable it.';
    }
    return body.details ?? body.error ?? text;
  } catch {
    return text || `Analytics API ${status}`;
  }
}

async function adFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${resolveBase()}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(parseApiError(text, res.status));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function buildAnalyticsQuery(
  startDate: string,
  endDate: string,
  options?: AdFetchOptions,
): string {
  const qs = new URLSearchParams({ startDate, endDate });
  if (options?.refresh) qs.set('refresh', '1');
  if (options?.projectId) qs.set('projectId', options.projectId);
  if (options?.platforms?.length) qs.set('platforms', options.platforms.join(','));
  if (options?.accountIds?.youtube) qs.set('youtubeAccountId', options.accountIds.youtube);
  if (options?.accountIds?.facebook) qs.set('facebookAccountId', options.accountIds.facebook);
  if (options?.accountIds?.instagram) qs.set('instagramAccountId', options.accountIds.instagram);
  if (options?.accountIds?.tiktok) qs.set('tiktokAccountId', options.accountIds.tiktok);
  return qs.toString();
}

export function adOAuthUrl(platform: 'youtube' | 'tiktok'): string {
  return `${resolveBase()}/auth/${platform}`;
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

export async function fetchAdAnalytics(
  startDate: string,
  endDate: string,
  options?: AdFetchOptions,
): Promise<AdAnalyticsResponse> {
  return adFetch<AdAnalyticsResponse>(`/analytics?${buildAnalyticsQuery(startDate, endDate, options)}`);
}

export async function fetchAdPlatformAnalytics(
  platform: AdPlatform,
  startDate: string,
  endDate: string,
  options?: AdFetchOptions,
): Promise<AdDataPoint[]> {
  const qs = new URLSearchParams({ startDate, endDate });
  if (options?.refresh) qs.set('refresh', '1');
  if (options?.projectId) qs.set('projectId', options.projectId);
  const accountId = options?.accountIds?.[platform];
  if (accountId) qs.set('accountId', accountId);
  return adFetch<AdDataPoint[]>(`/analytics/${platform}?${qs}`);
}

export async function fetchAdMasterOverview(
  startDate: string,
  endDate: string,
  opts?: { refresh?: boolean; projectId?: string; platform?: AdPlatform | 'all'; metric?: AdMetricKey },
): Promise<AdMasterOverview> {
  const qs = new URLSearchParams({ startDate, endDate });
  if (opts?.refresh) qs.set('refresh', '1');
  if (opts?.projectId) qs.set('projectId', opts.projectId);
  if (opts?.platform && opts.platform !== 'all') qs.set('platform', opts.platform);
  if (opts?.metric) qs.set('metric', opts.metric);
  return adFetch<AdMasterOverview>(`/analytics/master?${qs}`);
}

export async function fetchAdPlatformContent<T>(
  platform: AdPlatform,
  startDate: string,
  endDate: string,
  accountId?: string | null,
  refresh?: boolean,
): Promise<T> {
  const qs = new URLSearchParams({ startDate, endDate });
  if (accountId) qs.set('accountId', accountId);
  if (refresh) qs.set('refresh', '1');
  return adFetch<T>(`/${platform}/content?${qs}`);
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
  await adFetch('/social/profiles', { method: 'POST', body: JSON.stringify(profiles) });
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

export async function deleteAdAccount(projectId: string, accountId: string): Promise<void> {
  await adFetch(`/projects/${projectId}/accounts/${accountId}`, { method: 'DELETE' });
}

export async function fetchAdUsage(refresh?: boolean): Promise<unknown> {
  return adFetch(`/usage${refresh ? '?refresh=1' : ''}`);
}

export async function clearAdUsage(): Promise<void> {
  await adFetch('/usage', { method: 'DELETE' });
}

export async function fetchAdLogs(): Promise<{ content: string; lines: number }> {
  return adFetch('/logs');
}

export async function clearAdLogs(): Promise<void> {
  await adFetch('/logs', { method: 'DELETE' });
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

export const AD_METRIC_LABELS: Record<AdMetricKey, string> = {
  views: 'Views',
  posts: 'Posts',
  likes: 'Likes',
  shares: 'Shares',
  comments: 'Comments',
};

export const ALL_AD_PLATFORMS: AdPlatform[] = ['youtube', 'facebook', 'instagram', 'tiktok'];
