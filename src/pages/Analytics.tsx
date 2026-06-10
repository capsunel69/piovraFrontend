import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  IconAnalytics,
  IconGrid,
  IconSpark,
  IconTerminal,
  IconSettings,
  IconDashboard,
} from '../components/ui/icons';
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageSubtitle,
  Grid,
  Stack,
  Button,
  Spinner,
} from '../components/ui/primitives';
import LoadingState from '../components/shared/LoadingState';
import ErrorMessage from '../components/shared/ErrorMessage';
import { InfoTip } from '../components/ui/InfoTip';
import { AnalyticsChart } from '../components/analytics/AnalyticsChart';
import { DateRangePicker, getDateRangeFromPreset, type DateRange } from '../components/analytics/DateRangePicker';
import { PlatformBreakdown } from '../components/analytics/PlatformBreakdown';
import { PlatformHeader } from '../components/analytics/PlatformHeader';
import { MediaAvatar } from '../components/analytics/MediaImg';
import {
  PLATFORM_GLYPHS,
  PLATFORM_META,
  PLATFORM_METRIC_KEYS,
  platformsForMetric,
} from '../components/analytics/platformMeta';
import { StatCard } from '../components/analytics/StatCard';
import { MasterStatCard } from '../components/analytics/MasterStatCard';
import { ContentGrid } from '../components/analytics/ContentGrid';
import { SettingsPanel } from '../components/analytics/SettingsPanel';
import { UsagePanel } from '../components/analytics/UsagePanel';
import { AnalyticsAPI, mediaProxyUrl } from '../services/analytics';
import {
  bundleKey,
  bundleRange,
  deriveBundleForRange,
  startAnalyticsPull,
  useAnalyticsPull,
} from '../stores/analyticsPull';
import type {
  AnAccount,
  AnDataPoint,
  AnLogEntry,
  AnMetricKey,
  AnOverviewResponse,
  AnPlatform,
  AnProject,
  AnUsageResponse,
} from '../types/analytics';
import { AN_METRIC_LABELS, AN_PLATFORMS } from '../types/analytics';
import { formatDateRo, formatDateTimeRo } from '../utils/dateFormat';

const STORAGE_KEY = 'piovra.analytics.dateRange';

type TabId = 'overview' | AnPlatform | 'master' | 'usage' | 'logs' | 'settings';

const TabBar = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s-4);
  border-bottom: 1px solid var(--border-1);
  padding-bottom: var(--s-3);
  flex-wrap: wrap;
`;

const SocialTabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  flex: 1;
  min-width: 0;
`;

const UtilityTabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-1);
  padding: 4px;
  border-radius: var(--r-lg);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  flex-shrink: 0;
`;

const Tab = styled.button<{ $active?: boolean; $color?: string; $soft?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: ${(p) => (p.$active ? 600 : 500)};
  padding: 8px 14px;
  border-radius: var(--r-md);
  border: 1px solid ${(p) => (p.$active ? (p.$color ?? 'var(--accent)') : 'transparent')};
  cursor: pointer;
  background: ${(p) => (p.$active ? (p.$soft ?? 'rgba(76, 194, 255, 0.15)') : 'transparent')};
  color: ${(p) => (p.$active ? (p.$color ?? 'var(--accent)') : 'var(--text-2)')};
  transition: background 0.15s, color 0.15s, border-color 0.15s;

  svg { color: ${(p) => (p.$active ? (p.$color ?? 'var(--accent)') : 'var(--text-3)')}; }

  &:hover {
    color: ${(p) => p.$color ?? 'var(--accent)'};
    svg { color: ${(p) => p.$color ?? 'var(--accent)'}; }
  }
`;

const UtilityTab = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: ${(p) => (p.$active ? 600 : 500)};
  padding: 7px 12px;
  border-radius: var(--r-md);
  border: none;
  cursor: pointer;
  background: ${(p) => (p.$active ? 'var(--accent-soft)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--accent)' : 'var(--text-3)')};
  transition: background 0.15s, color 0.15s;

  svg { color: ${(p) => (p.$active ? 'var(--accent)' : 'var(--text-4)')}; }

  &:hover {
    color: var(--text-1);
    background: var(--bg-3);
    svg { color: var(--accent); }
  }
