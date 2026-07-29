import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
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
  IconSpark,
} from '../components/ui/icons';
import {
  listDocuments,
  getDocument,
  createDocument,
  deleteDocument,
  streamChat,
  GATA_CHAT_MODELS,
  GATA_DEFAULT_MODEL,
  type GbDocumentListItem,
  type GbDocumentDetail,
  type GbChatHistoryItem,
} from '../services/gataBoss';
import { useRegisterOverlay } from '../hooks/useOverlayStack';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'done' | 'error';
}

const Page = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 72px);
  min-height: 480px;
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-2) var(--s-2);
  flex-shrink: 0;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-width: 0;
`;

const BrandMark = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 35%, transparent), var(--bg-3));
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border-1));
  color: var(--accent);
  flex-shrink: 0;
`;

const BrandText = styled.div`
  min-width: 0;
`;

const BrandTitle = styled.div`
  font-size: 16px;
  font-weight: 650;
  color: var(--text-1);
  letter-spacing: -0.02em;
`;

const BrandSub = styled.div`
  font-size: 11.5px;
  color: var(--text-3);
`;

const ModelSelect = styled.select`
  appearance: none;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: 999px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 500;
  padding: 6px 28px 6px 12px;
  cursor: pointer;
  max-width: 200px;
  background-image: linear-gradient(45deg, transparent 50%, var(--text-3) 50%),
    linear-gradient(135deg, var(--text-3) 50%, transparent 50%);
  background-position: calc(100% - 14px) calc(50% - 2px), calc(100% - 9px) calc(50% - 2px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  &:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border-1)); color: var(--text-1); }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;

const TopActions = styled.div`
  display: flex;
  gap: var(--s-2);
  flex-shrink: 0;
`;

const Messages = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--s-2) var(--s-2) var(--s-4);
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
`;

const Empty = styled.div`
  margin: auto;
  text-align: center;
  max-width: 420px;
  padding: var(--s-8) var(--s-4);
`;

const EmptyTitle = styled.h1`
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.03em;
  color: var(--text-1);
  margin: 0 0 var(--s-2);
`;

const EmptySub = styled.p`
  margin: 0;
  color: var(--text-3);
  font-size: 14.5px;
  line-height: 1.55;
`;

const Suggestions = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-2);
  margin-top: var(--s-5);
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const Suggestion = styled.button`
  text-align: left;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  padding: 12px 14px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  &:hover {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border-1));
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-2));
    color: var(--text-1);
  }
`;

const Row = styled.div<{ $role: 'user' | 'assistant' }>`
  display: flex;
  justify-content: ${(p) => (p.$role === 'user' ? 'flex-end' : 'flex-start')};
`;

const Bubble = styled.div<{ $role: 'user' | 'assistant' }>`
  max-width: min(720px, 92%);
  padding: ${(p) => (p.$role === 'user' ? '11px 14px' : '2px 2px')};
  border-radius: ${(p) => (p.$role === 'user' ? '18px 18px 6px 18px' : '0')};
  background: ${(p) => (p.$role === 'user' ? 'var(--accent-soft)' : 'transparent')};
  color: var(--text-1);
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;

  & p { margin: 0 0 0.75em; }
  & p:last-child { margin-bottom: 0; }
  & ul, & ol { margin: 0.4em 0 0.8em; padding-left: 1.3em; }
  & code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--bg-3);
    padding: 1px 5px;
    border-radius: 4px;
  }
  & pre {
    background: var(--bg-3);
    border: 1px solid var(--border-1);
    border-radius: var(--r-md);
    padding: 12px;
    overflow-x: auto;
    margin: 0.6em 0;
  }
  & pre code { background: none; padding: 0; }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
`;

const Cursor = styled.span`
  display: inline-block;
  width: 7px;
  height: 1.05em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--accent);
  animation: ${blink} 1s step-end infinite;
`;

const ComposerWrap = styled.div`
  flex-shrink: 0;
  padding: 0 var(--s-2) var(--s-4);
`;

const Composer = styled.form`
  display: flex;
  gap: var(--s-2);
  align-items: flex-end;
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: 22px;
  padding: 10px 12px 10px 16px;
  box-shadow: var(--shadow-md);
  &:focus-within {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border-2));
  }
`;

const ComposerInput = styled.textarea`
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-1);
  font: inherit;
  font-size: 15px;
  line-height: 1.45;
  max-height: 180px;
  min-height: 24px;
  padding: 6px 0;
  &::placeholder { color: var(--text-3); }
`;

const KbModal = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: var(--r-lg);
  width: min(720px, 100%);
  max-height: min(84vh, 820px);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
