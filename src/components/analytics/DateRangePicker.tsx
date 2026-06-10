import React, { useMemo } from 'react';
import styled from 'styled-components';
import { endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns';
import { Button } from '../ui/primitives';

export type DateRangePreset = 'yesterday' | 'last7' | 'last14' | 'thisMonth' | 'lastMonth' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
}

const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  align-items: center;
`;

const PresetBtn = styled.button<{ $active?: boolean }>`
  font-size: 12px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: var(--r-md);
  border: 1px solid ${(p) => (p.$active ? 'var(--accent)' : 'var(--border-1)')};
  background: ${(p) => (p.$active ? 'rgba(76, 194, 255, 0.12)' : 'var(--bg-2)')};
  color: ${(p) => (p.$active ? 'var(--accent)' : 'var(--text-2)')};
  cursor: pointer;
`;

const DateInput = styled.input`
  font-size: 12px;
  padding: 6px 10px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-1);
  background: var(--bg-2);
  color: var(--text-1);
`;

function formatDateISO(date: Date): string {
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
      return {
        preset,
        startDate: customStart ?? formatDateISO(subDays(today, 7)),
        endDate: customEnd ?? formatDateISO(today),
      };
    default:
      return getDateRangeFromPreset('last7');
  }
}

const PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last14', label: 'Last 14 days' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
];

interface DateRangePickerProps {
  range: DateRange;
  onChange: (range: DateRange) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  range,
  onChange,
  onRefresh,
  refreshing,
}) => {
  const label = useMemo(
    () => `${range.startDate} → ${range.endDate}`,
    [range.startDate, range.endDate],
  );

  return (
    <Wrap>
      {PRESETS.map((p) => (
        <PresetBtn
          key={p.id}
          $active={range.preset === p.id}
          onClick={() => onChange(getDateRangeFromPreset(p.id, range.startDate, range.endDate))}
        >
          {p.label}
        </PresetBtn>
      ))}
      {range.preset === 'custom' && (
        <>
          <DateInput
            type="date"
            value={range.startDate}
            onChange={(e) =>
              onChange({ ...range, startDate: e.target.value, preset: 'custom' })
            }
          />
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>to</span>
          <DateInput
            type="date"
            value={range.endDate}
            onChange={(e) =>
              onChange({ ...range, endDate: e.target.value, preset: 'custom' })
            }
          />
        </>
      )}
      <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>{label}</span>
      {onRefresh && (
        <Button $size="sm" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      )}
    </Wrap>
  );
};
