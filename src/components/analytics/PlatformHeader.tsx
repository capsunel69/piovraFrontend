import React from 'react';
import styled from 'styled-components';
import type { AnContentResponse, AnPlatform } from '../../types/analytics';
import { mediaProxyUrl } from '../../services/analytics';
import { PLATFORM_GLYPHS, PLATFORM_META } from './platformMeta';

const Hero = styled.div<{ $gradient: string }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--s-4);
  padding: var(--s-5);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  background: ${(p) => p.$gradient}, var(--bg-2);
  overflow: hidden;
`;

const BrandWatermark = styled.div<{ $color: string }>`
  position: absolute;
  right: -18px;
  bottom: -24px;
  color: ${(p) => p.$color};
  opacity: 0.07;
  pointer-events: none;

  svg { width: 140px; height: 140px; }
`;

const Avatar = styled.div<{ $url?: string; $color: string }>`
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid ${(p) => p.$color};
  background: ${(p) => (p.$url ? `url(${p.$url}) center/cover` : 'var(--bg-3)')};
  display: grid;
  place-items: center;
  color: ${(p) => p.$color};
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
}

export const PlatformHeader: React.FC<PlatformHeaderProps> = ({ platform, content }) => {
  const meta = PLATFORM_META[platform];
  const Glyph = PLATFORM_GLYPHS[platform];
  const profile = content?.profile;
  const avatarUrl =
    platform === 'youtube' ? profile?.avatarUrl : mediaProxyUrl(profile?.avatarUrl);

  return (
    <Hero $gradient={meta.gradient}>
      <BrandWatermark $color={meta.color}><Glyph /></BrandWatermark>
      <Avatar $url={avatarUrl} $color={meta.color}>
        {!avatarUrl && <Glyph size={28} />}
      </Avatar>
      <Info>
        <NameRow>
          <Name>{profile?.name ?? meta.label}</Name>
          <BrandTag $color={meta.color} $soft={meta.soft}>
            <Glyph size={12} /> {meta.label}
          </BrandTag>
        </NameRow>
        <Stats>
          {profile?.handle && <span>{profile.handle}</span>}
          {profile?.followerCount != null && (
            <span><strong>{formatCompact(profile.followerCount)}</strong> followers</span>
          )}
          {profile?.postCount != null && (
            <span><strong>{profile.postCount}</strong> posts in range</span>
          )}
        </Stats>
      </Info>
    </Hero>
  );
};
