import styled, { css, keyframes } from 'styled-components';

/* ── Surface / Card ───────────────────────────────────────────────────── */

export const Card = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s ease, transform 0.2s ease;
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: var(--s-4) var(--s-5);
  border-bottom: 1px solid var(--border-1);
  flex-wrap: wrap;

  @media (max-width: 720px) {
    padding: var(--s-3);
    gap: var(--s-2);
  }
`;

export const CardTitle = styled.h3`
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  gap: var(--s-2);

  svg { color: var(--accent); }
`;

export const CardSubtle = styled.span`
  font-size: 12px;
  color: var(--text-3);
  font-weight: 500;
`;

export const CardBody = styled.div`
  padding: var(--s-2) 0;
`;

export const CardSection = styled.div`
  padding: var(--s-5);

  @media (max-width: 720px) {
    padding: var(--s-3);
  }
`;

/* ── Page primitives ──────────────────────────────────────────────────── */

export const PageContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
`;

export const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
  flex-wrap: wrap;
`;

export const PageTitle = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: var(--s-3);

  svg { color: var(--accent); }

  @media (max-width: 720px) {
    font-size: 18px;
    gap: var(--s-2);
  }
`;

export const PageSubtitle = styled.p`
  font-size: 13px;
  color: var(--text-3);
  margin: 4px 0 0 0;
`;

export const Grid = styled.div<{ $cols?: number; $min?: string }>`
  display: grid;
  gap: var(--s-4);
  grid-template-columns: ${p => p.$cols
    ? `repeat(${p.$cols}, minmax(0, 1fr))`
    : `repeat(auto-fit, minmax(${p.$min ?? '320px'}, 1fr))`};
`;

