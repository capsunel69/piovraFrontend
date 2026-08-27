import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { IconButton, Spinner } from '../ui/primitives';
import {
  IconBot,
  IconSend,
  IconStop,
  IconRefresh,
  IconX,
  IconMic,
  IconMicOff,
  IconVolume,
  IconVolumeOff,
  IconPlay,
  IconPause,
  IconAlert,
  IconPaperclip,
  IconFileText,
  IconMaximize,
  IconMinimize,
} from '../ui/icons';
import StepCard from '../agents/StepCard';
import GoogleConsentPrompt from '../agents/GoogleConsentPrompt';
import ConnectGmailBanner from '../agents/ConnectGmailBanner';
import { useChat } from '../../context/ChatContext';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { VoiceAPI, type VoiceCapabilities } from '../../services/voice';
import { PiovraAPI, type AgentStep, type OrchestrateUserFile } from '../../services/piovra';
import { shortModelLabel } from '../../constants/agentModels';
import { formatBubbleTime } from '../../utils/bubbleTime';
import {
  ORCHESTRATE_FILE_ACCEPT,
  ORCHESTRATE_FILE_MAX_BYTES,
  ORCHESTRATE_FILE_MAX_COUNT,
  ORCHESTRATE_FILES_MAX_TOTAL_BYTES,
  chatLimitsForModel,
  filesToOrchestrateFiles,
  formatChatLimitsLine,
  formatChatModelLine,
  isOrchestrateAttachable,
} from '../../utils/orchestrateImages';

/* ── Layout ────────────────────────────────────────────────────────────── */

const Surface = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

const GradientBar = styled.div`
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--accent), var(--purple), transparent);
  opacity: 0.7;
  flex-shrink: 0;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-1);
  flex-shrink: 0;
  background: rgba(7, 9, 13, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  @media (max-width: 720px) {
    padding: 10px 12px;
    gap: 6px;
  }
`;

const TitleBlock = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
`;

const Avatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--purple));
  color: #06121d;
  box-shadow: 0 0 20px var(--accent-glow);
  flex-shrink: 0;

  svg { width: 18px; height: 18px; }

  @media (max-width: 720px) {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    svg { width: 16px; height: 16px; }
  }
`;

const TitleText = styled.div`
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;

  strong {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  span {
    font-size: 11px;
    color: var(--text-3);
    font-family: var(--font-mono);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 720px) {
    strong { font-size: 13px; }
    span { font-size: 10.5px; margin-top: 1px; }
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  @media (max-width: 720px) {
    gap: 2px;
  }
`;

const HeaderChip = styled.button<{ $iconOnly?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border-1);
  background: var(--bg-2);
  color: var(--text-2);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;

  &:hover { background: var(--bg-3); color: var(--text-1); border-color: var(--border-2); }
  svg { width: 13px; height: 13px; }

  /* Hide label text on small viewports to avoid header crowding. */
  @media (max-width: 720px) {
    height: 30px;
    padding: ${(p) => (p.$iconOnly ? '0' : '0 8px')};
    width: ${(p) => (p.$iconOnly ? '30px' : 'auto')};
    justify-content: center;
    gap: 4px;
    font-size: 11px;

    .chip-label { display: none; }
    svg { width: 14px; height: 14px; }
  }
`;

const VoiceChipMarker = styled.span`
  display: inline-grid;
  place-items: center;
  width: 14px;
  height: 14px;
  font-size: 11px;
  line-height: 1;
  font-family: var(--font-mono);
  flex-shrink: 0;
`;

const LiveDot = styled.span<{ $live: boolean }>`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${(p) => (p.$live ? 'var(--success)' : 'var(--text-4)')};
  ${(p) =>
    p.$live &&
    css`
      box-shadow: 0 0 8px var(--success);
    `}
`;

const MessagesRegion = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const Scroller = styled.div<{ $wide: boolean }>`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 16px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  scroll-behavior: smooth;

  ${(p) =>
    p.$wide &&
    css`
      & > * {
        width: 100%;
        max-width: 1100px;
        margin-left: auto;
        margin-right: auto;
      }
      padding: 28px 28px 20px;
    `}

  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
`;

const ScrollFadeTop = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  pointer-events: none;
  z-index: 2;
  background: linear-gradient(
    180deg,
    var(--bg-1) 0%,
    color-mix(in srgb, var(--bg-1) 70%, transparent) 45%,
    transparent 100%
  );
`;

const Turn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const UserLine = styled.div`
  align-self: flex-end;
  background: linear-gradient(135deg, var(--accent-soft), rgba(164, 120, 255, 0.15));
  color: var(--text-1);
  border: 1px solid rgba(76, 194, 255, 0.2);
  border-radius: 16px 16px 4px 16px;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  max-width: 88%;
  word-wrap: break-word;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
`;

