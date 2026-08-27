import React from 'react';
import styled, { keyframes } from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconBot } from '../ui/icons';
import ChatSurface from './ChatSurface';
import { useChat } from '../../context/ChatContext';
import { useOverlayCount } from '../../hooks/useOverlayStack';

export const ASSISTANT_PATH = '/assistant';

/* ── Launcher bubble ───────────────────────────────────────────────────── */

const pulse = keyframes`
  0%   { box-shadow: 0 10px 32px rgba(0,0,0,0.45), 0 0 0 0 var(--accent-soft); }
  70%  { box-shadow: 0 10px 32px rgba(0,0,0,0.45), 0 0 0 14px rgba(76,194,255,0); }
  100% { box-shadow: 0 10px 32px rgba(0,0,0,0.45), 0 0 0 0 rgba(76,194,255,0); }
`;

const BubbleWrap = styled.div<{ $hidden: boolean }>`
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 180;
  display: ${(p) => (p.$hidden ? 'none' : 'flex')};
  align-items: center;
  gap: 10px;

  @media (max-width: 720px) {
    right: 14px;
    bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  }
`;

const BubbleLabel = styled.span`
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  color: var(--text-1);
  font-size: 12px;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transform: translateX(8px);
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
  white-space: nowrap;

  &::after {
    content: '';
    position: absolute;
    right: -5px;
    top: 50%;
    transform: translateY(-50%) rotate(45deg);
    width: 8px;
    height: 8px;
    background: var(--bg-2);
    border-right: 1px solid var(--border-2);
    border-top: 1px solid var(--border-2);
  }
  position: relative;
`;

const BubbleButton = styled.button`
  position: relative;
  width: 58px;
  height: 58px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: radial-gradient(120% 120% at 30% 20%, #62d8ff 0%, var(--accent) 45%, var(--purple) 100%);
  color: #06121d;
  border: none;
  cursor: pointer;
  animation: ${pulse} 2.6s ease-out infinite;
  transition: transform 0.18s ease, filter 0.18s ease;

  svg { width: 26px; height: 26px; }

  &:hover { transform: translateY(-2px) scale(1.04); filter: brightness(1.05); }
  &:active { transform: translateY(0) scale(0.97); }
`;

const StatusDot = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: var(--success);
  box-shadow: 0 0 10px var(--success);
  border: 2px solid #06121d;
`;

const HoverRevealWrap = styled(BubbleWrap)`
  &:hover ${BubbleLabel} {
    opacity: 1;
    transform: translateX(0);
  }
`;

/* ── Popup panel ───────────────────────────────────────────────────────── */

const popIn = keyframes`
  from { transform: translateY(12px) scale(0.98); opacity: 0; }
  to   { transform: translateY(0)    scale(1);    opacity: 1; }
`;

const Panel = styled.aside`
  position: fixed;
  right: 22px;
  bottom: 22px;
  width: min(520px, calc(100vw - 32px));
  height: min(720px, calc(100vh - 80px));
  max-height: min(720px, calc(100vh - 80px));
  background: linear-gradient(180deg, var(--bg-1), var(--bg-2));
  border: 1px solid var(--border-2);
  border-radius: var(--r-lg);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.55),
    0 4px 16px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(76, 194, 255, 0.05);
  display: flex;
  flex-direction: column;
  z-index: 181;
  animation: ${popIn} 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  overflow: hidden;
  transform-origin: bottom right;

  @media (max-width: 720px) {
    /* Go full-screen on phones so we get the whole viewport for chat. */
    inset: 0;
    width: auto;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    border: 0;
    border-top: 0;
  }
`;

const ChatWidget: React.FC = () => {
  const { isOpen, open, close } = useChat();
  const overlayCount = useOverlayCount();
  const navigate = useNavigate();
  const location = useLocation();
  const onAssistantPage = location.pathname === ASSISTANT_PATH;
  const bubbleHidden = isOpen || overlayCount > 0 || onAssistantPage;

  const expand = (): void => {
    close();
    navigate(ASSISTANT_PATH);
  };

  return (
    <>
      <HoverRevealWrap $hidden={bubbleHidden}>
        <BubbleLabel>Ask Piovra</BubbleLabel>
        <BubbleButton onClick={() => open()} aria-label="Open assistant">
          <IconBot />
          <StatusDot />
        </BubbleButton>
      </HoverRevealWrap>

      {isOpen && !onAssistantPage && (
        <Panel role="dialog" aria-label="Assistant">
          <ChatSurface
            variant="widget"
            active={isOpen}
            onClose={close}
            onExpand={expand}
          />
        </Panel>
      )}
    </>
  );
};

export default ChatWidget;