export const Stack = styled.div<{ $gap?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${p => `var(--s-${p.$gap ?? 3})`};
`;

export const Row = styled.div<{ $gap?: number; $wrap?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${p => `var(--s-${p.$gap ?? 3})`};
  flex-wrap: ${p => p.$wrap ? 'wrap' : 'nowrap'};
`;

/* ── Buttons ──────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md';

const variantStyles = (v: ButtonVariant) => {
  switch (v) {
    case 'primary': return css`
      background: var(--accent);
      color: #06121d;
      border-color: transparent;
      font-weight: 600;
      &:hover:not(:disabled) { background: var(--accent-strong); }
      &:active:not(:disabled) { transform: translateY(1px); }
    `;
    case 'secondary': return css`
      background: var(--bg-3);
      color: var(--text-1);
      border-color: var(--border-2);
      &:hover:not(:disabled) { background: var(--bg-4); border-color: var(--border-3); }
    `;
    case 'ghost': return css`
      background: transparent;
      color: var(--text-2);
      border-color: transparent;
      &:hover:not(:disabled) { color: var(--text-1); background: var(--bg-3); }
    `;
    case 'danger': return css`
      background: var(--danger-soft);
      color: var(--danger);
      border-color: rgba(255,93,108,0.2);
      &:hover:not(:disabled) { background: rgba(255,93,108,0.18); border-color: rgba(255,93,108,0.35); }
    `;
    case 'success': return css`
      background: var(--success-soft);
      color: var(--success);
      border-color: rgba(34,211,154,0.2);
      &:hover:not(:disabled) { background: rgba(34,211,154,0.18); border-color: rgba(34,211,154,0.35); }
    `;
  }
};

export const Button = styled.button<{ $variant?: ButtonVariant; $size?: ButtonSize; $block?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  padding: ${p => p.$size === 'sm' ? '6px 10px' : '8px 14px'};
  font-size: ${p => p.$size === 'sm' ? '12px' : '13px'};
  font-weight: 500;
  border-radius: var(--r-sm);
  border: 1px solid;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.05s;
  white-space: nowrap;
  width: ${p => p.$block ? '100%' : 'auto'};

  ${p => variantStyles(p.$variant ?? 'secondary')}

  &:disabled { opacity: 0.5; cursor: not-allowed; }

  svg { width: ${p => p.$size === 'sm' ? '14px' : '16px'}; height: ${p => p.$size === 'sm' ? '14px' : '16px'}; }
`;

export const IconButton = styled.button<{ $variant?: ButtonVariant; $size?: ButtonSize }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${p => p.$size === 'sm' ? '28px' : '32px'};
  height: ${p => p.$size === 'sm' ? '28px' : '32px'};
  border-radius: var(--r-sm);
  border: 1px solid;
  transition: background 0.15s, color 0.15s, border-color 0.15s;

  ${p => variantStyles(p.$variant ?? 'ghost')}

  svg { width: 16px; height: 16px; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/* ── Form controls ────────────────────────────────────────────────────── */

const fieldBase = css`
  width: 100%;
  background: var(--bg-1);
  border: 1px solid var(--border-2);
  border-radius: var(--r-sm);
  color: var(--text-1);
  font-size: 13px;
  padding: 10px 12px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;

  &::placeholder { color: var(--text-3); }
  &:hover:not(:disabled) { border-color: var(--border-3); }
  &:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: var(--bg-2); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  /* iOS zooms in on focus when the input's font-size is below 16px.
   * Bump it on small viewports so the input doesn't reflow the page. */
  @media (max-width: 720px) {
    font-size: 16px;
  }
`;

export const Input = styled.input`${fieldBase}`;
export const Textarea = styled.textarea`
  ${fieldBase}
  min-height: 88px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
`;
export const Select = styled.select`
  ${fieldBase}
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a4adbb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 32px;
  cursor: pointer;

  option { background: var(--bg-1); color: var(--text-1); }
`;

export const Label = styled.label`
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  display: block;
  margin-bottom: 6px;
  letter-spacing: 0.01em;
`;

export const Field = styled.div`
  display: flex;
  flex-direction: column;
`;

export const FieldGroup = styled.div<{ $cols?: number }>`
  display: grid;
  grid-template-columns: ${p =>
    p.$cols ? `repeat(${p.$cols}, minmax(0, 1fr))` : 'repeat(auto-fit, minmax(180px, 1fr))'};
  gap: var(--s-3);
`;

/* ── Badges ───────────────────────────────────────────────────────────── */

type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const badgeStyles = (v: BadgeVariant) => {
  const map: Record<BadgeVariant, [string, string]> = {
    neutral: ['var(--bg-3)', 'var(--text-2)'],
    accent:  ['var(--accent-soft)', 'var(--accent)'],
    success: ['var(--success-soft)', 'var(--success)'],
    warning: ['var(--warning-soft)', 'var(--warning)'],
    danger:  ['var(--danger-soft)', 'var(--danger)'],
    info:    ['var(--info-soft)', 'var(--info)'],
    purple:  ['var(--purple-soft)', 'var(--purple)'],
  };
  const [bg, color] = map[v];
  return css`background: ${bg}; color: ${color};`;
};

export const Badge = styled.span<{ $variant?: BadgeVariant }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.4;
  ${p => badgeStyles(p.$variant ?? 'neutral')}
`;

/* ── Checkbox (custom) ────────────────────────────────────────────────── */

export const Checkbox = styled.button<{ $checked: boolean }>`
  width: 18px;
  height: 18px;
  min-width: 18px;
  border-radius: var(--r-xs);
  border: 1.5px solid ${p => p.$checked ? 'var(--accent)' : 'var(--border-3)'};
  background: ${p => p.$checked ? 'var(--accent)' : 'transparent'};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;

  &:hover:not(:disabled) { border-color: var(--accent); }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:after {
    content: '';
    width: 10px;
    height: 10px;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2306121d' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E") center/contain no-repeat;
    opacity: ${p => p.$checked ? 1 : 0};
    transition: opacity 0.15s;
  }
`;

/* ── Empty state / dividers ──────────────────────────────────────────── */

export const EmptyState = styled.div`
  padding: var(--s-7) var(--s-5);
  text-align: center;
  color: var(--text-3);
  font-size: 13px;

  svg { width: 28px; height: 28px; opacity: 0.5; margin-bottom: var(--s-3); }
`;

export const Divider = styled.hr`
  border: 0;
  border-top: 1px solid var(--border-1);
  margin: 0;
`;

/* ── Spinner ──────────────────────────────────────────────────────────── */

const spin = keyframes`to { transform: rotate(360deg); }`;

export const Spinner = styled.div<{ $size?: number }>`
  width: ${p => p.$size ?? 18}px;
  height: ${p => p.$size ?? 18}px;
  border-radius: 50%;
  border: 2px solid var(--border-2);
  border-top-color: var(--accent);
  animation: ${spin} 0.8s linear infinite;
`;

/* ── Modal ────────────────────────────────────────────────────────────── */

export const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(2, 4, 8, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--s-5);
  animation: ${keyframes`from { opacity: 0; } to { opacity: 1; }`} 0.18s ease-out;
`;

export const ModalCard = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: var(--r-lg);
  width: 100%;
  max-width: 520px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
`;

/* ── Composer (modern create-form shell) ─────────────────────────────── */

export const Composer = styled.form`
  background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-3) var(--s-3) var(--s-3);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  transition: border-color .2s, box-shadow .2s;

  &:focus-within {
    border-color: var(--accent-soft);
    box-shadow: 0 0 0 1px var(--accent-soft), 0 0 32px rgba(76,194,255,0.12);
  }
