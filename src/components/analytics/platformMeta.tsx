import React from 'react';
import type { AnPlatform } from '../../types/analytics';

/**
 * Per-platform visual identity for the Analytics module. Brand glyphs are
 * inline SVGs (filled, not stroked, unlike the app's icon set) so each
 * platform tab/section is recognisable at a glance.
 */

export interface PlatformMeta {
  label: string;
  /** Brand color used for charts, accents, active tabs. */
  color: string;
  /** Soft translucent tint for backgrounds. */
  soft: string;
  /** Header gradient backdrop. */
  gradient: string;
}

export const PLATFORM_META: Record<AnPlatform, PlatformMeta> = {
  youtube: {
    label: 'YouTube',
    color: '#ff4e45',
    soft: 'rgba(255, 78, 69, 0.12)',
    gradient: 'linear-gradient(120deg, rgba(255,78,69,0.18), rgba(255,78,69,0.03) 55%, transparent)',
  },
  facebook: {
    label: 'Facebook',
    color: '#3d8bff',
    soft: 'rgba(61, 139, 255, 0.12)',
    gradient: 'linear-gradient(120deg, rgba(61,139,255,0.18), rgba(61,139,255,0.03) 55%, transparent)',
  },
  instagram: {
    label: 'Instagram',
    color: '#ff5e84',
    soft: 'rgba(255, 94, 132, 0.12)',
    gradient: 'linear-gradient(120deg, rgba(255,94,132,0.18), rgba(193,53,132,0.05) 55%, transparent)',
  },
  tiktok: {
    label: 'TikTok',
    color: '#5eead4',
    soft: 'rgba(94, 234, 212, 0.12)',
    gradient: 'linear-gradient(120deg, rgba(94,234,212,0.16), rgba(94,234,212,0.03) 55%, transparent)',
  },
};

type GlyphProps = React.SVGProps<SVGSVGElement> & { size?: number };

const glyph = (path: React.ReactNode) => {
  const Cmp: React.FC<GlyphProps> = ({ size = 16, ...rest }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden
      {...rest}
    >
      {path}
    </svg>
  );
  return Cmp;
};

export const GlyphYouTube = glyph(
  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z" />,
);

export const GlyphFacebook = glyph(
  <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12z" />,
);

export const GlyphInstagram = glyph(
  <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4a3.8 3.8 0 0 1-1.4-.9 3.8 3.8 0 0 1-.9-1.4c-.2-.4-.4-1-.4-2.2-.1-1.3-.1-1.7-.1-4.9s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1zM12 0C8.7 0 8.3 0 7 .1 5.7.2 4.9.4 4.1.7c-.8.3-1.5.7-2.1 1.4C1.3 2.7.9 3.4.7 4.1.4 4.9.2 5.7.1 7 0 8.3 0 8.7 0 12s0 3.7.1 5c.1 1.3.3 2.1.6 2.9.3.8.7 1.5 1.4 2.1.6.6 1.3 1 2.1 1.4.8.3 1.6.5 2.9.6 1.3.1 1.7.1 5 .1s3.7 0 5-.1c1.3-.1 2.1-.3 2.9-.6a5.9 5.9 0 0 0 2.1-1.4c.6-.6 1-1.3 1.4-2.1.3-.8.5-1.6.6-2.9.1-1.3.1-1.7.1-5s0-3.7-.1-5c-.1-1.3-.3-2.1-.6-2.9a5.9 5.9 0 0 0-1.4-2.1A5.9 5.9 0 0 0 19.9.7c-.8-.3-1.6-.5-2.9-.6C15.7 0 15.3 0 12 0zm0 5.8A6.2 6.2 0 1 0 18.2 12 6.2 6.2 0 0 0 12 5.8zm0 10.2A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm6.4-11.8a1.4 1.4 0 1 1-1.4 1.4 1.4 1.4 0 0 1 1.4-1.4z" />,
);

export const GlyphTikTok = glyph(
  <path d="M19.6 5.8a5.7 5.7 0 0 1-3.4-4.7V.6h-3.8v15.1a3.2 3.2 0 1 1-2.3-3.1V8.7a7 7 0 1 0 6.1 6.9V8.3a9.4 9.4 0 0 0 5.4 1.7V6.2a5.6 5.6 0 0 1-2-0.4z" />,
);

export const PLATFORM_GLYPHS: Record<AnPlatform, React.FC<GlyphProps>> = {
  youtube: GlyphYouTube,
  facebook: GlyphFacebook,
  instagram: GlyphInstagram,
  tiktok: GlyphTikTok,
};
