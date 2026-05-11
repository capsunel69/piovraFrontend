import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useAuth } from './AuthContext';
import * as chatApi from '../services/chat';
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
  send: (text: string, gif?: ChatGifAttachment) => void;
  deleteMessage: (messageId: string) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  pinMessage: (messageId: string) => void;
  unpinMessage: (messageId: string) => void;

  createChannel: (input: { name: string; topic?: string }) => ChatChannel;
  deleteChannel: (id: string) => void;
  updateChannelTopic: (id: string, topic: string) => void;

  /** Map of channelId → unread count (messages newer than `lastReadAt`, excluding own). */
  unreadByChannel: Record<string, number>;
  /** Total across all channels (for nav badge). */
  totalUnread: number;
  reads: ChannelReadState[];
  markActiveChannelRead: () => void;
}

const WorkChatContext = createContext<WorkChatContextValue | null>(null);

const STORAGE_ACTIVE_CHANNEL = 'workchat.activeChannelId';

export const WorkChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { me: authMe } = useAuth();

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

  const [channels, setChannels] = useState<ChatChannel[]>(() => chatApi.listChannels());
  const [activeChannelId, setActiveChannelIdState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_ACTIVE_CHANNEL);
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<ChannelReadState[]>([]);

  /* Seed a #general channel the very first time we see an admin. */
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!me || !isAdmin) return;
    if (channels.length > 0) { seededRef.current = true; return; }
    chatApi.ensureDefaultChannel(me.id);
    seededRef.current = true;
    setChannels(chatApi.listChannels());
  }, [me, isAdmin, channels.length]);

  /* Subscribe to chat events (cross-tab via BroadcastChannel). */
  useEffect(() => {
    const unsub = chatApi.subscribe((e) => {
      if (e.type === 'channels.changed') {
        setChannels(chatApi.listChannels());
      } else if (e.type === 'messages.changed') {
        if (e.channelId === activeChannelId) {
          setMessages(chatApi.listMessages(e.channelId));
        }
        // Recompute unread badges regardless of active channel.
        setChannels(chatApi.listChannels());
      } else if (e.type === 'reads.changed') {
        if (me) setReads(chatApi.getReads(me.id));
      }
    });
    return unsub;
  }, [activeChannelId, me]);

  /* Load reads for current user. */
  useEffect(() => {
    if (me) setReads(chatApi.getReads(me.id));
    else setReads([]);
  }, [me]);

  /* Pick an active channel if none set. */
  useEffect(() => {
    if (channels.length === 0) {
      setActiveChannelIdState(null);
      return;
    }
    if (!activeChannelId || !channels.some((c) => c.id === activeChannelId)) {
      const first = channels[0].id;
      setActiveChannelIdState(first);
      localStorage.setItem(STORAGE_ACTIVE_CHANNEL, first);
    }
  }, [channels, activeChannelId]);

  /* Load messages whenever active channel changes. */
  useEffect(() => {
    if (!activeChannelId) {
      setMessages([]);
      return;
    }
    setMessages(chatApi.listMessages(activeChannelId));
  }, [activeChannelId]);

  const setActiveChannel = useCallback((id: string) => {
    setActiveChannelIdState(id);
    localStorage.setItem(STORAGE_ACTIVE_CHANNEL, id);
  }, []);

  const send = useCallback((text: string, gif?: ChatGifAttachment) => {
    if (!me || !activeChannelId) return;
    const trimmed = text.trim();
    if (!trimmed && !gif) return;
    chatApi.sendMessage({ channelId: activeChannelId, author: me, text: trimmed, gif });
    chatApi.markChannelRead(me.id, activeChannelId);
  }, [me, activeChannelId]);

  const deleteMessage = useCallback((messageId: string) => {
    if (!activeChannelId) return;
    chatApi.deleteMessage(activeChannelId, messageId);
  }, [activeChannelId]);

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    if (!me || !activeChannelId) return;
    chatApi.toggleReaction(activeChannelId, messageId, emoji, me.id);
  }, [me, activeChannelId]);

  const pinMessage = useCallback((messageId: string) => {
    if (!me || !activeChannelId) return;
    chatApi.pinMessage(activeChannelId, messageId, me.id);
  }, [me, activeChannelId]);

  const unpinMessage = useCallback((messageId: string) => {
    if (!activeChannelId) return;
    chatApi.unpinMessage(activeChannelId, messageId);
  }, [activeChannelId]);

  const createChannel = useCallback((input: { name: string; topic?: string }): ChatChannel => {
    if (!me) throw new Error('Sign in to create a channel.');
    if (!isAdmin) throw new Error('Only admins can create channels.');
    const ch = chatApi.createChannel({ name: input.name, topic: input.topic, createdBy: me.id });
    setActiveChannel(ch.id);
    return ch;
  }, [me, isAdmin, setActiveChannel]);

  const deleteChannel = useCallback((id: string) => {
    if (!isAdmin) return;
    chatApi.deleteChannel(id);
  }, [isAdmin]);

  const updateChannelTopic = useCallback((id: string, topic: string) => {
    if (!isAdmin) return;
    chatApi.updateChannel(id, { topic });
  }, [isAdmin]);

  const markActiveChannelRead = useCallback(() => {
    if (!me || !activeChannelId) return;
    chatApi.markChannelRead(me.id, activeChannelId);
  }, [me, activeChannelId]);

  /* Auto-mark active channel as read when its messages update. */
  useEffect(() => {
    if (!me || !activeChannelId || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    chatApi.markChannelRead(me.id, activeChannelId, latest.createdAt);
  }, [me, activeChannelId, messages]);

  const unreadByChannel = useMemo<Record<string, number>>(() => {
    if (!me) return {};
    const out: Record<string, number> = {};
    const readMap = new Map(reads.map((r) => [r.channelId, r.lastReadAt]));
    for (const ch of channels) {
      const msgs = ch.id === activeChannelId ? messages : chatApi.listMessages(ch.id);
      const since = readMap.get(ch.id) ?? '';
      let count = 0;
      for (const m of msgs) {
        if (m.authorId === me.id) continue;
        if (m.createdAt > since) count++;
      }
      out[ch.id] = count;
    }
    return out;
  }, [channels, messages, activeChannelId, reads, me]);

  const totalUnread = useMemo(
    () => Object.values(unreadByChannel).reduce((a, b) => a + b, 0),
    [unreadByChannel],
  );

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId],
  );

  const value = useMemo<WorkChatContextValue>(() => ({
    me, isAdmin,
    channels, activeChannelId, activeChannel, setActiveChannel,
    messages, send, deleteMessage, toggleReaction, pinMessage, unpinMessage,
    createChannel, deleteChannel, updateChannelTopic,
    unreadByChannel, totalUnread, reads, markActiveChannelRead,
  }), [
    me, isAdmin,
    channels, activeChannelId, activeChannel, setActiveChannel,
    messages, send, deleteMessage, toggleReaction, pinMessage, unpinMessage,
    createChannel, deleteChannel, updateChannelTopic,
    unreadByChannel, totalUnread, reads, markActiveChannelRead,
  ]);

  return <WorkChatContext.Provider value={value}>{children}</WorkChatContext.Provider>;
};

export function useWorkChat(): WorkChatContextValue {
  const ctx = useContext(WorkChatContext);
  if (!ctx) throw new Error('useWorkChat must be used inside <WorkChatProvider>');
  return ctx;
}