`;

export const ComposerTitle = styled.input`
  background: transparent;
  border: 0;
  outline: 0;
  width: 100%;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-1);
  padding: 8px 10px;
  letter-spacing: -0.01em;

  &::placeholder { color: var(--text-4); font-weight: 400; }
`;

export const ComposerBody = styled.textarea`
  background: transparent;
  border: 0;
  outline: 0;
  width: 100%;
  font: inherit;
  font-size: 13px;
  color: var(--text-2);
  padding: 0 10px 4px;
  resize: vertical;
  min-height: 40px;
  line-height: 1.55;

  &::placeholder { color: var(--text-4); }

  @media (max-width: 720px) {
    font-size: 16px;
  }
`;

export const ComposerToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
  padding: 6px 6px 0;
  border-top: 1px dashed var(--border-1);
  margin-top: 4px;
  padding-top: 8px;
`;

export const ComposerSpacer = styled.div`
  flex: 1;
`;

/* ── Chip / segmented selector ───────────────────────────────────────── */

type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const chipActive = (tone: ChipTone) => {
  const map: Record<ChipTone, [string, string, string]> = {
    neutral: ['var(--bg-3)', 'var(--text-1)', 'var(--border-3)'],
    accent:  ['var(--accent-soft)', 'var(--accent)', 'var(--accent)'],
    success: ['var(--success-soft)', 'var(--success)', 'var(--success)'],
    warning: ['var(--warning-soft)', 'var(--warning)', 'var(--warning)'],
    danger:  ['var(--danger-soft)', 'var(--danger)', 'var(--danger)'],
    info:    ['var(--info-soft)', 'var(--info)', 'var(--info)'],
    purple:  ['var(--purple-soft)', 'var(--purple)', 'var(--purple)'],
  };
  const [bg, color, border] = map[tone];
  return css`background: ${bg}; color: ${color}; border-color: ${border};`;
};

export const Chip = styled.button<{ $active?: boolean; $tone?: ChipTone }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border-1);
  background: var(--bg-1);
  color: var(--text-3);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background .15s, color .15s, border-color .15s, transform .1s;
  white-space: nowrap;

  &:hover { color: var(--text-1); border-color: var(--border-3); }
  &:active { transform: translateY(1px); }

  svg { width: 13px; height: 13px; }

  ${p => p.$active && chipActive(p.$tone ?? 'accent')}

  @media (max-width: 720px) {
    height: 34px;
    font-size: 13px;
    padding: 0 12px;
  }
`;

export const ChipGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 999px;
  background: var(--bg-1);
  border: 1px solid var(--border-1);

  ${Chip} {
    border-color: transparent;
    background: transparent;
    height: 24px;
    padding: 0 10px;
  }

  @media (max-width: 720px) {
    ${Chip} {
      height: 30px;
      padding: 0 12px;
      font-size: 13px;
    }
  }
`;

/* ── Compact ghost field (for inline date / number inputs in toolbars) ─ */

export const GhostInput = styled.input`
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: 999px;
  height: 28px;
  padding: 0 10px;
  font: inherit;
  font-size: 12px;
  color: var(--text-1);
  outline: 0;
  transition: border-color .15s, background .15s;
  color-scheme: dark;

  &::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }

  &:hover { border-color: var(--border-3); }
  &:focus { border-color: var(--accent); background: var(--bg-2); }

  &[type='number'] { width: 70px; }

  @media (max-width: 720px) {
    font-size: 16px;
    height: 36px;
    padding: 0 12px;

    &[type='number'] { width: 80px; }
  }
`;
