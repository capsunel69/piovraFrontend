import React, { useCallback, useEffect, useState } from 'react';
import LoadingState from '../shared/LoadingState';
import ErrorMessage from '../shared/ErrorMessage';
import {
  AdDateRangePicker,
  AdLineChart,
  AdPlatformBreakdown,
  AdStatGrid,
  AdTopBarBlock,
  Alert,
} from './AdShared';
import { useAdActiveAccount, useAdWorkspace } from '../../context/AdWorkspaceContext';
import {
  fetchAdAnalytics,
  type AdDataPoint,
  type AdMetricKey,
  type AdPlatform,
  ALL_AD_PLATFORMS,
} from '../../services/analyticsDashboard';
import {
  getPreviousPeriodRange,
  loadPersistedDateRange,
  savePersistedDateRange,
  type DateRange,
} from '../../lib/analytics/dates';
import { buildMetricComparisons } from '../../lib/analytics/comparison';
import { buildChartRows, sumByPlatform, sumMetric } from '../../lib/analytics/metrics';

const OverviewTab: React.FC = () => {
  const { activeProjectId } = useAdWorkspace();
  const yt = useAdActiveAccount('youtube');
  const fb = useAdActiveAccount('facebook');
  const ig = useAdActiveAccount('instagram');
  const tt = useAdActiveAccount('tiktok');

  const [dateRange, setDateRange] = useState<DateRange>(loadPersistedDateRange);
  const [data, setData] = useState<AdDataPoint[]>([]);
  const [prevData, setPrevData] = useState<AdDataPoint[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountIds = { youtube: yt, facebook: fb, instagram: ig, tiktok: tt };

  const load = useCallback(
    async (refresh = false) => {
      setError(null);
      if (refresh) setBusy(true);
      else setLoading(true);
      try {
        const prev = getPreviousPeriodRange(dateRange.startDate, dateRange.endDate);
        const opts = { projectId: activeProjectId, accountIds, refresh };
        const [current, previous] = await Promise.all([
          fetchAdAnalytics(dateRange.startDate, dateRange.endDate, opts),
          fetchAdAnalytics(prev.startDate, prev.endDate, opts).catch(() => ({ data: [], errors: {} })),
        ]);
        setData(current.data);
        setErrors(current.errors ?? {});
        setPrevData(previous.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setBusy(false);
      }
    },
    [dateRange, activeProjectId, yt, fb, ig, tt],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const onRangeChange = (range: DateRange) => {
    setDateRange(range);
    savePersistedDateRange(range);
  };

  if (loading && data.length === 0) return <LoadingState message="Loading overview…" />;

  const totals = {
    views: sumMetric(data, 'views'),
    posts: sumMetric(data, 'posts'),
    likes: sumMetric(data, 'likes'),
    shares: sumMetric(data, 'shares'),
    comments: sumMetric(data, 'comments'),
  };
  const prevTotals = {
    views: sumMetric(prevData, 'views'),
    posts: sumMetric(prevData, 'posts'),
    likes: sumMetric(prevData, 'likes'),
    shares: sumMetric(prevData, 'shares'),
    comments: sumMetric(prevData, 'comments'),
  };
  const comparisons = buildMetricComparisons(totals, prevTotals);
  const totalsByPlatform = {
    views: sumByPlatform(data, 'views'),
    posts: sumByPlatform(data, 'posts'),
    likes: sumByPlatform(data, 'likes'),
    shares: sumByPlatform(data, 'shares'),
    comments: sumByPlatform(data, 'comments'),
  } as Record<AdMetricKey, Record<AdPlatform, number>>;

  return (
    <>
      <AdTopBarBlock
        title="Overview"
        subtitle="Unified analytics across all platforms"
        busy={busy}
        onRefresh={() => void load(false)}
        onRescrape={() => void load(true)}
      >
        <AdDateRangePicker value={dateRange} onChange={onRangeChange} />
      </AdTopBarBlock>

      {error && <ErrorMessage message={error} onRetry={() => void load(false)} />}
      {Object.keys(errors).length > 0 && (
        <Alert $variant="warn">
          Some platforms failed:{' '}
          {Object.entries(errors)
            .map(([p, m]) => `${p}: ${m}`)
            .join(' · ')}
        </Alert>
      )}

      <AdStatGrid totals={totals} comparisons={comparisons} />
      <AdLineChart
        rows={buildChartRows(data, dateRange.startDate, dateRange.endDate, ALL_AD_PLATFORMS, 'views')}
        platforms={ALL_AD_PLATFORMS}
      />
      <AdPlatformBreakdown totalsByPlatform={totalsByPlatform} />
    </>
  );
};

export default OverviewTab;
