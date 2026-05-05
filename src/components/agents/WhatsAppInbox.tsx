import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  Badge,
  Button,
  EmptyState,
  Spinner,
  Textarea,
} from '../ui/primitives';
import { IconRefresh, IconSearch, IconSend } from '../ui/icons';
import {
  PiovraAPI,
  type WhatsAppCachePreviewChat,
  type WhatsAppChatMessagesResponse,
  type WhatsAppSpamState,
  type WhatsAppSummaryResponse,
} from '../../services/piovra';

type Tab = 'inbox' | 'spam' | 'groups';

interface Props {
  chats: WhatsAppCachePreviewChat[];
  cacheBusy: boolean;
  totals: { chatCount: number; messageCount: number } | null;
  onRefreshCache: () => void | Promise<void>;
  /** Notify parent so it can refresh `chats` after a chat-settings mutation. */
  onChatsMutated: () => void | Promise<void>;
  hasAutoreplyConfigured: boolean;
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Wrap = styled.div`
  display: grid;
  grid-template-columns: minmax(260px, 320px) 1fr;
  gap: 0;
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--bg-1);
  min-height: 540px;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    min-height: 0;
  }
`;

const ListCol = styled.div`
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-1);
  background: var(--bg-0);
  min-width: 0;

  @media (max-width: 860px) {
    border-right: none;
    border-bottom: 1px solid var(--border-1);
  }
`;

const ListHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-1);
`;

const SearchRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  svg {
    position: absolute;
    left: 8px;
    width: 14px;
    height: 14px;
    color: var(--text-3);
    pointer-events: none;
  }

  input {
    width: 100%;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--border-1);
    background: var(--bg-1);
    color: var(--text-1);
    padding: 0 10px 0 28px;
    font-size: 13px;
    outline: none;
  }

  input:focus {
    border-color: var(--accent);
  }
`;

const TabsRow = styled.div`
  display: flex;
  gap: 4px;
`;

const TabBtn = styled.button<{ $active?: boolean }>`
  flex: 1;
  border: 1px solid var(--border-1);
  background: ${(p) => (p.$active ? 'var(--accent-soft, var(--bg-2))' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-3)')};
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 5px 6px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: background 0.12s, color 0.12s;

  &:hover {
    color: var(--text-1);
  }

  span.count {
    font-size: 10.5px;
    color: var(--text-3);
  }
`;

const ChatList = styled.div`
  flex: 1;
  overflow-y: auto;
  max-height: 540px;

  @media (max-width: 860px) {
    max-height: 360px;
  }
`;

const ChatRow = styled.button<{ $active?: boolean }>`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 8px;
  padding: 10px 12px;
  width: 100%;
  border: none;
  background: ${(p) => (p.$active ? 'var(--bg-2)' : 'transparent')};
  border-bottom: 1px solid var(--border-1);
  cursor: pointer;
  text-align: left;
  color: var(--text-1);
  transition: background 0.1s;

  &:hover {
    background: var(--bg-2);
  }

  .name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .time {
    font-size: 10.5px;
    color: var(--text-3);
    text-align: right;
    align-self: start;
  }

  .preview {
    font-size: 12px;
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    grid-column: 1 / -1;
  }

  .badges {
    grid-column: 1 / -1;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 2px;
  }
`;

const PaneCol = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-1);
`;

const PaneHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-1);
`;

const PaneTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const PaneTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  display: flex;
  align-items: center;
  gap: 6px;
`;

const PaneJid = styled.div`
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-3);
  word-break: break-all;
`;

const PaneActions = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
`;

const Switch = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-2);
  cursor: pointer;
  user-select: none;

  input { accent-color: var(--accent); }
`;

const MessagesScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  background: var(--bg-1);
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 380px;
`;

const Bubble = styled.div<{ $fromMe: boolean }>`
  align-self: ${(p) => (p.$fromMe ? 'flex-end' : 'flex-start')};
  max-width: 78%;
  background: ${(p) => (p.$fromMe ? 'var(--accent-soft, var(--bg-2))' : 'var(--bg-0)')};
  border: 1px solid var(--border-1);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--text-1);
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;

  .meta {
    margin-top: 2px;
    font-size: 10px;
    color: var(--text-3);
    display: flex;
    gap: 6px;
  }

  .nontext {
    font-style: italic;
    color: var(--text-3);
  }
`;

const ComposerWrap = styled.div`
  border-top: 1px solid var(--border-1);
  padding: 10px 12px;
  background: var(--bg-0);
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ComposerRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: stretch;
  flex-wrap: wrap;
`;

const ErrorBox = styled.div`
  font-size: 11.5px;
  color: var(--danger, #f87171);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: 6px;
  padding: 6px 10px;
`;

const PaneEmpty = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  font-size: 13px;
  padding: 40px 20px;
  text-align: center;
