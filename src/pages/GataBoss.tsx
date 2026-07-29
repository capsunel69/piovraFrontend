import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  IconTrash,
  IconX,
  IconPaperclip,
  IconUpload,
  IconFileText,
  IconChat,
} from '../components/ui/icons';
import {
  listDocuments,
  getDocument,
  createDocument,
  uploadDocuments,
  extractFiles,
  deleteDocument,
  listThreads,
  createThread,
  getThread,
  deleteThread,
  streamChat,
  GATA_CHAT_MODELS,
  GATA_DEFAULT_MODEL,
  GATA_UPLOAD_ACCEPT,
  type GbDocumentListItem,
  type GbDocumentDetail,
  type GbChatAttachment,
  type GbThreadListItem,
} from '../services/gataBoss';
import { useRegisterOverlay } from '../hooks/useOverlayStack';

type ThreadStatus = 'idle' | 'streaming' | 'error';

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
}

interface ThreadState {
  id: string;
  title: string;
  model: string | null;
  updatedAt: string;
  status: ThreadStatus;
  messages: ChatMessage[];
  loaded: boolean;
}

const SUGGESTIONS = [
  'Draft a short social post in GATA’s voice',
  'Talking points for a local press interview',
  'Slogan + poster concept from the knowledge base',
  'Summarize GATA’s identity from stored context',
];

const Page = styled.div`
  display: flex;
  justify-content: center;
  padding: 8px 0 16px;
  min-height: 0;
`;

const Shell = styled.div`
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  width: min(980px, 100%);
  height: min(720px, calc(100dvh - 110px));
  min-height: 480px;
  background: var(--bg-1);
  border: 1px solid var(--border-2);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    height: calc(100dvh - 96px);
    border-radius: 12px;
  }
`;

const Sidebar = styled.aside`
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--bg-2) 88%, #000);
  border-right: 1px solid var(--border-1);
  min-width: 0;

  @media (max-width: 760px) {
    display: none;
  }
`;

const SideHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--border-1);
`;

const SideTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-3);
`;

const ThreadList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ThreadItem = styled.button<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  text-align: left;
  border: 1px solid ${(p) => (p.$active ? 'color-mix(in srgb, var(--accent) 40%, var(--border-1))' : 'transparent')};
  background: ${(p) => (p.$active ? 'var(--accent-soft)' : 'transparent')};
  border-radius: 10px;
  padding: 9px 10px;
  cursor: pointer;
  color: inherit;
  transition: background 0.12s, border-color 0.12s;
  &:hover {
    background: ${(p) => (p.$active ? 'var(--accent-soft)' : 'var(--bg-3)')};
  }
`;

const ThreadName = styled.div`
  font-size: 12.5px;
  font-weight: 550;
  color: var(--text-1);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  width: 100%;
`;

const ThreadMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: var(--text-3);
  width: 100%;
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
`;

const StatusDot = styled.span<{ $tone: 'streaming' | 'error' | 'idle' }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) =>
    p.$tone === 'streaming' ? 'var(--accent)' : p.$tone === 'error' ? 'var(--danger)' : 'var(--text-3)'};
  ${(p) =>
    p.$tone === 'streaming' &&
    css`
      animation: ${pulse} 1.1s ease-in-out infinite;
    `}
`;

const Main = styled.section`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--bg-1);
`;

const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-1);
  flex-shrink: 0;
`;

const Brand = styled.div`
  min-width: 0;
`;

const BrandTitle = styled.h1`
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--text-1);
`;

const BrandSub = styled.p`
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TopActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
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
  padding: 6px 26px 6px 9px;
  cursor: pointer;
  max-width: 148px;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--text-3) 50%),
    linear-gradient(135deg, var(--text-3) 50%, transparent 50%);
  background-position: calc(100% - 11px) calc(50% - 2px), calc(100% - 6px) calc(50% - 2px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Messages = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Empty = styled.div`
  margin: auto;
  width: min(420px, 100%);
  text-align: center;
  padding: 12px 4px 20px;
`;

const EmptyTitle = styled.h2`
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--text-1);
`;

const EmptySub = styled.p`
  margin: 0 auto 16px;
  color: var(--text-3);
  font-size: 13px;
  line-height: 1.5;
`;

const Suggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
`;

