import { format, isSameDay } from 'date-fns';

/** Compact stamp for chat bubbles. Full locale string is the tooltip. */
export function formatBubbleTime(iso: string | null | undefined): { label: string; title: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const label = isSameDay(d, new Date()) ? format(d, 'HH:mm') : format(d, 'MMM d, HH:mm');
  return { label, title: d.toLocaleString() };
}
