/**
 * Desktop notifications for the work chat.
 *
 * Uses the standard Web Notifications API — no service worker required.
 * Permission grants survive across sessions; the user's "enabled" toggle
 * is persisted in localStorage so they can mute the app without revoking
 * the OS-level permission.
 *
 * When the tab is focused and viewing the same channel the message
 * arrived in, we suppress the notification (matches WhatsApp/Slack).
 */

import type { ChatMessage, ChatChannel } from '../types';

const LS_ENABLED_KEY = 'workchat.notifications.enabled';

export type NotificationsPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermission(): NotificationsPermission {
  if (!isSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationsPermission> {
  if (!isSupported()) return 'unsupported';
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission;
  }
}

export function isEnabledStored(): boolean {
  try {
    return localStorage.getItem(LS_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setEnabledStored(enabled: boolean): void {
  try {
    localStorage.setItem(LS_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    /* private mode / quota — best effort */
  }
}

interface ShowMessageOpts {
  message: ChatMessage;
  channel: ChatChannel | null;
  onClick?: () => void;
}

/**
 * Build a short preview line for a message.
 *
 * Long messages get truncated; GIF-only messages render as "🎞 GIF".
 */
function buildBody(msg: ChatMessage): string {
  const max = 140;
  const text = (msg.text ?? '').trim();
  if (text) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }
  if (msg.gif) return '🎞 GIF';
  return '(empty message)';
}

export function showMessageNotification(opts: ShowMessageOpts): void {
  if (!isSupported()) return;
  if (Notification.permission !== 'granted') return;

  const { message, channel, onClick } = opts;
  const channelLabel = channel ? `#${channel.name}` : 'Chat';
  const title = `${message.authorName} — ${channelLabel}`;
  const body = buildBody(message);

  try {
    const n = new Notification(title, {
      body,
      icon: message.authorPictureUrl ?? '/favicon.svg',
      tag: `chat:${message.channelId}`,
      silent: false,
    });

    n.onclick = () => {
      try { window.focus(); } catch { /* noop */ }
      onClick?.();
      n.close();
    };
  } catch {
    /* Firing notifications can throw in odd browser states — never crash. */
  }
}
