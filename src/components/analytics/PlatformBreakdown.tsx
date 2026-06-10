import React from 'react';
import styled from 'styled-components';
import type { AnMetricKey, AnOverviewResponse, AnPlatform } from '../../types/analytics';
import { AN_METRIC_LABELS, AN_PLATFORMS } from '../../types/analytics';
import { PLATFORM_GLYPHS, PLATFORM_META } from './platformMeta';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: var(--s-3);
`;

const Card = styled.button<{ $color: string; $gradient: string }>`
  text-align: left;
  font: inherit;
  background: ${(p) => p.$gradient}, var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-4);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s;

  &:hover {
    border-color: ${(p) => p.$color};
    transform: translateY(-2px);
  }
`;

const Header = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin-bottom: var(--s-3);
  color: ${(p) => p.$color};
`;

const Name = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
`;

const HeroValue = styled.div`
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;

  small {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 2px;
  }
`;

const MiniStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: var(--s-3);
  padding-top: var(--s-3);
  border-top: 1px solid var(--border-1);
  font-size: 11px;
  color: var(--text-3);

  strong { color: var(--text-2); font-variant-numeric: tabular-nums; }
`;

const ErrorText = styled.span`
  font-size: 12px;
  color: #f87171;
  display: block;
  word-break: break-word;
`;

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

const MINI_KEYS: AnMetricKey[] = ['posts', 'likes', 'comments', 'shares'];

interface PlatformBreakdownProps {
  overview: AnOverviewResponse | null;
  onSelect?: (platform: AnPlatform) => void;
}

export const PlatformBreakdown: React.FC<PlatformBreakdownProps> = ({ overview, onSelect }) => {
  if (!overview) return null;

  return (
    <Grid>
      {AN_PLATFORMS.map((platform) => {
        const meta = PLATFORM_META[platform];
        const Glyph = PLATFORM_GLYPHS[platform];
        const stats = overview.byPlatform[platform];
        const err = overview.errors[platform];
        return (
          <Card
            key={platform}
            $color={meta.color}
            $gradient={meta.gradient}
            onClick={() => onSelect?.(platform)}
            title={`Open ${meta.label} details`}
          >
            <Header $color={meta.color}>
              <Glyph size={16} />
              <Name>{meta.label}</Name>
            </Header>
            {err ? (
              <ErrorText>{err}</ErrorText>
            ) : (
              <>
                <HeroValue>
                  {formatCompact(stats?.views ?? 0)}
                  <small>views</small>
                </HeroValue>
                <MiniStats>
                  {MINI_KEYS.map((key) => (
                    <span key={key}>
                      {AN_METRIC_LABELS[key]} <strong>{formatCompact(stats?.[key] ?? 0)}</strong>
                    </span>
                  ))}
                </MiniStats>
              </>
            )}
          </Card>
        );
      })}
    </Grid>
  );
};
