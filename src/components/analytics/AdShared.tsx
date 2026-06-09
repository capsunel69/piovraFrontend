import React from 'react';
import styled from 'styled-components';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Button, Card, CardBody, CardHeader, CardTitle, Grid } from '../ui/primitives';
import { IconRefresh } from '../ui/icons';
import {
  AD_METRIC_LABELS,
  AD_PLATFORM_COLORS,
  AD_PLATFORM_LABELS,
  type AdMetricKey,
  type AdPlatform,
} from '../../services/analyticsDashboard';
import { formatCompact } from '../../lib/analytics/metrics';
import { formatPercentChange, type MetricComparison } from '../../lib/analytics/comparison';
import { DATE_PRESETS, getDateRangeFromPreset, type DateRange } from '../../lib/analytics/dates';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export const AdLayout = styled.div`
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--s-4);
  min-height: 0;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const AdSideNav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--s-3);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  background: var(--bg-2);
  height: fit-content;
  position: sticky;
  top: var(--s-4);

  @media (max-width: 900px) {
    flex-direction: row;
    flex-wrap: wrap;
    position: static;
  }
`;

export const AdNavBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  border-radius: var(--r-sm);
  background: ${(p) => (p.$active ? 'var(--accent-soft)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--accent)' : 'var(--text-2)')};
  font-size: 13px;
  font-weight: ${(p) => (p.$active ? 600 : 500)};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

export const AdMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  min-width: 0;
`;

export const AdTopBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s-3);
  padding-bottom: var(--s-3);
  border-bottom: 1px solid var(--border-1);
`;

export const AdTitleBlock = styled.div`
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-1);
  }
  p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-3);
  }
`;

export const AdActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
`;

export const PresetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

export const Alert = styled.div<{ $variant?: 'error' | 'warn' }>`
  padding: 12px 14px;
  border-radius: var(--r-md);
  font-size: 13px;
  line-height: 1.45;
  border: 1px solid
    ${(p) => (p.$variant === 'error' ? 'rgba(255,100,100,0.35)' : 'rgba(255,180,80,0.35)')};
  background: ${(p) => (p.$variant === 'error' ? 'rgba(255,80,80,0.08)' : 'rgba(255,180,80,0.08)')};
  color: var(--text-2);
`;

export const StatCard = styled(Card)`
  padding: var(--s-4);
`;

export const StatTitle = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
  margin-bottom: 6px;
`;

export const StatValue = styled.div`
  font-size: 28px;
  font-weight: 600;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
`;

export const StatDelta = styled.div<{ $positive?: boolean }>`
  margin-top: 6px;
  font-size: 12px;
  color: ${(p) => (p.$positive ? 'var(--success)' : p.$positive === false ? 'var(--danger)' : 'var(--text-3)')};
`;

export const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  th,
  td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-1);
    font-size: 13px;
    text-align: left;
  }
  th {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
  }
  td {
    font-variant-numeric: tabular-nums;
  }
`;

export const Dot = styled.span<{ $color: string }>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  margin-right: 8px;
`;

export const Field = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-1);
  background: var(--bg-3);
  color: var(--text-1);
  font-size: 13px;
`;

export const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-1);
  background: var(--bg-3);
  color: var(--text-1);
  font-size: 13px;
`;

interface TopBarProps {
  title: string;
  subtitle?: string;
  busy?: boolean;
  onRefresh?: () => void;
  onRescrape?: () => void;
  children?: React.ReactNode;
}

export const AdTopBarBlock: React.FC<TopBarProps> = ({
  title,
  subtitle,
  busy,
  onRefresh,
  onRescrape,
  children,
}) => (
  <AdTopBar>
    <AdTitleBlock>
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </AdTitleBlock>
    <AdActions>
      {children}
      {onRefresh && (
        <Button type="button" $size="sm" $variant="secondary" disabled={busy} onClick={onRefresh}>
          <IconRefresh />
          Refresh
        </Button>
      )}
      {onRescrape && (
        <Button type="button" $size="sm" $variant="primary" disabled={busy} onClick={onRescrape}>
          Rescrape
        </Button>
      )}
    </AdActions>
  </AdTopBar>
);

