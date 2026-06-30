import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  IconTranscribe,
  IconTrash,
  IconCheck,
  IconCopy,
  IconDownload,
  IconMic,
  IconUpload,
  IconLink,
  IconFileText,
} from '../components/ui/icons';
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageSubtitle,
  Card,
  CardBody,
  Button,
  Stack,
  Row,
  Badge,
  Spinner,
} from '../components/ui/primitives';
import ErrorMessage from '../components/shared/ErrorMessage';
import LoadingState from '../components/shared/LoadingState';
import {
  TranscribeAPI,
  type SpeakerSegment,
  type TranscribeProgress,
  type TranscriptDetail,
  type TranscriptListItem,
  type TranscriptSegment,
} from '../services/transcribe';
import { formatDateTimeRo } from '../utils/dateFormat';

const LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'ro', label: 'Română' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'ru', label: 'Русский' },
  { code: 'uk', label: 'Українська' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
];

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ── Section scaffolding ──────────────────────────────────────────────── */

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
`;

const SectionLabel = styled.span`
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
`;

/* ── Segmented control ────────────────────────────────────────────────── */

const Segmented = styled.div`
  display: inline-flex;
  padding: 4px;
  gap: 4px;
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
`;

const SegBtn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border: none;
  border-radius: var(--r-sm);
  background: ${(p) => (p.$active ? 'var(--bg-3)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-3)')};
  font-size: var(--text-sm);
  font-weight: ${(p) => (p.$active ? 600 : 500)};
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  svg { width: 15px; height: 15px; }
  &:hover:not(:disabled) { color: var(--text-1); }
  &:disabled { cursor: not-allowed; }
`;

/* ── Settings bar ─────────────────────────────────────────────────────── */

const SettingsBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  padding: var(--s-4);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  background: var(--bg-1);
`;

const SettingsTop = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-5);
  align-items: flex-end;
`;

const FieldLabel = styled.label`
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 6px;
  display: block;
`;

const LangSelect = styled.select`
  height: 38px;
  padding: 0 32px 0 var(--s-3);
  border-radius: var(--r-sm);
  border: 1px solid var(--border-2);
  background: var(--bg-2)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a4adbb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")
    no-repeat right 10px center;
  appearance: none;
  color: var(--text-1);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  &:hover:not(:disabled) { border-color: var(--border-3); }
  &:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  option { background: var(--bg-1); color: var(--text-1); }
`;

const PodcastRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  padding-top: var(--s-4);
  border-top: 1px solid var(--border-1);
`;

const Switch = styled.button<{ $on?: boolean }>`
  position: relative;
  flex-shrink: 0;
  width: 38px;
  height: 22px;
  margin-top: 1px;
  border: none;
  border-radius: 999px;
  background: ${(p) => (p.$on ? 'var(--accent)' : 'var(--bg-4)')};
  cursor: pointer;
  transition: background 0.2s;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${(p) => (p.$on ? '19px' : '3px')};
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${(p) => (p.$on ? '#06121d' : 'var(--text-3)')};
    transition: left 0.2s, background 0.2s;
  }
`;

/* ── Dropzone ─────────────────────────────────────────────────────────── */

const dropPulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.06); opacity: 0.85; }
`;

const Dropzone = styled.div<{ $dragging?: boolean; $hasFile?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--s-3);
  min-height: 200px;
  border: 1.5px dashed ${(p) => (p.$dragging ? 'var(--accent)' : 'var(--border-2)')};
  border-radius: var(--r-lg);
  padding: var(--s-7);
  text-align: center;
  cursor: pointer;
  background: ${(p) =>
    p.$dragging
      ? 'var(--accent-soft)'
      : 'radial-gradient(120% 120% at 50% 0%, var(--bg-3), var(--bg-1))'};
  transition: border-color 0.18s, background 0.18s;
  &:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
`;

const DropIcon = styled.div<{ $dragging?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--r-full);
  background: var(--accent-soft);
  color: var(--accent);
  ${(p) => p.$dragging && `animation: ${dropPulse} 1s ease-in-out infinite;`}
`;

