import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { IconAnalytics } from '../components/ui/icons';
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
import { ContentGrid } from '../components/analytics/ContentGrid';
import { SettingsPanel } from '../components/analytics/SettingsPanel';
import { AnalyticsAPI, mediaProxyUrl } from '../services/analytics';
import {
  bundleKey,
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
} from '../types/analytics';
import { AN_METRIC_LABELS, AN_PLATFORMS } from '../types/analytics';

const STORAGE_KEY = 'piovra.analytics.dateRange';

type TabId = 'overview' | AnPlatform | 'master' | 'logs' | 'settings';

const TabBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  border-bottom: 1px solid var(--border-1);
  padding-bottom: var(--s-3);
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
  const [logs, setLogs] = useState<AnLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
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
  const bundle = pull.bundles[currentCacheKey] ?? null;
  const hasData = bundle !== null;

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

  // Refresh logs whenever a pull finishes (success or failure).
  useEffect(() => {
    if (pull.completionId > 0) void loadLogs();
  }, [pull.completionId, loadLogs]);

  useEffect(() => {
    if (tab === 'logs') void loadLogs();
  }, [tab, loadLogs]);

  const sortedMasterRows = useMemo(() => {
    if (!hasData) return null;
    return [...bundle!.master].sort(
      (a, b) => (b.totals[masterMetric] ?? 0) - (a.totals[masterMetric] ?? 0),
    );
  }, [bundle, hasData, masterMetric]);

  if (loading) return <LoadingState message="Loading analytics…" />;

  const isDataTab = tab === 'overview' || tab === 'master' || AN_PLATFORMS.includes(tab as AnPlatform);

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle><IconAnalytics size={24} /> Analytics</PageTitle>
          <PageSubtitle>Social media performance across YouTube, Facebook, Instagram, and TikTok</PageSubtitle>
        </div>
        {projects.length > 0 && tab !== 'master' && (
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
        <Tab $active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</Tab>
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
        <Tab $active={tab === 'master'} onClick={() => setTab('master')}>Master</Tab>
        <Tab $active={tab === 'logs'} onClick={() => setTab('logs')}>Logs</Tab>
        <Tab $active={tab === 'settings'} onClick={() => setTab('settings')}>Settings</Tab>
      </TabBar>

      {isDataTab && (
        <ControlCard>
          <DateRangePicker range={range} onChange={setRange} />
          <PullBar>
            <Button $variant="primary" disabled={dataLoading} onClick={() => void pullData(false)}>
              {dataLoading ? 'Gathering data…' : 'Pull data now'}
            </Button>
            <Button $variant="ghost" $size="sm" disabled={dataLoading} onClick={() => void pullData(true)}>
              Force rescrape
            </Button>
            <InfoTip text="Pull uses cached data when available (free). Force rescrape bypasses the cache and hits live APIs — it uses ScrapeCreators credits." />
            {hasData && (
              <LastPull>
                Last pull: {new Date(bundle!.pulledAt).toLocaleString()}
              </LastPull>
            )}
          </PullBar>
        </ControlCard>
      )}

      {(error ?? pull.error) && <ErrorMessage message={(error ?? pull.error)!} />}

      {isDataTab && dataLoading && (
        <GatheringBox>
          <Spinner $size={28} />
          <span>Gathering data from platforms… this can take a minute on first pull.</span>
        </GatheringBox>
      )}

      {isDataTab && !dataLoading && !hasData && (
        <GatheringBox>
          <span>No data loaded yet. Pick a date range and press "Pull data now".</span>
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
        <Stack $gap={3}>
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
            <GatheringBox><span>No accounts configured in any project yet.</span></GatheringBox>
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
                  <span className="time">{new Date(entry.createdAt).toLocaleString()}</span>
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
