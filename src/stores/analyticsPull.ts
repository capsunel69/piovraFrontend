import { useSyncExternalStore } from 'react';
import { AnalyticsAPI } from '../services/analytics';
import type {
  AnContentResponse,
  AnMasterRow,
  AnMetricKey,
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
  /** Oldest platform refresh time in this bundle (ISO) — "data as of". */
  dataAsOf: string | null;
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

export function bundleRange(bundle: PulledBundle): { projectId: string; start: string; end: string } {
  const [projectId = '', start = '', end = ''] = bundle.cacheKey.split(':');
  return { projectId, start, end };
}

const METRICS: AnMetricKey[] = ['views', 'posts', 'likes', 'shares', 'comments'];

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return fmtDate(d);
}

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

function emptyTotals(): Record<AnMetricKey, number> {
  return { views: 0, posts: 0, likes: 0, shares: 0, comments: 0 };
}

/**
 * Slices a sub-range out of an already-pulled bundle entirely client-side —
 * no API calls. Used when the user selects e.g. "Yesterday" after pulling
 * "Last 7 days": all the daily points are already in memory.
 */
export function deriveBundleForRange(src: PulledBundle, start: string, end: string): PulledBundle {
  const { projectId, start: srcStart } = bundleRange(src);
  const inRange = (date: string) => date >= start && date <= end;

  const data = src.overview.data.filter((p) => inRange(p.date));

  const totals = emptyTotals();
  const byPlatform = {} as AnOverviewResponse['byPlatform'];
  for (const platform of AN_PLATFORMS) byPlatform[platform] = emptyTotals();
  for (const p of data) {
    for (const key of METRICS) {
      totals[key] += p[key];
      byPlatform[p.platform][key] += p[key];
    }
  }

  // Period-over-period comparison is only possible when the previous period
  // also falls inside the source bundle's range.
  const len = daysBetween(start, end);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(len - 1));
  let comparisons = {} as AnOverviewResponse['comparisons'];
  if (srcStart && prevStart >= srcStart) {
    const prevTotals = emptyTotals();
    for (const p of src.overview.data) {
      if (p.date >= prevStart && p.date <= prevEnd) {
        for (const key of METRICS) prevTotals[key] += p[key];
      }
    }
    comparisons = METRICS.reduce(
      (acc, key) => {
        const current = totals[key];
        const previous = prevTotals[key];
        acc[key] = {
          current,
          previous,
          delta: current - previous,
          percentChange: previous === 0 ? null : ((current - previous) / previous) * 100,
        };
        return acc;
      },
      {} as AnOverviewResponse['comparisons'],
    );
  }

  const platforms = {} as Record<AnPlatform, PlatformBundle>;
  for (const platform of AN_PLATFORMS) {
    const pb = src.platforms[platform];
    platforms[platform] = {
      contentError: pb?.contentError,
      content: pb?.content
        ? {
            ...pb.content,
            items: pb.content.items.filter((item) => inRange((item.publishedAt ?? '').slice(0, 10))),
          }
        : null,
    };
  }

  const master = src.master.map((row) => {
    const points = (row.points ?? []).filter((p) => inRange(p.date));
    const rowTotals = emptyTotals();
    for (const p of points) for (const key of METRICS) rowTotals[key] += p[key];
    return { ...row, points, totals: rowTotals };
  });

  return {
    cacheKey: bundleKey(projectId, start, end),
    overview: { data, totals, comparisons, byPlatform, errors: src.overview.errors },
    platforms,
    master,
    pulledAt: src.pulledAt,
    pullMeta: src.pullMeta,
    dataAsOf: src.dataAsOf,
  };
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

    // "Data as of" = the oldest platform refresh among loaded platforms, so
    // the label never overstates freshness.
    const asOfValues = contentResults
      .map((r) => r.content?.asOf)
      .filter((v): v is string => Boolean(v));
    const dataAsOf = asOfValues.length > 0 ? asOfValues.reduce((a, b) => (a < b ? a : b)) : null;

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
          dataAsOf,
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
