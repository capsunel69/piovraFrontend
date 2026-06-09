import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';

export type DateRangePreset =
  | 'yesterday'
  | 'last7'
  | 'last14'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
}

const STORAGE_KEY = 'piovra-ad-date-range';

export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getDateRangeFromPreset(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
): DateRange {
  const today = new Date();
  switch (preset) {
    case 'yesterday': {
      const yesterday = subDays(today, 1);
      const iso = formatDateISO(yesterday);
      return { preset, startDate: iso, endDate: iso };
    }
    case 'last7': {
      const end = subDays(today, 1);
      const start = subDays(end, 6);
      return { preset, startDate: formatDateISO(start), endDate: formatDateISO(end) };
    }
    case 'last14': {
      const end = subDays(today, 1);
      const start = subDays(end, 13);
      return { preset, startDate: formatDateISO(start), endDate: formatDateISO(end) };
    }
    case 'thisMonth':
      return {
        preset,
        startDate: formatDateISO(startOfMonth(today)),
        endDate: formatDateISO(endOfMonth(today)),
      };
    case 'lastMonth': {
      const ref = subMonths(today, 1);
      return {
        preset,
        startDate: formatDateISO(startOfMonth(ref)),
        endDate: formatDateISO(endOfMonth(ref)),
      };
    }
    case 'custom':
      if (!customStart || !customEnd) throw new Error('Custom range needs dates');
      return { preset, startDate: customStart, endDate: customEnd };
    default:
      return getDateRangeFromPreset('last7');
  }
}

export function loadPersistedDateRange(): DateRange {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDateRangeFromPreset('last7');
    const parsed = JSON.parse(raw) as DateRange;
    if (parsed.preset === 'custom') return parsed;
    return getDateRangeFromPreset(parsed.preset);
  } catch {
    return getDateRangeFromPreset('last7');
  }
}

export function savePersistedDateRange(range: DateRange): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
}

export function getPreviousPeriodRange(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days = differenceInCalendarDays(end, start) + 1;
  const prevEnd = subDays(start, 1);
  const prevStart = subDays(prevEnd, days - 1);
  return { startDate: formatDateISO(prevStart), endDate: formatDateISO(prevEnd) };
}

export function formatPeriodRangeLabel(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} → ${endDate}`;
}

export function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cur = parseISO(startDate);
  const end = parseISO(endDate);
  while (cur <= end) {
    dates.push(formatDateISO(cur));
    cur = subDays(cur, -1);
  }
  return dates;
}

export const DATE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last14', label: 'Last 14 days' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
];
