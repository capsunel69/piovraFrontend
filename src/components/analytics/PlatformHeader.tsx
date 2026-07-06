import React from 'react';
import styled from 'styled-components';
import type { AnAccount, AnContentResponse, AnPlatform, AnProfileMetrics } from '../../types/analytics';
import { mediaProxyUrl } from '../../services/analytics';
import { PLATFORM_GLYPHS, PLATFORM_META } from './platformMeta';
import { MediaAvatar } from './MediaImg';

const Hero = styled.div<{ $gradient: string; $cover?: string }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-5);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  background: ${(p) => p.$gradient}, var(--bg-2);
  overflow: hidden;

  ${(p) =>
    p.$cover &&
    `
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url(${p.$cover}) center/cover;
      opacity: 0.22;
      pointer-events: none;
    }
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, rgba(7,9,13,0.85), rgba(7,9,13,0.35));
      pointer-events: none;
    }
  `}
`;

const Content = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: var(--s-4);
  min-width: 0;
  width: 100%;
`;

const BrandWatermark = styled.div<{ $color: string }>`
  position: absolute;
  right: -18px;
  bottom: -24px;
  color: ${(p) => p.$color};
  opacity: 0.07;
  pointer-events: none;
  z-index: 1;

  svg { width: 140px; height: 140px; }
`;

const HeroAvatar = styled(MediaAvatar)`
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
`;

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
`;

const Name = styled.span`
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
`;

const BrandTag = styled.span<{ $color: string; $soft: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  background: ${(p) => p.$soft};
  color: ${(p) => p.$color};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Stats = styled.div`
  display: flex;
  gap: var(--s-4);
  font-size: 12px;
  color: var(--text-3);
  flex-wrap: wrap;

  strong { color: var(--text-1); font-variant-numeric: tabular-nums; }
`;

const MetricsRow = styled.div`
  display: flex;
  gap: var(--s-2);
  flex-wrap: wrap;
  margin-top: 4px;
`;

const MetricPill = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(4px);
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;

  strong {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
  }
`;

/** Which channel metrics to show per platform, in display order. */
const PROFILE_METRIC_DEFS: Record<
  AnPlatform,
  Array<{ key: keyof AnProfileMetrics; label: string }>
> = {
  youtube: [
    { key: 'followers', label: 'subscribers' },
    { key: 'totalViews', label: 'total views' },
    { key: 'videos', label: 'videos' },
  ],
  facebook: [
    { key: 'followers', label: 'followers' },
    { key: 'likes', label: 'page likes' },
  ],
  instagram: [
    { key: 'followers', label: 'followers' },
    { key: 'following', label: 'following' },
    { key: 'videos', label: 'posts' },
  ],
  tiktok: [
    { key: 'followers', label: 'followers' },
    { key: 'likes', label: 'likes' },
    { key: 'videos', label: 'videos' },
  ],
};

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US').format(value);
}

interface PlatformHeaderProps {
  platform: AnPlatform;
  content: AnContentResponse | null;
  /** Stored account row — supplies avatar/cover even before any pull. */
  account?: AnAccount | null;
}

export const PlatformHeader: React.FC<PlatformHeaderProps> = ({ platform, content, account }) => {
  const meta = PLATFORM_META[platform];
  const Glyph = PLATFORM_GLYPHS[platform];
  const profile = content?.profile;

  // Prefer the fresh profile from the pull, fall back to what's stored on the
  // account row. YouTube images come from Google CDNs that allow hotlinking;
  // everything else is routed through the backend media proxy.
  const proxied = (url?: string | null) =>
    !url ? undefined : platform === 'youtube' ? url : mediaProxyUrl(url);
  const avatarUrl = proxied(profile?.avatarUrl ?? account?.avatarUrl);
  const coverUrl = proxied(profile?.coverUrl ?? account?.coverUrl);
  const displayName = profile?.name ?? account?.displayName ?? account?.label ?? meta.label;

  const metrics: AnProfileMetrics =
    profile?.metrics ?? account?.profileMetrics ?? (
      profile?.followerCount != null ? { followers: profile.followerCount } : {}
    );
  const metricEntries = PROFILE_METRIC_DEFS[platform]
    .map((def) => ({ ...def, value: metrics[def.key] }))
    .filter((m): m is typeof m & { value: number } => m.value != null);

  return (
    <Hero $gradient={meta.gradient} $cover={coverUrl}>
      <BrandWatermark $color={meta.color}><Glyph /></BrandWatermark>
      <Content>
        <HeroAvatar
          src={avatarUrl}
          size={64}
          color={meta.color}
          borderWidth={2}
          glyph={<Glyph size={28} />}
        />
        <Info>
          <NameRow>
            <Name>{displayName}</Name>
            <BrandTag $color={meta.color} $soft={meta.soft}>
              <Glyph size={12} /> {meta.label}
            </BrandTag>
          </NameRow>
          <Stats>
            {(profile?.handle ?? account?.handle) && (
              <span>{profile?.handle ?? account?.handle}</span>
            )}
            {metricEntries.length === 0 && profile?.followerCount != null && (
              <span><strong>{formatCompact(profile.followerCount)}</strong> followers</span>
            )}
            {profile?.postCount != null && (
              <span><strong>{profile.postCount}</strong> posts in range</span>
            )}
          </Stats>
          {metricEntries.length > 0 && (
            <MetricsRow>
              {metricEntries.map((m) => (
                <MetricPill key={m.key}>
                  <strong>{formatCompact(m.value)}</strong> {m.label}
                </MetricPill>
              ))}
            </MetricsRow>
          )}
        </Info>
      </Content>
    </Hero>
  );
};