const DropHint = styled.span`
  font-size: var(--text-sm);
  color: var(--text-3);
`;

/* ── Selected file chip ───────────────────────────────────────────────── */

const FileChip = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--border-2);
  border-radius: var(--r-md);
  background: var(--bg-1);
`;

const FileIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--r-sm);
  background: var(--accent-soft);
  color: var(--accent);
`;

const FileMeta = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  .name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .size { font-size: var(--text-xs); color: var(--text-3); }
`;

const UrlInput = styled.input`
  width: 100%;
  height: 44px;
  padding: 0 var(--s-4);
  border-radius: var(--r-md);
  border: 1px solid var(--border-2);
  background: var(--bg-1);
  color: var(--text-1);
  font-size: var(--text-base);
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  &::placeholder { color: var(--text-3); }
  &:hover { border-color: var(--border-3); }
  &:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: var(--bg-2); }
  @media (max-width: 720px) { font-size: 16px; }
`;

/* ── Progress ─────────────────────────────────────────────────────────── */

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const ProgressCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-4);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  background: var(--bg-1);
`;

const ProgressTrack = styled.div`
  height: 8px;
  background: var(--bg-4);
  border-radius: var(--r-full);
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${(p) => p.$pct}%;
  border-radius: var(--r-full);
  background: linear-gradient(90deg, var(--accent-strong), var(--accent), var(--accent-strong));
  background-size: 200% 100%;
  animation: ${shimmer} 1.4s linear infinite;
  transition: width 0.35s ease;
`;

/* ── Results ──────────────────────────────────────────────────────────── */

const ResultHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  flex-wrap: wrap;
`;

const ResultTitle = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-1);
  svg { color: var(--accent); }
`;

const TranscriptBox = styled.pre`
  white-space: pre-wrap;
  word-break: break-word;
  padding: var(--s-4);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  font-family: inherit;
  font-size: var(--text-sm);
  line-height: 1.7;
  color: var(--text-1);
  max-height: 420px;
  overflow-y: auto;
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
`;

const HistoryItem = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  background: var(--bg-1);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  color: var(--text-1);
  &:hover {
    background: var(--bg-3);
    border-color: var(--border-3);
  }
`;

const HistoryIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: var(--r-sm);
  background: var(--bg-3);
  color: var(--text-3);
`;

const SpeakerBadge = styled.span<{ $host?: boolean }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--r-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  background: ${(p) => (p.$host ? 'var(--accent-soft)' : 'var(--bg-3)')};
  color: ${(p) => (p.$host ? 'var(--accent)' : 'var(--text-2)')};
  margin-right: var(--s-2);
`;

const PodcastLine = styled.div`
  margin-bottom: var(--s-3);
`;

const SubtitleLine = styled.div`
  display: flex;
  gap: var(--s-4);
  padding: var(--s-3) 0;
  border-bottom: 1px solid var(--border-1);
  font-size: var(--text-sm);
  line-height: 1.6;
  &:last-child { border-bottom: none; }
`;

const SubtitleTime = styled.div`
  flex-shrink: 0;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  font-size: var(--text-xs);
  min-width: 120px;
  padding-top: 1px;
