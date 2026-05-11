import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useAuth } from './AuthContext';
import * as chatApi from '../services/chat';
import * as notify from '../services/chatNotifications';
import type {
  ChatChannel, ChatMessage, ChatUser, ChannelReadState, ChatGifAttachment,
} from '../types';

interface WorkChatContextValue {
  me: ChatUser | null;
  isAdmin: boolean;

  channels: ChatChannel[];
  activeChannelId: string | null;
  activeChannel: ChatChannel | null;
  setActiveChannel: (id: string) => void;

  messages: ChatMessage[];
  send: (text: string, gif?: ChatGifAttachment) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  pinMessage: (messageId: string) => Promise<void>;
  unpinMessage: (messageId: string) => Promise<void>;

  createChannel: (input: { name: string; topic?: string }) => Promise<ChatChannel>;
  deleteChannel: (id: string) => Promise<void>;
  updateChannelTopic: (id: string, topic: string) => Promise<void>;

  /** Map of channelId → unread count (messages newer than `lastReadAt`, excluding own). */
  unreadByChannel: Record<string, number>;
  /** Total across all channels (for nav badge). */
  totalUnread: number;
  reads: ChannelReadState[];
  markActiveChannelRead: () => Promise<void>;

  /** Last load error (e.g. server unreachable). `null` while healthy. */
  loadError: string | null;
  /** True until the first channel list resolves. */
  loading: boolean;

  /** Free-text filter applied to the active channel's messages. */
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  /** Desktop notification state (browser permission + user toggle). */
  notificationsSupported: boolean;
  notificationsPermission: notify.NotificationsPermission;
  notificationsEnabled: boolean;
  enableNotifications: () => Promise<notify.NotificationsPermission>;
  disableNotifications: () => void;
}

const WorkChatContext = createContext<WorkChatContextValue | null>(null);

const STORAGE_ACTIVE_CHANNEL = 'workchat.activeChannelId';
/* Polling is the safety net behind SSE. Keep it slow so we don't hammer
 * the server when the live stream is doing all the work. */
const POLL_ACTIVE_MS = 30_000;
const POLL_BACKGROUND_MS = 90_000;
const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const SSE_URL = `${PIOVRA_BASE_URL}/v1/chat/events`;

