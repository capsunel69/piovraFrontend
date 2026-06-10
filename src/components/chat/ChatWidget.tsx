import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { IconButton, Spinner } from '../ui/primitives';
import {
  IconBot,
  IconSend,
  IconStop,
  IconRefresh,
  IconX,
  IconImage,
  IconMic,
  IconMicOff,
  IconVolume,
  IconVolumeOff,
  IconPlay,
  IconPause,
  IconAlert,
} from '../ui/icons';
import StepCard from '../agents/StepCard';
import GoogleConsentPrompt from '../agents/GoogleConsentPrompt';
import { useChat } from '../../context/ChatContext';
import { useOverlayCount } from '../../hooks/useOverlayStack';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { VoiceAPI, type VoiceCapabilities } from '../../services/voice';
import type { AgentStep, OrchestrateUserImage } from '../../services/piovra';
import {
  ORCHESTRATE_IMAGE_MAX_COUNT,
  filesToOrchestrateImages,
} from '../../utils/orchestrateImages';

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

/* ── Popup ─────────────────────────────────────────────────────────────── */

const popIn = keyframes`
  from { transform: translateY(12px) scale(0.98); opacity: 0; }
  to   { transform: translateY(0)    scale(1);    opacity: 1; }
`;

const Panel = styled.aside`
  position: fixed;
  right: 22px;
  bottom: 22px;
  width: min(460px, calc(100vw - 32px));
  height: min(640px, calc(100vh - 120px));
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

const Scroller = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  scroll-behavior: smooth;

  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
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
  max-width: 320px;
  line-height: 1.55;
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

const ComposerBar = styled.form`
  border-top: 1px solid var(--border-1);
  padding: 10px 12px calc(12px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(7, 9, 13, 0.4);
  flex-shrink: 0;
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

const Hint = styled.div`
  font-size: 10.5px;
  color: var(--text-4);
  text-align: right;
  padding: 4px 6px 0;
  font-family: var(--font-mono);
`;

const recPulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(255, 93, 108, 0.55); }
  70%  { box-shadow: 0 0 0 10px rgba(255, 93, 108, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 93, 108, 0); }
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

type PendingImage = { id: string; preview: string; file: File };

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

const ChatWidget: React.FC = () => {
  const { turns, status, send, abort, reset, isOpen, open, close, instanceId, setInstanceId } = useChat();
  const overlayCount = useOverlayCount();
  const bubbleHidden = isOpen || overlayCount > 0;
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

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
    if (!voiceMode || !ttsAvailable) return;
    for (const t of turns) {
      if (t.status !== 'idle') continue;
      if (spokenTurnsRef.current.has(t.id)) continue;
      const text = (t.output && t.output.trim()) || lastAssistantText(t.steps);
      if (!text) continue;
      spokenTurnsRef.current.add(t.id);
      void playTurnAudio(t.id, text);
      break; // only one turn at a time
    }
  }, [turns, voiceMode, ttsAvailable, playTurnAudio]);

  // Stop playback / cancel recording when widget closes.
  useEffect(() => {
    if (isOpen) return;
    stopPlayback();
    if (recorder.state === 'recording') recorder.cancel();
  }, [isOpen, stopPlayback, recorder]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  useEffect(() => {
    if (!isOpen) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, status, isOpen]);

  useEffect(() => {
    if (isOpen) return;
    for (const p of pendingRef.current) URL.revokeObjectURL(p.preview);
    setPending([]);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => textareaRef.current?.focus(), 260);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isOpen]);

  const autoGrow = (el: HTMLTextAreaElement | null): void => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const addFiles = (files: FileList | File[]): void => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    setPending((prev) => {
      const next = [...prev];
      for (const f of list) {
        if (next.length >= ORCHESTRATE_IMAGE_MAX_COUNT) break;
        next.push({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) });
      }
      return next;
    });
  };

  const removePending = (id: string): void => {
    setPending((prev) => {
      const t = prev.find((p) => p.id === id);
      if (t) URL.revokeObjectURL(t.preview);
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

    let images: OrchestrateUserImage[] | undefined;
    try {
      if (toSend.length > 0) {
        images = await filesToOrchestrateImages(toSend.map((t) => t.file));
      }
    } catch {
      return;
    }
    setValue('');
    setPending([]);
    for (const p of toSend) URL.revokeObjectURL(p.preview);
    // Wait for React to flush the empty value into the DOM before remeasuring
    // — otherwise scrollHeight still reflects the just-sent message and the
    // textarea stays tall.
    requestAnimationFrame(() => autoGrow(textareaRef.current));
    void send(text, images);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  const onPasteImages = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = e.clipboardData.files;
    if (!files?.length) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) return;
    e.preventDefault();
    addFiles(imgs);
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
    <>
      <HoverRevealWrap $hidden={bubbleHidden}>
        <BubbleLabel>Ask Piovra</BubbleLabel>
        <BubbleButton onClick={() => open()} aria-label="Open assistant">
          <IconBot />
          <StatusDot />
        </BubbleButton>
      </HoverRevealWrap>

      {isOpen && (
        <Panel role="dialog" aria-label="Assistant">
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
              <IconButton $variant="ghost" onClick={close} aria-label="Close">
                <IconX />
              </IconButton>
            </HeaderActions>
          </Header>

          <Scroller ref={scrollRef}>
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
                  I can add tasks, schedule meetings, set reminders, read/send email, and look things up. Try one
                  of these:
                </EmptyHint>
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
                const userLabel =
                  u ||
                  (turn.imageCount
                    ? turn.imageCount === 1
                      ? 'Image'
                      : `${turn.imageCount} images`
                    : '');
                return (
                <Turn key={turn.id}>
                  <UserLine>
                    {userLabel}
                    {u && turn.imageCount ? ` · ${turn.imageCount} image(s)` : ''}
                  </UserLine>
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

          <ComposerBar onSubmit={handleSubmit}>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
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
                {pending.map((p) => (
                  <ThumbWrap key={p.id}>
                    <img src={p.preview} alt="" />
                    <ThumbRemove
                      type="button"
                      onClick={() => removePending(p.id)}
                      aria-label="Remove image"
                    >
                      <IconX />
                    </ThumbRemove>
                  </ThumbWrap>
                ))}
              </AttachmentStrip>
            )}
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
                title="Add image"
                aria-label="Add image"
              >
                <IconImage />
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
                    ? "Voice unavailable on this model — switch to one that supports voice"
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
                onPaste={onPasteImages}
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
            <Hint>
              Enter to send · Shift+Enter newline · Esc to close
            </Hint>
          </ComposerBar>
        </Panel>
      )}
    </>
  );
};

export default ChatWidget;