`;

const PullStatusPill = styled.span<{ $mode: 'cache' | 'scrape' | 'mixed' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: ${(p) =>
    p.$mode === 'scrape'
      ? 'rgba(251, 191, 36, 0.12)'
      : p.$mode === 'mixed'
        ? 'rgba(167, 139, 250, 0.12)'
        : 'rgba(76, 194, 255, 0.12)'};
  color: ${(p) =>
    p.$mode === 'scrape' ? '#fbbf24' : p.$mode === 'mixed' ? '#a78bfa' : 'var(--accent)'};
`;

const ControlCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-4);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
`;

const PullBar = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  flex-wrap: wrap;
`;

const StaleNote = styled.span`
  font-size: 12px;
  color: var(--warn, #fbbf24);
`;

const LastPull = styled.span`
  font-size: 12px;
  color: var(--text-3);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
`;

const StaleRangeBanner = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: 12px 16px;
  border-radius: var(--r-lg);
  border: 1px solid rgba(251, 191, 36, 0.35);
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.03));
  font-size: 13px;
  color: var(--text-2);
  flex-wrap: wrap;

  .icon {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: var(--r-md);
    display: grid;
    place-items: center;
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
    font-size: 15px;
  }

  .body {
    flex: 1;
    min-width: 200px;
    line-height: 1.45;

    strong { color: #fbbf24; font-variant-numeric: tabular-nums; }
  }
`;

const GatheringBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--s-3);
  padding: var(--s-8) var(--s-5);
  border: 1px dashed var(--border-1);
  border-radius: var(--r-lg);
  color: var(--text-2);
  font-size: 13px;
`;

const LogRow = styled.div<{ $level: string }>`
  display: flex;
  gap: var(--s-3);
  align-items: baseline;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-1);
  font-size: 12px;

  &:last-child { border-bottom: none; }

  .level {
    flex-shrink: 0;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 10px;
    color: ${(p) => (p.$level === 'error' ? '#f87171' : p.$level === 'warn' ? '#fbbf24' : '#34d399')};
  }
  .time { flex-shrink: 0; color: var(--text-3); font-variant-numeric: tabular-nums; }
  .source { flex-shrink: 0; color: var(--accent); }
  .msg { color: var(--text-2); word-break: break-word; }
`;

const ProjectChip = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$on ? 'var(--accent)' : 'var(--border-2)')};
  background: ${(p) => (p.$on ? 'var(--accent-soft)' : 'var(--bg-2)')};
  color: ${(p) => (p.$on ? 'var(--accent)' : 'var(--text-3)')};
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  text-decoration: ${(p) => (p.$on ? 'none' : 'line-through')};

  &:hover { border-color: var(--accent); }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${(p) => (p.$on ? 'var(--accent)' : 'var(--text-4)')};
  }
`;

const IncludedBubble = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bg-3);
  border: 1px solid var(--border-1);
  color: var(--text-2);

  strong { color: var(--accent); }
`;

const MasterTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-1);
  }
  th {
    color: var(--text-3);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.04em;
  }
  td { color: var(--text-2); font-variant-numeric: tabular-nums; }
