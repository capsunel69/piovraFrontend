import React, { useCallback, useEffect, useState } from 'react';
import LoadingState from '../shared/LoadingState';
import ErrorMessage from '../shared/ErrorMessage';
import { Badge } from '../ui/primitives';
import {
  AdDateRangePicker,
  AdLineChart,
  AdStatGrid,
  AdTopBarBlock,
  Select,
  VideoCard,
  VideoGrid,
} from './AdShared';
import { useAdActiveAccount, useAdWorkspace } from '../../context/AdWorkspaceContext';
import {
  AD_PLATFORM_LABELS,
  fetchAdPlatformAnalytics,
  fetchAdPlatformContent,
  type AdPlatform,
} from '../../services/analyticsDashboard';
import { buildMetricComparisons } from '../../lib/analytics/comparison';
import {
  getPreviousPeriodRange,
  loadPersistedDateRange,
  savePersistedDateRange,
} from '../../lib/analytics/dates';
import { buildChartRows, sumMetric } from '../../lib/analytics/metrics';

interface Props {
  platform: AdPlatform;
}

const PlatformTab: React.FC<Props> = ({ platform }) => {
  const { activeProjectId, accountsForPlatform, setActiveAccount } = useAdWorkspace();
  const activeAccountId = useAdActiveAccount(platform);
  const accounts = accountsForPlatform(platform);

  const [dateRange, setDateRange] = useState(loadPersistedDateRange);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof fetchAdPlatformAnalytics>>>([]);
  const [prevAnalytics, setPrevAnalytics] = useState<Awaited<ReturnType<typeof fetchAdPlatformAnalytics>>>([]);
  const [content, setContent] = useState<{ videos?: Array<{ id: string; title: string; thumbnailUrl?: string; url?: string; views?: number }>; posts?: unknown[]; profile?: { displayName?: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setError(null);
      if (refresh) setBusy(true);
      else setLoading(true);
      try {
        const prev = getPreviousPeriodRange(dateRange.startDate, dateRange.endDate);
        const opts = {
          refresh,
          projectId: activeProjectId,
          accountIds: { [platform]: activeAccountId } as Partial<Record<AdPlatform, string | null>>,
        };
        const [current, previous, contentRes] = await Promise.all([
          fetchAdPlatformAnalytics(platform, dateRange.startDate, dateRange.endDate, opts),
          fetchAdPlatformAnalytics(platform, prev.startDate, prev.endDate, opts).catch(() => []),
          fetchAdPlatformContent<typeof content>(platform, dateRange.startDate, dateRange.endDate, activeAccountId, refresh).catch(() => null),
        ]);
        setAnalytics(current);
        setPrevAnalytics(previous);
        setContent(contentRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setBusy(false);
      }
    },
    [dateRange, activeProjectId, activeAccountId, platform],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading && analytics.length === 0) {
    return <LoadingState message={`Loading ${AD_PLATFORM_LABELS[platform]}…`} />;
  }

  const totals = {
    views: sumMetric(analytics, 'views'),
    posts: sumMetric(analytics, 'posts'),
    likes: sumMetric(analytics, 'likes'),
    shares: sumMetric(analytics, 'shares'),
    comments: sumMetric(analytics, 'comments'),
  };
  const prevTotals = {
    views: sumMetric(prevAnalytics, 'views'),
    posts: sumMetric(prevAnalytics, 'posts'),
    likes: sumMetric(prevAnalytics, 'likes'),
    shares: sumMetric(prevAnalytics, 'shares'),
    comments: sumMetric(prevAnalytics, 'comments'),
  };

  const videos = (content as { videos?: Array<{ id: string; title: string; thumbnailUrl?: string; url?: string; views?: number }> } | null)?.videos ?? [];

  return (
    <>
      <AdTopBarBlock
        title={AD_PLATFORM_LABELS[platform]}
        subtitle={
          content && typeof content === 'object' && 'channel' in content
            ? String((content as { channel?: { title?: string } }).channel?.title ?? 'Platform analytics')
            : 'Platform analytics'
        }
        busy={busy}
        onRefresh={() => void load(false)}
        onRescrape={() => void load(true)}
      >
        <AdDateRangePicker
          value={dateRange}
          onChange={(r) => {
            setDateRange(r);
            savePersistedDateRange(r);
          }}
        />
      </AdTopBarBlock>

      {accounts.length > 1 && (
        <Select
          value={activeAccountId ?? ''}
          onChange={(e) => setActiveAccount(platform, e.target.value || null)}
          style={{ maxWidth: 320 }}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.label} — {a.handle}</option>
          ))}
        </Select>
      )}

      {error && <ErrorMessage message={error} onRetry={() => void load(false)} />}

      <AdStatGrid totals={totals} comparisons={buildMetricComparisons(totals, prevTotals)} />
      <AdLineChart
        rows={buildChartRows(analytics, dateRange.startDate, dateRange.endDate, [platform], 'views')}
        platforms={[platform]}
      />

      {videos.length > 0 && (
        <>
          <Badge $variant="neutral">{videos.length} items in range</Badge>
          <VideoGrid>
            {videos.map((v) => (
              <VideoCard key={v.id} href={v.url ?? '#'} target="_blank" rel="noreferrer">
                {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" /> : <div style={{ aspectRatio: '16/9', background: 'var(--bg-4)' }} />}
                <div className="meta">
                  <div>{v.title}</div>
                  {v.views != null && <div>{v.views.toLocaleString()} views</div>}
                </div>
              </VideoCard>
            ))}
          </VideoGrid>
        </>
      )}
    </>
  );
};

export default PlatformTab;
