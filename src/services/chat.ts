/**
 * Work-chat service.
 *
 * Designed as a thin transport layer so the UI doesn't care whether messages
 * live in localStorage (current) or a future Piovra REST + WebSocket layer.
 *
 * Today's backend = localStorage with a BroadcastChannel pub/sub so multiple
 * tabs / windows on the same browser see live updates. When Piovra ships
 * chat endpoints (`/v1/chat/channels`, `/v1/chat/messages`, SSE/WS), only this
 * file changes: `subscribe`, `listChannels`, `sendMessage`, etc. become
 * network calls; the UI / context stays untouched.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ChatChannel,
  ChatMessage,
  ChannelReadState,
  LinkPreviewData,
  ChatGifAttachment,
  ChatUser,
} from '../types';

const LS_KEYS = {
  channels: 'workchat.channels',
  messages: 'workchat.messages',
  reads: 'workchat.reads',
  linkPreviews: 'workchat.linkPreviews',
} as const;

const BROADCAST_NAME = 'workchat';

type ChatEvent =
  | { type: 'channels.changed' }
  | { type: 'messages.changed'; channelId: string }
  | { type: 'reads.changed' };

type Listener = (e: ChatEvent) => void;

const listeners = new Set<Listener>();
let bc: BroadcastChannel | null = null;

const supportsBroadcast = typeof window !== 'undefined' && 'BroadcastChannel' in window;
if (supportsBroadcast) {
  bc = new BroadcastChannel(BROADCAST_NAME);
  bc.onmessage = (ev) => {
    const data = ev.data as ChatEvent | undefined;
    if (data) emit(data, false);
  };
}

function emit(e: ChatEvent, alsoBroadcast = true): void {
  for (const l of listeners) {
    try { l(e); } catch (err) { console.warn('[chat] listener failed', err); }
  }
  if (alsoBroadcast && bc) bc.postMessage(e);
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[chat] failed writing ${key}`, err);
  }
}

/* ── Public API ────────────────────────────────────────────────────── */

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function listChannels(): ChatChannel[] {
  const list = read<ChatChannel[]>(LS_KEYS.channels, []);
  return list.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export function createChannel(input: {
  name: string;
  topic?: string;
  createdBy: string;
}): ChatChannel {
  const cleaned = input.name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!cleaned) throw new Error('Channel name must contain letters or numbers.');
  const channels = listChannels();
  if (channels.some((c) => c.name === cleaned)) {
    throw new Error(`A channel called #${cleaned} already exists.`);
  }
  const ch: ChatChannel = {
    id: uuidv4(),
    name: cleaned,
    topic: input.topic?.trim() ?? '',
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    pinnedMessageIds: [],
  };
  write(LS_KEYS.channels, [...channels, ch]);
  emit({ type: 'channels.changed' });
  return ch;
}

export function updateChannel(id: string, patch: Partial<Pick<ChatChannel, 'topic'>>): void {
  const channels = listChannels().map((c) => (c.id === id ? { ...c, ...patch } : c));
  write(LS_KEYS.channels, channels);
  emit({ type: 'channels.changed' });
}

export function deleteChannel(id: string): void {
  const channels = listChannels().filter((c) => c.id !== id);
  write(LS_KEYS.channels, channels);
  const all = readAllMessages();
  delete all[id];
  write(LS_KEYS.messages, all);
  emit({ type: 'channels.changed' });
  emit({ type: 'messages.changed', channelId: id });
}

function readAllMessages(): Record<string, ChatMessage[]> {
  return read<Record<string, ChatMessage[]>>(LS_KEYS.messages, {});
}

export function listMessages(channelId: string): ChatMessage[] {
  return readAllMessages()[channelId] ?? [];
}

