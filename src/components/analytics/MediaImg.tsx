import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

/**
 * <img> that removes itself when the source fails to load, letting whatever
 * placeholder sits behind it (platform glyph, tinted background) show through.
 */
export const MediaImg: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({
  src,
  ...rest
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return null;
  return <img loading="lazy" src={src} onError={() => setFailed(true)} alt="" {...rest} />;
};

const Bubble = styled.span<{ $size: number; $color?: string; $borderWidth: number }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  flex-shrink: 0;
  border-radius: 50%;
  border: ${(p) => (p.$borderWidth > 0 ? `${p.$borderWidth}px solid ${p.$color ?? 'var(--border-2)'}` : 'none')};
  background: var(--bg-3);
  color: ${(p) => p.$color ?? 'var(--text-3)'};
  overflow: hidden;
`;

const CoverImg = styled(MediaImg)`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

interface MediaAvatarProps {
  src?: string;
  size: number;
  /** Brand color for border + glyph tint. */
  color?: string;
  borderWidth?: number;
  /** Fallback glyph shown until the image loads (or if it fails). */
  glyph: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Round avatar with automatic glyph fallback when the image is missing/broken. */
export const MediaAvatar: React.FC<MediaAvatarProps> = ({
  src,
  size,
  color,
  borderWidth = 0,
  glyph,
  className,
  style,
}) => (
  <Bubble $size={size} $color={color} $borderWidth={borderWidth} className={className} style={style}>
    {glyph}
    <CoverImg src={src} />
  </Bubble>
);