const Suggestion = styled.button`
  text-align: left;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 999px;
  padding: 7px 11px;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.3;
  cursor: pointer;
  &:hover {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border-1));
    color: var(--text-1);
  }
`;

const Turn = styled.div<{ $role: 'user' | 'assistant' }>`
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$role === 'user' ? 'flex-end' : 'flex-start')};
  gap: 5px;
`;

const Bubble = styled.div<{ $role: 'user' | 'assistant' }>`
  max-width: ${(p) => (p.$role === 'user' ? '82%' : '100%')};
  padding: ${(p) => (p.$role === 'user' ? '9px 12px' : '0')};
  border-radius: ${(p) => (p.$role === 'user' ? '14px 14px 4px 14px' : '0')};
  background: ${(p) => (p.$role === 'user' ? 'var(--bg-3)' : 'transparent')};
  border: ${(p) => (p.$role === 'user' ? '1px solid var(--border-1)' : 'none')};
  color: var(--text-1);
  font-size: 13.5px;
  line-height: 1.6;
  word-break: break-word;
  & p { margin: 0 0 0.65em; }
  & p:last-child { margin-bottom: 0; }
  & ul, & ol { margin: 0.3em 0 0.65em; padding-left: 1.2em; }
  & code {
    font-family: var(--font-mono);
    font-size: 0.88em;
    background: var(--bg-3);
    padding: 1px 4px;
    border-radius: 4px;
  }
  & pre {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 8px;
    padding: 10px;
    overflow-x: auto;
    margin: 0.45em 0;
  }
  & pre code { background: none; padding: 0; }
`;

const FileChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const FileChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 7px;
  padding: 3px 7px;
  max-width: 200px;
  svg { color: var(--accent); flex-shrink: 0; }
  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.15; }
`;

const Cursor = styled.span`
  display: inline-block;
  width: 5px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--accent);
  animation: ${blink} 1s step-end infinite;
`;

const ComposerDock = styled.div`
  flex-shrink: 0;
  padding: 8px 12px 12px;
  border-top: 1px solid var(--border-1);
  background: color-mix(in srgb, var(--bg-1) 92%, var(--bg-2));
`;

const ComposerShell = styled.form`
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: 14px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  &:focus-within {
    border-color: color-mix(in srgb, var(--accent) 35%, var(--border-2));
  }
`;

const PendingRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const PendingChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--text-2);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: 999px;
  padding: 3px 4px 3px 8px;
  max-width: 220px;
  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

const ComposerRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 4px;
`;

const ComposerInput = styled.textarea`
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-1);
  font: inherit;
  font-size: 13.5px;
  line-height: 1.4;
  max-height: 120px;
  min-height: 22px;
  padding: 6px 4px;
  &::placeholder { color: var(--text-3); }
`;

const Hint = styled.div`
  margin-top: 6px;
  text-align: center;
  font-size: 10.5px;
  color: var(--text-3);
`;

const HiddenFile = styled.input`
  display: none;
`;

const MobileThreads = styled.div`
  display: none;
  @media (max-width: 760px) {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 0 0 2px;
    max-width: 42vw;
  }
`;

const MobileChip = styled.button<{ $active?: boolean; $busy?: boolean }>`
  flex-shrink: 0;
  border: 1px solid ${(p) => (p.$active ? 'color-mix(in srgb, var(--accent) 40%, var(--border-1))' : 'var(--border-1)')};
  background: ${(p) => (p.$active ? 'var(--accent-soft)' : 'var(--bg-2)')};
  color: var(--text-2);
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 11px;
  cursor: pointer;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  ${(p) =>
    p.$busy &&
    css`
      &::before {
        content: '';
        display: inline-block;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--accent);
        margin-right: 5px;
        animation: ${pulse} 1.1s ease-in-out infinite;
      }
    `}
`;

const KbModal = styled.div`
  background: var(--bg-1);
  border: 1px solid var(--border-2);
  border-radius: 14px;
  width: min(680px, 100%);
  max-height: min(82vh, 780px);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
`;

const KbHeader = styled.div`
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const KbTitle = styled.div`
  font-weight: 600;
  color: var(--text-1);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  svg { color: var(--accent); }
