import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  IconTranscribe,
  IconTrash,
  IconCheck,
  IconExternal,
  IconMic,
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

const FieldLabel = styled.label`
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-3);
`;

const OptionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-5);
  align-items: flex-end;
`;

const LangSelect = styled.select`
  height: 40px;
  padding: 0 var(--s-3);
  border-radius: var(--r-md);
  border: 1px solid var(--border-1);
  background: var(--surface-1);
  color: var(--text-1);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: border-color 0.15s;
  &:hover { border-color: var(--border-2); }
  &:focus { outline: none; border-color: var(--accent); }
`;

const ModeSwitcher = styled.div`
  display: inline-flex;
  height: 40px;
  padding: 3px;
  gap: 3px;
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  background: var(--surface-1);
`;

const ModeBtn = styled.button<{ $active?: boolean }>`
  padding: 0 var(--s-4);
  border: none;
  border-radius: calc(var(--r-md) - 3px);
  background: ${(p) => (p.$active ? 'var(--accent)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--on-accent)' : 'var(--text-2)')};
  font-size: var(--text-sm);
  font-weight: ${(p) => (p.$active ? 600 : 400)};
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  &:hover {
    background: ${(p) => (p.$active ? 'var(--accent)' : 'var(--surface-3)')};
  }
`;

const ToggleCard = styled.label<{ $active?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border: 1px solid ${(p) => (p.$active ? 'var(--accent)' : 'var(--border-1)')};
  border-radius: var(--r-md);
  background: ${(p) => (p.$active ? 'var(--accent-muted)' : 'var(--surface-1)')};
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  &:hover { border-color: var(--border-2); }

  input { margin-top: 2px; cursor: pointer; flex-shrink: 0; }
`;

const TabSwitcher = styled.div`
  display: flex;
  gap: var(--s-1);
  border-bottom: 1px solid var(--border-1);
`;

const TabBtn = styled.button<{ $active?: boolean }>`
  padding: var(--s-3) var(--s-4);
  margin-bottom: -1px;
  border: none;
  background: transparent;
  font-size: var(--text-sm);
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-3)')};
  font-weight: ${(p) => (p.$active ? 600 : 500)};
  border-bottom: 2px solid ${(p) => (p.$active ? 'var(--accent)' : 'transparent')};
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  &:hover { color: var(--text-1); }
`;

const Dropzone = styled.div<{ $dragging?: boolean; $hasFile?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--s-3);
  min-height: 180px;
  border: 1.5px dashed ${(p) => (p.$dragging ? 'var(--accent)' : 'var(--border-2)')};
  border-radius: var(--r-lg);
  padding: var(--s-8);
  text-align: center;
  cursor: pointer;
  background: ${(p) =>
    p.$dragging ? 'var(--accent-muted)' : p.$hasFile ? 'var(--surface-2)' : 'var(--surface-1)'};
  transition: border-color 0.15s, background 0.15s;
  &:hover {
    border-color: var(--accent);
    background: var(--surface-2);
  }
`;

const DropIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--r-full);
  background: var(--surface-3);
  color: var(--text-2);
`;

const UrlInput = styled.input`
  width: 100%;
  height: 44px;
  padding: 0 var(--s-4);
  border-radius: var(--r-md);
  border: 1px solid var(--border-1);
  background: var(--surface-1);
  color: var(--text-1);
  font-size: var(--text-base);
  transition: border-color 0.15s;
  &::placeholder { color: var(--text-3); }
  &:hover { border-color: var(--border-2); }
  &:focus { outline: none; border-color: var(--accent); }
`;

const ProgressTrack = styled.div`
  height: 6px;
  background: var(--surface-3);
  border-radius: var(--r-full);
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${(p) => p.$pct}%;
  background: var(--accent);
  transition: width 0.3s ease;
`;

const TranscriptBox = styled.pre`
  white-space: pre-wrap;
  word-break: break-word;
  padding: var(--s-4);
  background: var(--surface-2);
  border-radius: var(--r-md);
  font-family: inherit;
  font-size: var(--text-sm);
  line-height: 1.6;
  max-height: 400px;
  overflow-y: auto;
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
`;

const HistoryItem = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  background: var(--surface-1);
  text-align: left;
  cursor: pointer;
  width: 100%;
  color: var(--text-1);
  &:hover {
    background: var(--surface-2);
  }
`;

const SpeakerBadge = styled.span<{ $host?: boolean }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--r-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  background: ${(p) => (p.$host ? 'var(--accent-muted)' : 'var(--surface-3)')};
  color: ${(p) => (p.$host ? 'var(--accent)' : 'var(--text-2)')};
  margin-right: var(--s-2);
`;

const PodcastLine = styled.div`
  margin-bottom: var(--s-3);
`;

const SubtitleLine = styled.div`
  display: flex;
  gap: var(--s-4);
  padding: var(--s-2) 0;
  border-bottom: 1px solid var(--border-1);
  font-size: var(--text-sm);
`;

const SubtitleTime = styled.div`
  flex-shrink: 0;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  min-width: 120px;
`;

