import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Meeting } from '../../types';
import { Button, IconButton } from '../ui/primitives';
import { IconChevronLeft, IconChevronRight, IconExternal } from '../ui/icons';

interface Props {
  meetings: Meeting[];
  onPickDay: (date: Date) => void;
  onPickMeeting: (m: Meeting) => void;
}

const Wrap = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  border-bottom: 1px solid var(--border-1);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--accent) 8%, transparent),
    transparent
  );
`;

const MonthLabel = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  flex: 1;
  letter-spacing: 0.2px;
`;

const Nav = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const WeekHeader = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--bg-3);
  border-bottom: 1px solid var(--border-1);
`;

const WeekHeaderCell = styled.div`
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-3);
  text-align: center;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(110px, 1fr);
`;

const Day = styled.button<{ $today?: boolean; $outside?: boolean }>`
  position: relative;
  text-align: left;
  background: ${(p) => (p.$outside ? 'var(--bg-1)' : 'var(--bg-2)')};
  border: none;
  border-right: 1px solid var(--border-1);
  border-bottom: 1px solid var(--border-1);
  padding: 6px 8px 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--text-1);
  transition: background 0.12s ease;
  min-height: 110px;

  &:nth-child(7n) { border-right: none; }

  &:hover { background: color-mix(in oklab, var(--accent) 6%, var(--bg-2)); }

  ${(p) => p.$today && `
    background: color-mix(in oklab, var(--accent) 10%, var(--bg-2));
  `}

  @media (max-width: 720px) {
    min-height: 80px;
    padding: 4px 5px 6px;
  }
`;

const DayHeader = styled.div<{ $today?: boolean; $outside?: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: ${(p) => (p.$today ? 700 : 500)};
  color: ${(p) =>
    p.$outside ? 'var(--text-3)' : p.$today ? 'var(--accent)' : 'var(--text-2)'};
`;

const DayNumber = styled.span<{ $today?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  padding: 0 6px;
  ${(p) => p.$today && `
    background: var(--accent);
    color: var(--accent-contrast, #fff);
  `}
`;

const Events = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
`;

const Event = styled.div<{ $done?: boolean; $synced?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 1.25;
  padding: 3px 6px;
  border-radius: 4px;
  background: ${(p) =>
    p.$synced
      ? 'color-mix(in oklab, #4285F4 18%, var(--bg-3))'
      : 'color-mix(in oklab, var(--accent) 18%, var(--bg-3))'};
  border-left: 2px solid ${(p) =>
    p.$synced ? '#4285F4' : 'var(--accent)'};
  color: ${(p) => (p.$done ? 'var(--text-3)' : 'var(--text-1)')};
  text-decoration: ${(p) => (p.$done ? 'line-through' : 'none')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;

  &:hover { filter: brightness(1.08); }

  svg { flex-shrink: 0; opacity: 0.7; }
`;

const Time = styled.span`
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
`;

const MoreLink = styled.button`
  background: none;
  border: none;
  font-size: 11px;
  color: var(--text-3);
  text-align: left;
  padding: 1px 4px;
  cursor: pointer;
  &:hover { color: var(--text-1); }
`;

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MonthCalendar: React.FC<Props> = ({ meetings, onPickDay, onPickMeeting }) => {
  const [cursor, setCursor] = useState<Date>(() => new Date());

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = useMemo(() => {
    const arr: Date[] = [];
    const d = new Date(gridStart);
    while (d <= gridEnd) {
      arr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }, [gridStart, gridEnd]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const k = format(new Date(m.date), 'yyyy-MM-dd');
      const list = map.get(k) ?? [];
      list.push(m);
      map.set(k, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return map;
  }, [meetings]);

  const MAX_VISIBLE = 3;

  return (
    <Wrap>
      <Header>
        <MonthLabel>{format(cursor, 'MMMM yyyy')}</MonthLabel>
        <Nav>
          <IconButton $size="sm" $variant="ghost" onClick={() => setCursor(new Date())} title="Today">
            Today
          </IconButton>
          <IconButton
            $size="sm"
            $variant="ghost"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label="Previous month"
          >
            <IconChevronLeft />
          </IconButton>
          <IconButton
            $size="sm"
            $variant="ghost"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
          >
            <IconChevronRight />
          </IconButton>
        </Nav>
      </Header>
      <WeekHeader>
        {WEEK_DAYS.map((d) => (
          <WeekHeaderCell key={d}>{d}</WeekHeaderCell>
        ))}
      </WeekHeader>
      <Grid>
        {days.map((day) => {
          const k = format(day, 'yyyy-MM-dd');
          const items = eventsByDay.get(k) ?? [];
          const outside = !isSameMonth(day, cursor);
          const today = isToday(day);
          const visible = items.slice(0, MAX_VISIBLE);
          const extra = items.length - visible.length;
          return (
            <Day
              key={k}
              $today={today}
              $outside={outside}
              onClick={() => onPickDay(day)}
              aria-label={`${format(day, 'EEEE, MMMM d')} — ${items.length} meeting${
                items.length === 1 ? '' : 's'
              }`}
            >
              <DayHeader $today={today} $outside={outside}>
                <DayNumber $today={today}>{format(day, 'd')}</DayNumber>
                {items.some((m) => m.googleEventId) && (
                  <IconExternal size={10} aria-label="Synced with Google" />
                )}
              </DayHeader>
              <Events>
                {visible.map((m) => (
                  <Event
                    key={m.id}
                    $done={m.completed}
                    $synced={Boolean(m.googleEventId)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickMeeting(m);
                    }}
                    title={`${m.title} — ${format(new Date(m.date), 'HH:mm')}`}
                  >
                    <Time>{format(new Date(m.date), 'HH:mm')}</Time>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.title}
                    </span>
                  </Event>
                ))}
                {extra > 0 && (
                  <MoreLink
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open the first hidden meeting; user can find others in list view.
                      const first = items[MAX_VISIBLE];
                      if (first) onPickMeeting(first);
                    }}
                  >
                    +{extra} more
                  </MoreLink>
                )}
              </Events>
            </Day>
          );
        })}
      </Grid>
    </Wrap>
  );
};

export default MonthCalendar;

export const CalendarButton = Button;
