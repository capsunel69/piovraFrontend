import { useSyncExternalStore } from 'react';
import { AnalyticsAPI } from '../services/analytics';
import type {
  AnContentResponse,
  AnMasterRow,
  AnOverviewResponse,
  AnPlatform,
  AnPullMeta,
} from '../types/analytics';
import { AN_PLATFORMS } from '../types/analytics';

export type PlatformBundle = {
  content: AnContentResponse | null;
  contentError?: string;
};

export type PulledBundle = {
  cacheKey: string;
  overview: AnOverviewResponse;
  platforms: Record<AnPlatform, PlatformBundle>;
  master: AnMasterRow[];
  pulledAt: number;
  /** Aggregated cache vs live stats for this pull. */
  pullMeta: AnPullMeta;
};

export type PullStatus = 'idle' | 'pulling' | 'done' | 'error';

export type PullMode = 'cache' | 'scrape';

export interface PullProgress {
  mode: PullMode;
  message: string;
  cacheHits: number;
  liveCalls: number;
  completedSteps: number;
  totalSteps: number;
}

export interface AnalyticsPullState {
  status: PullStatus;
  bundles: Record<string, PulledBundle>;
  error: string | null;
  completionId: number;
  progress: PullProgress | null;
}

export function bundleKey(projectId: string, start: string, end: string): string {
  return `${projectId}:${start}:${end}`;
}

function stripMeta<T extends { _meta?: AnPullMeta }>(raw: T): { data: Omit<T, '_meta'>; meta: AnPullMeta } {
  const { _meta, ...data } = raw;
  return { data: data as Omit<T, '_meta'>, meta: _meta ?? { cacheHits: 0, liveCalls: 0 } };
}

function mergeMeta(acc: AnPullMeta, next: AnPullMeta): AnPullMeta {
  return {
    cacheHits: acc.cacheHits + next.cacheHits,
    liveCalls: acc.liveCalls + next.liveCalls,
  };
}

function progressMessage(mode: PullMode, cacheHits: number, liveCalls: number): string {
  if (mode === 'scrape') {
    if (liveCalls === 0) return 'Scraping live data from platforms…';
    return `Scraping live data… ${liveCalls} API call${liveCalls !== 1 ? 's' : ''} so far`;
  }
  if (liveCalls > 0 && cacheHits > 0) {
    return `Mixed load: ${cacheHits} from cache, ${liveCalls} live scrape${liveCalls !== 1 ? 's' : ''}…`;
  }
  if (liveCalls > 0) {
    return `Switching to live scrape… ${liveCalls} call${liveCalls !== 1 ? 's' : ''}`;
  }
  if (cacheHits > 0) {
    return `Loading from cache… ${cacheHits} hit${cacheHits !== 1 ? 's' : ''}`;
  }
  return 'Checking cache for saved data…';
}

let state: AnalyticsPullState = {
  status: 'idle',
  bundles: {},
  error: null,
  completionId: 0,
  progress: null,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<AnalyticsPullState>): void {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAnalyticsPullState(): AnalyticsPullState {
  return state;
}

export function useAnalyticsPull(): AnalyticsPullState {
  return useSyncExternalStore(subscribe, getAnalyticsPullState);
}

export interface PullParams {
  projectId: string;
  startDate: string;
  endDate: string;
  refresh: boolean;
}

export async function startAnalyticsPull(params: PullParams): Promise<void> {
  if (state.status === 'pulling') return;
  const { projectId, startDate, endDate, refresh } = params;
  if (!projectId) return;

  const mode: PullMode = refresh ? 'scrape' : 'cache';
  const totalSteps = 2 + AN_PLATFORMS.length;
  let aggMeta: AnPullMeta = { cacheHits: 0, liveCalls: 0 };
  let completedSteps = 0;

  const updateProgress = () => {
    setState({
      progress: {
        mode,
        message: progressMessage(mode, aggMeta.cacheHits, aggMeta.liveCalls),
        cacheHits: aggMeta.cacheHits,
        liveCalls: aggMeta.liveCalls,
        completedSteps,
        totalSteps,
      },
    });
  };

  setState({
    status: 'pulling',
    error: null,
    progress: {
      mode,
      message: refresh ? 'Scraping live data from platforms…' : 'Checking cache for saved data…',
      cacheHits: 0,
      liveCalls: 0,
      completedSteps: 0,
      totalSteps,
    },
  });

  const key = bundleKey(projectId, startDate, endDate);
  const query = { startDate, endDate, projectId, refresh };

  try {
    const overviewPromise = AnalyticsAPI.getOverview(query).then((raw) => {
      const { data, meta } = stripMeta(raw);
      aggMeta = mergeMeta(aggMeta, meta);
      completedSteps += 1;
      updateProgress();
      return data;
    });

    const masterPromise = AnalyticsAPI.getMaster({ startDate, endDate, refresh }).then((raw) => {
      if (raw._meta) {
        aggMeta = mergeMeta(aggMeta, raw._meta);
        completedSteps += 1;
        updateProgress();
      }
      return raw.rows;
    });

    const contentPromises = AN_PLATFORMS.map((platform) =>
      AnalyticsAPI.getPlatformContent(platform, query)
        .then((raw) => {
          const { data, meta } = stripMeta(raw);
          aggMeta = mergeMeta(aggMeta, meta);
          completedSteps += 1;
          updateProgress();
          return { platform, content: data };
        })
        .catch((e: unknown) => {
          completedSteps += 1;
          updateProgress();
          return {
            platform,
            content: null,
            error: e instanceof Error ? e.message : 'Failed to load content',
          };
        }),
    );

    const [overview, master, ...contentResults] = await Promise.all([
      overviewPromise,
      masterPromise,
      ...contentPromises,
    ]);

    const platforms = {} as Record<AnPlatform, PlatformBundle>;
    for (const result of contentResults) {
      platforms[result.platform] = {
        content: result.content,
        contentError: 'error' in result ? result.error : undefined,
      };
    }

    setState({
      status: 'done',
      bundles: {
        ...state.bundles,
        [key]: {
          cacheKey: key,
          overview,
          platforms,
          master,
          pulledAt: Date.now(),
          pullMeta: aggMeta,
        },
      },
      completionId: state.completionId + 1,
      progress: null,
    });
  } catch (e) {
    setState({
      status: 'error',
      error: e instanceof Error ? e.message : 'Failed to pull data',
      completionId: state.completionId + 1,
      progress: null,
    });
  }
}
