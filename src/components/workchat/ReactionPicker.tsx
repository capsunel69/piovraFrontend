import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { IconSmile } from '../ui/icons';
import EmojiPicker from './EmojiPicker';

/** WhatsApp-style default quick reactions. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

interface Props {
  anchorEl: HTMLElement | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  background: transparent;
`;

const Panel = styled.div<{ $top: number; $left: number }>`
  position: fixed;
  top: ${(p) => p.$top}px;
  left: ${(p) => p.$left}px;
  z-index: 201;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  animation: reactIn 0.14s ease-out;

  @keyframes reactIn {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const QuickBar = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: 999px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
`;

const QuickBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s ease, background 0.12s ease;

  &:hover {
    background: var(--bg-3);
    transform: scale(1.15);
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover { transform: none; }
  }
`;

const MoreBtn = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  border: 1px dashed var(--border-2);
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;

  &:hover {
    background: var(--bg-3);
    color: var(--accent);
    border-color: var(--accent);
  }

  svg { width: 18px; height: 18px; }
`;

const PickerWrap = styled.div`
  border-radius: var(--r-md);
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
`;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const ReactionPicker: React.FC<Props> = ({ anchorEl, onSelect, onClose }) => {
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!anchorEl) return;

    const update = (): void => {
      const rect = anchorEl.getBoundingClientRect();
      const panel = panelRef.current;
      const panelW = panel?.offsetWidth ?? (expanded ? 320 : 280);
      const panelH = panel?.offsetHeight ?? (expanded ? 360 : 52);
      const margin = 8;

      let top = rect.top - panelH - margin;
      if (top < margin) top = rect.bottom + margin;

      let left = rect.left + rect.width / 2 - panelW / 2;
      left = clamp(left, margin, window.innerWidth - panelW - margin);

      setPos({ top, left });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorEl, expanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!anchorEl || typeof document === 'undefined') return null;

  const pick = (emoji: string): void => {
    onSelect(emoji);
    onClose();
  };

  return createPortal(
    <>
      <Backdrop onMouseDown={onClose} aria-hidden />
      <Panel ref={panelRef} $top={pos.top} $left={pos.left} onMouseDown={(e) => e.stopPropagation()}>
        <QuickBar role="toolbar" aria-label="Quick reactions">
          {QUICK_REACTIONS.map((emoji) => (
            <QuickBtn
              key={emoji}
              type="button"
              title={`React with ${emoji}`}
              onClick={() => pick(emoji)}
            >
              {emoji}
            </QuickBtn>
          ))}
          <MoreBtn
            type="button"
            title={expanded ? 'Hide emoji picker' : 'More emojis'}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <IconSmile />
          </MoreBtn>
        </QuickBar>
        {expanded && (
          <PickerWrap>
            <EmojiPicker onSelect={pick} />
          </PickerWrap>
        )}
      </Panel>
    </>,
    document.body,
  );
};

export default ReactionPicker;
