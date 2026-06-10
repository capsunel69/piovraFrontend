import React from 'react';
import styled from 'styled-components';
import type { AnAccount, AnContentResponse, AnPlatform } from '../../types/analytics';
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
            {profile?.followerCount != null && (
              <span><strong>{formatCompact(profile.followerCount)}</strong> followers</span>
            )}
            {profile?.postCount != null && (
              <span><strong>{profile.postCount}</strong> posts in range</span>
            )}
          </Stats>
        </Info>
      </Content>
    </Hero>
  );
};
