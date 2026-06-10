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
  background: linear-gradient(180deg, var(--bg-3) 0%, var(--bg-2) 100%);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-5) var(--s-5) var(--s-4);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: ${(p) =>
      p.$accent
        ? `linear-gradient(90deg, ${p.$accent}, ${p.$accent}44 40%, transparent 85%)`
        : 'linear-gradient(90deg, var(--accent), transparent 70%)'};
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
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.01em;
`;

const ChipGroup = styled.div`
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: var(--r-md);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
`;

const Chip = styled.button<{ $active?: boolean }>`
  font-size: 11px;
  font-weight: 600;
  padding: 5px 11px;
  border-radius: calc(var(--r-md) - 2px);
  border: none;
  background: ${(p) => (p.$active ? 'var(--accent-soft)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--accent)' : 'var(--text-3)')};
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
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

const TooltipBox = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: var(--r-md);
  padding: 10px 12px;
  font-size: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);

  .label {
    font-weight: 600;
    color: var(--text-1);
    margin-bottom: 6px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    color: var(--text-2);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
`;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <TooltipBox>
      <div className="label">{formatDateRo(label)}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="row">
          <span className="dot" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <strong style={{ marginLeft: 'auto' }}>{formatNumber(entry.value)}</strong>
        </div>
      ))}
    </TooltipBox>
  );
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
      <Wrap $accent={accent} style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
        Loading…
      </Wrap>
    );
  }

  if (rows.length === 0) {
    return (
      <Wrap $accent={accent} style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
        No {AN_METRIC_LABELS[metric].toLowerCase()} data for this period
      </Wrap>
    );
  }

  const Chart = chartType === 'area' ? AreaChart : BarChart;
  const gridStroke = 'rgba(255,255,255,0.06)';

  return (
    <Wrap $accent={accent}>
      <HeaderRow>
        <Title>{AN_METRIC_LABELS[metric]}</Title>
        <ChipGroup>
          <Chip $active={chartType === 'area'} onClick={() => setChartType('area')}>Area</Chip>
          <Chip $active={chartType === 'bar'} onClick={() => setChartType('bar')}>Bar</Chip>
        </ChipGroup>
      </HeaderRow>
      <ResponsiveContainer width="100%" height={260}>
        <Chart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {platforms.map((platform) => {
              const color = PLATFORM_META[platform].color;
              return (
                <linearGradient key={platform} id={`grad-${platform}-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid stroke={gridStroke} strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--text-4)' }}
            tickLine={false}
            axisLine={{ stroke: gridStroke }}
            tickFormatter={formatDayMonthRo}
            dy={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-4)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatNumber}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-2)', strokeWidth: 1 }} />
          {!single && (
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              iconType="circle"
              iconSize={8}
            />
          )}
          {platforms.map((platform) => {
            const color = PLATFORM_META[platform].color;
            return chartType === 'area' ? (
              <Area
                key={platform}
                type="monotone"
                dataKey={platform}
                name={PLATFORM_META[platform].label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${platform}-${metric})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: color }}
              />
            ) : (
              <Bar
                key={platform}
                dataKey={platform}
                name={PLATFORM_META[platform].label}
                fill={color}
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            );
          })}
        </Chart>
      </ResponsiveContainer>
    </Wrap>
  );
};
