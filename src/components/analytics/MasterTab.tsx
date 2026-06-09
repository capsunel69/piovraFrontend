import React, { useCallback, useEffect, useState } from 'react';
import LoadingState from '../shared/LoadingState';
import ErrorMessage from '../shared/ErrorMessage';
import {
  AdDateRangePicker,
  AdStatGrid,
  AdTopBarBlock,
  Alert,
  DataTable,
  Dot,
  Select,
} from './AdShared';
import { useAdWorkspace } from '../../context/AdWorkspaceContext';
import {
  AD_METRIC_LABELS,
  AD_PLATFORM_COLORS,
  AD_PLATFORM_LABELS,
  ALL_AD_PLATFORMS,
  fetchAdMasterOverview,
  type AdMetricKey,
  type AdPlatform,
} from '../../services/analyticsDashboard';
import { loadPersistedDateRange, savePersistedDateRange, type DateRange } from '../../lib/analytics/dates';
import { formatCompact } from '../../lib/analytics/metrics';

const MasterTab: React.FC = () => {
  const { projects } = useAdWorkspace();
  const [dateRange, setDateRange] = useState(loadPersistedDateRange);
  const [projectId, setProjectId] = useState('all');
  const [platform, setPlatform] = useState<AdPlatform | 'all'>('all');
  const [metric, setMetric] = useState<AdMetricKey>('views');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdMasterOverview>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setError(null);
      if (refresh) setBusy(true);
      else setLoading(true);
      try {
        const res = await fetchAdMasterOverview(dateRange.startDate, dateRange.endDate, {
          refresh,
          projectId: projectId === 'all' ? undefined : projectId,
          platform,
          metric,
        });
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setBusy(false);
      }
    },
    [dateRange, projectId, platform, metric],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading && !data) return <LoadingState message="Loading master overview…" />;

  return (
    <>
      <AdTopBarBlock
        title="Master Overview"
        subtitle="Cross-project ranking"
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select value={platform} onChange={(e) => setPlatform(e.target.value as AdPlatform | 'all')} style={{ maxWidth: 160 }}>
          <option value="all">All platforms</option>
          {ALL_AD_PLATFORMS.map((p) => (
            <option key={p} value={p}>{AD_PLATFORM_LABELS[p]}</option>
          ))}
        </Select>
        <Select value={metric} onChange={(e) => setMetric(e.target.value as AdMetricKey)} style={{ maxWidth: 140 }}>
          {(Object.keys(AD_METRIC_LABELS) as AdMetricKey[]).map((m) => (
            <option key={m} value={m}>{AD_METRIC_LABELS[m]}</option>
          ))}
        </Select>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => void load(false)} />}
      {data && (
        <>
          <AdStatGrid totals={data.totals} comparisons={data.comparisons} />
          <Alert>Top accounts by {AD_METRIC_LABELS[metric]}</Alert>
          <DataTable>
            <thead>
              <tr>
                <th>Account</th>
                <th>Project</th>
                <th>Platform</th>
                <th>{AD_METRIC_LABELS[metric]}</th>
              </tr>
            </thead>
            <tbody>
              {data.topAccounts.map((row) => (
                <tr key={row.accountId}>
                  <td>{row.accountLabel} <span style={{ color: 'var(--text-3)' }}>({row.handle})</span></td>
                  <td>{row.projectName}</td>
                  <td><Dot $color={AD_PLATFORM_COLORS[row.platform]} />{AD_PLATFORM_LABELS[row.platform]}</td>
                  <td>{formatCompact(row.totals[metric])}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      )}
    </>
  );
};

export default MasterTab;
