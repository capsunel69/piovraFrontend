import React from 'react';
import styled from 'styled-components';
import type { AnPlatform, AnSocialPostItem } from '../../types/analytics';
import { mediaProxyUrl } from '../../services/analytics';
import { PLATFORM_GLYPHS, PLATFORM_META } from './platformMeta';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--s-3);
`;

const Card = styled.a<{ $color?: string }>`
  display: flex;
  flex-direction: column;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s, transform 0.15s;

  &:hover {
    border-color: ${(p) => p.$color ?? 'var(--accent)'};
    transform: translateY(-2px);
  }
`;

const Thumb = styled.div<{ $url?: string; $color?: string }>`
  aspect-ratio: 16 / 9;
  position: relative;
  background: ${(p) => (p.$url ? `url(${p.$url}) center/cover` : 'var(--bg-3)')};
  display: grid;
  place-items: center;
  color: ${(p) => p.$color ?? 'var(--text-4)'};
`;

const ThumbBadge = styled.span<{ $color: string }>`
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(7, 9, 13, 0.75);
  color: ${(p) => p.$color};
  backdrop-filter: blur(4px);
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
  platform?: AnPlatform;
  emptyLabel?: string;
}

export const ContentGrid: React.FC<ContentGridProps> = ({ items, platform, emptyLabel }) => {
  // TikTok/IG/FB CDNs reject hotlinked images; route those through the backend proxy.
  const resolveThumb = (url?: string) =>
    platform && platform !== 'youtube' ? mediaProxyUrl(url) : url;
  const meta = platform ? PLATFORM_META[platform] : null;
  const Glyph = platform ? PLATFORM_GLYPHS[platform] : null;

  if (items.length === 0) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
        {emptyLabel ?? 'No posts in this date range'}
      </p>
    );
  }

  return (
    <Grid>
      {items.map((item) => {
        const thumb = resolveThumb(item.thumbnailUrl);
        return (
        <Card
          key={item.id}
          href={item.url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { if (!item.url) e.preventDefault(); }}
          $color={meta?.color}
        >
          <Thumb $url={thumb} $color={meta?.color}>
            {!thumb && Glyph && <Glyph size={28} />}
            {thumb && meta && Glyph && (
              <ThumbBadge $color={meta.color}><Glyph size={13} /></ThumbBadge>
            )}
          </Thumb>
          <Body>
            <Title>{item.title}</Title>
            <Meta>
              <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
              <span>{formatCompact(item.views)} views</span>
              <span>{formatCompact(item.likes)} likes</span>
            </Meta>
          </Body>
        </Card>
        );
      })}
    </Grid>
  );
};