`;

function loadStoredRange(): DateRange {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DateRange;
      if (parsed.startDate && parsed.endDate) return parsed;
    }
  } catch {
    /* ignore */
  }
  return getDateRangeFromPreset('last7');
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

const METRIC_KEYS = Object.keys(AN_METRIC_LABELS) as AnMetricKey[];

function platformSeries(overview: AnOverviewResponse, platform: AnPlatform): AnDataPoint[] {
  return overview.data.filter((d) => d.platform === platform);
}

function seriesTotals(series: AnDataPoint[]): Record<AnMetricKey, number> {
  const totals = { views: 0, posts: 0, likes: 0, comments: 0, shares: 0 } as Record<AnMetricKey, number>;
  for (const point of series) {
    for (const key of METRIC_KEYS) {
      totals[key] += (point[key] as number | undefined) ?? 0;
    }
  }
  return totals;
}

const Analytics: React.FC = () => {
  const [tab, setTab] = useState<TabId>('overview');
  const [range, setRange] = useState<DateRange>(loadStoredRange);
  const [projects, setProjects] = useState<AnProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [accounts, setAccounts] = useState<AnAccount[]>([]);
  const [masterMetric, setMasterMetric] = useState<AnMetricKey>('views');
  /** Project ids excluded from the Master roll-up (default: include all). */
  const [masterExcluded, setMasterExcluded] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<AnLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [usage, setUsage] = useState<AnUsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pull state lives in a module-level store so in-flight pulls (and their
  // results) survive navigating away from this page. Bundles are cached per
  // (project, date range), so revisiting an already-pulled range is instant.
  const pull = useAnalyticsPull();
  const dataLoading = pull.status === 'pulling';

  const loadWorkspace = useCallback(async () => {
    const ws = await AnalyticsAPI.getWorkspace();
    setProjects(ws.projects);
    setActiveProjectId(ws.active);
    setAccounts(ws.accounts);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadWorkspace();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load workspace');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadWorkspace]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
  }, [range]);

  const currentCacheKey = bundleKey(activeProjectId, range.startDate, range.endDate);
  const exactBundle = pull.bundles[currentCacheKey] ?? null;

  // Selected range fully covered by an already-pulled bundle (e.g. Yesterday
  // inside Last 7 days): slice it out client-side. Data is complete, so no
  // warning and no API call needed.
  const derivedBundle = useMemo(() => {
    if (exactBundle || !activeProjectId) return null;
    const containing = Object.values(pull.bundles)
      .filter((b) => {
        const r = bundleRange(b);
        return (
          r.projectId === activeProjectId &&
          r.start <= range.startDate &&
          r.end >= range.endDate
        );
      })
      .sort((a, b) => b.pulledAt - a.pulledAt)[0];
    if (!containing) return null;
    return deriveBundleForRange(containing, range.startDate, range.endDate);
  }, [exactBundle, activeProjectId, range.startDate, range.endDate, pull.bundles]);

  // Otherwise fall back to the most recent bundle for this project, shown
  // with a clear "incomplete" warning instead of auto-scraping the new range.
  const fallbackBundle = useMemo(() => {
    if (exactBundle || derivedBundle || !activeProjectId) return null;
    const candidates = Object.values(pull.bundles).filter((b) =>
      b.cacheKey.startsWith(`${activeProjectId}:`),
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) => (b.pulledAt > a.pulledAt ? b : a));
  }, [exactBundle, derivedBundle, activeProjectId, pull.bundles]);

  const bundle = exactBundle ?? derivedBundle ?? fallbackBundle;
  const hasData = bundle !== null;
  const isStaleRange = !exactBundle && !derivedBundle && fallbackBundle !== null;

  const staleRangeLabel = useMemo(() => {
    if (!isStaleRange || !fallbackBundle) return null;
    const { start, end } = bundleRange(fallbackBundle);
    if (!start || !end) return null;
    return { start, end };
  }, [isStaleRange, fallbackBundle]);

  const activePlatform = AN_PLATFORMS.includes(tab as AnPlatform) ? (tab as AnPlatform) : null;
  const activeOverview = hasData ? bundle!.overview : null;
  const activePlatformSeries = activeOverview && activePlatform
    ? platformSeries(activeOverview, activePlatform)
    : [];
  const activePlatformContent = hasData && activePlatform
    ? bundle!.platforms[activePlatform].content
    : null;
  const activePlatformTotals = useMemo(() => seriesTotals(activePlatformSeries), [activePlatformSeries]);
  const accountForPlatform = useCallback(
    (platform: AnPlatform) => accounts.find((a) => a.platform === platform && a.enabled) ?? null,
    [accounts],
  );

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await AnalyticsAPI.getLogs(200);
      setLogs(data.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  /** One pull loads overview + all platform content + master — every tab reads from the same bundle. */
  const pullData = useCallback(
    (refresh: boolean) => {
      setError(null);
      void startAnalyticsPull({
        projectId: activeProjectId,
        startDate: range.startDate,
        endDate: range.endDate,
        refresh,
      });
    },
    [activeProjectId, range],
  );

  // Auto-hydrate on first visit per project only. Changing the date range
  // afterwards never auto-pulls (which could trigger live scrapes) — instead
  // the last pulled bundle is shown with an "incomplete data" warning and the
  // user decides when to press "Pull data now".
  const autoPullAttempted = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading || !activeProjectId) return;
    if (pull.status === 'pulling') return;
    const hasAnyForProject = Object.keys(pull.bundles).some((k) =>
      k.startsWith(`${activeProjectId}:`),
    );
    if (hasAnyForProject) return;
    if (autoPullAttempted.current.has(activeProjectId)) return;
    autoPullAttempted.current.add(activeProjectId);
    void startAnalyticsPull({
      projectId: activeProjectId,
      startDate: range.startDate,
      endDate: range.endDate,
      refresh: false,
    });
  }, [loading, activeProjectId, range.startDate, range.endDate, pull.bundles, pull.status]);

  // Refresh logs whenever a pull finishes (success or failure).
  useEffect(() => {
    if (pull.completionId > 0) void loadLogs();
  }, [pull.completionId, loadLogs]);

  useEffect(() => {
    if (tab === 'logs') void loadLogs();
  }, [tab, loadLogs]);

  // Usage is local DB data (cheap), so it auto-loads when the tab opens or the range changes.
  useEffect(() => {
    if (tab !== 'usage') return;
    let cancelled = false;
    setUsageLoading(true);
    AnalyticsAPI.getUsage({ startDate: range.startDate, endDate: range.endDate })
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load usage');
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, range.startDate, range.endDate]);

  const masterRows = hasData ? bundle!.master : null;

  const masterProjects = useMemo(() => {
    if (!masterRows) return [];
    const seen = new Map<string, string>();
    for (const row of masterRows) {
      if (!seen.has(row.projectId)) seen.set(row.projectId, row.projectName);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [masterRows]);

  const masterIncludedRows = useMemo(
    () => (masterRows ?? []).filter((row) => !masterExcluded.has(row.projectId)),
    [masterRows, masterExcluded],
  );

  const sortedMasterRows = useMemo(() => {
    if (!masterRows) return null;
    return [...masterIncludedRows].sort(
      (a, b) => (b.totals[masterMetric] ?? 0) - (a.totals[masterMetric] ?? 0),
    );
  }, [masterRows, masterIncludedRows, masterMetric]);

  /** Sum daily series of the included rows per (date, platform) for charts. */
  const masterSeries = useMemo(() => {
    const byKey = new Map<string, AnDataPoint>();
    for (const row of masterIncludedRows) {
      for (const point of row.points ?? []) {
        const key = `${point.date}:${point.platform}`;
        const acc = byKey.get(key);
        if (acc) {
          acc.views += point.views;
          acc.posts += point.posts;
          acc.likes += point.likes;
          acc.shares += point.shares;
          acc.comments += point.comments;
        } else {
          byKey.set(key, { ...point });
        }
      }
    }
    return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [masterIncludedRows]);

  const masterTotals = useMemo(() => seriesTotals(masterSeries), [masterSeries]);

  const toggleMasterProject = useCallback((projectId: string) => {
    setMasterExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  if (loading) return <LoadingState message="Loading analytics…" />;

  const isDataTab = tab === 'overview' || tab === 'master' || AN_PLATFORMS.includes(tab as AnPlatform);
  const isUtilityTab = tab === 'master' || tab === 'usage' || tab === 'logs' || tab === 'settings';

  const pullStatusMode = ((): 'cache' | 'scrape' | 'mixed' | null => {
    if (!pull.progress) return null;
    const { mode, liveCalls, cacheHits } = pull.progress;
    if (mode === 'scrape' || (liveCalls > 0 && cacheHits === 0)) return 'scrape';
    if (liveCalls > 0 && cacheHits > 0) return 'mixed';
    return 'cache';
  })();

  const pullStatusLabel =
    pullStatusMode === 'scrape'
      ? 'Live scrape'
      : pullStatusMode === 'mixed'
        ? 'Cache + scrape'
        : pullStatusMode === 'cache'
          ? 'From cache'
          : null;

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle><IconAnalytics size={24} /> Analytics</PageTitle>
          <PageSubtitle>Social media performance across YouTube, Facebook, Instagram, and TikTok</PageSubtitle>
        </div>
        {projects.length > 0 && !isUtilityTab && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {projects.map((p) => (
              <Button
                key={p.id}
                $size="sm"
                $variant={p.id === activeProjectId ? 'primary' : 'ghost'}
                onClick={async () => {
                  await AnalyticsAPI.switchProject(p.id);
                  await loadWorkspace();
                }}
              >
                {p.name}
              </Button>
            ))}
          </div>
        )}
      </PageHeader>

      <TabBar>
        <SocialTabs>
          <Tab $active={tab === 'overview'} onClick={() => setTab('overview')}>
            <IconDashboard size={15} /> Overview
          </Tab>
          {AN_PLATFORMS.map((p) => {
            const Glyph = PLATFORM_GLYPHS[p];
            const meta = PLATFORM_META[p];
            const account = accountForPlatform(p);
            const avatar = account?.avatarUrl
              ? p === 'youtube'
                ? account.avatarUrl
                : mediaProxyUrl(account.avatarUrl)
              : undefined;
            return (
              <Tab
                key={p}
                $active={tab === p}
                $color={meta.color}
                $soft={meta.soft}
                onClick={() => setTab(p)}
              >
                <MediaAvatar src={avatar} size={16} glyph={<Glyph size={11} />} /> {meta.label}
              </Tab>
            );
          })}
        </SocialTabs>
        <UtilityTabs>
          <UtilityTab $active={tab === 'master'} onClick={() => setTab('master')}>
            <IconGrid size={14} /> Master
          </UtilityTab>
          <UtilityTab $active={tab === 'usage'} onClick={() => setTab('usage')}>
            <IconSpark size={14} /> Usage
          </UtilityTab>
          <UtilityTab $active={tab === 'logs'} onClick={() => setTab('logs')}>
            <IconTerminal size={14} /> Logs
          </UtilityTab>
          <UtilityTab $active={tab === 'settings'} onClick={() => setTab('settings')}>
            <IconSettings size={14} /> Settings
          </UtilityTab>
        </UtilityTabs>
      </TabBar>

      {isDataTab && (
        <ControlCard>
          <DateRangePicker range={range} onChange={setRange} />
          <PullBar>
            <Button $variant="primary" disabled={dataLoading} onClick={() => void pullData(false)}>
              {dataLoading ? (pull.progress?.message ?? 'Gathering data…') : 'Pull data now'}
            </Button>
            {dataLoading && pullStatusMode && pullStatusLabel && (
              <PullStatusPill $mode={pullStatusMode}>{pullStatusLabel}</PullStatusPill>
            )}
            <Button $variant="ghost" $size="sm" disabled={dataLoading} onClick={() => void pullData(true)}>
              Force rescrape
            </Button>
            <InfoTip text="Pull uses cached data when available (free). Force rescrape bypasses the cache and hits live APIs — it uses ScrapeCreators credits." />
            {hasData && (
              <LastPull>
                Last pull: {formatDateTimeRo(bundle!.pulledAt)}
                {(bundle!.pullMeta?.liveCalls ?? 0) === 0 && (bundle!.pullMeta?.cacheHits ?? 0) > 0 && (
                  <> · from cache</>
                )}
                {(bundle!.pullMeta?.liveCalls ?? 0) > 0 && (
                  <> · {bundle!.pullMeta!.liveCalls} live call{bundle!.pullMeta!.liveCalls !== 1 ? 's' : ''}</>
                )}
              </LastPull>
            )}
          </PullBar>
        </ControlCard>
      )}

      {(error ?? pull.error) && <ErrorMessage message={(error ?? pull.error)!} />}

      {isDataTab && !dataLoading && isStaleRange && staleRangeLabel && (
        <StaleRangeBanner>
          <span className="icon">⚠</span>
          <span className="body">
            Data shown is from your last pull covering{' '}
            <strong>{formatDateRo(staleRangeLabel.start)} → {formatDateRo(staleRangeLabel.end)}</strong>
            {' '}— it may be incomplete for the selected period. Press{' '}
            <strong>Pull data now</strong> to fetch the full range.
          </span>
          <Button $size="sm" $variant="primary" onClick={() => void pullData(false)}>
            Pull data now
          </Button>
        </StaleRangeBanner>
      )}

      {isDataTab && dataLoading && (
        <GatheringBox>
          <Spinner $size={28} />
          <span>{pull.progress?.message ?? 'Loading analytics data…'}</span>
          {pull.progress && (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {pull.progress.completedSteps}/{pull.progress.totalSteps} sources
              {pull.progress.liveCalls > 0 && ` · ${pull.progress.liveCalls} live`}
              {pull.progress.cacheHits > 0 && ` · ${pull.progress.cacheHits} cached`}
            </span>
          )}
        </GatheringBox>
      )}

      {isDataTab && !dataLoading && !hasData && (
        <GatheringBox>
          <span>No data available for this period. Try a different range or force rescrape.</span>
        </GatheringBox>
      )}

      {tab === 'overview' && !dataLoading && activeOverview && (
        <Stack $gap={4}>
          <Grid $cols={5} $min="160px">
            {METRIC_KEYS.map((key) => (
              <StatCard
                key={key}
                title={key === 'shares' ? 'Shares (FB + TikTok)' : AN_METRIC_LABELS[key]}
                value={activeOverview.totals[key] ?? 0}
                comparison={activeOverview.comparisons[key]}
                large={key === 'views'}
              />
            ))}
          </Grid>
          <PlatformBreakdown overview={activeOverview} accounts={accounts} onSelect={(p) => setTab(p)} />
          <Grid $min="420px">
            {METRIC_KEYS.map((key) => (
              <AnalyticsChart
                key={key}
                data={activeOverview.data}
                metric={key}
                platforms={platformsForMetric(key)}
              />
            ))}
          </Grid>
        </Stack>
      )}

      {activePlatform && !dataLoading && !hasData && (
        <PlatformHeader platform={activePlatform} content={null} account={accountForPlatform(activePlatform)} />
      )}

      {activePlatform && !dataLoading && hasData && (
        <Stack $gap={4}>
          <PlatformHeader
            platform={activePlatform}
            content={activePlatformContent}
            account={accountForPlatform(activePlatform)}
          />
          {bundle!.platforms[activePlatform].contentError && (
            <StaleNote>{bundle!.platforms[activePlatform].contentError}</StaleNote>
          )}
          <Grid $cols={PLATFORM_METRIC_KEYS[activePlatform].length} $min="160px">
            {PLATFORM_METRIC_KEYS[activePlatform].map((key) => (
              <StatCard
                key={key}
                title={AN_METRIC_LABELS[key]}
                value={activePlatformTotals[key]}
                accent={PLATFORM_META[activePlatform].color}
              />
            ))}
          </Grid>
          <Grid $min="420px">
            {PLATFORM_METRIC_KEYS[activePlatform].map((key) => (
              <AnalyticsChart
                key={key}
                data={activePlatformSeries}
                metric={key}
                platforms={[activePlatform]}
              />
            ))}
          </Grid>
          <ContentGrid items={activePlatformContent?.items ?? []} platform={activePlatform} />
        </Stack>
      )}

      {tab === 'master' && !dataLoading && sortedMasterRows && (
        <Stack $gap={4}>
          {/* Project filter chips + included-projects bubble */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {masterProjects.map((p) => (
              <ProjectChip
                key={p.id}
                $on={!masterExcluded.has(p.id)}
                onClick={() => toggleMasterProject(p.id)}
                title={masterExcluded.has(p.id) ? 'Include in summary' : 'Exclude from summary'}
              >
                <span className="dot" /> {p.name}
              </ProjectChip>
            ))}
            <IncludedBubble>
              Showing <strong>{masterProjects.length - masterExcluded.size}</strong> of{' '}
              {masterProjects.length} projects
            </IncludedBubble>
          </div>

          {/* Summed stat cards (like Overview, across included projects) */}
          <Grid $cols={5} $min="170px">
            {METRIC_KEYS.map((key) => (
              <MasterStatCard
                key={key}
                metric={key}
                title={key === 'shares' ? 'Shares (FB + TikTok)' : undefined}
                value={masterTotals[key]}
                large={key === 'views'}
              />
            ))}
          </Grid>

          {/* Charts across included projects, split by platform */}
          <Grid $min="420px">
            {METRIC_KEYS.map((key) => (
              <AnalyticsChart
                key={key}
                data={masterSeries}
                metric={key}
                platforms={platformsForMetric(key)}
              />
            ))}
          </Grid>

          {/* Ranking table */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {METRIC_KEYS.map((key) => (
              <Button
                key={key}
                $size="sm"
                $variant={masterMetric === key ? 'primary' : 'ghost'}
                onClick={() => setMasterMetric(key)}
              >
                {AN_METRIC_LABELS[key]}
              </Button>
            ))}
          </div>
          {sortedMasterRows.length === 0 ? (
            <GatheringBox><span>No accounts in the selected projects.</span></GatheringBox>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-1)', borderRadius: 'var(--r-lg)' }}>
              <MasterTable>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Project</th>
                    <th>Account</th>
                    <th>Platform</th>
                    {METRIC_KEYS.map((key) => (
                      <th key={key} style={{ color: masterMetric === key ? 'var(--accent)' : undefined }}>
                        {AN_METRIC_LABELS[key]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedMasterRows.map((row, i) => {
                    const Glyph = PLATFORM_GLYPHS[row.platform];
                    return (
                    <tr key={row.accountId}>
                      <td>{i + 1}</td>
                      <td>{row.projectName}</td>
                      <td>{row.accountLabel}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: PLATFORM_META[row.platform].color, fontWeight: 600 }}>
                          <Glyph size={13} /> {PLATFORM_META[row.platform].label}
                        </span>
                      </td>
                      {row.error ? (
                        <td colSpan={METRIC_KEYS.length} style={{ color: '#f87171' }}>{row.error}</td>
                      ) : (
                        METRIC_KEYS.map((key) => (
                          <td key={key} style={{ fontWeight: masterMetric === key ? 700 : 400 }}>
                            {PLATFORM_METRIC_KEYS[row.platform].includes(key)
                              ? formatCompact(row.totals[key] ?? 0)
                              : '—'}
                          </td>
                        ))
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </MasterTable>
            </div>
          )}
        </Stack>
      )}

      {tab === 'usage' && (
        <Stack $gap={4}>
          <ControlCard>
            <DateRangePicker range={range} onChange={setRange} />
          </ControlCard>
          {usageLoading && (
            <GatheringBox>
              <Spinner $size={28} />
              <span>Loading usage…</span>
            </GatheringBox>
          )}
          {!usageLoading && usage && <UsagePanel usage={usage} />}
        </Stack>
      )}

      {tab === 'logs' && (
        <Stack $gap={3}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button $size="sm" disabled={logsLoading} onClick={() => void loadLogs()}>
              {logsLoading ? 'Loading…' : 'Refresh'}
            </Button>
            <Button
              $size="sm"
              $variant="ghost"
              disabled={logsLoading || logs.length === 0}
              onClick={async () => {
                if (!confirm('Clear all analytics logs?')) return;
                await AnalyticsAPI.clearLogs();
                setLogs([]);
              }}
            >
              Clear
            </Button>
          </div>
          {logs.length === 0 ? (
            <GatheringBox><span>No log entries yet. Pull some data first.</span></GatheringBox>
          ) : (
            <div style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
              {logs.map((entry) => (
                <LogRow key={entry.id} $level={entry.level}>
                  <span className="level">{entry.level}</span>
                  <span className="time">{formatDateTimeRo(entry.createdAt)}</span>
                  <span className="source">{entry.source}</span>
                  <span className="msg">
                    {entry.message}
                    {entry.details?.ms != null && (
                      <span style={{ color: 'var(--text-3)' }}> · {String(entry.details.ms)}ms</span>
                    )}
                  </span>
                </LogRow>
              ))}
            </div>
          )}
        </Stack>
      )}

      {tab === 'settings' && (
        <SettingsPanel
          projects={projects}
          activeProjectId={activeProjectId}
          accounts={accounts}
          onWorkspaceChange={loadWorkspace}
        />
      )}
    </PageContainer>
  );
};

export default Analytics;