`;

const SummaryCard = styled.div`
  margin: 8px 14px 0;
  border: 1px solid var(--border-1);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--bg-0);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.5;
  white-space: pre-wrap;

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  header button {
    background: none;
    border: none;
    color: var(--text-3);
    font-size: 11px;
    cursor: pointer;
    padding: 0;

    &:hover { color: var(--text-1); }
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ts: number): string {
  if (!ts || ts <= 0) return '';
  const ms = ts > 10_000_000_000 ? ts : ts * 1000;
  const d = new Date(ms);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function bucketChat(c: WhatsAppCachePreviewChat): Tab {
  if (c.chatType === 'group') return 'groups';
  if (c.spamState === 'allowed') return 'inbox';
  if (c.spamState === 'blocked') return 'spam';
  if (c.looksLikeSpam || (c.spamState === 'unknown' && !c.hasTextMessages)) {
    return 'spam';
  }
  return 'inbox';
}

const SELECTED_POLL_MS = 4_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WhatsAppInbox: React.FC<Props> = ({
  chats,
  cacheBusy,
  totals,
  onRefreshCache,
  onChatsMutated,
  hasAutoreplyConfigured,
}) => {
  const [tab, setTab] = useState<Tab>('inbox');
  const [search, setSearch] = useState('');
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [paneData, setPaneData] = useState<WhatsAppChatMessagesResponse | null>(null);
  const [paneBusy, setPaneBusy] = useState(false);
  const [paneError, setPaneError] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summary, setSummary] = useState<WhatsAppSummaryResponse | null>(null);
  const [composerText, setComposerText] = useState('');
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  const counts = useMemo(() => {
    const c = { inbox: 0, spam: 0, groups: 0 };
    for (const ch of chats) c[bucketChat(ch)] += 1;
    return c;
  }, [chats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chats.filter((c) => {
      if (bucketChat(c) !== tab) return false;
      if (!q) return true;
      const hay = `${c.name ?? ''} ${c.jid}`.toLowerCase();
      return hay.includes(q);
    });
  }, [chats, tab, search]);

  // Keep selection valid as the chat list changes / search filters.
  useEffect(() => {
    if (!selectedJid) return;
    if (!filtered.some((c) => c.jid === selectedJid)) {
      setSelectedJid(filtered[0]?.jid ?? null);
    }
  }, [filtered, selectedJid]);

  // Auto-pick first chat when switching tabs and nothing is selected.
  useEffect(() => {
    if (selectedJid) return;
    setSelectedJid(filtered[0]?.jid ?? null);
  }, [filtered, selectedJid]);

  const loadPane = useCallback(async (): Promise<void> => {
    if (!selectedJid) return;
    setPaneBusy(true);
    setPaneError(null);
    try {
      const data = await PiovraAPI.getWhatsAppChatMessages(selectedJid, 80);
      setPaneData(data);
    } catch (e) {
      setPaneError(e instanceof Error ? e.message : String(e));
    } finally {
      setPaneBusy(false);
    }
  }, [selectedJid]);

  useEffect(() => {
    setPaneData(null);
    setComposerText('');
    setPaneError(null);
    setSummary(null);
    if (!selectedJid) return;
    void loadPane();
    const id = window.setInterval(() => void loadPane(), SELECTED_POLL_MS);
    return () => clearInterval(id);
  }, [selectedJid, loadPane]);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [paneData?.messages.length]);

  const selectedChat = useMemo(
    () => chats.find((c) => c.jid === selectedJid) ?? null,
    [chats, selectedJid],
  );

  const muted = paneData?.settings.autoreplyMuted ?? selectedChat?.autoreplyMuted ?? false;
  const spamState: WhatsAppSpamState =
    paneData?.settings.spamState ?? selectedChat?.spamState ?? 'unknown';

  const updateChatSetting = async (
    patch: { autoreplyMuted?: boolean; spamState?: WhatsAppSpamState },
  ): Promise<void> => {
    if (!selectedJid) return;
    try {
      const updated = await PiovraAPI.setWhatsAppChatSettings(selectedJid, patch);
      setPaneData((prev) =>
        prev
          ? {
              ...prev,
              settings: {
                autoreplyMuted: updated.autoreplyMuted,
                spamState: updated.spamState,
              },
            }
          : prev,
      );
      void onChatsMutated();
    } catch (e) {
      setPaneError(e instanceof Error ? e.message : String(e));
    }
  };

  const generateDraft = async (): Promise<void> => {
    if (!selectedJid) return;
    setDraftBusy(true);
    setPaneError(null);
    try {
      const res = await PiovraAPI.draftWhatsAppReply(selectedJid);
      setComposerText(res.draft);
    } catch (e) {
      setPaneError(e instanceof Error ? e.message : String(e));
    } finally {
      setDraftBusy(false);
    }
  };

  const summarize = async (): Promise<void> => {
    if (!selectedJid) return;
    setSummaryBusy(true);
    setPaneError(null);
    try {
      const res = await PiovraAPI.summarizeWhatsAppChat(selectedJid);
      setSummary(res);
    } catch (e) {
      setPaneError(e instanceof Error ? e.message : String(e));
    } finally {
      setSummaryBusy(false);
    }
  };

  const sendMessage = async (): Promise<void> => {
    if (!selectedJid) return;
    const text = composerText.trim();
    if (!text) return;
    setSendBusy(true);
    setPaneError(null);
    try {
      await PiovraAPI.sendWhatsAppMessage(selectedJid, text);
      setComposerText('');
      await loadPane();
    } catch (e) {
      setPaneError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendBusy(false);
    }
  };

  const renderRow = (c: WhatsAppCachePreviewChat): React.ReactNode => {
    const lastMsg = c.recent[c.recent.length - 1];
    const lastPreview = lastMsg
      ? lastMsg.contentKind !== 'text'
        ? `[${lastMsg.contentKind}]`
        : lastMsg.textPreview ?? ''
      : '(no messages)';
    const lastSender = lastMsg
      ? lastMsg.fromMe
        ? 'you: '
        : ''
      : '';
    return (
      <ChatRow
        key={c.jid}
        $active={c.jid === selectedJid}
        onClick={() => setSelectedJid(c.jid)}
      >
        <span className="name">{c.name ?? '(unnamed chat)'}</span>
        <span className="time">{formatTime(c.lastMessageAt ?? 0)}</span>
        <span className="preview">
          {lastSender}
          {lastPreview}
        </span>
        <span className="badges">
          {c.unreadCount > 0 ? (
            <Badge $variant="success">{c.unreadCount}</Badge>
          ) : null}
          {c.autoreplyMuted ? <Badge>muted</Badge> : null}
          {c.spamState === 'allowed' ? <Badge>allowed</Badge> : null}
          {c.spamState === 'blocked' ? <Badge $variant="danger">blocked</Badge> : null}
          {c.spamState !== 'allowed' && c.looksLikeSpam ? (
            <Badge $variant="warning">spam?</Badge>
          ) : null}
          {c.chatType === 'broadcast' ? <Badge>broadcast</Badge> : null}
        </span>
      </ChatRow>
    );
  };

  return (
    <Wrap>
      <ListCol>
        <ListHeader>
          <SearchRow>
            <IconSearch />
            <input
              type="search"
              placeholder="Search by name or jid"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </SearchRow>
          <TabsRow>
            <TabBtn $active={tab === 'inbox'} onClick={() => setTab('inbox')}>
              Inbox <span className="count">{counts.inbox}</span>
            </TabBtn>
            <TabBtn $active={tab === 'spam'} onClick={() => setTab('spam')}>
              Spam <span className="count">{counts.spam}</span>
            </TabBtn>
            <TabBtn $active={tab === 'groups'} onClick={() => setTab('groups')}>
              Groups <span className="count">{counts.groups}</span>
            </TabBtn>
          </TabsRow>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {totals
                ? `${totals.chatCount} chats · ${totals.messageCount} msgs cached`
                : '—'}
            </span>
            <Button
              type="button"
              $variant="ghost"
              $size="sm"
              onClick={() => void onRefreshCache()}
              disabled={cacheBusy}
            >
              <IconRefresh />
              {cacheBusy ? '…' : ''}
            </Button>
          </div>
        </ListHeader>
        <ChatList>
          {filtered.length === 0 ? (
            <EmptyState style={{ padding: '32px 16px', fontSize: 12.5 }}>
              {tab === 'spam'
                ? 'No spam — unknown chats land here when they have no display name and only non-text content.'
                : tab === 'groups'
                  ? 'No groups cached yet.'
                  : 'No DMs cached yet. Send yourself a test message to populate.'}
            </EmptyState>
          ) : (
            filtered.map(renderRow)
          )}
        </ChatList>
      </ListCol>

      <PaneCol>
        {!selectedChat ? (
          <PaneEmpty>Select a chat on the left to read messages, draft a reply, or mute autoreply for it.</PaneEmpty>
        ) : (
          <>
            <PaneHeader>
              <PaneTitleRow>
                <div style={{ minWidth: 0 }}>
                  <PaneTitle>
                    {selectedChat.name ?? '(unnamed chat)'}
                    <Badge>{selectedChat.chatType}</Badge>
                    {selectedChat.unreadCount > 0 ? (
                      <Badge $variant="success">{selectedChat.unreadCount} unread</Badge>
                    ) : null}
                    {paneBusy ? <Spinner /> : null}
                  </PaneTitle>
                  <PaneJid>{selectedChat.jid}</PaneJid>
                </div>
                <PaneActions>
                  {selectedChat.chatType === 'dm' ? (
                    <Switch>
                      <input
                        type="checkbox"
                        checked={!muted}
                        onChange={(e) =>
                          void updateChatSetting({ autoreplyMuted: !e.target.checked })
                        }
                      />
                      Autoreply for this chat
                    </Switch>
                  ) : null}
                  {tab === 'spam' ? (
                    <>
                      <Button
                        type="button"
                        $variant="secondary"
                        $size="sm"
                        onClick={() => void updateChatSetting({ spamState: 'allowed' })}
                      >
                        Allow
                      </Button>
                      <Button
                        type="button"
                        $variant="danger"
                        $size="sm"
                        onClick={() => void updateChatSetting({ spamState: 'blocked' })}
                      >
                        Block
                      </Button>
                    </>
                  ) : spamState === 'blocked' ? (
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      onClick={() => void updateChatSetting({ spamState: 'unknown' })}
                    >
                      Unblock
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    $variant="ghost"
                    $size="sm"
                    onClick={() => void summarize()}
                    disabled={summaryBusy || !hasAutoreplyConfigured}
                    title={
                      hasAutoreplyConfigured
                        ? 'Generate a short summary of recent activity in this chat'
                        : 'Configure the autoreply persona + agent instance below first'
                    }
                  >
                    {summaryBusy ? 'Summarizing…' : 'Summarize'}
                  </Button>
                  <Button
                    type="button"
                    $variant="ghost"
                    $size="sm"
                    onClick={() => void loadPane()}
                    disabled={paneBusy}
                  >
                    <IconRefresh />
                  </Button>
                </PaneActions>
              </PaneTitleRow>
            </PaneHeader>

            {summary ? (
              <SummaryCard>
                <header>
                  <span>
                    Summary · {summary.basedOn.messageCount} msgs
                    {summary.basedOn.fromTs
                      ? ` · ${formatTime(summary.basedOn.fromTs)} → ${formatTime(
                          summary.basedOn.toTs ?? summary.basedOn.fromTs,
                        )}`
                      : ''}
                  </span>
                  <button type="button" onClick={() => setSummary(null)}>
                    dismiss
                  </button>
                </header>
                <div>{summary.summary}</div>
              </SummaryCard>
            ) : null}

            <MessagesScroll ref={messagesScrollRef}>
              {(paneData?.messages ?? []).length === 0 && !paneBusy ? (
                <PaneEmpty>No messages cached yet for this chat.</PaneEmpty>
              ) : (
                (paneData?.messages ?? []).map((m) => (
                  <Bubble key={m.id} $fromMe={m.fromMe}>
                    {m.text ? (
                      m.text
                    ) : (
                      <span className="nontext">[{m.contentKind}]</span>
                    )}
                    <div className="meta">
                      <span>{m.fromMe ? 'you' : m.pushName ?? 'them'}</span>
                      <span>·</span>
                      <span>{formatTime(m.timestamp)}</span>
                      {m.contentKind !== 'text' && m.text ? (
                        <>
                          <span>·</span>
                          <span>[{m.contentKind}]</span>
                        </>
                      ) : null}
                    </div>
                  </Bubble>
                ))
              )}
            </MessagesScroll>

            <ComposerWrap>
              {paneError ? <ErrorBox>{paneError}</ErrorBox> : null}
              {selectedChat.chatType === 'dm' ? (
                <>
                  <ComposerRow>
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      onClick={() => void generateDraft()}
                      disabled={draftBusy || !hasAutoreplyConfigured}
                      title={
                        hasAutoreplyConfigured
                          ? 'Run the autoreply persona to draft a reply for this chat'
                          : 'Configure the autoreply persona + agent instance below first'
                      }
                    >
                      {draftBusy ? 'Drafting…' : 'Generate reply'}
                    </Button>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'center' }}>
                      Uses your autoreply persona + last 10 messages. Edit before sending.
                    </span>
                  </ComposerRow>
                  <Textarea
                    rows={3}
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder="Type a message or click Generate reply…"
                  />
                  <ComposerRow>
                    <Button
                      type="button"
                      $variant="primary"
                      $size="sm"
                      onClick={() => void sendMessage()}
                      disabled={sendBusy || composerText.trim().length === 0}
                    >
                      <IconSend />
                      {sendBusy ? 'Sending…' : 'Send'}
                    </Button>
                    {composerText.trim().length > 0 ? (
                      <Button
                        type="button"
                        $variant="ghost"
                        $size="sm"
                        onClick={() => setComposerText('')}
                      >
                        Discard
                      </Button>
                    ) : null}
                  </ComposerRow>
                </>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Sending and autoreply are disabled for {selectedChat.chatType} chats.
                </span>
              )}
            </ComposerWrap>
          </>
        )}
      </PaneCol>
    </Wrap>
  );
};

export default WhatsAppInbox;