function ProgressPanel({ progress }: { progress: TranscribeProgress | null }) {
  if (!progress) return null;
  return (
    <Stack $gap={2}>
      <Row style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>{progress.message}</span>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{progress.percent}%</span>
      </Row>
      <ProgressTrack>
        <ProgressFill $pct={progress.percent} />
      </ProgressTrack>
    </Stack>
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
        <PageTitle>
          <IconTranscribe size={24} /> Transcribe
        </PageTitle>
        <PageSubtitle>Convert audio and video to text or subtitles with Whisper.</PageSubtitle>
      </PageHeader>

      <Stack $gap={6}>
        <Card>
          <CardBody>
            <Stack $gap={5}>
              <OptionsRow>
                <Stack $gap={2}>
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
                </Stack>

                <Stack $gap={2}>
                  <FieldLabel as="span">Output</FieldLabel>
                  <ModeSwitcher>
                    <ModeBtn $active={mode === 'text'} onClick={() => setMode('text')} disabled={isProcessing}>
                      Text
                    </ModeBtn>
                    <ModeBtn
                      $active={mode === 'subtitles'}
                      onClick={() => setMode('subtitles')}
                      disabled={isProcessing}
                    >
                      Subtitles
                    </ModeBtn>
                  </ModeSwitcher>
                </Stack>
              </OptionsRow>

              <ToggleCard $active={isPodcast}>
                <input
                  type="checkbox"
                  checked={isPodcast}
                  onChange={(e) => setIsPodcast(e.target.checked)}
                  disabled={isProcessing}
                />
                <Stack $gap={1}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    Podcast mode
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                    Labels speakers as host (Gazdă) and guest (Invitat). Uses voice diarization when
                    available, with heuristic fallback.
                  </span>
                </Stack>
              </ToggleCard>

              <TabSwitcher>
                <TabBtn $active={activeTab === 'upload'} onClick={() => switchTab('upload')}>
                  Upload file
                </TabBtn>
                <TabBtn $active={activeTab === 'url'} onClick={() => switchTab('url')}>
                  Video URL
                </TabBtn>
              </TabSwitcher>

              {activeTab === 'upload' && (
                <Stack $gap={4}>
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
                    <DropIcon>
                      <IconMic size={22} />
                    </DropIcon>
                    {file ? (
                      <Stack $gap={1} style={{ alignItems: 'center' }}>
                        <strong>{file.name}</strong>
                        <span style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB · click to change
                        </span>
                      </Stack>
                    ) : (
                      <Stack $gap={1} style={{ alignItems: 'center' }}>
                        <strong>Drag & drop or click to select</strong>
                        <span style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>
                          MP3, MP4, WAV, MKV and more (max 2 GB)
                        </span>
                      </Stack>
                    )}
                  </Dropzone>
                </Stack>
              )}

              {activeTab === 'url' && (
                <Stack $gap={2}>
                  <UrlInput
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      resetResults();
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && canTranscribe && !isProcessing && void runTranscribe()}
                    disabled={isProcessing}
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                    Supports YouTube, TikTok, Facebook, Vimeo, and 1000+ sites via yt-dlp.
                  </span>
                </Stack>
              )}

              <Button
                $variant="primary"
                $size="md"
                $block
                onClick={() => void runTranscribe()}
                disabled={isProcessing || !canTranscribe}
              >
                {isProcessing ? (
                  <>
                    <Spinner /> Processing...
                  </>
                ) : isPodcast ? (
                  mode === 'subtitles' ? 'Transcribe podcast + subtitles' : 'Transcribe podcast'
                ) : mode === 'subtitles' ? (
                  'Generate subtitles'
                ) : (
                  'Transcribe'
                )}
              </Button>

              {isProcessing && <ProgressPanel progress={progress} />}
              {error && <ErrorMessage message={error} />}
            </Stack>
          </CardBody>
        </Card>

        {hasResult && mode === 'text' && (
          <Card>
            <CardBody>
              <Stack $gap={4}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{showPodcastLayout ? 'Podcast transcript' : 'Transcript'}</strong>
                  <Badge>{transcript.split(/\s+/).filter(Boolean).length} words</Badge>
                </Row>
                {showPodcastLayout && speakerSegments ? (
                  <PodcastTranscript segments={speakerSegments} />
                ) : (
                  <TranscriptBox>{transcript}</TranscriptBox>
                )}
                <Row $gap={2}>
                  <Button $variant="secondary" onClick={handleCopy}>
                    <IconCheck size={16} /> {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button $variant="secondary" onClick={() => downloadFile(transcript, 'transcript.txt')}>
                    <IconExternal size={16} /> TXT
                  </Button>
                </Row>
              </Stack>
            </CardBody>
          </Card>
        )}

        {hasResult && mode === 'subtitles' && segments && (
          <Card>
            <CardBody>
              <Stack $gap={4}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{showPodcastLayout ? 'Podcast subtitles' : 'Subtitles'}</strong>
                  <Badge>{segments.length} segments</Badge>
                </Row>
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
                <Row $gap={2}>
                  <Button $variant="secondary" onClick={handleCopy}>
                    <IconCheck size={16} /> {copied ? 'Copied!' : 'Copy SRT'}
                  </Button>
                  {srt && (
                    <Button $variant="secondary" onClick={() => downloadFile(srt, 'subtitles.srt')}>
                      <IconExternal size={16} /> SRT
                    </Button>
                  )}
                  <Button $variant="secondary" onClick={() => downloadFile(transcript, 'transcript.txt')}>
                    <IconExternal size={16} /> TXT
                  </Button>
                </Row>
              </Stack>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <Stack $gap={4}>
              <strong>History</strong>
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
                      <Stack $gap={1} style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.sourceName || (item.source === 'url' ? 'URL' : 'File')}
                        </strong>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                          {formatDateTimeRo(item.createdAt)} · {item.mode}
                          {item.contentType === 'podcast' ? ' · podcast' : ''}
                        </span>
                      </Stack>
                      <Button
                        $variant="ghost"
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
