import styled, { keyframes } from 'styled-components';

const MOBILE_BP = 720;

const drift1 = keyframes`
  0%   { transform: translate3d(-10%, -10%, 0) scale(1); }
  50%  { transform: translate3d(15%, 8%, 0) scale(1.15); }
  100% { transform: translate3d(-10%, -10%, 0) scale(1); }
`;

const drift2 = keyframes`
  0%   { transform: translate3d(20%, 30%, 0) scale(1.1); }
  50%  { transform: translate3d(-15%, -5%, 0) scale(0.95); }
  100% { transform: translate3d(20%, 30%, 0) scale(1.1); }
`;

const drift3 = keyframes`
  0%   { transform: translate3d(40%, -20%, 0) scale(1); }
  50%  { transform: translate3d(-10%, 25%, 0) scale(1.2); }
  100% { transform: translate3d(40%, -20%, 0) scale(1); }
`;

const gridShift = keyframes`
  from { background-position: 0 0, 0 0; }
  to   { background-position: 40px 40px, 40px 40px; }
`;

const scan = keyframes`
  0%   { transform: translateY(-20%); opacity: 0; }
  10%  { opacity: 0.6; }
  100% { transform: translateY(120vh); opacity: 0; }
`;

/**
 * Fixed to the main content pane (below topbar, right of sidebar) so it always
 * fills the viewport while the page scrolls — avoids a hard horizontal seam
 * where the decorative layer used to end at the first viewport height.
 */
const Wrap = styled.div<{ $collapsed: boolean }>`
  position: fixed;
  top: var(--topbar-h);
  right: 0;
  bottom: 0;
  left: ${(p) => (p.$collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)')};
  overflow: hidden;
  pointer-events: none;
  z-index: 0;

  @media (max-width: ${MOBILE_BP}px) {
    left: 0;
  }
`;

const Orb = styled.div<{
  $color: string;
  $size: number;
  $duration: number;
  $anim: ReturnType<typeof keyframes>;
  $top: string;
  $left: string;
}>`
  position: absolute;
  top: ${(p) => p.$top};
  left: ${(p) => p.$left};
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, ${(p) => p.$color}, transparent 60%);
  filter: blur(60px);
  opacity: 0.55;
  animation: ${(p) => p.$anim} ${(p) => p.$duration}s ease-in-out infinite;
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Grid = styled.div`
  position: absolute;
  inset: -1px;
  background-image:
    linear-gradient(rgba(120, 200, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(120, 200, 255, 0.04) 1px, transparent 1px);
  background-size: 40px 40px, 40px 40px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  animation: ${gridShift} 20s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Scanline = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(120, 200, 255, 0.35), transparent);
  box-shadow: 0 0 12px rgba(120, 200, 255, 0.5);
  animation: ${scan} 9s linear infinite;
  animation-delay: 4s;
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at top, transparent 40%, rgba(0, 0, 0, 0.45) 100%),
    radial-gradient(ellipse at bottom, transparent 50%, rgba(0, 0, 0, 0.5) 100%);
  pointer-events: none;
`;

/** Soft fade into the page base color so the glow never ends in a hard edge on screen. */
const BottomBlend = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: min(48vh, 520px);
  background: linear-gradient(
    to bottom,
    rgba(7, 9, 13, 0) 0%,
    rgba(7, 9, 13, 0.35) 45%,
    var(--bg-0) 88%,
    var(--bg-0) 100%
  );
  pointer-events: none;
`;

export interface BackgroundFxProps {
  /** Desktop sidebar width switches between collapsed and expanded. */
  sidebarCollapsed: boolean;
}

const BackgroundFx: React.FC<BackgroundFxProps> = ({ sidebarCollapsed }) => {
  return (
    <Wrap $collapsed={sidebarCollapsed} aria-hidden="true">
      <Grid />
      <Orb $color="rgba(76, 194, 255, 0.45)" $size={680} $duration={28} $anim={drift1} $top="-20%" $left="-10%" />
      <Orb $color="rgba(155, 92, 255, 0.35)" $size={560} $duration={34} $anim={drift2} $top="40%" $left="55%" />
      <Orb $color="rgba(0, 224, 198, 0.22)" $size={460} $duration={42} $anim={drift3} $top="60%" $left="-15%" />
      <Scanline />
      <Vignette />
      <BottomBlend />
    </Wrap>
  );
};

export default BackgroundFx;