function dedupeMessagesAppend(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return prev;
  const seen = new Set(prev.map((m) => m.id));
  const additions = incoming.filter((m) => !seen.has(m.id));
  if (additions.length === 0) return prev;
  return [...prev, ...additions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function replaceMessage(prev: ChatMessage[], next: ChatMessage): ChatMessage[] {
  let found = false;
  const out = prev.map((m) => {
    if (m.id === next.id) { found = true; return next; }
    return m;
  });
  return found ? out : [...out, next];
}

export const WorkChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { me: authMe, isAuthenticated } = useAuth();

  const me: ChatUser | null = useMemo(() => {
    if (!authMe) return null;
    return {
      id: authMe.id,
      name: authMe.name ?? authMe.email,
      email: authMe.email,
      pictureUrl: authMe.pictureUrl,
      role: authMe.role,
    };
  }, [authMe]);

  const isAdmin = me?.role === 'admin';

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelIdState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_ACTIVE_CHANNEL);
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<ChannelReadState[]>([]);
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  /* Desktop notifications: derive state from the OS permission + a local
   * "muted" toggle. The toggle defaults to true once permission is granted. */
  const [notificationsPermission, setNotificationsPermission] = useState<notify.NotificationsPermission>(
    () => notify.getPermission(),
  );
  const [notificationsEnabledState, setNotificationsEnabledState] = useState<boolean>(
    () => notify.isEnabledStored(),
  );
  const notificationsSupported = notify.isSupported();
  const notificationsEnabled = notificationsPermission === 'granted' && notificationsEnabledState;

  /* Track whether the chat page is mounted (we poll faster when it is). */
  const isVisibleRef = useRef(false);
  const setActivePolling = useCallback((on: boolean) => { isVisibleRef.current = on; }, []);

  /* ── Loaders ───────────────────────────────────────────────────────── */

  const reloadChannels = useCallback(async (): Promise<ChatChannel[] | null> => {
    if (!isAuthenticated) return null;
    try {
      const rows = await chatApi.listChannels();
      setChannels(rows);
      setLoadError(null);
      return rows;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load channels');
      return null;
    }
  }, [isAuthenticated]);

  const reloadReadsAndUnread = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;
    try {
      const [r, u] = await Promise.all([chatApi.listReads(), chatApi.fetchUnreadSummary()]);
      setReads(r);
      const map: Record<string, number> = {};
      for (const row of u) map[row.channelId] = row.unreadCount;
      setUnreadByChannel(map);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load chat state');
    }
  }, [isAuthenticated]);

  const reloadActiveMessages = useCallback(async (channelId: string): Promise<void> => {
    try {
      const rows = await chatApi.listMessages(channelId);
      setMessages(rows);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load messages');
    }
  }, []);

  const pollActiveDelta = useCallback(async (channelId: string): Promise<void> => {
    try {
      const last = messagesRef.current[messagesRef.current.length - 1];
      const since = last?.createdAt;
      const rows = await chatApi.listMessages(channelId, since ? { since } : undefined);
      if (rows.length > 0) {
        setMessages((prev) => dedupeMessagesAppend(prev, rows));
      }
    } catch {
      /* Swallow polling errors — next tick will retry. */
    }
  }, []);

  /* Keep refs to live state so async closures (SSE, polling) don't go stale. */
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const activeChannelIdRef = useRef<string | null>(activeChannelId);
  useEffect(() => { activeChannelIdRef.current = activeChannelId; }, [activeChannelId]);
  const channelsRef = useRef<ChatChannel[]>([]);
  useEffect(() => { channelsRef.current = channels; }, [channels]);
  const notificationsLiveRef = useRef<boolean>(false);
  useEffect(() => { notificationsLiveRef.current = notificationsEnabled; }, [notificationsEnabled]);

  /* ── Initial / auth-change load ────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setChannels([]);
      setMessages([]);
      setReads([]);
      setUnreadByChannel({});
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      await reloadChannels();
      await reloadReadsAndUnread();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, reloadChannels, reloadReadsAndUnread]);

  /* Pick an active channel once channels load. */
  useEffect(() => {
    if (channels.length === 0) {
      if (activeChannelId !== null) {
        setActiveChannelIdState(null);
        localStorage.removeItem(STORAGE_ACTIVE_CHANNEL);
      }
      return;
    }
    if (!activeChannelId || !channels.some((c) => c.id === activeChannelId)) {
      const first = channels[0].id;
      setActiveChannelIdState(first);
      localStorage.setItem(STORAGE_ACTIVE_CHANNEL, first);
    }
  }, [channels, activeChannelId]);

  /* Load full message list when active channel changes. */
  useEffect(() => {
    if (!activeChannelId) {
      setMessages([]);
      return;
    }
    void reloadActiveMessages(activeChannelId);
  }, [activeChannelId, reloadActiveMessages]);

  /* ── Polling loop ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (!isAuthenticated) return;
    let stopped = false;
    let timer: number | null = null;

    const tick = async (): Promise<void> => {
      if (stopped) return;
      const active = isVisibleRef.current;
      try {
        if (active && activeChannelId) {
          await pollActiveDelta(activeChannelId);
        }
        await Promise.all([reloadChannels(), reloadReadsAndUnread()]);
      } finally {
        if (!stopped) {
          const next = active ? POLL_ACTIVE_MS : POLL_BACKGROUND_MS;
          timer = window.setTimeout(tick, next);
        }
      }
    };

    timer = window.setTimeout(tick, POLL_ACTIVE_MS);
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [isAuthenticated, activeChannelId, pollActiveDelta, reloadChannels, reloadReadsAndUnread]);

  /* Refresh on tab focus so the user sees fresh state immediately. */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = (): void => {
      if (document.visibilityState !== 'visible') return;
      if (!isAuthenticated) return;
      void reloadChannels();
      void reloadReadsAndUnread();
      if (activeChannelId) void pollActiveDelta(activeChannelId);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isAuthenticated, activeChannelId, pollActiveDelta, reloadChannels, reloadReadsAndUnread]);

  /* ── SSE live stream (the fast path) ─────────────────────────────── */
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof EventSource === 'undefined') return;

    let stopped = false;
    let es: EventSource | null = null;
    let retryTimer: number | null = null;
    let retryDelay = 1_000;

    const handleMessageCreated = (channelId: string, msg: ChatMessage): void => {
      if (channelId === activeChannelIdRef.current) {
        setMessages((prev) => dedupeMessagesAppend(prev, [msg]));
      }
      const fromOther = msg.authorId !== me?.id;
      const isActiveChannel = channelId === activeChannelIdRef.current;
      // Bump unread for non-active channels and non-own messages.
      if (fromOther && !isActiveChannel) {
        setUnreadByChannel((prev) => ({ ...prev, [channelId]: (prev[channelId] ?? 0) + 1 }));
      }
      // Desktop notification: only for messages from others, only when the
      // user can't see them (different channel, or tab not focused).
      if (fromOther && notificationsLiveRef.current) {
        const tabHidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';
        if (!isActiveChannel || tabHidden) {
          const channel = channelsRef.current.find((c) => c.id === channelId) ?? null;
          notify.showMessageNotification({
            message: msg,
            channel,
            onClick: () => {
              setActiveChannelIdState(channelId);
              try { localStorage.setItem(STORAGE_ACTIVE_CHANNEL, channelId); } catch { /* noop */ }
            },
          });
        }
      }
    };

    const handleMessageDeleted = (channelId: string, messageId: string): void => {
      if (channelId === activeChannelIdRef.current) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    };

    const handleMessageUpdated = (channelId: string, msg: ChatMessage): void => {
      if (channelId === activeChannelIdRef.current) {
        setMessages((prev) => replaceMessage(prev, msg));
      }
    };

    const handleChannelCreated = (ch: ChatChannel): void => {
      setChannels((prev) => {
        if (prev.some((c) => c.id === ch.id)) return prev;
        return [...prev, ch].sort((a, b) => a.name.localeCompare(b.name));
      });
    };

    const handleChannelUpdated = (ch: ChatChannel): void => {
      setChannels((prev) => prev.map((c) => (c.id === ch.id ? ch : c)));
    };

    const handleChannelDeleted = (channelId: string): void => {
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      setUnreadByChannel((prev) => {
        const { [channelId]: _drop, ...rest } = prev;
        void _drop;
        return rest;
      });
      if (activeChannelIdRef.current === channelId) {
        setMessages([]);
      }
    };

    const open = (): void => {
      if (stopped) return;
      try {
        es = new EventSource(SSE_URL, { withCredentials: true });
      } catch (err) {
        // Surface as soft error and rely on the polling fallback.
        // eslint-disable-next-line no-console
        console.warn('chat SSE init failed', err);
        return;
      }

      es.addEventListener('hello', () => {
        retryDelay = 1_000;
      });

      es.addEventListener('message.created', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            channelId: string; payload: ChatMessage;
          };
          handleMessageCreated(data.channelId, data.payload);
        } catch { /* swallow malformed events */ }
      });

      es.addEventListener('message.deleted', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            channelId: string; messageId: string;
          };
          handleMessageDeleted(data.channelId, data.messageId);
        } catch { /* swallow */ }
      });

      es.addEventListener('message.updated', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            channelId: string; payload: ChatMessage;
          };
          handleMessageUpdated(data.channelId, data.payload);
        } catch { /* swallow */ }
      });

      es.addEventListener('channel.created', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { channel: ChatChannel };
          handleChannelCreated(data.channel);
        } catch { /* swallow */ }
      });

      es.addEventListener('channel.updated', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { channel: ChatChannel };
          handleChannelUpdated(data.channel);
        } catch { /* swallow */ }
      });

      es.addEventListener('channel.deleted', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { channelId: string };
          handleChannelDeleted(data.channelId);
        } catch { /* swallow */ }
      });

      es.onerror = () => {
        // Browsers auto-reconnect on transient errors; for hard failures
        // (auth, 404) the stream stays CLOSED and we manage retry ourselves.
        if (!es || es.readyState === EventSource.CLOSED) {
          if (es) es.close();
          es = null;
          if (stopped) return;
          const delay = Math.min(retryDelay, 30_000);
          retryDelay = Math.min(retryDelay * 2, 30_000);
          retryTimer = window.setTimeout(open, delay);
        }
      };
    };

    open();

    return () => {
      stopped = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (es) es.close();
    };
  }, [isAuthenticated, me?.id]);

  /* ── Mutations ─────────────────────────────────────────────────────── */

  const setActiveChannel = useCallback((id: string) => {
    setActiveChannelIdState(id);
    localStorage.setItem(STORAGE_ACTIVE_CHANNEL, id);
  }, []);

  const markChannelReadAt = useCallback(async (channelId: string, at: string): Promise<void> => {
    if (!me) return;
    setReads((prev) => {
      const i = prev.findIndex((r) => r.channelId === channelId);
      if (i >= 0) {
        if (prev[i].lastReadAt >= at) return prev;
        const next = prev.slice();
        next[i] = { channelId, lastReadAt: at };
        return next;
      }
      return [...prev, { channelId, lastReadAt: at }];
    });
    setUnreadByChannel((prev) => ({ ...prev, [channelId]: 0 }));
    try {
      await chatApi.markChannelRead(channelId, at);
    } catch {
      /* swallow — next poll will reconcile */
    }
  }, [me]);

  const send = useCallback(async (text: string, gif?: ChatGifAttachment): Promise<void> => {
    if (!me || !activeChannelId) return;
    const trimmed = text.trim();
    if (!trimmed && !gif) return;
    try {
      const created = await chatApi.sendMessage({ channelId: activeChannelId, text: trimmed, gif });
      setMessages((prev) => dedupeMessagesAppend(prev, [created]));
      // Server already marked sender as read; mirror locally to avoid flash.
      await markChannelReadAt(activeChannelId, created.createdAt);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [me, activeChannelId, markChannelReadAt]);

  const deleteMessage = useCallback(async (messageId: string): Promise<void> => {
    if (!activeChannelId) return;
    const prev = messagesRef.current;
    setMessages((p) => p.filter((m) => m.id !== messageId));
    try {
      await chatApi.deleteMessage(activeChannelId, messageId);
      void reloadChannels();
    } catch (err) {
      setMessages(prev);
      setLoadError(err instanceof Error ? err.message : 'Failed to delete message');
    }
  }, [activeChannelId, reloadChannels]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string): Promise<void> => {
    if (!me || !activeChannelId) return;
    try {
      const updated = await chatApi.toggleReaction(activeChannelId, messageId, emoji);
      setMessages((p) => replaceMessage(p, updated));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to react');
    }
  }, [me, activeChannelId]);

  const pinMessage = useCallback(async (messageId: string): Promise<void> => {
    if (!me || !activeChannelId) return;
    try {
      const { channel, message } = await chatApi.pinMessage(activeChannelId, messageId);
      setChannels((p) => p.map((c) => (c.id === channel.id ? channel : c)));
      setMessages((p) => replaceMessage(p, message));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to pin');
    }
  }, [me, activeChannelId]);

  const unpinMessage = useCallback(async (messageId: string): Promise<void> => {
    if (!activeChannelId) return;
    try {
      const { channel, message } = await chatApi.unpinMessage(activeChannelId, messageId);
      setChannels((p) => p.map((c) => (c.id === channel.id ? channel : c)));
      setMessages((p) => replaceMessage(p, message));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to unpin');
    }
  }, [activeChannelId]);

  const createChannel = useCallback(async (input: { name: string; topic?: string }): Promise<ChatChannel> => {
    if (!me) throw new Error('Sign in to create a channel.');
    if (!isAdmin) throw new Error('Only admins can create channels.');
    const ch = await chatApi.createChannel(input);
    setChannels((prev) => {
      if (prev.some((c) => c.id === ch.id)) return prev;
      return [...prev, ch].sort((a, b) => a.name.localeCompare(b.name));
    });
    setActiveChannel(ch.id);
    return ch;
  }, [me, isAdmin, setActiveChannel]);

  const deleteChannel = useCallback(async (id: string): Promise<void> => {
    if (!isAdmin) return;
    try {
      await chatApi.deleteChannel(id);
      setChannels((p) => p.filter((c) => c.id !== id));
      setUnreadByChannel((p) => { const { [id]: _drop, ...rest } = p; void _drop; return rest; });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to delete channel');
    }
  }, [isAdmin]);

  const updateChannelTopic = useCallback(async (id: string, topic: string): Promise<void> => {
    if (!isAdmin) return;
    try {
      const ch = await chatApi.updateChannel(id, { topic });
      setChannels((p) => p.map((c) => (c.id === id ? ch : c)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to update channel');
    }
  }, [isAdmin]);

  const markActiveChannelRead = useCallback(async (): Promise<void> => {
    if (!me || !activeChannelId) return;
    const latest = messagesRef.current[messagesRef.current.length - 1];
    const at = latest?.createdAt ?? new Date().toISOString();
    await markChannelReadAt(activeChannelId, at);
  }, [me, activeChannelId, markChannelReadAt]);

  /* Auto-mark active channel as read whenever its newest message changes. */
  const lastReadSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!me || !activeChannelId || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    const key = `${activeChannelId}:${latest.createdAt}`;
    if (lastReadSentRef.current === key) return;
    lastReadSentRef.current = key;
    void markChannelReadAt(activeChannelId, latest.createdAt);
  }, [me, activeChannelId, messages, markChannelReadAt]);

  /* When the Chat page mounts/unmounts it bumps polling speed. We expose
   * `setActivePolling` indirectly via a small effect on `activeChannelId`:
   * the chat page calls `markActiveChannelRead` on mount, but we also want
   * polling to ramp up. Simpler: ramp up whenever an active channel is set. */
  useEffect(() => {
    setActivePolling(Boolean(activeChannelId));
  }, [activeChannelId, setActivePolling]);

  const totalUnread = useMemo(
    () => Object.values(unreadByChannel).reduce((a, b) => a + b, 0),
    [unreadByChannel],
  );

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId],
  );

  /* Reset search when channel changes. */
  useEffect(() => { setSearchQuery(''); }, [activeChannelId]);

  const enableNotifications = useCallback(async (): Promise<notify.NotificationsPermission> => {
    if (!notify.isSupported()) return 'unsupported';
    let perm = notify.getPermission();
    if (perm === 'default') {
      perm = await notify.requestPermission();
    }
    setNotificationsPermission(perm);
    if (perm === 'granted') {
      notify.setEnabledStored(true);
      setNotificationsEnabledState(true);
    }
    return perm;
  }, []);

  const disableNotifications = useCallback((): void => {
    notify.setEnabledStored(false);
    setNotificationsEnabledState(false);
  }, []);

  /* Re-sync permission when tab is refocused (user might've changed it in
   * browser settings). */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = (): void => {
      if (document.visibilityState === 'visible') {
        setNotificationsPermission(notify.getPermission());
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const value = useMemo<WorkChatContextValue>(() => ({
    me, isAdmin,
    channels, activeChannelId, activeChannel, setActiveChannel,
    messages, send, deleteMessage, toggleReaction, pinMessage, unpinMessage,
    createChannel, deleteChannel, updateChannelTopic,
    unreadByChannel, totalUnread, reads, markActiveChannelRead,
    loadError, loading,
    searchQuery, setSearchQuery,
    notificationsSupported, notificationsPermission, notificationsEnabled,
    enableNotifications, disableNotifications,
  }), [
    me, isAdmin,
    channels, activeChannelId, activeChannel, setActiveChannel,
    messages, send, deleteMessage, toggleReaction, pinMessage, unpinMessage,
    createChannel, deleteChannel, updateChannelTopic,
    unreadByChannel, totalUnread, reads, markActiveChannelRead,
    loadError, loading,
    searchQuery,
    notificationsSupported, notificationsPermission, notificationsEnabled,
    enableNotifications, disableNotifications,
  ]);

  return <WorkChatContext.Provider value={value}>{children}</WorkChatContext.Provider>;
};

export function useWorkChat(): WorkChatContextValue {
  const ctx = useContext(WorkChatContext);
  if (!ctx) throw new Error('useWorkChat must be used inside <WorkChatProvider>');
  return ctx;
}
