import React from 'react';
import styled from 'styled-components';
import type { AnMetricKey, AnOverviewResponse, AnPlatform } from '../../types/analytics';
import {
  AN_METRIC_LABELS,
  AN_PLATFORM_COLORS,
  AN_PLATFORM_LABELS,
  AN_PLATFORMS,
} from '../../types/analytics';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--s-3);
`;

const Card = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-4);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin-bottom: var(--s-3);
`;

const Dot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => p.$color};
`;

const Name = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
`;

const MetricRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 4px 0;
  color: var(--text-2);
`;

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

interface PlatformBreakdownProps {
  overview: AnOverviewResponse | null;
  metric?: AnMetricKey;
  errors?: Partial<Record<AnPlatform, string>>;
}

export const PlatformBreakdown: React.FC<PlatformBreakdownProps> = ({
  overview,
  metric = 'views',
  errors = {},
}) => {
  if (!overview) return null;

  return (
    <Grid>
      {AN_PLATFORMS.map((platform) => {
        const stats = overview.byPlatform[platform];
        const err = errors[platform] ?? overview.errors[platform];
        return (
          <Card key={platform}>
            <Header>
              <Dot $color={AN_PLATFORM_COLORS[platform]} />
              <Name>{AN_PLATFORM_LABELS[platform]}</Name>
            </Header>
            {err ? (
              <span style={{ fontSize: 12, color: '#f87171' }}>{err}</span>
            ) : (
              (Object.keys(AN_METRIC_LABELS) as AnMetricKey[]).map((key) => (
                <MetricRow key={key}>
                  <span>{AN_METRIC_LABELS[key]}</span>
                  <strong style={{ color: key === metric ? 'var(--accent)' : undefined }}>
                    {formatCompact(stats?.[key] ?? 0)}
                  </strong>
                </MetricRow>
              ))
            )}
          </Card>
        );
      })}
    </Grid>
  );
};