export function sendMessage(input: {
  channelId: string;
  author: ChatUser;
  text: string;
  gif?: ChatGifAttachment;
}): ChatMessage {
  const msg: ChatMessage = {
    id: uuidv4(),
    channelId: input.channelId,
    authorId: input.author.id,
    authorName: input.author.name,
    authorPictureUrl: input.author.pictureUrl,
    text: input.text,
    gif: input.gif,
    createdAt: new Date().toISOString(),
    reactions: {},
  };
  const all = readAllMessages();
  all[input.channelId] = [...(all[input.channelId] ?? []), msg];
  write(LS_KEYS.messages, all);
  emit({ type: 'messages.changed', channelId: input.channelId });
  return msg;
}

export function deleteMessage(channelId: string, messageId: string): void {
  const all = readAllMessages();
  const list = all[channelId];
  if (!list) return;
  all[channelId] = list.filter((m) => m.id !== messageId);
  write(LS_KEYS.messages, all);

  const channels = listChannels().map((c) =>
    c.id === channelId
      ? { ...c, pinnedMessageIds: c.pinnedMessageIds.filter((id) => id !== messageId) }
      : c,
  );
  write(LS_KEYS.channels, channels);

  emit({ type: 'messages.changed', channelId });
  emit({ type: 'channels.changed' });
}

export function toggleReaction(
  channelId: string,
  messageId: string,
  emoji: string,
  userId: string,
): void {
  const all = readAllMessages();
  const list = all[channelId];
  if (!list) return;
  all[channelId] = list.map((m) => {
    if (m.id !== messageId) return m;
    const cur = new Set(m.reactions[emoji] ?? []);
    if (cur.has(userId)) cur.delete(userId);
    else cur.add(userId);
    const nextReactions = { ...m.reactions };
    if (cur.size === 0) delete nextReactions[emoji];
    else nextReactions[emoji] = [...cur];
    return { ...m, reactions: nextReactions };
  });
  write(LS_KEYS.messages, all);
  emit({ type: 'messages.changed', channelId });
}

export function pinMessage(channelId: string, messageId: string, pinnerId: string): void {
  const channels = listChannels();
  const ch = channels.find((c) => c.id === channelId);
  if (!ch) return;
  if (ch.pinnedMessageIds.includes(messageId)) return;
  const nextChannels = channels.map((c) =>
    c.id === channelId
      ? { ...c, pinnedMessageIds: [messageId, ...c.pinnedMessageIds] }
      : c,
  );
  write(LS_KEYS.channels, nextChannels);

  const all = readAllMessages();
  if (all[channelId]) {
    all[channelId] = all[channelId].map((m) =>
      m.id === messageId
        ? { ...m, pinnedAt: new Date().toISOString(), pinnedBy: pinnerId }
        : m,
    );
    write(LS_KEYS.messages, all);
  }

  emit({ type: 'channels.changed' });
  emit({ type: 'messages.changed', channelId });
}

export function unpinMessage(channelId: string, messageId: string): void {
  const channels = listChannels().map((c) =>
    c.id === channelId
      ? { ...c, pinnedMessageIds: c.pinnedMessageIds.filter((id) => id !== messageId) }
      : c,
  );
  write(LS_KEYS.channels, channels);

  const all = readAllMessages();
  if (all[channelId]) {
    all[channelId] = all[channelId].map((m) =>
      m.id === messageId ? { ...m, pinnedAt: undefined, pinnedBy: undefined } : m,
    );
    write(LS_KEYS.messages, all);
  }

  emit({ type: 'channels.changed' });
  emit({ type: 'messages.changed', channelId });
}

/* ── Read receipts ─────────────────────────────────────────────────── */

function readsKey(userId: string): string {
  return `${LS_KEYS.reads}:${userId}`;
}

export function getReads(userId: string): ChannelReadState[] {
  return read<ChannelReadState[]>(readsKey(userId), []);
}

export function markChannelRead(userId: string, channelId: string, at = new Date().toISOString()): void {
  const cur = getReads(userId);
  const idx = cur.findIndex((r) => r.channelId === channelId);
  if (idx >= 0) {
    if (cur[idx].lastReadAt >= at) return;
    cur[idx] = { channelId, lastReadAt: at };
  } else {
    cur.push({ channelId, lastReadAt: at });
  }
  write(readsKey(userId), cur);
  emit({ type: 'reads.changed' });
}

