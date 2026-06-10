export type AnPlatform = 'youtube' | 'facebook' | 'instagram' | 'tiktok';
export type AnMetricKey = 'views' | 'posts' | 'likes' | 'shares' | 'comments';

export interface AnDataPoint {
  date: string;
  platform: AnPlatform;
  views: number;
  posts: number;
  likes: number;
  shares: number;
  comments: number;
}

export interface AnMetricComparison {
  percentChange: number | null;
  delta: number;
  previous: number;
  current: number;
}

export interface AnOverviewResponse {
  data: AnDataPoint[];
  totals: Record<AnMetricKey, number>;
  comparisons: Record<AnMetricKey, AnMetricComparison>;
  byPlatform: Record<AnPlatform, Record<AnMetricKey, number>>;
  errors: Partial<Record<AnPlatform, string>>;
}

export interface AnProject {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnAccount {
  id: string;
  projectId: string;
  platform: AnPlatform;
  label: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnWorkspaceState {
  active: string;
  projects: AnProject[];
  accounts: AnAccount[];
}

export interface AnSocialPostItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  url?: string;
  duration?: string;
}

export interface AnContentResponse {
  profile?: {
    name: string;
    handle?: string;
    avatarUrl?: string;
    coverUrl?: string;
    followerCount?: number;
    postCount?: number;
  };
  items: AnSocialPostItem[];
  dataSource: 'scrapecreators' | 'public';
  platform: AnPlatform;
}

export interface AnLogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AnMasterRow {
  projectId: string;
  projectName: string;
  accountId: string;
  accountLabel: string;
  platform: AnPlatform;
  totals: Record<AnMetricKey, number>;
  /** Daily series for cross-project charts. */
  points: AnDataPoint[];
  error?: string;
}

export interface AnUsageBucket {
  scCredits: number;
  ytUnits: number;
}

export interface AnUsageProjectRow extends AnUsageBucket {
  projectId: string | null;
  projectName: string;
  byPlatform: Record<string, AnUsageBucket>;
  estCostUsd: number;
}

export interface AnUsageResponse {
  startDate: string;
  endDate: string;
  creditCostUsd: number;
  totals: AnUsageBucket & { calls: number; estCostUsd: number };
  projects: AnUsageProjectRow[];
  daily: Array<AnUsageBucket & { date: string }>;
}

export const AN_PLATFORMS: AnPlatform[] = ['youtube', 'facebook', 'instagram', 'tiktok'];

export const AN_METRIC_LABELS: Record<AnMetricKey, string> = {
  views: 'Views',
  posts: 'Posts',
  likes: 'Likes',
  shares: 'Shares',
  comments: 'Comments',
};

export const AN_PLATFORM_LABELS: Record<AnPlatform, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

export const AN_PLATFORM_COLORS: Record<AnPlatform, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  instagram: '#E4405F',
  tiktok: '#69C9D0',
};
