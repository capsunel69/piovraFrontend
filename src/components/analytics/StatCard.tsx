import React from 'react';
import styled from 'styled-components';
import type { AnMetricComparison } from '../../types/analytics';

const Card = styled.div<{ $large?: boolean }>`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: ${(p) => (p.$large ? 'var(--s-6)' : 'var(--s-5)')};
  position: relative;
  overflow: hidden;
`;

const Title = styled.p`
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const Value = styled.p<{ $large?: boolean }>`
  margin-top: var(--s-2);
  font-size: ${(p) => (p.$large ? '2.5rem' : '1.75rem')};
  font-weight: 700;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
`;

const Comparison = styled.div`
  margin-top: var(--s-3);
  padding-top: var(--s-3);
  border-top: 1px solid var(--border-1);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
`;

const Badge = styled.span<{ $tone: 'up' | 'down' | 'flat' | 'new' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: var(--r-sm);
  width: fit-content;
  background: ${(p) =>
    p.$tone === 'up'
      ? 'rgba(52, 211, 153, 0.15)'
      : p.$tone === 'down'
        ? 'rgba(248, 113, 113, 0.15)'
        : p.$tone === 'new'
          ? 'rgba(52, 211, 153, 0.15)'
          : 'var(--bg-3)'};
  color: ${(p) =>
    p.$tone === 'up' || p.$tone === 'new'
      ? '#34d399'
      : p.$tone === 'down'
        ? '#f87171'
        : 'var(--text-3)'};
`;

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercentChange(value: number | null): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

interface StatCardProps {
  title: string;
  value: number;
  comparison?: AnMetricComparison | null;
  large?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, comparison, large }) => {
  const percent = comparison?.percentChange ?? null;
  const isUp = percent !== null && percent > 0;
  const isDown = percent !== null && percent < 0;
  const isNew = comparison && comparison.previous === 0 && comparison.current > 0;

  return (
    <Card $large={large}>
      <Title>{title}</Title>
      <Value $large={large}>{formatCompact(value)}</Value>
      {comparison && (
        <Comparison>
          {isNew ? (
            <Badge $tone="new">New vs previous period</Badge>
          ) : (
            <>
              <Badge $tone={isUp ? 'up' : isDown ? 'down' : 'flat'}>
                {formatPercentChange(percent)}
              </Badge>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Prev: {formatCompact(comparison.previous)}
              </span>
            </>
          )}
        </Comparison>
      )}
    </Card>
  );
};
