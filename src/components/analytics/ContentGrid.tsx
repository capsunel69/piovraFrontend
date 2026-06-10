import React from 'react';
import styled from 'styled-components';
import type { AnSocialPostItem } from '../../types/analytics';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--s-3);
`;

const Card = styled.a`
  display: flex;
  flex-direction: column;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--accent);
  }
`;

const Thumb = styled.div<{ $url?: string }>`
  aspect-ratio: 16 / 9;
  background: ${(p) => (p.$url ? `url(${p.$url}) center/cover` : 'var(--bg-3)')};
`;

const Body = styled.div`
  padding: var(--s-3);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Title = styled.p`
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--text-3);
`;

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

interface ContentGridProps {
  items: AnSocialPostItem[];
  emptyLabel?: string;
}

export const ContentGrid: React.FC<ContentGridProps> = ({ items, emptyLabel }) => {
  if (items.length === 0) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
        {emptyLabel ?? 'No posts in this date range'}
      </p>
    );
  }

  return (
    <Grid>
      {items.map((item) => (
        <Card
          key={item.id}
          href={item.url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { if (!item.url) e.preventDefault(); }}
        >
          <Thumb $url={item.thumbnailUrl} />
          <Body>
            <Title>{item.title}</Title>
            <Meta>
              <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
              <span>{formatCompact(item.views)} views</span>
              <span>{formatCompact(item.likes)} likes</span>
            </Meta>
          </Body>
        </Card>
      ))}
    </Grid>
  );
};