`;

const STAGE_LABELS: Record<string, string> = {
  starting: 'Starting',
  uploading: 'Uploading',
  downloading: 'Downloading',
  converting: 'Converting',
  transcribing: 'Transcribing',
  diarizing: 'Identifying speakers',
  complete: 'Complete',
};

function ProgressPanel({ progress }: { progress: TranscribeProgress | null }) {
  if (!progress) return null;
  const stage = STAGE_LABELS[progress.stage] ?? progress.stage;
  return (
    <ProgressCard>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row $gap={2}>
          <Spinner $size={15} />
          <SectionLabel>{stage}</SectionLabel>
        </Row>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {progress.percent}%
        </span>
      </Row>
      <ProgressTrack>
        <ProgressFill $pct={progress.percent} />
      </ProgressTrack>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>{progress.message}</span>
    </ProgressCard>
  );
}

function PodcastTranscript({ segments }: { segments: SpeakerSegment[] }) {
  return (
    <TranscriptBox as="div">
      {segments.map((seg, i) => (
        <PodcastLine key={i}>
          <SpeakerBadge $host={seg.speakerLabel === 'Gazdă'}>{seg.speakerLabel}</SpeakerBadge>
          {seg.text.trim()}
        </PodcastLine>
      ))}
    </TranscriptBox>
  );
}

export default function Transcribe() {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [mode, setMode] = useState<'text' | 'subtitles'>('text');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<TranscribeProgress | null>(null);
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const [srt, setSrt] = useState<string | null>(null);
  const [speakerSegments, setSpeakerSegments] = useState<SpeakerSegment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState('auto');
  const [isPodcast, setIsPodcast] = useState(false);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<TranscriptListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const items = await TranscribeAPI.getHistory();
      setHistory(items);
    } catch {
      /* ignore on initial load */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const resetResults = () => {
    setTranscript('');
    setSegments(null);
    setSrt(null);
    setSpeakerSegments(null);
    setError(null);
    setProgress(null);
  };

  const handleResult = (data: {
    transcript?: string;
    segments?: TranscriptSegment[] | null;
    srt?: string | null;
    speakerSegments?: SpeakerSegment[] | null;
  }) => {
    setTranscript(data.transcript || '');
    setSegments(data.segments || null);
    setSrt(data.srt || null);
    setSpeakerSegments(data.speakerSegments || null);
  };

  const loadFromHistory = async (id: string) => {
    try {
      const detail: TranscriptDetail = await TranscribeAPI.get(id);
      setMode(detail.mode as 'text' | 'subtitles');
      setIsPodcast(detail.contentType === 'podcast');
      handleResult(detail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transcript');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this transcript?')) return;
    try {
      await TranscribeAPI.remove(id);
      setHistory((h) => h.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const runTranscribe = async () => {
    const opts = {
      language,
      mode,
      contentType: (isPodcast ? 'podcast' : 'default') as 'default' | 'podcast',
    };

    setIsProcessing(true);
    resetResults();
    setProgress({ percent: 2, message: 'Starting...', stage: 'starting' });

    try {
      const data =
        activeTab === 'upload' && file
          ? await TranscribeAPI.transcribeFile(file, opts, setProgress)
          : await TranscribeAPI.transcribeUrl(url, opts, setProgress);

      handleResult(data);
      setProgress({ percent: 100, message: 'Done!', stage: 'complete' });
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleCopy = () => {
    const content = mode === 'subtitles' && srt ? srt : transcript;
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  const switchTab = (tab: 'upload' | 'url') => {
    if (isProcessing) return;
    setActiveTab(tab);
    resetResults();
    setFile(null);
    setUrl('');
  };

  const canTranscribe = activeTab === 'upload' ? !!file : !!url.trim();
  const hasResult = !!transcript;
  const showPodcastLayout = isPodcast && (speakerSegments?.length ?? 0) > 0;

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle>
            <IconTranscribe size={24} /> Transcribe
          </PageTitle>
          <PageSubtitle>Convert audio and video to text or subtitles with Whisper.</PageSubtitle>
        </div>
      </PageHeader>

      <Stack $gap={6}>
        <Card>
          <CardBody>
            <Stack $gap={5} style={{ padding: '0 var(--s-5)' }}>
              {/* Source */}
              <Section>
                <SectionLabel>Source</SectionLabel>
                <Segmented role="tablist">
                  <SegBtn
                    $active={activeTab === 'upload'}
                    onClick={() => switchTab('upload')}
                    disabled={isProcessing}
                  >
                    <IconUpload /> Upload file
                  </SegBtn>
                  <SegBtn
                    $active={activeTab === 'url'}
                    onClick={() => switchTab('url')}
                    disabled={isProcessing}
                  >
                    <IconLink /> Video URL
                  </SegBtn>
                </Segmented>
              </Section>

              {/* Input */}
              {activeTab === 'upload' ? (
                file ? (
                  <FileChip>
                    <FileIcon>
                      <IconFileText size={20} />
                    </FileIcon>
                    <FileMeta>
                      <span className="name">{file.name}</span>
                      <span className="size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </FileMeta>
                    <Button
                      $variant="ghost"
                      $size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                    >
                      Change
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setFile(e.target.files[0]);
                          resetResults();
                        }
                      }}
                      accept="audio/*,video/*"
                      hidden
                    />
                  </FileChip>
                ) : (
                  <Dropzone
                    $dragging={isDragging}
                    $hasFile={!!file}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files?.[0]) {
                        setFile(e.dataTransfer.files[0]);
                        resetResults();
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setFile(e.target.files[0]);
                          resetResults();
                        }
                      }}
                      accept="audio/*,video/*"
                      hidden
                    />
                    <DropIcon $dragging={isDragging}>
                      <IconMic size={24} />
                    </DropIcon>
                    <Stack $gap={1} style={{ alignItems: 'center' }}>
                      <strong style={{ fontSize: 'var(--text-base)' }}>
                        {isDragging ? 'Drop to upload' : 'Drag & drop or click to select'}
                      </strong>
                      <DropHint>MP3, MP4, WAV, MKV and more · up to 2 GB</DropHint>
                    </Stack>
                  </Dropzone>
                )
              ) : (
                <Section>
                  <UrlInput
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      resetResults();
                    }}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && canTranscribe && !isProcessing && void runTranscribe()
                    }
                    disabled={isProcessing}
                  />
                  <DropHint>Supports YouTube, TikTok, Facebook, Vimeo, and 1000+ sites via yt-dlp.</DropHint>
                </Section>
              )}

              {/* Settings */}
              <SettingsBar>
                <SettingsTop>
                  <div>
                    <FieldLabel htmlFor="lang-select">Language</FieldLabel>
                    <LangSelect
                      id="lang-select"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      disabled={isProcessing}
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </LangSelect>
                  </div>

                  <div>
                    <FieldLabel as="span">Output</FieldLabel>
                    <Segmented>
                      <SegBtn $active={mode === 'text'} onClick={() => setMode('text')} disabled={isProcessing}>
                        Text
                      </SegBtn>
                      <SegBtn
                        $active={mode === 'subtitles'}
                        onClick={() => setMode('subtitles')}
                        disabled={isProcessing}
                      >
                        Subtitles
                      </SegBtn>
                    </Segmented>
                  </div>
                </SettingsTop>

                <PodcastRow>
                  <Switch
                    type="button"
                    $on={isPodcast}
                    onClick={() => setIsPodcast((v) => !v)}
                    disabled={isProcessing}
                    role="switch"
                    aria-checked={isPodcast}
                    aria-label="Podcast mode"
                  />
                  <Stack $gap={1}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-1)' }}>
                      Podcast mode
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', lineHeight: 1.5 }}>
                      Labels speakers as host (Gazdă) and guest (Invitat). Uses voice diarization when
                      available, with heuristic fallback.
                    </span>
                  </Stack>
                </PodcastRow>
              </SettingsBar>

              <Button
                $variant="primary"
                $size="md"
                $block
                onClick={() => void runTranscribe()}
                disabled={isProcessing || !canTranscribe}
              >
                {isProcessing ? (
                  <>
                    <Spinner $size={16} /> Processing...
                  </>
                ) : (
                  <>
                    <IconTranscribe size={16} />
                    {isPodcast
                      ? mode === 'subtitles'
                        ? 'Transcribe podcast + subtitles'
                        : 'Transcribe podcast'
                      : mode === 'subtitles'
                        ? 'Generate subtitles'
                        : 'Transcribe'}
                  </>
                )}
              </Button>

              {isProcessing && <ProgressPanel progress={progress} />}
              {error && <ErrorMessage message={error} onRetry={canTranscribe ? () => void runTranscribe() : undefined} />}
            </Stack>
          </CardBody>
        </Card>

        {hasResult && mode === 'text' && (
          <Card>
            <CardBody>
              <Stack $gap={4} style={{ padding: '0 var(--s-5)' }}>
                <ResultHead>
                  <ResultTitle>
                    <IconFileText size={18} />
                    {showPodcastLayout ? 'Podcast transcript' : 'Transcript'}
                    <Badge $variant="accent">
                      {transcript.split(/\s+/).filter(Boolean).length} words
                    </Badge>
                  </ResultTitle>
                  <Row $gap={2}>
                    <Button $variant="secondary" $size="sm" onClick={handleCopy}>
                      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />} {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      $variant="secondary"
                      $size="sm"
                      onClick={() => downloadFile(transcript, 'transcript.txt')}
                    >
                      <IconDownload size={14} /> TXT
                    </Button>
                  </Row>
                </ResultHead>
                {showPodcastLayout && speakerSegments ? (
                  <PodcastTranscript segments={speakerSegments} />
                ) : (
                  <TranscriptBox>{transcript}</TranscriptBox>
                )}
              </Stack>
            </CardBody>
          </Card>
        )}

        {hasResult && mode === 'subtitles' && segments && (
          <Card>
            <CardBody>
              <Stack $gap={4} style={{ padding: '0 var(--s-5)' }}>
                <ResultHead>
                  <ResultTitle>
                    <IconFileText size={18} />
                    {showPodcastLayout ? 'Podcast subtitles' : 'Subtitles'}
                    <Badge $variant="accent">{segments.length} segments</Badge>
                  </ResultTitle>
                  <Row $gap={2}>
                    <Button $variant="secondary" $size="sm" onClick={handleCopy}>
                      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />} {copied ? 'Copied' : 'Copy SRT'}
                    </Button>
                    {srt && (
                      <Button $variant="secondary" $size="sm" onClick={() => downloadFile(srt, 'subtitles.srt')}>
                        <IconDownload size={14} /> SRT
                      </Button>
                    )}
                    <Button
                      $variant="secondary"
                      $size="sm"
                      onClick={() => downloadFile(transcript, 'transcript.txt')}
                    >
                      <IconDownload size={14} /> TXT
                    </Button>
                  </Row>
                </ResultHead>
                <div>
                  {segments.map((seg, i) => (
                    <SubtitleLine key={i}>
                      <SubtitleTime>
                        {formatTime(seg.start)} → {formatTime(seg.end)}
                      </SubtitleTime>
                      <div>
                        {seg.speakerLabel && (
                          <SpeakerBadge $host={seg.speakerLabel === 'Gazdă'}>
                            {seg.speakerLabel}
                          </SpeakerBadge>
                        )}
                        {seg.text.trim()}
                      </div>
                    </SubtitleLine>
                  ))}
                </div>
              </Stack>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <Stack $gap={4} style={{ padding: '0 var(--s-5)' }}>
              <ResultTitle>
                <IconTranscribe size={18} /> History
              </ResultTitle>
              {historyLoading ? (
                <LoadingState message="Loading history..." />
              ) : history.length === 0 ? (
                <span style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>
                  No transcripts yet.
                </span>
              ) : (
                <HistoryList>
                  {history.map((item) => (
                    <HistoryItem key={item.id} onClick={() => void loadFromHistory(item.id)}>
                      <HistoryIcon>
                        {item.source === 'url' ? <IconLink size={16} /> : <IconFileText size={16} />}
                      </HistoryIcon>
                      <Stack $gap={1} style={{ flex: 1, minWidth: 0 }}>
                        <strong
                          style={{
                            fontSize: 'var(--text-sm)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.sourceName || (item.source === 'url' ? 'URL' : 'File')}
                        </strong>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                          {formatDateTimeRo(item.createdAt)} · {item.mode}
                          {item.contentType === 'podcast' ? ' · podcast' : ''}
                        </span>
                      </Stack>
                      <Button
                        $variant="ghost"
                        $size="sm"
                        onClick={(e) => void handleDelete(item.id, e)}
                        aria-label="Delete"
                      >
                        <IconTrash size={16} />
                      </Button>
                    </HistoryItem>
                  ))}
                </HistoryList>
              )}
            </Stack>
          </CardBody>
        </Card>
      </Stack>
    </PageContainer>
  );
}
