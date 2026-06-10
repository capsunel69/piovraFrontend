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
} from '../components/ui/primitives';
import LoadingState from '../components/shared/LoadingState';
import ErrorMessage from '../components/shared/ErrorMessage';
import { AnalyticsChart } from '../components/analytics/AnalyticsChart';
import { DateRangePicker, getDateRangeFromPreset, type DateRange } from '../components/analytics/DateRangePicker';
import { PlatformBreakdown } from '../components/analytics/PlatformBreakdown';
import { StatCard } from '../components/analytics/StatCard';
import { ContentGrid } from '../components/analytics/ContentGrid';
import { SettingsPanel } from '../components/analytics/SettingsPanel';
import { AnalyticsAPI } from '../services/analytics';
import type {
  AnAccount,
  AnContentResponse,
  AnDataPoint,
  AnMetricKey,
  AnOverviewResponse,
  AnPlatform,
  AnProject,
} from '../types/analytics';
import {
  AN_METRIC_LABELS,
  AN_PLATFORM_LABELS,
  AN_PLATFORMS,
} from '../types/analytics';

const STORAGE_KEY = 'piovra.analytics.dateRange';

type TabId = 'overview' | AnPlatform | 'settings';

const TabBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  border-bottom: 1px solid var(--border-1);
  padding-bottom: var(--s-3);
`;

const Tab = styled.button<{ $active?: boolean }>`
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: var(--r-md);
  border: none;
  cursor: pointer;
  background: ${(p) => (p.$active ? 'rgba(76, 194, 255, 0.15)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--accent)' : 'var(--text-2)')};
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

const Analytics: React.FC = () => {
  const [tab, setTab] = useState<TabId>('overview');
  const [range, setRange] = useState<DateRange>(loadStoredRange);
  const [projects, setProjects] = useState<AnProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [accounts, setAccounts] = useState<AnAccount[]>([]);
  const [overview, setOverview] = useState<AnOverviewResponse | null>(null);
  const [platformData, setPlatformData] = useState<AnDataPoint[]>([]);
  const [platformContent, setPlatformContent] = useState<AnContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const queryBase = useMemo(
    () => ({
      startDate: range.startDate,
      endDate: range.endDate,
      projectId: activeProjectId || undefined,
    }),
    [range, activeProjectId],
  );

  const loadOverview = useCallback(
    async (refresh = false) => {
      if (!activeProjectId) return;
      setDataLoading(true);
      setError(null);
      try {
        const data = await AnalyticsAPI.getOverview({ ...queryBase, refresh });
        setOverview(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load overview');
      } finally {
        setDataLoading(false);
        setRefreshing(false);
      }
    },
    [activeProjectId, queryBase],
  );

  const loadPlatform = useCallback(
    async (platform: AnPlatform, refresh = false) => {
      if (!activeProjectId) return;
      setDataLoading(true);
      setError(null);
      try {
        const [analytics, content] = await Promise.all([
          AnalyticsAPI.getPlatformAnalytics(platform, { ...queryBase, refresh }),
          AnalyticsAPI.getPlatformContent(platform, { ...queryBase, refresh }),
        ]);
        setPlatformData(analytics);
        setPlatformContent(content);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Failed to load ${platform}`);
      } finally {
        setDataLoading(false);
        setRefreshing(false);
      }
    },
    [activeProjectId, queryBase],
  );

  useEffect(() => {
    if (!activeProjectId || loading) return;
    if (tab === 'overview') void loadOverview();
    else if (tab !== 'settings') void loadPlatform(tab);
  }, [tab, activeProjectId, loading, loadOverview, loadPlatform, range.startDate, range.endDate]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (tab === 'overview') void loadOverview(true);
    else if (tab !== 'settings') void loadPlatform(tab, true);
    else setRefreshing(false);
  };

  const metricKeys = Object.keys(AN_METRIC_LABELS) as AnMetricKey[];

  if (loading) return <LoadingState message="Loading analytics…" />;

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle><IconAnalytics size={24} /> Analytics</PageTitle>
          <PageSubtitle>Social media performance across YouTube, Facebook, Instagram, and TikTok</PageSubtitle>
        </div>
        {projects.length > 0 && (
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
        {AN_PLATFORMS.map((p) => (
          <Tab key={p} $active={tab === p} onClick={() => setTab(p)}>{AN_PLATFORM_LABELS[p]}</Tab>
        ))}
        <Tab $active={tab === 'settings'} onClick={() => setTab('settings')}>Settings</Tab>
      </TabBar>

      {tab !== 'settings' && (
        <DateRangePicker
          range={range}
          onChange={setRange}
          onRefresh={handleRefresh}
          refreshing={refreshing || dataLoading}
        />
      )}

      {error && <ErrorMessage message={error} />}

      {tab === 'overview' && (
        <Stack $gap={4}>
          <Grid $cols={5} $min="160px">
            {metricKeys.map((key) => (
              <StatCard
                key={key}
                title={AN_METRIC_LABELS[key]}
                value={overview?.totals[key] ?? 0}
                comparison={overview?.comparisons[key]}
                large={key === 'views'}
              />
            ))}
          </Grid>
          <AnalyticsChart data={overview?.data ?? []} loading={dataLoading} />
          <PlatformBreakdown overview={overview} />
        </Stack>
      )}

      {AN_PLATFORMS.includes(tab as AnPlatform) && (
        <Stack $gap={4}>
          {platformContent?.profile && (
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              <strong>{platformContent.profile.name}</strong>
              {platformContent.profile.followerCount != null && (
                <span> · {platformContent.profile.followerCount.toLocaleString()} followers</span>
              )}
            </div>
          )}
          <AnalyticsChart
            data={platformData}
            loading={dataLoading}
            platforms={[tab as AnPlatform]}
          />
          <ContentGrid items={platformContent?.items ?? []} />
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