`;

const KbHeader = styled.div`
  padding: var(--s-4) var(--s-5);
  border-bottom: 1px solid var(--border-1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
`;

const KbTitle = styled.div`
  font-weight: 650;
  color: var(--text-1);
  display: flex;
  align-items: center;
  gap: var(--s-2);
  svg { color: var(--accent); }
`;

const KbBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--s-4) var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
`;

const DocCard = styled.button`
  text-align: left;
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  padding: 12px 14px;
  cursor: pointer;
  color: inherit;
  transition: border-color 0.15s;
  &:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border-1)); }
`;

const DocTitle = styled.div`
  font-weight: 600;
  color: var(--text-1);
  font-size: 14px;
  margin-bottom: 4px;
`;

const DocSummary = styled.div`
  font-size: 13px;
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
  gap: var(--s-3);
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
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--text-2);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  padding: 14px;
  margin: 0;
  max-height: 40vh;
  overflow-y: auto;
`;

const AddForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding-top: var(--s-2);
  border-top: 1px solid var(--border-1);
  margin-top: var(--s-2);
`;

const SUGGESTIONS = [
  'Draft a short social media post about GATA’s core message',
  'Write talking points for a local press interview',
  'Suggest a slogan and poster concept in GATA’s voice',
  'Summarize GATA’s identity from the knowledge base',
];

export default function GataBoss() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const toast = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
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

  const [kbOpen, setKbOpen] = useState(false);
  useRegisterOverlay(kbOpen);
  const [docs, setDocs] = useState<GbDocumentListItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selected, setSelected] = useState<GbDocumentDetail | null>(null);
  const [adding, setAdding] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addContent, setAddContent] = useState('');
  const [addBusy, setAddBusy] = useState(false);

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
  }, [messages]);

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;

    const history: GbChatHistoryItem[] = messages
      .filter((m) => m.status !== 'error' && m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: message,
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
    setStreaming(true);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamChat(
        { message, history, model },
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

  const handleAdd = async () => {
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
      toast.success('Added to knowledge base (summarized)');
      await refreshDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add document');
    } finally {
      setAddBusy(false);
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
          <BrandMark>
            <IconSpark size={18} />
          </BrandMark>
          <BrandText>
            <BrandTitle>GATA Bo$$</BrandTitle>
            <BrandSub>Party communications · {modelLabel}</BrandSub>
          </BrandText>
        </Brand>
        <TopActions>
          <ModelSelect
            aria-label="Model"
            value={model}
            disabled={streaming}
            onChange={(e) => pickModel(e.target.value)}
            title="Chat model"
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
          <Button type="button" $variant="ghost" onClick={() => setKbOpen(true)}>
            <IconBook size={15} /> Knowledge base
            {docs.length > 0 ? ` (${docs.length})` : ''}
          </Button>
          {messages.length > 0 && (
            <IconButton
              type="button"
              aria-label="New chat"
              title="New chat"
              onClick={() => {
                stop();
                setMessages([]);
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
            <EmptyTitle>GATA Bo$$</EmptyTitle>
            <EmptySub>
              Ask for drafts, talking points, slogans, or visual concepts grounded in the shared GATA knowledge base.
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
            <Row key={m.id} $role={m.role}>
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
            </Row>
          ))
        )}
      </Messages>

      <ComposerWrap>
        <Composer
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
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
          />
          {streaming ? (
            <IconButton type="button" aria-label="Stop" onClick={stop}>
              <IconStop size={16} />
            </IconButton>
          ) : (
            <IconButton type="submit" aria-label="Send" disabled={!draft.trim()}>
              <IconSend size={16} />
            </IconButton>
          )}
        </Composer>
      </ComposerWrap>

      {kbOpen && (
        <ModalOverlay onClick={(e) => e.target === e.currentTarget && setKbOpen(false)}>
          <KbModal>
            <KbHeader>
              <KbTitle>
                <IconBook size={18} /> Knowledge base
              </KbTitle>
              <div style={{ display: 'flex', gap: 8 }}>
                {isAdmin && !adding && !selected && (
                  <Button type="button" $size="sm" onClick={() => setAdding(true)}>
                    <IconPlus size={14} /> Add context
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
                    ← Back to list
                  </DetailBack>
                  <DocTitle>{selected.title}</DocTitle>
                  <DocMeta>
                    Summary · {selected.createdByName || selected.createdByEmail || 'unknown'} ·{' '}
                    {formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true })}
                  </DocMeta>
                  <Label>Summary</Label>
                  <DocSummary style={{ WebkitLineClamp: 'unset' as unknown as number, display: 'block' }}>
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
              ) : docsLoading ? (
                <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
                  <Spinner />
                </div>
              ) : docs.length === 0 && !adding ? (
                <EmptySub style={{ textAlign: 'center', padding: 24 }}>
                  No documents yet.
                  {isAdmin ? ' Add party identity, positions, bios, and tone guides.' : ' Ask an admin to add context.'}
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

              {isAdmin && adding && (
                <AddForm>
                  <Field>
                    <Label>Title (optional)</Label>
                    <Input
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      placeholder="Auto-generated if empty"
                      disabled={addBusy}
                    />
                  </Field>
                  <Field>
                    <Label>Content</Label>
                    <Textarea
                      rows={8}
                      value={addContent}
                      onChange={(e) => setAddContent(e.target.value)}
                      placeholder="Paste documents, identity notes, positions, bios, style guides…"
                      disabled={addBusy}
                    />
                  </Field>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Button type="button" $variant="ghost" disabled={addBusy} onClick={() => setAdding(false)}>
                      Cancel
                    </Button>
                    <Button type="button" disabled={addBusy || !addContent.trim()} onClick={() => void handleAdd()}>
                      {addBusy ? <Spinner $size={14} /> : null}
                      {addBusy ? 'Summarizing…' : 'Add & summarize'}
                    </Button>
                  </div>
                </AddForm>
              )}
            </KbBody>
          </KbModal>
        </ModalOverlay>
      )}
    </Page>
  );
}
