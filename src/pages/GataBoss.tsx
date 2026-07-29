import { useCallback, useEffect, useRef, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import {
  Button,
  IconButton,
  Input,
  Label,
  Field,
  ModalOverlay,
  Spinner,
  Textarea,
} from '../components/ui/primitives';
import {
  IconBook,
  IconPlus,
  IconSend,
  IconStop,
  IconRefresh,
  IconTrash,
  IconX,
  IconPaperclip,
  IconUpload,
  IconFileText,
} from '../components/ui/icons';
import {
  listDocuments,
  getDocument,
  createDocument,
  uploadDocuments,
  extractFiles,
  deleteDocument,
  streamChat,
  GATA_CHAT_MODELS,
  GATA_DEFAULT_MODEL,
  GATA_UPLOAD_ACCEPT,
  type GbDocumentListItem,
  type GbDocumentDetail,
  type GbChatHistoryItem,
  type GbChatAttachment,
} from '../services/gataBoss';
import { useRegisterOverlay } from '../hooks/useOverlayStack';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fileNames?: string[];
  status?: 'streaming' | 'done' | 'error';
}

interface PendingFile {
  id: string;
  name: string;
  content: string;
  charCount: number;
  extracting?: boolean;
}

const SUGGESTIONS = [
  'Draft a short social post in GATA’s voice',
  'Talking points for a local press interview',
  'Slogan + poster concept from the knowledge base',
  'Summarize GATA’s identity from stored context',
];

const Page = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px);
  min-height: 520px;
  width: min(820px, 100%);
  margin: 0 auto;
  position: relative;
`;

const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 8px 10px;
  flex-shrink: 0;
`;

const Brand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const BrandTitle = styled.h1`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-1);
`;

const BrandSub = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--text-3);
`;

const TopActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const ModelSelect = styled.select`
  appearance: none;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 8px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 500;
  padding: 7px 28px 7px 10px;
  cursor: pointer;
  max-width: 168px;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--text-3) 50%),
    linear-gradient(135deg, var(--text-3) 50%, transparent 50%);
  background-position: calc(100% - 12px) calc(50% - 2px), calc(100% - 7px) calc(50% - 2px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  &:hover { color: var(--text-1); border-color: var(--border-2); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Messages = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 8px 24px;
  display: flex;
  flex-direction: column;
  gap: 22px;
`;

const Empty = styled.div`
  margin: auto;
  width: min(520px, 100%);
  text-align: center;
  padding: 32px 12px 48px;
`;

const EmptyTitle = styled.h2`
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.035em;
  color: var(--text-1);
`;

const EmptySub = styled.p`
  margin: 0 auto 28px;
  max-width: 380px;
  color: var(--text-3);
  font-size: 14px;
  line-height: 1.55;
`;

const Suggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
`;

const Suggestion = styled.button`
  text-align: left;
  background: transparent;
  border: 1px solid var(--border-1);
  border-radius: 999px;
  padding: 8px 14px;
  color: var(--text-2);
  font-size: 12.5px;
  line-height: 1.35;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  &:hover {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border-1));
    color: var(--text-1);
    background: var(--accent-soft);
  }
`;

const Turn = styled.div<{ $role: 'user' | 'assistant' }>`
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$role === 'user' ? 'flex-end' : 'flex-start')};
  gap: 6px;
`;

const Bubble = styled.div<{ $role: 'user' | 'assistant' }>`
  max-width: ${(p) => (p.$role === 'user' ? '78%' : '100%')};
  padding: ${(p) => (p.$role === 'user' ? '10px 14px' : '0')};
  border-radius: ${(p) => (p.$role === 'user' ? '16px 16px 4px 16px' : '0')};
  background: ${(p) => (p.$role === 'user' ? 'var(--bg-3)' : 'transparent')};
  border: ${(p) => (p.$role === 'user' ? '1px solid var(--border-1)' : 'none')};
  color: var(--text-1);
  font-size: 14.5px;
  line-height: 1.65;
  word-break: break-word;

  & p { margin: 0 0 0.7em; }
  & p:last-child { margin-bottom: 0; }
  & ul, & ol { margin: 0.35em 0 0.7em; padding-left: 1.25em; }
  & code {
    font-family: var(--font-mono);
    font-size: 0.88em;
    background: var(--bg-3);
    padding: 1px 5px;
    border-radius: 4px;
  }
  & pre {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    padding: 12px;
    overflow-x: auto;
    margin: 0.55em 0;
  }
  & pre code { background: none; padding: 0; }
`;

const FileChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const FileChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 8px;
  padding: 4px 8px;
  max-width: 220px;
  svg { color: var(--accent); flex-shrink: 0; }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.15; }
`;

const Cursor = styled.span`
  display: inline-block;
  width: 6px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--accent);
  animation: ${blink} 1s step-end infinite;
