/**
 * Client-side @mention helpers for work chat.
 */

export interface MentionableUser {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  mentionHandle: string;
}

export function filterMentionCandidates(
  users: MentionableUser[],
  query: string,
  excludeUserId?: string,
): MentionableUser[] {
  const q = query.toLowerCase();
  return users
    .filter((u) => u.id !== excludeUserId)
    .filter((u) => {
      if (!q) return true;
      const handle = u.mentionHandle.toLowerCase();
      const name = u.name.toLowerCase();
      const email = u.email.toLowerCase();
      return handle.includes(q) || name.includes(q) || email.includes(q);
    })
    .slice(0, 8);
}

export function buildKnownHandles(users: MentionableUser[]): Set<string> {
  const handles = new Set<string>();
  for (const u of users) {
    handles.add(u.mentionHandle.toLowerCase());
    const local = u.email.split('@')[0]?.toLowerCase();
    if (local) handles.add(local);
    const first = u.name.split(/\s+/)[0]?.toLowerCase();
    if (first) handles.add(first);
    const compact = u.name.replace(/\s+/g, '').toLowerCase();
    if (compact) handles.add(compact);
  }
  return handles;
}

/** Find the @mention query at the textarea caret, if any. */
export function mentionQueryAtCaret(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(^|[\s(])@([a-zA-Z0-9_.-]*)$/.exec(before);
  if (!match) return null;
  const query = match[2];
  const start = caret - query.length - 1;
  return { start, query };
}

export function insertMention(
  text: string,
  start: number,
  caret: number,
  handle: string,
): { next: string; nextCaret: number } {
  const before = text.slice(0, start);
  const after = text.slice(caret);
  const token = `@${handle} `;
  const next = before + token + after;
  const nextCaret = before.length + token.length;
  return { next, nextCaret };
}