const UserStack = styled.div`
  align-self: flex-end;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: 88%;
  ${UserLine} { max-width: 100%; align-self: stretch; }
`;

const BubbleTime = styled.time<{ $mine?: boolean }>`
  margin-top: 4px;
  padding: 0 4px;
  font-size: 10.5px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--text-4);
  user-select: none;
  align-self: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
`;

const SentFiles = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
  white-space: normal;
`;

const SentFileChip = styled.span<{ $wide?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: ${(p) => (p.$wide ? '100%' : '280px')};
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(76, 194, 255, 0.25);
  background: rgba(7, 9, 13, 0.3);
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text-2);

  svg { width: 12px; height: 12px; flex-shrink: 0; }
  .n {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: ${(p) => (p.$wide ? 'normal' : 'nowrap')};
    word-break: ${(p) => (p.$wide ? 'break-all' : 'normal')};
    color: var(--text-1);
  }
  .s { color: var(--text-4); flex-shrink: 0; font-family: var(--font-mono); font-size: 10px; }
`;

const AgentColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-self: flex-start;
  max-width: 100%;
  width: 100%;
`;

const TurnFooter = styled.div`
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-4);
  padding: 0 2px;
  font-family: var(--font-mono);
  align-items: center;
`;

/* ── Empty state with suggestions ──────────────────────────────────────── */

const EmptyWrap = styled.div`
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 32px 12px;
  color: var(--text-3);
  text-align: center;
`;

const EmptyAvatar = styled(Avatar)`
  width: 54px;
  height: 54px;
  border-radius: 18px;
  svg { width: 28px; height: 28px; }
`;

const EmptyTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
`;

const EmptyHint = styled.div`
  font-size: 12.5px;
  max-width: 380px;
  line-height: 1.55;
`;

const EmptyLimits = styled.div`
  font-size: 11.5px;
  color: var(--text-3);
  font-family: var(--font-mono);
  max-width: 420px;
  line-height: 1.65;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-1);
  background: rgba(7, 9, 13, 0.35);
  text-align: left;

  strong { color: var(--text-1); font-weight: 600; }
`;

const Suggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
`;

const SuggestionChip = styled.button`
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
  border: 1px solid var(--border-2);
  background: var(--bg-2);
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;

  &:hover {
    background: var(--accent-soft);
    color: var(--accent);
    border-color: var(--accent);
    transform: translateY(-1px);
  }
`;

/* ── Composer ──────────────────────────────────────────────────────────── */

const ComposerBar = styled.form<{ $wide: boolean }>`
  border-top: 1px solid var(--border-1);
  padding: 10px 12px calc(12px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(7, 9, 13, 0.4);
  flex-shrink: 0;

  ${(p) =>
    p.$wide &&
    css`
      padding: 14px 20px calc(16px + env(safe-area-inset-bottom, 0px));
      & > * {
        width: 100%;
        max-width: 1100px;
        margin-left: auto;
        margin-right: auto;
      }
    `}
`;

const AttachmentStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 4px 4px;
`;

const ThumbWrap = styled.div`
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-2);
  flex-shrink: 0;
  background: var(--bg-3);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const FileChip = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 280px;
  height: 48px;
  padding: 0 28px 0 8px;
  border-radius: 8px;
  border: 1px solid var(--border-2);
  background: var(--bg-3);

  .icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: grid;
    place-items: center;
    color: var(--text-2);
    background: var(--bg-2);
    flex-shrink: 0;
  }

  .meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .name {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .size {
    font-size: 10px;
    color: var(--text-3);
  }
`;

const AttachError = styled.div`
  font-size: 11px;
  color: var(--danger);
  padding: 0 4px 2px;
`;

const ThumbRemove = styled.button`
  position: absolute;
  top: 1px;
  right: 1px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;

  svg {
    width: 10px;
    height: 10px;
  }
`;

const recPulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(255, 93, 108, 0.55); }
  70%  { box-shadow: 0 0 0 10px rgba(255, 93, 108, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 93, 108, 0); }