/* ── Seeding ───────────────────────────────────────────────────────── */

/** Create a default `#general` channel the first time the workspace loads. */
export function ensureDefaultChannel(adminId: string): ChatChannel {
  const existing = listChannels();
  if (existing.length > 0) return existing[0];
  return createChannel({
    name: 'general',
    topic: 'Team-wide chatter.',
    createdBy: adminId,
  });
}

/* ── Link preview (Microlink, free tier, no key) ───────────────────── */

const LINK_PREVIEW_TTL_MS = 6 * 60 * 60 * 1000; // 6h cache

interface LinkPreviewCacheEntry {
  fetchedAt: number;
  data: LinkPreviewData;
}

function readPreviewCache(): Record<string, LinkPreviewCacheEntry> {
  return read<Record<string, LinkPreviewCacheEntry>>(LS_KEYS.linkPreviews, {});
}

function writePreviewCache(c: Record<string, LinkPreviewCacheEntry>): void {
  write(LS_KEYS.linkPreviews, c);
}

export function detectLinks(text: string): string[] {
  const re = /https?:\/\/[^\s<>"']+/gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.add(m[0]);
  return [...out];
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  const cache = readPreviewCache();
  const hit = cache[url];
  if (hit && Date.now() - hit.fetchedAt < LINK_PREVIEW_TTL_MS) {
    return hit.data;
  }
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`microlink ${res.status}`);
    const json = (await res.json()) as {
      status: string;
      data?: {
        title?: string | null;
        description?: string | null;
        image?: { url?: string | null } | null;
        publisher?: string | null;
      };
    };
    const d = json.data ?? {};
    const data: LinkPreviewData = {
      url,
      title: d.title ?? null,
      description: d.description ?? null,
      image: d.image?.url ?? null,
      siteName: d.publisher ?? null,
    };
    cache[url] = { fetchedAt: Date.now(), data };
    writePreviewCache(cache);
    return data;
  } catch {
    const failed: LinkPreviewData = {
      url,
      title: null,
      description: null,
      image: null,
      siteName: null,
      failed: true,
    };
    cache[url] = { fetchedAt: Date.now(), data: failed };
    writePreviewCache(cache);
    return failed;
  }
}

/* ── GIF search (Tenor — requires VITE_TENOR_API_KEY) ──────────────── */

const TENOR_KEY = (import.meta.env.VITE_TENOR_API_KEY as string | undefined) ?? '';

export const gifSearchEnabled = Boolean(TENOR_KEY);

interface TenorMediaFormat { url: string; dims: [number, number] }
interface TenorResult {
  id: string;
  content_description?: string;
  media_formats?: {
    gif?: TenorMediaFormat;
    tinygif?: TenorMediaFormat;
    nanogif?: TenorMediaFormat;
  };
}

export async function searchGifs(query: string, limit = 24): Promise<ChatGifAttachment[]> {
  if (!TENOR_KEY) return [];
  const q = query.trim();
  const url = q
    ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&client_key=piovra-work&limit=${limit}&media_filter=gif,tinygif&contentfilter=high`
    : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&client_key=piovra-work&limit=${limit}&media_filter=gif,tinygif&contentfilter=high`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tenor ${res.status}`);
  const json = (await res.json()) as { results?: TenorResult[] };
  return (json.results ?? [])
    .map((r) => {
      const full = r.media_formats?.gif;
      const preview = r.media_formats?.tinygif ?? r.media_formats?.nanogif ?? full;
      if (!full || !preview) return null;
      return {
        url: full.url,
        previewUrl: preview.url,
        width: full.dims?.[0] ?? 200,
        height: full.dims?.[1] ?? 200,
        alt: r.content_description ?? 'GIF',
      } satisfies ChatGifAttachment;
    })
    .filter((g): g is ChatGifAttachment => g !== null);
}
