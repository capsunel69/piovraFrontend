/**
 * Work-chat REST client. All chat state lives on the Piovra server now.
 *
 * Calls go to `/v1/chat/*` with the `piovra_sid` session cookie. The UI
 * polls (`fetchUnreadSummary`, `listMessages?since=…`) to pick up new
 * messages; an SSE/WS upgrade is the natural next step.
 *
 * Link previews and GIF search are kept on the client because they're
 * third-party network calls that don't need to hit our server.
 */

import type {
  ChatChannel,
  ChatMessage,
  ChannelReadState,
  LinkPreviewData,
  ChatGifAttachment,
} from '../types';

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const BASE = `${PIOVRA_BASE_URL}/v1/chat`;

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: init.body
      ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
      : (init.headers ?? undefined),
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let parsed: { error?: string } | null = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* plain text */ }
    const msg = parsed?.error ?? text ?? `chat ${init.method ?? 'GET'} ${path} -> ${res.status}`;
    throw new ChatApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ChatApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/* ── Channels ──────────────────────────────────────────────────────────── */

export function listChannels(): Promise<ChatChannel[]> {
  return http<ChatChannel[]>('/channels');
}

export function createChannel(input: { name: string; topic?: string }): Promise<ChatChannel> {
  return http<ChatChannel>('/channels', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateChannel(id: string, patch: { topic?: string }): Promise<ChatChannel> {
  return http<ChatChannel>(`/channels/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteChannel(id: string): Promise<void> {
  return http<void>(`/channels/${id}`, { method: 'DELETE' });
}

/* ── Messages ──────────────────────────────────────────────────────────── */

export function listMessages(
  channelId: string,
  opts: { since?: string; limit?: number } = {},
): Promise<ChatMessage[]> {
  const qs = new URLSearchParams();
  if (opts.since) qs.set('since', opts.since);
  if (opts.limit !== undefined) qs.set('limit', String(opts.limit));
  const q = qs.toString();
  return http<ChatMessage[]>(`/channels/${channelId}/messages${q ? `?${q}` : ''}`);
}

export function sendMessage(input: {
  channelId: string;
  text: string;
  gif?: ChatGifAttachment;
}): Promise<ChatMessage> {
  return http<ChatMessage>(`/channels/${input.channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text: input.text, gif: input.gif }),
  });
}

export function deleteMessage(channelId: string, messageId: string): Promise<void> {
  return http<void>(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' });
}

export function toggleReaction(
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<ChatMessage> {
  return http<ChatMessage>(`/channels/${channelId}/messages/${messageId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji }),
  });
}

export function pinMessage(
  channelId: string,
  messageId: string,
): Promise<{ channel: ChatChannel; message: ChatMessage }> {
  return http(`/channels/${channelId}/messages/${messageId}/pin`, { method: 'POST' });
}

export function unpinMessage(
  channelId: string,
  messageId: string,
): Promise<{ channel: ChatChannel; message: ChatMessage }> {
  return http(`/channels/${channelId}/messages/${messageId}/unpin`, { method: 'POST' });
}

/* ── Reads / unread ────────────────────────────────────────────────────── */

export function listReads(): Promise<ChannelReadState[]> {
  return http<ChannelReadState[]>('/reads');
}

export function markChannelRead(channelId: string, lastReadAt: string): Promise<ChannelReadState> {
  return http<ChannelReadState>(`/channels/${channelId}/read`, {
    method: 'PUT',
    body: JSON.stringify({ lastReadAt }),
  });
}

export interface UnreadSummaryRow {
  channelId: string;
  unreadCount: number;
  latestAt: string | null;
}

export function fetchUnreadSummary(): Promise<UnreadSummaryRow[]> {
  return http<UnreadSummaryRow[]>('/unread');
}

/* ── Link preview (Microlink, free tier) ───────────────────────────────── */

const LS_PREVIEW_CACHE = 'workchat.linkPreviews';
const LINK_PREVIEW_TTL_MS = 6 * 60 * 60 * 1000;

interface LinkPreviewCacheEntry { fetchedAt: number; data: LinkPreviewData }

function readPreviewCache(): Record<string, LinkPreviewCacheEntry> {
  try {
    const raw = localStorage.getItem(LS_PREVIEW_CACHE);
    return raw ? (JSON.parse(raw) as Record<string, LinkPreviewCacheEntry>) : {};
  } catch {
    return {};
  }
}

function writePreviewCache(c: Record<string, LinkPreviewCacheEntry>): void {
  try { localStorage.setItem(LS_PREVIEW_CACHE, JSON.stringify(c)); } catch { /* quota */ }
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
  if (hit && Date.now() - hit.fetchedAt < LINK_PREVIEW_TTL_MS) return hit.data;
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
      url, title: null, description: null, image: null, siteName: null, failed: true,
    };
    cache[url] = { fetchedAt: Date.now(), data: failed };
    writePreviewCache(cache);
    return failed;
  }
}

/* ── GIF search (GIPHY) ────────────────────────────────────────────────── */

/* Tenor stopped accepting new API clients in Jan 2026, so we now use GIPHY.
 * The legacy `VITE_TENOR_API_KEY` env var is ignored. */

const GIPHY_KEY = (import.meta.env.VITE_GIPHY_API_KEY as string | undefined) ?? '';
export const gifSearchEnabled = Boolean(GIPHY_KEY);

interface GiphyImage { url: string; width: string; height: string }
interface GiphyResult {
  id: string;
  title?: string;
  alt_text?: string;
  images: {
    fixed_height?: GiphyImage;
    fixed_height_small?: GiphyImage;
    fixed_width?: GiphyImage;
    original?: GiphyImage;
    downsized?: GiphyImage;
  };
}

function toNum(v: string | undefined, fallback: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function searchGifs(query: string, limit = 24): Promise<ChatGifAttachment[]> {
  if (!GIPHY_KEY) return [];
  const q = query.trim();
  const params = new URLSearchParams({
    api_key: GIPHY_KEY,
    limit: String(limit),
    rating: 'pg-13',
    bundle: 'messaging_non_clips',
  });
  if (q) params.set('q', q);
  const url = q
    ? `https://api.giphy.com/v1/gifs/search?${params.toString()}`
    : `https://api.giphy.com/v1/gifs/trending?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`giphy ${res.status}`);
  const json = (await res.json()) as { data?: GiphyResult[] };
  return (json.data ?? [])
    .map((r) => {
      const full = r.images.fixed_height ?? r.images.downsized ?? r.images.original;
      const preview = r.images.fixed_height_small ?? r.images.fixed_width ?? full;
      if (!full || !preview) return null;
      return {
        url: full.url,
        previewUrl: preview.url,
        width: toNum(full.width, 200),
        height: toNum(full.height, 200),
        alt: r.alt_text ?? r.title ?? 'GIF',
      } satisfies ChatGifAttachment;
    })
    .filter((g): g is ChatGifAttachment => g !== null);
}