`;

const KbBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const DropZone = styled.label<{ $active?: boolean; $busy?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 22px 14px;
  border-radius: 10px;
  border: 1px dashed ${(p) => (p.$active ? 'var(--accent)' : 'var(--border-2)')};
  background: ${(p) => (p.$active ? 'var(--accent-soft)' : 'var(--bg-2)')};
  color: var(--text-3);
  text-align: center;
  cursor: ${(p) => (p.$busy ? 'wait' : 'pointer')};
  strong { color: var(--text-1); font-weight: 560; }
  small { font-size: 11px; }
`;

const DocCard = styled.button`
  text-align: left;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  color: inherit;
  &:hover { border-color: color-mix(in srgb, var(--accent) 35%, var(--border-1)); }
`;

const DocTitle = styled.div`
  font-weight: 600;
  color: var(--text-1);
  font-size: 13px;
  margin-bottom: 3px;
`;

const DocSummary = styled.div`
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const DocMeta = styled.div`
  margin-top: 6px;
  font-size: 10.5px;
  color: var(--text-3);
  font-family: var(--font-mono);
`;

const DetailPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DetailBack = styled.button`
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 12.5px;
  padding: 0;
`;

const DetailContent = styled.pre`
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 8px;
  padding: 10px;
  margin: 0;
  max-height: 34vh;
  overflow-y: auto;
`;

const AddForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--border-1);
`;

const Tabs = styled.div`
  display: flex;
  gap: 3px;
  background: var(--bg-2);
  border-radius: 8px;
  padding: 3px;
  width: fit-content;
`;

const Tab = styled.button<{ $active?: boolean }>`
  border: none;
  background: ${(p) => (p.$active ? 'var(--bg-4)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-3)')};
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
`;

