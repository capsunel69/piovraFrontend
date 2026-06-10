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
import { AN_METRIC_LABELS, AN_PLATFORMS } from '../../types/analytics';
import { PLATFORM_META } from './platformMeta';
import { formatDateRo, formatDayMonthRo } from '../../utils/dateFormat';

const Wrap = styled.div<{ $accent?: string }>`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-5);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 2px;
    background: ${(p) =>
      p.$accent ? `linear-gradient(90deg, ${p.$accent}, transparent 70%)` : 'transparent'};
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
  margin-bottom: var(--s-4);
  flex-wrap: wrap;
`;

const Title = styled.h3`
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
`;

const Chip = styled.button<{ $active?: boolean }>`
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--r-sm);
  border: 1px solid ${(p) => (p.$active ? 'var(--accent)' : 'var(--border-1)')};
  background: ${(p) => (p.$active ? 'rgba(76, 194, 255, 0.13)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--accent)' : 'var(--text-3)')};
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
  metric: AnMetricKey;
  loading?: boolean;
  platforms?: AnPlatform[];
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  data,
  metric,
  loading,
  platforms = AN_PLATFORMS,
}) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const rows = useMemo(() => buildChartRows(data, metric), [data, metric]);
  const single = platforms.length === 1 ? platforms[0] : null;
  const accent = single ? PLATFORM_META[single].color : undefined;

  if (loading) {
    return (
      <Wrap $accent={accent} style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
        Loading…
      </Wrap>
    );
  }

  if (rows.length === 0) {
    return (
      <Wrap $accent={accent} style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
        No {AN_METRIC_LABELS[metric].toLowerCase()} data for this period
      </Wrap>
    );
  }

  const Chart = chartType === 'area' ? AreaChart : BarChart;

  return (
    <Wrap $accent={accent}>
      <HeaderRow>
        <Title>{AN_METRIC_LABELS[metric]}</Title>
        <div style={{ display: 'flex', gap: 6 }}>
          <Chip $active={chartType === 'area'} onClick={() => setChartType('area')}>Area</Chip>
          <Chip $active={chartType === 'bar'} onClick={() => setChartType('bar')}>Bar</Chip>
        </div>
      </HeaderRow>
      <ResponsiveContainer width="100%" height={240}>
        <Chart data={rows}>
          <CartesianGrid stroke="var(--border-1)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--text-3)' }}
            tickFormatter={formatDayMonthRo}
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
            labelFormatter={(label: string) => formatDateRo(label)}
          />
          {!single && <Legend />}
          {platforms.map((platform) =>
            chartType === 'area' ? (
              <Area
                key={platform}
                type="monotone"
                dataKey={platform}
                name={PLATFORM_META[platform].label}
                stroke={PLATFORM_META[platform].color}
                fill={`${PLATFORM_META[platform].color}33`}
                stackId="1"
              />
            ) : (
              <Bar
                key={platform}
                dataKey={platform}
                name={PLATFORM_META[platform].label}
                fill={PLATFORM_META[platform].color}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </Wrap>
  );
};
