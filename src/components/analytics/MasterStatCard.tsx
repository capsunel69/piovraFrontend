import React from 'react';
import styled from 'styled-components';
import type { AnMetricKey } from '../../types/analytics';
import { AN_METRIC_LABELS } from '../../types/analytics';

const METRIC_STYLE: Record<
  AnMetricKey,
  { color: string; soft: string; glyph: string }
> = {
  views: { color: '#4cc2ff', soft: 'rgba(76, 194, 255, 0.14)', glyph: '👁' },
  posts: { color: '#a78bfa', soft: 'rgba(167, 139, 250, 0.14)', glyph: '📄' },
  likes: { color: '#f472b6', soft: 'rgba(244, 114, 182, 0.14)', glyph: '♥' },
  shares: { color: '#34d399', soft: 'rgba(52, 211, 153, 0.14)', glyph: '↗' },
  comments: { color: '#fbbf24', soft: 'rgba(251, 191, 36, 0.14)', glyph: '💬' },
};

const Card = styled.div<{ $color: string; $soft: string; $large?: boolean }>`
  position: relative;
  overflow: hidden;
  border-radius: var(--r-lg);
  border: 1px solid ${(p) => p.$color}33;
  background: linear-gradient(145deg, ${(p) => p.$soft}, var(--bg-2) 55%);
  padding: ${(p) => (p.$large ? 'var(--s-6) var(--s-5)' : 'var(--s-5)')};
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);

  &::after {
    content: '';
    position: absolute;
    right: -20px;
    top: -20px;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: ${(p) => p.$color};
    opacity: 0.06;
    pointer-events: none;
  }
`;

const Top = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
`;

const IconWrap = styled.span<{ $color: string; $soft: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-md);
  background: ${(p) => p.$soft};
  color: ${(p) => p.$color};
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
`;

const Title = styled.p`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
`;

const Value = styled.p<{ $large?: boolean; $color: string }>`
  margin-top: var(--s-3);
  font-size: ${(p) => (p.$large ? '2.4rem' : '1.85rem')};
  font-weight: 800;
  color: ${(p) => p.$color};
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  text-shadow: 0 0 24px ${(p) => p.$color}44;
`;

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('ro-RO').format(value);
}

interface Props {
  metric: AnMetricKey;
  value: number;
  title?: string;
  large?: boolean;
}

export const MasterStatCard: React.FC<Props> = ({ metric, value, title, large }) => {
  const style = METRIC_STYLE[metric];
  return (
    <Card $color={style.color} $soft={style.soft} $large={large}>
      <Top>
        <Title>{title ?? AN_METRIC_LABELS[metric]}</Title>
        <IconWrap $color={style.color} $soft={style.soft}>{style.glyph}</IconWrap>
      </Top>
      <Value $large={large} $color={style.color}>{formatCompact(value)}</Value>
    </Card>
  );
};
