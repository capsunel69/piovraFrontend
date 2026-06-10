const RO_LOCALE = 'ro-RO';

/** "2026-06-10" or Date → "10/06/2026" */
export function formatDateRo(value: string | number | Date): string {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(RO_LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Date/timestamp → "10/06/2026, 13:30" */
export function formatDateTimeRo(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(RO_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "2026-06-10" → "10/06" (short, for chart axes) */
export function formatDayMonthRo(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}`;
}