`;

const ComposerDock = styled.div`
  flex-shrink: 0;
  padding: 0 8px 18px;
`;

const ComposerShell = styled.form`
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: 18px;
  padding: 10px 10px 10px 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  gap: 8px;
  &:focus-within {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border-2));
  }
`;

const PendingRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const PendingChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: 999px;
  padding: 4px 6px 4px 10px;
  max-width: 260px;
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const ComposerRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 6px;
`;

const ComposerInput = styled.textarea`
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-1);
  font: inherit;
  font-size: 14.5px;
  line-height: 1.45;
  max-height: 160px;
  min-height: 24px;
  padding: 8px 4px;
  &::placeholder { color: var(--text-3); }
`;

const Hint = styled.div`
  margin-top: 8px;
  text-align: center;
  font-size: 11px;
  color: var(--text-3);
`;

const HiddenFile = styled.input`
  display: none;
`;

const KbModal = styled.div`
  background: var(--bg-1);
  border: 1px solid var(--border-2);
  border-radius: 16px;
  width: min(720px, 100%);
  max-height: min(86vh, 860px);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
`;

const KbHeader = styled.div`
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const KbTitle = styled.div`
  font-weight: 600;
  color: var(--text-1);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  svg { color: var(--accent); }
`;

const KbBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const DropZone = styled.label<{ $active?: boolean; $busy?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 16px;
  border-radius: 12px;
  border: 1px dashed ${(p) => (p.$active ? 'var(--accent)' : 'var(--border-2)')};
  background: ${(p) => (p.$active ? 'var(--accent-soft)' : 'var(--bg-2)')};
  color: var(--text-3);
  text-align: center;
  cursor: ${(p) => (p.$busy ? 'wait' : 'pointer')};
  transition: border-color 0.15s, background 0.15s;
  ${(p) =>
    !p.$busy &&
    css`
      &:hover {
        border-color: color-mix(in srgb, var(--accent) 50%, var(--border-2));
        color: var(--text-2);
      }
    `}
  strong { color: var(--text-1); font-weight: 560; }
  small { font-size: 11.5px; }
`;

const DocCard = styled.button`
  text-align: left;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  color: inherit;
  transition: border-color 0.15s;
  &:hover { border-color: color-mix(in srgb, var(--accent) 35%, var(--border-1)); }
`;

const DocTitle = styled.div`
  font-weight: 600;
  color: var(--text-1);
  font-size: 13.5px;
  margin-bottom: 4px;
`;

const DocSummary = styled.div`
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const DocMeta = styled.div`
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-3);
  font-family: var(--font-mono);
`;

const DetailPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const DetailBack = styled.button`
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
`;

const DetailContent = styled.pre`
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 10px;
  padding: 12px;
  margin: 0;
  max-height: 38vh;
  overflow-y: auto;
`;

const AddForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-1);
`;

const Tabs = styled.div`
  display: flex;
  gap: 4px;
  background: var(--bg-2);
  border-radius: 10px;
  padding: 3px;
  width: fit-content;
`;

const Tab = styled.button<{ $active?: boolean }>`
  border: none;
  background: ${(p) => (p.$active ? 'var(--bg-4)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-3)')};
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
`;

