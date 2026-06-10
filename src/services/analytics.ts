import type {
  AnAccount,
  AnContentResponse,
  AnDataPoint,
  AnLogEntry,
  AnMasterRow,
  AnOverviewResponse,
  AnPlatform,
  AnProject,
  AnUsageResponse,
  AnWorkspaceState,
} from '../types/analytics';

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const API_URL = `${PIOVRA_BASE_URL}/v1/analytics`;

async function fetchAn<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}/${endpoint}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* use raw */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as unknown as T;
  return response.json() as Promise<T>;
}

export interface DateRangeQuery {
  startDate: string;
  endDate: string;
  projectId?: string;
  refresh?: boolean;
  accountId?: string;
}

function toQuery(params: Record<string, string | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (typeof v === 'boolean') {
      if (v) qs.set(k, 'true');
      continue;
    }
    qs.set(k, v);
  }
  return qs.toString();
}

export const AnalyticsAPI = {
  getWorkspace: () => fetchAn<AnWorkspaceState>('projects'),

  createProject: (name: string) =>
    fetchAn<{ success: boolean; project: AnProject }>('projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  switchProject: (id: string) =>
    fetchAn<{ success: boolean; project: AnProject; accounts: AnAccount[] }>('projects/switch', {
      method: 'PUT',
      body: JSON.stringify({ id }),
    }),

  renameProject: (id: string, name: string) =>
    fetchAn<{ success: boolean; project: AnProject }>(`projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),

  deleteProject: (id: string) =>
    fetchAn<{ success: boolean; active: AnProject; accounts: AnAccount[] }>(`projects/${id}`, {
      method: 'DELETE',
    }),

  listAccounts: (projectId: string) =>
    fetchAn<{ accounts: AnAccount[] }>(`projects/${projectId}/accounts`),

  createAccount: (
    projectId: string,
    input: { platform: AnPlatform; label: string; handle: string },
  ) =>
    fetchAn<{ account: AnAccount }>(`projects/${projectId}/accounts`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateAccount: (
    projectId: string,
    accountId: string,
    patch: Partial<{ label: string; handle: string; enabled: boolean }>,
  ) =>
    fetchAn<{ account: AnAccount }>(`projects/${projectId}/accounts/${accountId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteAccount: (projectId: string, accountId: string) =>
    fetchAn<{ success: boolean }>(`projects/${projectId}/accounts/${accountId}`, {
      method: 'DELETE',
    }),

  getOverview: (query: DateRangeQuery & { youtubeAccountId?: string; facebookAccountId?: string; instagramAccountId?: string; tiktokAccountId?: string }) =>
    fetchAn<AnOverviewResponse>(`data/overview?${toQuery({ ...query })}`),

  getPlatformAnalytics: (platform: AnPlatform, query: DateRangeQuery) =>
    fetchAn<AnDataPoint[]>(`data/${platform}?${toQuery({ ...query })}`),

  getPlatformContent: (platform: AnPlatform, query: DateRangeQuery) =>
    fetchAn<AnContentResponse>(`content/${platform}?${toQuery({ ...query })}`),

  getMaster: (query: { startDate: string; endDate: string; refresh?: boolean }) =>
    fetchAn<{ rows: AnMasterRow[] }>(`data/master?${toQuery({ ...query })}`),

  getLogs: (limit = 200) => fetchAn<{ logs: AnLogEntry[] }>(`logs?limit=${limit}`),

  getUsage: (query: { startDate: string; endDate: string }) =>
    fetchAn<AnUsageResponse>(`usage?${toQuery({ ...query })}`),

  clearLogs: () => fetchAn<{ success: boolean }>('logs', { method: 'DELETE' }),
};

/** Routes social CDN thumbnails (TikTok/IG/FB block hotlinking) through the backend proxy. */
export function mediaProxyUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return `${API_URL}/media/proxy?url=${encodeURIComponent(url)}`;
}
