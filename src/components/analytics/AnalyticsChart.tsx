import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnDataPoint, AnMetricKey, AnPlatform } from '../../types/analytics';
import {
  AN_METRIC_LABELS,
  AN_PLATFORM_COLORS,
  AN_PLATFORM_LABELS,
  AN_PLATFORMS,
} from '../../types/analytics';

const Wrap = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-5);
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-bottom: var(--s-4);
`;

const Chip = styled.button<{ $active?: boolean; $color?: string }>`
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--r-sm);
  border: 1px solid ${(p) => (p.$active ? (p.$color ?? 'var(--accent)') : 'var(--border-1)')};
  background: ${(p) => (p.$active ? `${p.$color ?? 'var(--accent)'}22` : 'transparent')};
  color: ${(p) => (p.$active ? (p.$color ?? 'var(--accent)') : 'var(--text-3)')};
  cursor: pointer;
`;

export type ChartRow = Record<string, string | number>;

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function buildChartRows(data: AnDataPoint[], metric: AnMetricKey): ChartRow[] {
  const byDate = new Map<string, ChartRow>();
  for (const point of data) {
    const row = byDate.get(point.date) ?? { date: point.date };
    row[point.platform] = (Number(row[point.platform] ?? 0) + point[metric]) as number;
    byDate.set(point.date, row);
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

interface AnalyticsChartProps {
  data: AnDataPoint[];
  loading?: boolean;
  platforms?: AnPlatform[];
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  data,
  loading,
  platforms = AN_PLATFORMS,
}) => {
  const [metric, setMetric] = useState<AnMetricKey>('views');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const rows = useMemo(() => buildChartRows(data, metric), [data, metric]);

  if (loading) {
    return <Wrap style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>Loading chart…</Wrap>;
  }

  if (rows.length === 0) {
    return <Wrap style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>No data for this period</Wrap>;
  }

  const Chart = chartType === 'area' ? AreaChart : BarChart;

  return (
    <Wrap>
      <Controls>
        {(Object.keys(AN_METRIC_LABELS) as AnMetricKey[]).map((m) => (
          <Chip key={m} $active={metric === m} onClick={() => setMetric(m)}>
            {AN_METRIC_LABELS[m]}
          </Chip>
        ))}
        <Chip $active={chartType === 'area'} onClick={() => setChartType('area')}>Area</Chip>
        <Chip $active={chartType === 'bar'} onClick={() => setChartType('bar')}>Bar</Chip>
      </Controls>
      <ResponsiveContainer width="100%" height={300}>
        <Chart data={rows}>
          <CartesianGrid stroke="var(--border-1)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--text-3)' }}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickFormatter={formatNumber} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border-1)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => formatNumber(value)}
          />
          <Legend />
          {platforms.map((platform) =>
            chartType === 'area' ? (
              <Area
                key={platform}
                type="monotone"
                dataKey={platform}
                name={AN_PLATFORM_LABELS[platform]}
                stroke={AN_PLATFORM_COLORS[platform]}
                fill={`${AN_PLATFORM_COLORS[platform]}33`}
                stackId="1"
              />
            ) : (
              <Bar
                key={platform}
                dataKey={platform}
                name={AN_PLATFORM_LABELS[platform]}
                fill={AN_PLATFORM_COLORS[platform]}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </Wrap>
  );
};
