import { useSyncExternalStore } from 'react';
import { AnalyticsAPI } from '../services/analytics';
import type {
  AnContentResponse,
  AnMasterRow,
  AnOverviewResponse,
  AnPlatform,
} from '../types/analytics';
import { AN_PLATFORMS } from '../types/analytics';

/**
 * Module-level store for the analytics "Pull data" operation. Lives outside
 * React so an in-flight pull keeps running (and its results are kept in
 * memory) when the user navigates to another page and comes back.
 *
 * Bundles are cached per (project, date range) key, so switching between
 * ranges that were already pulled shows data instantly without re-pulling.
 */

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
};

export type PullStatus = 'idle' | 'pulling' | 'done' | 'error';

export interface AnalyticsPullState {
  status: PullStatus;
  /** All pulled bundles this session, keyed by `projectId:start:end`. */
  bundles: Record<string, PulledBundle>;
  error: string | null;
  /** Increments on every finished pull so listeners can react to completion. */
  completionId: number;
}

export function bundleKey(projectId: string, start: string, end: string): string {
  return `${projectId}:${start}:${end}`;
}

let state: AnalyticsPullState = {
  status: 'idle',
  bundles: {},
  error: null,
  completionId: 0,
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

  setState({ status: 'pulling', error: null });
  const key = bundleKey(projectId, startDate, endDate);
  const query = { startDate, endDate, projectId, refresh };

  try {
    const [overview, masterResult, ...contentResults] = await Promise.all([
      AnalyticsAPI.getOverview(query),
      AnalyticsAPI.getMaster({ startDate, endDate, refresh }),
      ...AN_PLATFORMS.map((platform) =>
        AnalyticsAPI.getPlatformContent(platform, query)
          .then((content) => ({ platform, content }))
          .catch((e: unknown) => ({
            platform,
            content: null,
            error: e instanceof Error ? e.message : 'Failed to load content',
          })),
      ),
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
          master: masterResult.rows,
          pulledAt: Date.now(),
        },
      },
      completionId: state.completionId + 1,
    });
  } catch (e) {
    setState({
      status: 'error',
      error: e instanceof Error ? e.message : 'Failed to pull data',
      completionId: state.completionId + 1,
    });
  }
}