function sortThreads(a: ThreadState, b: ThreadState) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export default function GataBoss() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const toast = useToast();

  const [threads, setThreads] = useState<Record<string, ThreadState>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [model, setModel] = useState(() => {
    try {
      return localStorage.getItem('gata_boss_model') || GATA_DEFAULT_MODEL;
    } catch {
      return GATA_DEFAULT_MODEL;
    }
  });

  const abortMap = useRef<Map<string, AbortController>>(new Map());
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

  const threadList = useMemo(
    () => Object.values(threads).sort(sortThreads),
    [threads],
  );
  const active = activeId ? threads[activeId] : null;
  const activeStreaming = active?.status === 'streaming';

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

  const upsertThreadMeta = useCallback((item: GbThreadListItem, patch?: Partial<ThreadState>) => {
    setThreads((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          id: item.id,
          title: patch?.title ?? existing?.title ?? item.title,
          model: patch?.model ?? existing?.model ?? item.model,
          updatedAt: patch?.updatedAt ?? item.updatedAt,
          status: patch?.status ?? existing?.status ?? 'idle',
          messages: patch?.messages ?? existing?.messages ?? [],
          loaded: patch?.loaded ?? existing?.loaded ?? false,
        },
      };
    });
  }, []);

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

  const loadThreads = useCallback(async () => {
    try {
      const rows = await listThreads();
      setThreads((prev) => {
        const next: Record<string, ThreadState> = {};
        for (const row of rows) {
          const existing = prev[row.id];
          next[row.id] = {
            id: row.id,
            title: existing?.status === 'streaming' ? existing.title : row.title,
            model: row.model,
            updatedAt: row.updatedAt,
            status: existing?.status ?? 'idle',
            messages: existing?.messages ?? [],
            loaded: existing?.loaded ?? false,
          };
        }
        // Keep local streaming threads that may not be in list yet
        for (const [id, t] of Object.entries(prev)) {
          if (!next[id] && t.status === 'streaming') next[id] = t;
        }
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load chats');
    }
  }, [toast]);

  useEffect(() => {
    void loadThreads();
    void refreshDocs();
  }, [loadThreads, refreshDocs]);

  useEffect(() => {
    if (kbOpen) void refreshDocs();
  }, [kbOpen, refreshDocs]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [active?.messages, activeId]);

  const ensureThreadLoaded = useCallback(
    async (id: string) => {
      const current = threads[id];
      if (current?.loaded || current?.status === 'streaming') return;
      try {
        const detail = await getThread(id);
        setThreads((prev) => {
          const existing = prev[id];
          if (existing?.status === 'streaming') return prev;
          return {
            ...prev,
            [id]: {
              id: detail.id,
              title: detail.title,
              model: detail.model,
              updatedAt: detail.updatedAt,
              status: 'idle',
              loaded: true,
              messages: detail.messages.map((m) => ({
                id: m.id,
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
                fileNames: m.fileNames,
                status: 'done' as const,
              })),
            },
          };
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to open chat');
      }
    },
    [threads, toast],
  );

  const selectThread = async (id: string) => {
    setActiveId(id);
    setDraft('');
    setPendingFiles([]);
    await ensureThreadLoaded(id);
  };

  const startNewChat = async () => {
    try {
      const row = await createThread({ model });
      upsertThreadMeta(row, { loaded: true, messages: [], status: 'idle' });
      setActiveId(row.id);
      setDraft('');
      setPendingFiles([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create chat');
    }
  };

  const removeThread = async (id: string) => {
    abortMap.current.get(id)?.abort();
    abortMap.current.delete(id);
    try {
      await deleteThread(id);
      setThreads((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activeId === id) setActiveId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete chat');
    }
  };

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const stopActive = () => {
    if (!activeId) return;
    abortMap.current.get(activeId)?.abort();
  };

  const attachChatFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, 5);
    if (files.length === 0) return;
    setExtracting(true);
    try {
      const result = await extractFiles(files);
      for (const err of result.errors) toast.error(`${err.name}: ${err.error}`);
      setPendingFiles((prev) =>
        [
          ...prev,
          ...result.files.map((f) => ({
            id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: f.name,
            content: f.content,
            charCount: f.charCount,
          })),
        ].slice(0, 5),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to read files');
    } finally {
      setExtracting(false);
      if (chatFileRef.current) chatFileRef.current.value = '';
    }
  };

  const send = async (text: string, threadIdOverride?: string) => {
    const message = text.trim();
    const attachments: GbChatAttachment[] = pendingFiles.map((f) => ({
      name: f.name,
      content: f.content,
    }));
    if ((!message && attachments.length === 0) || extracting) return;

    let threadId = threadIdOverride ?? activeId;
    if (!threadId) {
      const row = await createThread({ model });
      upsertThreadMeta(row, { loaded: true, messages: [], status: 'idle' });
      threadId = row.id;
      setActiveId(row.id);
    }

    // Don't allow double-send on same thread while streaming
    if (abortMap.current.has(threadId)) return;

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

    const provisionalTitle =
      message.replace(/\s+/g, ' ').slice(0, 72) ||
      (attachments[0] ? `File: ${attachments[0].name}` : 'New chat');

    setThreads((prev) => {
      const t = prev[threadId!] ?? {
        id: threadId!,
        title: provisionalTitle,
        model,
        updatedAt: new Date().toISOString(),
        status: 'idle' as ThreadStatus,
        messages: [],
        loaded: true,
      };
      return {
        ...prev,
        [threadId!]: {
          ...t,
          title: t.title === 'New chat' ? provisionalTitle : t.title,
          updatedAt: new Date().toISOString(),
          status: 'streaming',
          loaded: true,
          messages: [...t.messages, userMsg, assistantMsg],
        },
      };
    });

    setDraft('');
    setPendingFiles([]);
    requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.style.height = 'auto';
    });

    const ac = new AbortController();
    abortMap.current.set(threadId, ac);

    const patchThread = (fn: (t: ThreadState) => ThreadState) => {
      setThreads((prev) => {
        const t = prev[threadId!];
        if (!t) return prev;
        return { ...prev, [threadId!]: fn(t) };
      });
    };

    try {
      await streamChat(
        { message, model, attachments, threadId },
        {
          onStarted: (info) => {
            if (info.threadId && info.threadId !== threadId) {
              // Server created/returned id — remapped if needed
            }
            patchThread((t) => ({
              ...t,
              title: info.title && t.title === 'New chat' ? info.title : t.title,
              model: info.model || t.model,
            }));
          },
          onToken: (delta) => {
            patchThread((t) => ({
              ...t,
              messages: t.messages.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + delta } : m,
              ),
            }));
          },
          onCompleted: (info) => {
            patchThread((t) => ({
              ...t,
              status: 'idle',
              title: info.title && (t.title === 'New chat' || !t.title) ? info.title : t.title,
              updatedAt: new Date().toISOString(),
              messages: t.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: info.text || m.content, status: 'done' }
                  : m,
              ),
            }));
            void loadThreads();
          },
          onFailed: (error) => {
            patchThread((t) => ({
              ...t,
              status: 'error',
              messages: t.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content || error, status: 'error' }
                  : m,
              ),
            }));
            toast.error(error);
          },
        },
        ac.signal,
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        patchThread((t) => ({
          ...t,
          status: 'idle',
          messages: t.messages.map((m) =>
            m.id === assistantId
              ? { ...m, status: m.content ? 'done' : 'error', content: m.content || '(stopped)' }
              : m,
          ),
        }));
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        patchThread((t) => ({
          ...t,
          status: 'error',
          messages: t.messages.map((m) =>
            m.id === assistantId ? { ...m, content: msg, status: 'error' } : m,
          ),
        }));
        toast.error(msg);
      }
    } finally {
      abortMap.current.delete(threadId);
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

  const handleDeleteDoc = async (id: string) => {
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
      <Shell>
        <Sidebar>
          <SideHead>
            <SideTitle>Chats</SideTitle>
            <IconButton type="button" $size="sm" aria-label="New chat" title="New chat" onClick={() => void startNewChat()}>
              <IconPlus size={14} />
            </IconButton>
          </SideHead>
          <ThreadList>
            {threadList.length === 0 ? (
              <EmptySub style={{ margin: '12px 4px', textAlign: 'left' }}>No chats yet.</EmptySub>
            ) : (
              threadList.map((t) => (
                <ThreadItem
                  key={t.id}
                  type="button"
                  $active={t.id === activeId}
                  onClick={() => void selectThread(t.id)}
                >
                  <ThreadName>{t.title || 'New chat'}</ThreadName>
                  <ThreadMeta>
                    <StatusDot
                      $tone={
                        t.status === 'streaming' ? 'streaming' : t.status === 'error' ? 'error' : 'idle'
                      }
                    />
                    {t.status === 'streaming'
                      ? 'Thinking…'
                      : t.status === 'error'
                        ? 'Error'
                        : formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                    <span style={{ marginLeft: 'auto' }}>
                      <IconButton
                        type="button"
                        $size="sm"
                        aria-label="Delete chat"
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeThread(t.id);
                        }}
                      >
                        <IconTrash size={12} />
                      </IconButton>
                    </span>
                  </ThreadMeta>
                </ThreadItem>
              ))
            )}
          </ThreadList>
        </Sidebar>

        <Main>
          <TopBar>
            <Brand>
              <BrandTitle>GATA Bo$$</BrandTitle>
              <BrandSub>
                {active?.title && active.title !== 'New chat'
                  ? active.title
                  : `Communications · ${modelLabel}`}
              </BrandSub>
            </Brand>
            <TopActions>
              <MobileThreads>
                <MobileChip type="button" onClick={() => void startNewChat()}>+ New</MobileChip>
                {threadList.slice(0, 6).map((t) => (
                  <MobileChip
                    key={t.id}
                    type="button"
                    $active={t.id === activeId}
                    $busy={t.status === 'streaming'}
                    onClick={() => void selectThread(t.id)}
                  >
                    {t.title || 'Chat'}
                  </MobileChip>
                ))}
              </MobileThreads>
              <ModelSelect
                aria-label="Model"
                value={model}
                disabled={activeStreaming}
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
                <IconBook size={13} />
                KB{docs.length ? ` · ${docs.length}` : ''}
              </Button>
              <IconButton type="button" $size="sm" aria-label="New chat" title="New chat" onClick={() => void startNewChat()}>
                <IconPlus size={14} />
              </IconButton>
            </TopActions>
          </TopBar>

          <Messages ref={scrollerRef}>
            {!active || active.messages.length === 0 ? (
              <Empty>
                <EmptyTitle>What should we draft?</EmptyTitle>
                <EmptySub>
                  Compact workspace for GATA drafts — grounded in the shared knowledge base.
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
              active.messages.map((m) => (
                <Turn key={m.id} $role={m.role}>
                  {m.fileNames && m.fileNames.length > 0 && (
                    <FileChips>
                      {m.fileNames.map((name) => (
                        <FileChip key={name}>
                          <IconFileText size={11} />
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
                      <IconFileText size={12} />
                      <span>{f.name}</span>
                      <IconButton
                        type="button"
                        $size="sm"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setPendingFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      >
                        <IconX size={11} />
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
                  disabled={activeStreaming || extracting || pendingFiles.length >= 5}
                  onClick={() => chatFileRef.current?.click()}
                >
                  {extracting ? <Spinner $size={13} /> : <IconPaperclip size={15} />}
                </IconButton>
                <ComposerInput
                  ref={inputRef}
                  rows={1}
                  placeholder="Message GATA Bo$$…"
                  value={draft}
                  disabled={activeStreaming}
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
                {activeStreaming ? (
                  <IconButton type="button" aria-label="Stop" onClick={stopActive}>
                    <IconStop size={15} />
                  </IconButton>
                ) : (
                  <IconButton
                    type="submit"
                    aria-label="Send"
                    disabled={(!draft.trim() && pendingFiles.length === 0) || extracting}
                  >
                    <IconSend size={15} />
                  </IconButton>
                )}
              </ComposerRow>
            </ComposerShell>
            <Hint>
              <IconChat size={10} style={{ verticalAlign: -1, marginRight: 4 }} />
              Switch chats anytime — running replies keep thinking in the sidebar
            </Hint>
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
        </Main>
      </Shell>

      {kbOpen && (
        <ModalOverlay onClick={(e) => e.target === e.currentTarget && setKbOpen(false)}>
          <KbModal>
            <KbHeader>
              <KbTitle>
                <IconBook size={15} /> Knowledge base
              </KbTitle>
              <div style={{ display: 'flex', gap: 8 }}>
                {isAdmin && !adding && !selected && (
                  <Button type="button" $size="sm" onClick={() => { setAdding(true); setAddMode('upload'); }}>
                    <IconPlus size={13} /> Add
                  </Button>
                )}
                <IconButton type="button" aria-label="Close" onClick={() => setKbOpen(false)}>
                  <IconX size={15} />
                </IconButton>
              </div>
            </KbHeader>
            <KbBody>
              {selected ? (
                <DetailPanel>
                  <DetailBack type="button" onClick={() => setSelected(null)}>← Back</DetailBack>
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
                    <Button type="button" $variant="danger" $size="sm" onClick={() => void handleDeleteDoc(selected.id)}>
                      <IconTrash size={13} /> Remove
                    </Button>
                  )}
                </DetailPanel>
              ) : (
                <>
                  {isAdmin && adding && (
                    <AddForm>
                      <Tabs>
                        <Tab type="button" $active={addMode === 'upload'} onClick={() => setAddMode('upload')}>Upload</Tab>
                        <Tab type="button" $active={addMode === 'paste'} onClick={() => setAddMode('paste')}>Paste</Tab>
                      </Tabs>
                      <Field>
                        <Label>Title (optional)</Label>
                        <Input
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
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
                            <IconUpload size={20} />
                            <strong>{addBusy ? 'Extracting…' : 'Drop PDF / DOCX here'}</strong>
                            <small>or click · TXT, MD, CSV, JSON too</small>
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
                              rows={6}
                              value={addContent}
                              onChange={(e) => setAddContent(e.target.value)}
                              disabled={addBusy}
                            />
                          </Field>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <Button type="button" $variant="ghost" disabled={addBusy} onClick={() => setAdding(false)}>
                              Cancel
                            </Button>
                            <Button type="button" disabled={addBusy || !addContent.trim()} onClick={() => void handlePasteAdd()}>
                              {addBusy ? <Spinner $size={13} /> : null}
                              Add
                            </Button>
                          </div>
                        </>
                      )}
                    </AddForm>
                  )}

                  {docsLoading ? (
                    <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
                      <Spinner />
                    </div>
                  ) : docs.length === 0 ? (
                    <EmptySub style={{ margin: 0 }}>
                      No documents yet.
                      {isAdmin ? ' Upload party materials to ground replies.' : ' Ask an admin to add context.'}
                    </EmptySub>
                  ) : (
                    docs.map((d) => (
                      <DocCard key={d.id} type="button" onClick={() => void openDoc(d.id)}>
                        <DocTitle>{d.title}</DocTitle>
                        <DocSummary>{d.summary}</DocSummary>
                        <DocMeta>
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