interface DatePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export const AdDateRangePicker: React.FC<DatePickerProps> = ({ value, onChange }) => (
  <PresetRow>
    {DATE_PRESETS.map((p) => (
      <Button
        key={p.id}
        type="button"
        $size="sm"
        $variant={value.preset === p.id ? 'primary' : 'secondary'}
        onClick={() => onChange(getDateRangeFromPreset(p.id))}
      >
        {p.label}
      </Button>
    ))}
  </PresetRow>
);

interface StatGridProps {
  totals: Record<AdMetricKey, number>;
  comparisons?: Record<AdMetricKey, MetricComparison> | null;
}

export const AdStatGrid: React.FC<StatGridProps> = ({ totals, comparisons }) => (
  <Grid $min="140px">
    {(Object.keys(AD_METRIC_LABELS) as AdMetricKey[]).map((key) => {
      const cmp = comparisons?.[key];
      return (
        <StatCard key={key}>
          <StatTitle>{AD_METRIC_LABELS[key]}</StatTitle>
          <StatValue>{formatCompact(totals[key] ?? 0)}</StatValue>
          {cmp && (
            <StatDelta $positive={cmp.delta > 0 ? true : cmp.delta < 0 ? false : undefined}>
              {formatPercentChange(cmp.percentChange)} vs prev
            </StatDelta>
          )}
        </StatCard>
      );
    })}
  </Grid>
);

interface PlatformBreakdownProps {
  totalsByPlatform: Record<AdMetricKey, Record<AdPlatform, number>>;
}

export const AdPlatformBreakdown: React.FC<PlatformBreakdownProps> = ({ totalsByPlatform }) => (
  <Card>
    <CardHeader>
      <CardTitle>By platform</CardTitle>
    </CardHeader>
    <CardBody style={{ padding: 0 }}>
      <DataTable>
        <thead>
          <tr>
            <th>Platform</th>
            <th>Views</th>
            <th>Posts</th>
            <th>Likes</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(AD_PLATFORM_LABELS) as AdPlatform[]).map((p) => (
            <tr key={p}>
              <td>
                <Dot $color={AD_PLATFORM_COLORS[p]} />
                {AD_PLATFORM_LABELS[p]}
              </td>
              <td>{formatCompact(totalsByPlatform.views?.[p] ?? 0)}</td>
              <td>{formatCompact(totalsByPlatform.posts?.[p] ?? 0)}</td>
              <td>{formatCompact(totalsByPlatform.likes?.[p] ?? 0)}</td>
              <td>{formatCompact(totalsByPlatform.comments?.[p] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </CardBody>
  </Card>
);

interface ChartProps {
  rows: Array<{ date: string; [key: string]: string | number }>;
  platforms: AdPlatform[];
  metric?: AdMetricKey;
}

export const AdLineChart: React.FC<ChartProps> = ({ rows, platforms, metric = 'views' }) => {
  const labels = rows.map((r) => r.date.slice(5));
  const datasets = platforms.map((platform) => ({
    label: AD_PLATFORM_LABELS[platform],
    data: rows.map((r) => Number(r[platform] ?? 0)),
    borderColor: AD_PLATFORM_COLORS[platform],
    backgroundColor: `${AD_PLATFORM_COLORS[platform]}33`,
    tension: 0.3,
    fill: false,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{AD_METRIC_LABELS[metric]} over time</CardTitle>
      </CardHeader>
      <CardBody style={{ padding: 'var(--s-4)' }}>
        <Line
          data={{ labels, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: '#9aa4b2' } } },
            scales: {
              x: { ticks: { color: '#9aa4b2' }, grid: { color: 'rgba(255,255,255,0.06)' } },
              y: { ticks: { color: '#9aa4b2' }, grid: { color: 'rgba(255,255,255,0.06)' } },
            },
          }}
        />
      </CardBody>
    </Card>
  );
};

export const VideoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--s-3);
`;

export const VideoCard = styled.a`
  display: block;
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--bg-3);
  color: inherit;
  text-decoration: none;

  img {
    width: 100%;
    aspect-ratio: 16/9;
    object-fit: cover;
    background: var(--bg-4);
  }

  .meta {
    padding: 10px 12px;
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.4;
  }
`;