export default function GataBoss() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const toast = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [model, setModel] = useState(() => {
    try {
      return localStorage.getItem('gata_boss_model') || GATA_DEFAULT_MODEL;
    } catch {
      return GATA_DEFAULT_MODEL;
    }
  });
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const kbFileRef = useRef<HTMLInputElement>(null);

  const [kbOpen, setKbOpen] = useState(false);
  useRegisterOverlay(kbOpen);
  const [docs, setDocs] = useState<GbDocumentListItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selected, setSelected] = useState<GbDocumentDetail | null>(null);
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState<'upload' | 'paste'>('upload');
  const [addTitle, setAddTitle] = useState('');
  const [addContent, setAddContent] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const modelLabel =
    GATA_CHAT_MODELS.find((m) => m.id === model)?.label ??
    model.replace(/^openai:|^google:/, '');

  const pickModel = (next: string) => {
    setModel(next);
    try {
      localStorage.setItem('gata_boss_model', next);
    } catch {
      /* ignore */
    }
  };

  const refreshDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      setDocs(await listDocuments());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load knowledge base');
    } finally {
      setDocsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refreshDocs();
  }, [refreshDocs]);

  useEffect(() => {
    if (kbOpen) void refreshDocs();
  }, [kbOpen, refreshDocs]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, pendingFiles]);

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const attachChatFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, 5);
    if (files.length === 0) return;
    setExtracting(true);
    try {
      const result = await extractFiles(files);
      for (const err of result.errors) {
        toast.error(`${err.name}: ${err.error}`);
      }
      setPendingFiles((prev) => [
        ...prev,
        ...result.files.map((f) => ({
          id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          content: f.content,
          charCount: f.charCount,
        })),
      ].slice(0, 5));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to read files');
    } finally {
      setExtracting(false);
      if (chatFileRef.current) chatFileRef.current.value = '';
    }
  };

  const send = async (text: string) => {
    const message = text.trim();
    const attachments: GbChatAttachment[] = pendingFiles.map((f) => ({
      name: f.name,
      content: f.content,
    }));
    if ((!message && attachments.length === 0) || streaming || extracting) return;

    const history: GbChatHistoryItem[] = messages
      .filter((m) => m.status !== 'error' && m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: message || (attachments.length ? `Attached ${attachments.length} file(s)` : ''),
      fileNames: attachments.map((a) => a.name),
      status: 'done',
    };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'streaming',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setDraft('');
    setPendingFiles([]);
    setStreaming(true);
    requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.style.height = 'auto';
    });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamChat(
        { message, history, model, attachments },
        {
          onToken: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + delta } : m,
              ),
            );
          },
          onCompleted: (info) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: info.text || m.content, status: 'done' }
                  : m,
              ),
            );
          },
          onFailed: (error) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content || error, status: 'error' }
                  : m,
              ),
            );
            toast.error(error);
          },
        },
        ac.signal,
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, status: m.content ? 'done' : 'error', content: m.content || '(stopped)' }
              : m,
          ),
        );
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: msg, status: 'error' } : m,
          ),
        );
        toast.error(msg);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const openDoc = async (id: string) => {
    try {
      setSelected(await getDocument(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load document');
    }
  };

  const handlePasteAdd = async () => {
    if (!addContent.trim() || addBusy) return;
    setAddBusy(true);
    try {
      await createDocument({
        title: addTitle.trim() || undefined,
        content: addContent.trim(),
      });
      setAddTitle('');
      setAddContent('');
      setAdding(false);
      toast.success('Added to knowledge base');
      await refreshDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add document');
    } finally {
      setAddBusy(false);
    }
  };

  const handleKbUpload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0 || addBusy) return;
    setAddBusy(true);
    try {
      const result = await uploadDocuments(files, addTitle.trim() || undefined);
      for (const err of result.errors) toast.error(`${err.name}: ${err.error}`);
      if (result.documents.length) {
        toast.success(
          result.documents.length === 1
            ? `Added “${result.documents[0]!.title}”`
            : `Added ${result.documents.length} documents`,
        );
        setAdding(false);
        setAddTitle('');
        await refreshDocs();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setAddBusy(false);
      if (kbFileRef.current) kbFileRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this document from the knowledge base?')) return;
    try {
      await deleteDocument(id);
      if (selected?.id === id) setSelected(null);
      toast.success('Document removed');
      await refreshDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <Page>
      <TopBar>
        <Brand>
          <BrandTitle>GATA Bo$$</BrandTitle>
          <BrandSub>Communications assistant · {modelLabel}</BrandSub>
        </Brand>
        <TopActions>
          <ModelSelect
            aria-label="Model"
            value={model}
            disabled={streaming}
            onChange={(e) => pickModel(e.target.value)}
          >
            <optgroup label="ChatGPT / OpenAI">
              {GATA_CHAT_MODELS.filter((m) => m.provider === 'openai').map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </optgroup>
            <optgroup label="Gemini / Google">
              {GATA_CHAT_MODELS.filter((m) => m.provider === 'google').map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </optgroup>
          </ModelSelect>
          <Button type="button" $variant="ghost" $size="sm" onClick={() => setKbOpen(true)}>
            <IconBook size={14} />
            Knowledge{docs.length ? ` · ${docs.length}` : ''}
          </Button>
          {messages.length > 0 && (
            <IconButton
              type="button"
              aria-label="New chat"
              title="New chat"
              onClick={() => {
                stop();
                setMessages([]);
                setPendingFiles([]);
              }}
            >
              <IconRefresh size={16} />
            </IconButton>
          )}
        </TopActions>
      </TopBar>

      <Messages ref={scrollerRef}>
        {messages.length === 0 ? (
          <Empty>
            <EmptyTitle>What should we draft?</EmptyTitle>
            <EmptySub>
              Write from GATA’s shared knowledge base — posts, talking points, slogans, or visual concepts.
            </EmptySub>
            <Suggestions>
              {SUGGESTIONS.map((s) => (
                <Suggestion key={s} type="button" onClick={() => void send(s)}>
                  {s}
                </Suggestion>
              ))}
            </Suggestions>
          </Empty>
        ) : (
          messages.map((m) => (
            <Turn key={m.id} $role={m.role}>
              {m.fileNames && m.fileNames.length > 0 && (
                <FileChips>
                  {m.fileNames.map((name) => (
                    <FileChip key={name}>
                      <IconFileText size={12} />
                      <span>{name}</span>
                    </FileChip>
                  ))}
                </FileChips>
              )}
              <Bubble $role={m.role}>
                {m.role === 'assistant' ? (
                  <>
                    {m.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    ) : m.status === 'streaming' ? (
                      <span style={{ color: 'var(--text-3)' }}>Thinking…</span>
                    ) : null}
                    {m.status === 'streaming' && <Cursor />}
                  </>
                ) : (
                  m.content
                )}
              </Bubble>
            </Turn>
          ))
        )}
      </Messages>

      <ComposerDock>
        <ComposerShell
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          {pendingFiles.length > 0 && (
            <PendingRow>
              {pendingFiles.map((f) => (
                <PendingChip key={f.id}>
                  <IconFileText size={13} />
                  <span>{f.name}</span>
                  <IconButton
                    type="button"
                    $size="sm"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setPendingFiles((prev) => prev.filter((x) => x.id !== f.id))}
                  >
                    <IconX size={12} />
                  </IconButton>
                </PendingChip>
              ))}
            </PendingRow>
          )}
          <ComposerRow>
            <IconButton
              type="button"
              aria-label="Attach document"
              title="Attach PDF, DOCX, or text"
              disabled={streaming || extracting || pendingFiles.length >= 5}
              onClick={() => chatFileRef.current?.click()}
            >
              {extracting ? <Spinner $size={14} /> : <IconPaperclip size={16} />}
            </IconButton>
            <ComposerInput
              ref={inputRef}
              rows={1}
              placeholder="Message GATA Bo$$…"
              value={draft}
              disabled={streaming}
              onChange={(e) => {
                setDraft(e.target.value);
                resizeInput();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files || []);
                if (files.length) {
                  e.preventDefault();
                  void attachChatFiles(files);
                }
              }}
            />
            {streaming ? (
              <IconButton type="button" aria-label="Stop" onClick={stop}>
                <IconStop size={16} />
              </IconButton>
            ) : (
              <IconButton
                type="submit"
                aria-label="Send"
                disabled={(!draft.trim() && pendingFiles.length === 0) || extracting}
              >
                <IconSend size={16} />
              </IconButton>
            )}
          </ComposerRow>
        </ComposerShell>
        <Hint>PDF · DOCX · TXT · MD — up to 5 files per message</Hint>
        <HiddenFile
          ref={chatFileRef}
          type="file"
          accept={GATA_UPLOAD_ACCEPT}
          multiple
          onChange={(e) => {
            if (e.target.files) void attachChatFiles(e.target.files);
          }}
        />
      </ComposerDock>

      {kbOpen && (
        <ModalOverlay onClick={(e) => e.target === e.currentTarget && setKbOpen(false)}>
          <KbModal>
            <KbHeader>
              <KbTitle>
                <IconBook size={16} /> Knowledge base
              </KbTitle>
              <div style={{ display: 'flex', gap: 8 }}>
                {isAdmin && !adding && !selected && (
                  <Button type="button" $size="sm" onClick={() => { setAdding(true); setAddMode('upload'); }}>
                    <IconPlus size={14} /> Add
                  </Button>
                )}
                <IconButton type="button" aria-label="Close" onClick={() => setKbOpen(false)}>
                  <IconX size={16} />
                </IconButton>
              </div>
            </KbHeader>
            <KbBody>
              {selected ? (
                <DetailPanel>
                  <DetailBack type="button" onClick={() => setSelected(null)}>
                    ← Back
                  </DetailBack>
                  <DocTitle>{selected.title}</DocTitle>
                  <DocMeta>
                    {selected.createdByName || selected.createdByEmail || 'unknown'} ·{' '}
                    {formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true })}
                  </DocMeta>
                  <Label>Summary</Label>
                  <DocSummary style={{ display: 'block', WebkitLineClamp: 'unset' as unknown as number }}>
                    {selected.summary}
                  </DocSummary>
                  <Label>Full content</Label>
                  <DetailContent>{selected.content}</DetailContent>
                  {isAdmin && (
                    <Button type="button" $variant="danger" $size="sm" onClick={() => void handleDelete(selected.id)}>
                      <IconTrash size={14} /> Remove
                    </Button>
                  )}
                </DetailPanel>
              ) : (
                <>
                  {isAdmin && adding && (
                    <AddForm>
                      <Tabs>
                        <Tab type="button" $active={addMode === 'upload'} onClick={() => setAddMode('upload')}>
                          Upload files
                        </Tab>
                        <Tab type="button" $active={addMode === 'paste'} onClick={() => setAddMode('paste')}>
                          Paste text
                        </Tab>
                      </Tabs>
                      <Field>
                        <Label>Title (optional)</Label>
                        <Input
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
                          placeholder="Defaults from filename / content"
                          disabled={addBusy}
                        />
                      </Field>
                      {addMode === 'upload' ? (
                        <>
                          <DropZone
                            $active={dragOver}
                            $busy={addBusy}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOver(false);
                              if (e.dataTransfer.files.length) void handleKbUpload(e.dataTransfer.files);
                            }}
                          >
                            <IconUpload size={22} />
                            <strong>{addBusy ? 'Extracting & summarizing…' : 'Drop PDF / DOCX here'}</strong>
                            <small>or click to browse · also TXT, MD, CSV, JSON</small>
                            <HiddenFile
                              ref={kbFileRef}
                              type="file"
                              accept={GATA_UPLOAD_ACCEPT}
                              multiple
                              disabled={addBusy}
                              onChange={(e) => {
                                if (e.target.files) void handleKbUpload(e.target.files);
                              }}
                            />
                          </DropZone>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button type="button" $variant="ghost" disabled={addBusy} onClick={() => setAdding(false)}>
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <Field>
                            <Label>Content</Label>
                            <Textarea
                              rows={7}
                              value={addContent}
                              onChange={(e) => setAddContent(e.target.value)}
                              placeholder="Paste identity notes, positions, bios, style guides…"
                              disabled={addBusy}
                            />
                          </Field>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <Button type="button" $variant="ghost" disabled={addBusy} onClick={() => setAdding(false)}>
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              disabled={addBusy || !addContent.trim()}
                              onClick={() => void handlePasteAdd()}
                            >
                              {addBusy ? <Spinner $size={14} /> : null}
                              {addBusy ? 'Summarizing…' : 'Add & summarize'}
                            </Button>
                          </div>
                        </>
                      )}
                    </AddForm>
                  )}

                  {docsLoading ? (
                    <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
                      <Spinner />
                    </div>
                  ) : docs.length === 0 ? (
                    <EmptySub style={{ margin: 0, padding: '20px 0' }}>
                      No documents yet.
                      {isAdmin ? ' Upload party materials to ground every reply.' : ' Ask an admin to add context.'}
                    </EmptySub>
                  ) : (
                    docs.map((d) => (
                      <DocCard key={d.id} type="button" onClick={() => void openDoc(d.id)}>
                        <DocTitle>{d.title}</DocTitle>
                        <DocSummary>{d.summary}</DocSummary>
                        <DocMeta>
                          {d.createdByName || d.createdByEmail || 'unknown'} ·{' '}
                          {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })} ·{' '}
                          {d.contentLength.toLocaleString()} chars
                        </DocMeta>
                      </DocCard>
                    ))
                  )}
                </>
              )}
            </KbBody>
          </KbModal>
        </ModalOverlay>
      )}
    </Page>
  );
}