`;

/** Inline icon button that lives inside the input pill (attach, mic). */
const PillIconButton = styled.button<{ $recording?: boolean; $busy?: boolean }>`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  color: var(--text-3);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, transform 0.15s;
  padding: 0;

  &:hover:not(:disabled) {
    background: var(--bg-3);
    color: var(--text-1);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  ${(p) =>
    p.$recording &&
    css`
      background: var(--danger);
      color: #0b0306;
      animation: ${recPulse} 1.4s ease-out infinite;
      &:hover:not(:disabled) {
        background: var(--danger);
        color: #0b0306;
      }
    `}

  ${(p) =>
    p.$busy &&
    !p.$recording &&
    css`
      cursor: progress;
    `}

  svg {
    width: 17px;
    height: 17px;
  }
`;

const TextInputWrap = styled.div<{ $focused: boolean; $disabled: boolean }>`
  display: flex;
  align-items: flex-end;
  gap: 2px;
  background: var(--bg-2);
  border: 1px solid ${(p) => (p.$focused ? 'var(--accent)' : 'var(--border-2)')};
  border-radius: 22px;
  padding: 4px 4px 4px 6px;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: ${(p) => (p.$focused ? '0 0 0 3px var(--accent-soft)' : 'none')};
  opacity: ${(p) => (p.$disabled ? 0.6 : 1)};
  min-width: 0;
`;

const TextInput = styled.textarea`
  flex: 1;
  min-width: 0;
  min-height: 36px;
  max-height: 160px;
  resize: none;
  background: transparent;
  border: 0;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  padding: 8px 8px;
  line-height: 1.45;
  outline: none;
  overflow-y: auto;
  overflow-x: hidden;
  display: block;

  /* Hide native scrollbars; the textarea still scrolls via wheel/touch. */
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
  /* Some webkit builds expose the resize corner even with resize:none. */
  &::-webkit-resizer {
    display: none;
  }

  &::placeholder {
    color: var(--text-4);
  }

  @media (max-width: 720px) {
    font-size: 16px;
  }
`;

const SendButton = styled.button<{ $variant: 'send' | 'stop' }>`
  width: 36px;
  height: 36px;
  margin: 0;
  align-self: flex-end;
  border-radius: 999px;
  border: none;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.15s, filter 0.15s, opacity 0.15s;
  flex-shrink: 0;

  ${(p) =>
    p.$variant === 'send'
      ? css`
          background: linear-gradient(135deg, var(--accent), var(--purple));
          color: #06121d;
          box-shadow: 0 4px 16px rgba(76, 194, 255, 0.25);
        `
      : css`
          background: var(--danger);
          color: #0b0306;
        `}

  &:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
  &:not(:disabled):hover { transform: scale(1.05); filter: brightness(1.08); }
  &:not(:disabled):active { transform: scale(0.95); }

  svg { width: 16px; height: 16px; }
`;

/** Always-visible file limits + model line. */
const LimitsBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--text-3);
  padding: 6px 6px 0;
  font-family: var(--font-mono);
  line-height: 1.45;

  .limits {
    color: var(--text-2);
  }
  .model {
    color: var(--text-3);
  }
`;

const Hint = styled.div`
  font-size: 10.5px;
  color: var(--text-4);
  text-align: right;
  padding: 2px 6px 0;
  font-family: var(--font-mono);
`;

const RecBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 6px;
  font-size: 11.5px;
  color: var(--text-3);
  font-family: var(--font-mono);

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--danger);
    box-shadow: 0 0 8px var(--danger);
    animation: ${recPulse} 1.4s ease-out infinite;
  }
`;

const VoiceNotice = styled.div`
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 93, 108, 0.3);
  background: var(--danger-soft, rgba(255, 93, 108, 0.08));
  color: var(--text-1);
  border-radius: var(--r-sm);
  font-size: 12.5px;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  gap: 10px;

  svg {
    color: var(--danger);
    flex-shrink: 0;
    margin-top: 1px;
    width: 14px;
    height: 14px;
  }

  strong {
    color: var(--text-1);
    font-weight: 600;
  }

  button {
    margin-left: auto;
    background: transparent;
    border: 0;
    color: var(--text-3);
    cursor: pointer;
    padding: 2px;
    align-self: flex-start;
    &:hover {
      color: var(--text-1);
    }
    svg {
      width: 12px;
      height: 12px;
      color: currentColor;
    }
  }
`;

const PlayChip = styled.button<{ $playing?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--border-2);
  background: ${(p) => (p.$playing ? 'var(--accent-soft)' : 'var(--bg-2)')};
  color: ${(p) => (p.$playing ? 'var(--accent)' : 'var(--text-3)')};
  font-size: 10.5px;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: var(--bg-3);
    color: var(--text-1);
    border-color: var(--border-1);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 10px;
    height: 10px;
  }
`;

/* ── Component ─────────────────────────────────────────────────────────── */

const SUGGESTIONS = [
  'Add a task for today',
  "What's on my agenda?",
  'Email office@seroxy.eu from my work account about tomorrow',
  'Schedule a meeting tomorrow at 3pm',
  'Send a follow-up email to my latest work contact',
];

type PendingFile = { id: string; preview: string | null; file: File };

function formatAttachBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const VOICE_MODE_KEY = 'piovra.chat.voiceMode';
const VOICE_ID_KEY = 'piovra.chat.voiceId';

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60).toString().padStart(2, '0');
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function lastAssistantText(steps: AgentStep[]): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.kind === 'message' && s.role === 'assistant' && s.content?.trim()) {
      return s.content;
    }
  }
  return '';
}

function isAutoplayBlockedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /not allowed|denied|user agent|platform/i.test(message);
}

export interface ChatSurfaceProps {
  variant: 'widget' | 'page';
  /** Whether the surface is currently visible (widget: open; page: always). */
  active: boolean;
  onClose?: () => void;
  /** Widget → open the dedicated full page. */
  onExpand?: () => void;
  /** Page → back to the floating widget. */
  onCollapse?: () => void;
}

const ChatSurface: React.FC<ChatSurfaceProps> = ({
  variant,
  active,
  onClose,
  onExpand,
  onCollapse,
}) => {
  const { turns, status, send, abort, reset, instanceId, setInstanceId } = useChat();
  const isPage = variant === 'page';
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  /* ── Active model (for the limits line) ─────────────────────────────── */
  const [model, setModel] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        if (instanceId) {
          const inst = await PiovraAPI.getInstance(instanceId);
          const def = await PiovraAPI.getDefinition(inst.definitionId);
          if (!cancelled) setModel(def.model);
        } else {
          const defs = await PiovraAPI.listDefinitions();
          const def = defs.find((d) => d.name === 'default-assistant') ?? defs[0] ?? null;
          if (!cancelled) setModel(def?.model ?? null);
        }
      } catch {
        /* non-fatal: limits line just omits the model */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, instanceId]);

  const limits = chatLimitsForModel(model);
  const pendingBytes = pending.reduce((s, p) => s + p.file.size, 0);
  const limitsLine = formatChatLimitsLine(
    model,
    pending.length > 0 ? { count: pending.length, bytes: pendingBytes } : undefined,
  );
  const modelLine = formatChatModelLine(model);

  /* ── Voice ─────────────────────────────────────────────────────────── */
  const [voiceCaps, setVoiceCaps] = useState<VoiceCapabilities | null>(null);
  const [capsError, setCapsError] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(VOICE_MODE_KEY) === '1';
  });
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(VOICE_ID_KEY);
  });
  const [voiceNoticeDismissed, setVoiceNoticeDismissed] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  /** Which turn id is currently playing TTS, plus the underlying audio el. */
  const [playingTurnId, setPlayingTurnId] = useState<string | null>(null);
  const [pendingTtsTurnId, setPendingTtsTurnId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const spokenTurnsRef = useRef<Set<string>>(new Set());
  const recorder = useVoiceRecorder({ maxDurationMs: 90_000 });

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    VoiceAPI.getCapabilities(ctrl.signal)
      .then((c) => {
        if (!cancelled) setVoiceCaps(c);
      })
      .catch((err) => {
        if (cancelled) return;
        setCapsError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VOICE_MODE_KEY, voiceMode ? '1' : '0');
  }, [voiceMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedVoiceId) window.localStorage.setItem(VOICE_ID_KEY, selectedVoiceId);
  }, [selectedVoiceId]);

  const sttAvailable = !!voiceCaps?.stt.available && recorder.isSupported;
  const ttsAvailable = !!voiceCaps?.tts.available;
  const voiceFullyAvailable = sttAvailable && ttsAvailable;

  const availableVoices = voiceCaps?.tts.voices ?? [];
  const activeVoiceId =
    (selectedVoiceId && availableVoices.some((v) => v.id === selectedVoiceId)
      ? selectedVoiceId
      : null) ?? voiceCaps?.tts.defaultVoice ?? null;
  const activeVoice = availableVoices.find((v) => v.id === activeVoiceId) ?? null;

  const cycleVoice = useCallback((): void => {
    if (availableVoices.length === 0) return;
    const idx = availableVoices.findIndex((v) => v.id === activeVoiceId);
    const next = availableVoices[(idx + 1) % availableVoices.length];
    setSelectedVoiceId(next.id);
  }, [activeVoiceId, availableVoices]);

  const stopPlayback = useCallback((): void => {
    const el = audioRef.current;
    if (el) {
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    audioRef.current = null;
    setPlayingTurnId(null);
    setPendingTtsTurnId(null);
  }, []);

  const playTurnAudio = useCallback(
    async (turnId: string, text: string): Promise<void> => {
      if (!ttsAvailable || !text.trim()) return;
      stopPlayback();
      setPendingTtsTurnId(turnId);
      try {
        const blob = await VoiceAPI.synthesize({
          text,
          voice: activeVoiceId ?? undefined,
          format: 'mp3_44100_128',
        });
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const el = new Audio(url);
        audioRef.current = el;
        el.onended = () => {
          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            audioUrlRef.current = null;
          }
          if (audioRef.current === el) audioRef.current = null;
          setPlayingTurnId((p) => (p === turnId ? null : p));
        };
        el.onerror = () => {
          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url);
            audioUrlRef.current = null;
          }
          setPlayingTurnId((p) => (p === turnId ? null : p));
          setVoiceError('Could not play TTS audio.');
        };
        setPendingTtsTurnId(null);
        setPlayingTurnId(turnId);
        try {
          await el.play();
        } catch (err) {
          // iOS/Safari can block non-user-gesture autoplay. This isn't a real
          // runtime error; user can still tap the per-turn play chip.
          if (isAutoplayBlockedError(err)) {
            setPlayingTurnId((p) => (p === turnId ? null : p));
            return;
          }
          throw err;
        }
      } catch (err) {
        setPendingTtsTurnId(null);
        if (!isAutoplayBlockedError(err)) {
          setVoiceError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [stopPlayback, ttsAvailable, activeVoiceId],
  );

  const togglePlayTurn = useCallback(
    (turnId: string, text: string): void => {
      if (playingTurnId === turnId) {
        stopPlayback();
        return;
      }
      void playTurnAudio(turnId, text);
    },
    [playTurnAudio, playingTurnId, stopPlayback],
  );

  // Auto-speak newly-completed assistant turns when voice mode is on.
  useEffect(() => {
    if (!voiceMode || !ttsAvailable || !active) return;
    for (const t of turns) {
      if (t.status !== 'idle') continue;
      if (spokenTurnsRef.current.has(t.id)) continue;
      const text = (t.output && t.output.trim()) || lastAssistantText(t.steps);
      if (!text) continue;
      spokenTurnsRef.current.add(t.id);
      void playTurnAudio(t.id, text);
      break; // only one turn at a time
    }
  }, [turns, voiceMode, ttsAvailable, playTurnAudio, active]);

  // Stop playback / cancel recording when the surface is hidden.
  useEffect(() => {
    if (active) return;
    stopPlayback();
    if (recorder.state === 'recording') recorder.cancel();
  }, [active, stopPlayback, recorder]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  useEffect(() => {
    if (!active) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, status, active]);

  // Widget: drop staged files when it closes. The page keeps them.
  useEffect(() => {
    if (active || isPage) return;
    for (const p of pendingRef.current) {
      if (p.preview) URL.revokeObjectURL(p.preview);
    }
    setPending([]);
    setAttachError(null);
  }, [active, isPage]);

  useEffect(() => {
    if (!active || !onClose) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => textareaRef.current?.focus(), 260);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [active]);

  const autoGrow = (el: HTMLTextAreaElement | null): void => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, isPage ? 280 : 160)}px`;
  };

  const addFiles = (files: FileList | File[]): void => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const errors: string[] = [];
    const accepted: File[] = [];
    for (const f of incoming) {
      if (f.size > ORCHESTRATE_FILE_MAX_BYTES) {
        errors.push(`${f.name || 'File'} must be 80MB or smaller`);
        continue;
      }
      accepted.push(f);
    }
    setPending((prev) => {
      const next = [...prev];
      let total = next.reduce((s, p) => s + p.file.size, 0);
      for (const f of accepted) {
        if (next.length >= ORCHESTRATE_FILE_MAX_COUNT) {
          errors.push(`At most ${ORCHESTRATE_FILE_MAX_COUNT} files per message`);
          break;
        }
        if (total + f.size > ORCHESTRATE_FILES_MAX_TOTAL_BYTES) {
          errors.push('Attachments together must be 90MB or smaller');
          break;
        }
        total += f.size;
        next.push({
          id: crypto.randomUUID(),
          file: f,
          preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        });
      }
      return next;
    });
    setAttachError(errors[0] ?? null);
  };

  const removePending = (id: string): void => {
    setPending((prev) => {
      const t = prev.find((p) => p.id === id);
      if (t?.preview) URL.revokeObjectURL(t.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const streaming = status === 'streaming';

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (streaming) return;
    if (!value.trim() && pending.length === 0) return;
    const text = value;
    const toSend = pending;

    let files: OrchestrateUserFile[] | undefined;
    try {
      if (toSend.length > 0) {
        files = await filesToOrchestrateFiles(toSend.map((t) => t.file));
      }
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Could not read file');
      return;
    }
    setAttachError(null);
    setValue('');
    setPending([]);
    for (const p of toSend) {
      if (p.preview) URL.revokeObjectURL(p.preview);
    }
    // Wait for React to flush the empty value into the DOM before remeasuring
    // — otherwise scrollHeight still reflects the just-sent message and the
    // textarea stays tall.
    requestAnimationFrame(() => autoGrow(textareaRef.current));
    void send(text, files);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  const onPasteFiles = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = e.clipboardData.files;
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => isOrchestrateAttachable(f));
    if (list.length === 0) return;
    e.preventDefault();
    addFiles(list);
  };

  const submitSuggestion = (text: string): void => {
    if (status === 'streaming') return;
    void send(text);
  };

  const recording = recorder.state === 'recording' || recorder.state === 'requesting';
  const micBusy = transcribing || recorder.state === 'requesting';
  const micDisabled = streaming || (!sttAvailable && voiceNoticeDismissed);

  const handleMicClick = useCallback(async (): Promise<void> => {
    setVoiceError(null);
    if (!sttAvailable) {
      setVoiceNoticeDismissed(false);
      return;
    }
    if (recording) {
      const blob = await recorder.stop();
      if (!blob || blob.size < 200) {
        setTranscribing(false);
        return;
      }
      setTranscribing(true);
      try {
        const text = await VoiceAPI.transcribe(blob);
        setTranscribing(false);
        if (!text) return;
        if (voiceMode) {
          void send(text);
        } else {
          setValue((prev) => (prev ? `${prev} ${text}` : text));
          requestAnimationFrame(() => autoGrow(textareaRef.current));
          textareaRef.current?.focus();
        }
      } catch (err) {
        setTranscribing(false);
        setVoiceError(err instanceof Error ? err.message : String(err));
      }
      return;
    }
    if (streaming) return;
    stopPlayback();
    void recorder.start();
  }, [recorder, recording, send, sttAvailable, stopPlayback, streaming, voiceMode]);

  const toggleVoiceMode = useCallback((): void => {
    setVoiceMode((v) => {
      const next = !v;
      if (!next) stopPlayback();
      else if (!voiceFullyAvailable) {
        setVoiceNoticeDismissed(false);
      }
      return next;
    });
  }, [stopPlayback, voiceFullyAvailable]);

  return (
    <Surface>
      <GradientBar />
      <Header>
        <TitleBlock>
          <Avatar>
            <IconBot />
          </Avatar>
          <TitleText>
            <strong>Piovra</strong>
            <span>
              <LiveDot $live={!streaming} />
              {streaming
                ? 'thinking…'
                : turns.length
                  ? `${turns.length} turn${turns.length === 1 ? '' : 's'}`
                  : 'ready'}
              {model ? ` · ${shortModelLabel(model)}` : ''}
            </span>
          </TitleText>
        </TitleBlock>
        <HeaderActions>
          {instanceId && (
            <HeaderChip
              type="button"
              onClick={() => setInstanceId(undefined)}
              title="Switch back to default instance"
              aria-label={`Switch back to default instance (current: ${instanceId.slice(0, 6)})`}
              $iconOnly
            >
              <IconX />
              <span className="chip-label">inst {instanceId.slice(0, 6)}</span>
            </HeaderChip>
          )}
          <HeaderChip
            type="button"
            onClick={toggleVoiceMode}
            title={
              voiceMode
                ? 'Voice mode on — replies are spoken'
                : 'Voice mode off — turn on for hands-free'
            }
            aria-pressed={voiceMode}
            aria-label={voiceMode ? 'Turn voice mode off' : 'Turn voice mode on'}
            style={
              voiceMode
                ? { color: 'var(--accent)', borderColor: 'var(--accent)' }
                : undefined
            }
          >
            {voiceMode ? <IconVolume /> : <IconVolumeOff />}
            <span className="chip-label">Voice</span>
          </HeaderChip>
          {ttsAvailable && availableVoices.length > 1 && activeVoice && (
            <HeaderChip
              type="button"
              onClick={cycleVoice}
              title={`Switch voice (currently ${activeVoice.name})`}
              aria-label={`Switch voice — currently ${activeVoice.name}`}
            >
              <VoiceChipMarker aria-hidden>
                {activeVoice.gender === 'masculine' ? 'M' : activeVoice.gender === 'feminine' ? 'F' : '·'}
              </VoiceChipMarker>
              <span className="chip-label">{activeVoice.name}</span>
            </HeaderChip>
          )}
          {turns.length > 0 && (
            <HeaderChip
              type="button"
              onClick={reset}
              title="Reset conversation"
              aria-label="Reset conversation"
              $iconOnly
            >
              <IconRefresh />
              <span className="chip-label">Reset</span>
            </HeaderChip>
          )}
          {onExpand && (
            <HeaderChip
              type="button"
              onClick={onExpand}
              aria-label="Open fullscreen chat"
              title="Open fullscreen chat"
            >
              <IconMaximize />
              <span className="chip-label">Fullscreen</span>
            </HeaderChip>
          )}
          {onCollapse && (
            <HeaderChip
              type="button"
              onClick={onCollapse}
              aria-label="Back to widget"
              title="Back to widget"
            >
              <IconMinimize />
              <span className="chip-label">Widget</span>
            </HeaderChip>
          )}
          {onClose && (
            <IconButton $variant="ghost" onClick={onClose} aria-label="Close">
              <IconX />
            </IconButton>
          )}
        </HeaderActions>
      </Header>

      <MessagesRegion>
        <ScrollFadeTop aria-hidden />
        <Scroller ref={scrollRef} $wide={isPage}>
          <ConnectGmailBanner compact />
          {!voiceNoticeDismissed && voiceCaps && !voiceFullyAvailable && (
            <VoiceNotice>
              <IconAlert />
              <div>
                <strong>Voice not available on this model.</strong>{' '}
                This orchestrator/instance can't transcribe or speak — switch to a
                voice-capable model (the active instance must be backed by an OpenAI
                configuration). You can keep using text in the meantime.
              </div>
              <button
                type="button"
                onClick={() => setVoiceNoticeDismissed(true)}
                aria-label="Dismiss"
                title="Dismiss"
              >
                <IconX />
              </button>
            </VoiceNotice>
          )}
          {!voiceNoticeDismissed && capsError && (
            <VoiceNotice>
              <IconAlert />
              <div>
                <strong>Voice features unreachable.</strong> {capsError}
              </div>
              <button
                type="button"
                onClick={() => setVoiceNoticeDismissed(true)}
                aria-label="Dismiss"
                title="Dismiss"
              >
                <IconX />
              </button>
            </VoiceNotice>
          )}
          {voiceError && (
            <VoiceNotice>
              <IconAlert />
              <div>
                <strong>Voice error.</strong> {voiceError}
              </div>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                aria-label="Dismiss"
                title="Dismiss"
              >
                <IconX />
              </button>
            </VoiceNotice>
          )}
          {turns.length === 0 ? (
            <EmptyWrap>
              <EmptyAvatar>
                <IconBot />
              </EmptyAvatar>
              <EmptyTitle>How can I help?</EmptyTitle>
              <EmptyHint>
                I can add tasks, schedule meetings, set reminders, read/send email,
                look things up, and read files you attach — the whole conversation
                (including file contents) stays in context. Try one of these:
              </EmptyHint>
              <EmptyLimits>
                <strong>
                  {limits.maxFiles} files max · {limits.maxPerFile} per file · {limits.maxTotal} total
                </strong>
                <br />
                Any file type (PDF, Word, Excel, images, audio, code, ZIP, and the rest).
                {modelLine ? (
                  <>
                    <br />
                    {modelLine}
                  </>
                ) : null}
              </EmptyLimits>
              <Suggestions>
                {SUGGESTIONS.map((s) => (
                  <SuggestionChip
                    key={s}
                    type="button"
                    onClick={() => submitSuggestion(s)}
                    disabled={streaming}
                  >
                    {s}
                  </SuggestionChip>
                ))}
              </Suggestions>
            </EmptyWrap>
          ) : (
            turns.map((turn) => {
              const u = turn.input.trim();
              const sentFiles = turn.files ?? [];
              const sentAt = formatBubbleTime(turn.startedAt);
              return (
                <Turn key={turn.id}>
                  <UserStack>
                    <UserLine>
                      {u || (sentFiles.length > 0 ? 'Sent files' : '')}
                      {sentFiles.length > 0 && (
                        <SentFiles>
                          {sentFiles.map((f, i) => (
                            <SentFileChip key={`${turn.id}-f${i}`} $wide={isPage} title={f.name}>
                              <IconFileText />
                              <span className="n">{f.name}</span>
                              <span className="s">{formatAttachBytes(f.size)}</span>
                            </SentFileChip>
                          ))}
                        </SentFiles>
                      )}
                    </UserLine>
                    {sentAt && (
                      <BubbleTime $mine dateTime={turn.startedAt} title={sentAt.title}>
                        {sentAt.label}
                      </BubbleTime>
                    )}
                  </UserStack>
                  <AgentColumn>
                    {turn.steps.map((step, i) => (
                      <StepCard key={i} step={step} />
                    ))}
                    {turn.status === 'streaming' && (
                      <TurnFooter>
                        <Spinner $size={12} /> thinking…
                      </TurnFooter>
                    )}
                    {turn.needsConsent && <GoogleConsentPrompt consent={turn.needsConsent} />}
                    {turn.error && (
                      <TurnFooter style={{ color: 'var(--danger)' }}>{turn.error}</TurnFooter>
                    )}
                    {turn.status === 'idle' && turn.runId && (
                      <TurnFooter>
                        <span>run {turn.runId.slice(0, 8)}</span>
                        {turn.tokensIn !== null && <span>in {turn.tokensIn}</span>}
                        {turn.tokensOut !== null && <span>out {turn.tokensOut}</span>}
                        {ttsAvailable && (() => {
                          const speakText =
                            (turn.output && turn.output.trim()) ||
                            lastAssistantText(turn.steps);
                          if (!speakText) return null;
                          const isPlaying = playingTurnId === turn.id;
                          const isLoading = pendingTtsTurnId === turn.id;
                          return (
                            <PlayChip
                              type="button"
                              $playing={isPlaying}
                              disabled={isLoading}
                              onClick={() => togglePlayTurn(turn.id, speakText)}
                              title={isPlaying ? 'Stop speech' : 'Play reply'}
                              aria-label={isPlaying ? 'Stop speech' : 'Play reply'}
                            >
                              {isLoading ? (
                                <Spinner $size={10} />
                              ) : isPlaying ? (
                                <IconPause />
                              ) : (
                                <IconPlay />
                              )}
                              {isPlaying ? 'stop' : isLoading ? 'loading' : 'play'}
                            </PlayChip>
                          );
                        })()}
                      </TurnFooter>
                    )}
                  </AgentColumn>
                </Turn>
              );
            })
          )}
        </Scroller>
      </MessagesRegion>

      <ComposerBar
        $wide={isPage}
        onSubmit={handleSubmit}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files?.length) return;
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ORCHESTRATE_FILE_ACCEPT}
          multiple
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
          aria-hidden
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {pending.length > 0 && (
          <AttachmentStrip>
            {pending.map((p) =>
              p.preview && p.file.type.startsWith('image/') ? (
                <ThumbWrap key={p.id}>
                  <img src={p.preview} alt="" />
                  <ThumbRemove
                    type="button"
                    onClick={() => removePending(p.id)}
                    aria-label={`Remove ${p.file.name || 'file'}`}
                  >
                    <IconX />
                  </ThumbRemove>
                </ThumbWrap>
              ) : (
                <FileChip key={p.id}>
                  <span className="icon">
                    <IconFileText size={14} />
                  </span>
                  <span className="meta">
                    <span className="name">{p.file.name || 'File'}</span>
                    <span className="size">{formatAttachBytes(p.file.size)}</span>
                  </span>
                  <ThumbRemove
                    type="button"
                    onClick={() => removePending(p.id)}
                    aria-label={`Remove ${p.file.name || 'file'}`}
                  >
                    <IconX />
                  </ThumbRemove>
                </FileChip>
              ),
            )}
          </AttachmentStrip>
        )}
        {attachError && <AttachError>{attachError}</AttachError>}
        {recording && (
          <RecBar>
            <span className="dot" />
            <span>recording · {formatElapsed(recorder.elapsedMs)}</span>
            <span style={{ marginLeft: 'auto' }}>
              tap mic to {voiceMode ? 'send' : 'transcribe'} · or
            </span>
            <PlayChip
              type="button"
              onClick={() => recorder.cancel()}
              title="Cancel recording"
            >
              <IconX /> cancel
            </PlayChip>
          </RecBar>
        )}
        {transcribing && (
          <RecBar>
            <Spinner $size={10} />
            <span>transcribing…</span>
          </RecBar>
        )}
        <TextInputWrap $focused={focused} $disabled={streaming}>
          <PillIconButton
            type="button"
            disabled={streaming}
            onClick={() => fileRef.current?.click()}
            title={`Attach files — ${limitsLine}`}
            aria-label="Attach files"
          >
            <IconPaperclip />
          </PillIconButton>
          <PillIconButton
            type="button"
            data-recording={recording ? 'true' : undefined}
            $recording={recording}
            $busy={micBusy}
            disabled={micDisabled}
            onClick={handleMicClick}
            title={
              !sttAvailable
                ? 'Voice unavailable on this model — switch to one that supports voice'
                : recording
                  ? `Stop & ${voiceMode ? 'send' : 'transcribe'} (${formatElapsed(recorder.elapsedMs)})`
                  : voiceMode
                    ? 'Hold-to-talk: speak, then tap to send'
                    : 'Record voice (tap again to stop & transcribe)'
            }
            aria-label={recording ? 'Stop recording' : 'Start voice recording'}
            aria-pressed={recording}
          >
            {transcribing ? (
              <Spinner $size={14} />
            ) : recording ? (
              <IconStop />
            ) : sttAvailable ? (
              <IconMic />
            ) : (
              <IconMicOff />
            )}
          </PillIconButton>
          <TextInput
            ref={textareaRef}
            placeholder="Message Piovra…"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoGrow(e.currentTarget);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            onPaste={onPasteFiles}
            rows={1}
            disabled={streaming}
          />
          {streaming ? (
            <SendButton type="button" $variant="stop" onClick={abort} aria-label="Stop">
              <IconStop />
            </SendButton>
          ) : (
            <SendButton
              type="submit"
              $variant="send"
              disabled={!value.trim() && pending.length === 0}
              aria-label="Send"
            >
              <IconSend />
            </SendButton>
          )}
        </TextInputWrap>
        <LimitsBar>
          <span className="limits">{limitsLine}</span>
          <span className="model">{modelLine}</span>
        </LimitsBar>
        <Hint>
          Enter to send · Shift+Enter newline{onClose ? ' · Esc to close' : ''}
        </Hint>
      </ComposerBar>
    </Surface>
  );
};

export default ChatSurface;
