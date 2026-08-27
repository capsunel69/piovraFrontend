import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { format, isSameDay, isValid } from 'date-fns';
import { useAppContext } from '../context/AppContext';
import LinkifyText from '../components/shared/LinkifyText';
import ReminderEditForm from '../components/ReminderEditForm';
import {
  PageContainer, PageHeader, PageTitle, PageSubtitle,
  Card, CardHeader, CardTitle, CardSubtle, CardBody,
  Button, IconButton, Badge, Checkbox, EmptyState, Select,
  Composer, ComposerTitle, ComposerBody, ComposerToolbar, ComposerSpacer,
  Chip, ChipGroup, GhostInput,
} from '../components/ui/primitives';
import {
  IconBell, IconPlus, IconTrash, IconRepeat, IconClock, IconEdit, IconCheck, IconX,
} from '../components/ui/icons';
import type { Reminder } from '../types';

const ReminderRow = styled.div<{ $today?: boolean; $converted?: boolean; $selected?: boolean }>`
  padding: var(--s-4) var(--s-5);
  display: flex;
  gap: var(--s-3);
  align-items: flex-start;
  border-top: 1px solid var(--border-1);
  position: relative;
  background: ${p => p.$selected ? 'color-mix(in oklab, var(--accent) 8%, transparent)' : 'transparent'};

  &:first-child { border-top: none; }
  &:hover { background: ${p => p.$selected ? 'color-mix(in oklab, var(--accent) 12%, var(--bg-3))' : 'var(--bg-3)'}; }

  ${p => p.$today && `
    &:before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 2px;
      background: var(--success);
    }
  `}
  ${p => p.$converted && `opacity: 0.65;`}

  @media (max-width: 720px) {
    padding: var(--s-3);
    gap: var(--s-2);
    flex-wrap: wrap;
  }
`;

const Title = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
`;

const Description = styled.div`
  font-size: 13px;
  color: var(--text-2);
  margin: 6px 0 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
`;

const BulkBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s-2);
  padding: var(--s-3) var(--s-5);
  border-bottom: 1px solid var(--border-1);
  background: color-mix(in oklab, var(--accent) 10%, var(--bg-2));

  .count {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    margin-right: 4px;
  }

  @media (max-width: 720px) {
    padding: var(--s-3);
  }
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
  font-size: 12px;
  color: var(--text-3);
  margin-top: var(--s-2);
  font-variant-numeric: tabular-nums;

  span { display: flex; align-items: center; gap: 6px; }
  svg { width: 13px; height: 13px; }
`;

const Body = styled.div` flex: 1; min-width: 0; `;

const Actions = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;

  @media (max-width: 720px) {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
    margin-top: 4px;
  }
`;

const daysOfWeek = [
  { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
];

const weekNumbers = [
  { value: 1, label: 'First' }, { value: 2, label: 'Second' }, { value: 3, label: 'Third' },
  { value: 4, label: 'Fourth' }, { value: -1, label: 'Last' },
];

function parseReminderDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string | Date);
  return isValid(d) ? d : null;
}

function applyTime(target: Date, time: string) {
  if (!time) return;
  const [h, m] = time.split(':').map(Number);
  if (Number.isFinite(h) && Number.isFinite(m)) target.setHours(h, m, 0, 0);
}

/** Notes are notes — show markdown checkboxes as bullets, not fake controls. */
function displayNotes(text: string): string {
  return text.replace(/^(\s*)(?:[-*]|\d+\.)\s+\[[ xX]\]\s?/gm, '$1• ');
}

function isReminderCompleted(r: Reminder, currentDate: Date): boolean {
  if (!r.recurring) return r.completed;
  const t = new Date(currentDate);
  t.setHours(0, 0, 0, 0);
  return (r.completedInstances || []).some((d) => {
    const instance = parseReminderDate(d);
    return instance ? isSameDay(instance, t) : false;
  });
}

const Reminders: React.FC = () => {
  const {
    reminders,
    addReminder,
    updateReminder,
    deleteReminder,
    toggleReminderCompletion,
    convertReminderToTask,
    currentDate,
  } = useAppContext();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [recurring, setRecurring] = useState<'' | 'daily' | 'weekly' | 'monthly'>('');
  const [weeklyDay, setWeeklyDay] = useState<number>(1);
  const [monthlyType, setMonthlyType] = useState<'dayOfMonth' | 'relativeDay'>('dayOfMonth');
  const [monthlyDay, setMonthlyDay] = useState<number>(1);
  const [monthlyWeekNum, setMonthlyWeekNum] = useState<number>(1);
  const [monthlyWeekDay, setMonthlyWeekDay] = useState<number>(1);
  const [showDate, setShowDate] = useState(true);
  const [showDescriptionField, setShowDescriptionField] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    setShowDate(recurring === '');
  }, [recurring]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIds(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const live = new Set(reminders.map((r) => r.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [reminders]);

  const reset = () => {
    setTitle(''); setDescription(''); setDate(''); setTime('');
    setRecurring(''); setWeeklyDay(1); setMonthlyType('dayOfMonth');
    setMonthlyDay(1); setMonthlyWeekNum(1); setMonthlyWeekDay(1);
    setShowDescriptionField(false);
  };

  const isReminderDueToday = (r: Reminder) => {
    if (!r.recurring) {
      const rd = parseReminderDate(r.date);
      if (!rd) return false;
      const today = new Date(currentDate);
      return rd.getFullYear() === today.getFullYear() && rd.getMonth() === today.getMonth() && rd.getDate() === today.getDate();
    }
    const now = new Date(currentDate);
    if (r.recurring === 'daily') return true;
    if (r.recurring === 'weekly' && r.recurringConfig) return now.getDay() === r.recurringConfig.dayOfWeek;
    if (r.recurring === 'monthly' && r.recurringConfig) {
      if (r.recurringConfig.subtype === 'dayOfMonth') return now.getDate() === r.recurringConfig.dayOfMonth;
      const wn = r.recurringConfig.weekNum!, dw = r.recurringConfig.dayOfWeek!;
      let target;
      if (wn === -1) {
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        let day = last.getDate();
        while (new Date(now.getFullYear(), now.getMonth(), day).getDay() !== dw) day--;
        target = new Date(now.getFullYear(), now.getMonth(), day);
      } else {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        let off = dw - first.getDay();
        if (off < 0) off += 7;
        target = new Date(now.getFullYear(), now.getMonth(), 1 + off + (wn - 1) * 7);
      }
      return isSameDay(now, target);
    }
    return false;
  };

  const previewText = () => {
    if (recurring === 'daily') return 'Repeats every day';
    if (recurring === 'weekly') return `Every ${daysOfWeek.find(d => d.value === weeklyDay)?.label}`;
    if (recurring === 'monthly' && monthlyType === 'dayOfMonth') return `Day ${monthlyDay} of every month`;
    if (recurring === 'monthly' && monthlyType === 'relativeDay') {
      const wn = weekNumbers.find(w => w.value === monthlyWeekNum)?.label;
      const wd = daysOfWeek.find(d => d.value === monthlyWeekDay)?.label;
      return `${wn} ${wd} of every month`;
    }
    return '';
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (recurring === '' && !date) return;

    const data: Omit<Reminder, 'id'> = {
      title: title.trim(),
      description: description || '',
      completed: false,
      date: new Date(),
      recurring: recurring || undefined,
    };

    if (recurring === '') {
      // Date alone is enough; missing time defaults to 09:00 local.
      const next = new Date(`${date}T${time || '09:00'}`);
      if (!isValid(next)) return;
      data.date = next;
    } else if (recurring === 'daily') {
      const now = new Date();
      applyTime(now, time);
      data.date = now;
    } else if (recurring === 'weekly') {
      data.recurringConfig = { type: 'weekly', dayOfWeek: weeklyDay, time: time || undefined };
      const now = new Date();
      const add = (weeklyDay - now.getDay() + 7) % 7;
      const next = new Date(now); next.setDate(now.getDate() + add);
      applyTime(next, time);
      data.date = next;
    } else if (recurring === 'monthly') {
      if (monthlyType === 'dayOfMonth') {
        data.recurringConfig = { type: 'monthly', subtype: 'dayOfMonth', dayOfMonth: monthlyDay, time: time || undefined };
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), monthlyDay);
        if (next < now) next.setMonth(next.getMonth() + 1);
        applyTime(next, time);
        data.date = next;
      } else {
        data.recurringConfig = { type: 'monthly', subtype: 'relativeDay', weekNum: monthlyWeekNum, dayOfWeek: monthlyWeekDay, time: time || undefined };
        const now = new Date();
        const nth = (year: number, month: number, dw: number, n: number) => {
          const first = new Date(year, month, 1);
          let off = dw - first.getDay();
          if (off < 0) off += 7;
          if (n === -1) {
            const last = new Date(year, month + 1, 0);
            let o = dw - last.getDay();
            if (o > 0) o -= 7;
            return new Date(year, month, last.getDate() + o);
          }
          return new Date(year, month, 1 + off + (n - 1) * 7);
        };
        let m = now.getMonth(), y = now.getFullYear();
        let next = nth(y, m, monthlyWeekDay, monthlyWeekNum);
        if (next < now) { m = (m + 1) % 12; if (m === 0) y++; next = nth(y, m, monthlyWeekDay, monthlyWeekNum); }
        applyTime(next, time);
        data.date = next;
      }
    }

    addReminder(data);
    reset();
  };

  const formatRecurring = (r: Reminder) => {
    if (!r.recurring) return '';
    if (r.recurring === 'daily') return 'Repeats daily';
    if (r.recurring === 'weekly' && r.recurringConfig) {
      const day = daysOfWeek.find(d => d.value === r.recurringConfig!.dayOfWeek)?.label;
      return `Every ${day}`;
    }
    if (r.recurring === 'monthly' && r.recurringConfig) {
      if (r.recurringConfig.subtype === 'dayOfMonth') return `Day ${r.recurringConfig.dayOfMonth} monthly`;
      const wn = weekNumbers.find(w => w.value === r.recurringConfig!.weekNum)?.label;
      const wd = daysOfWeek.find(d => d.value === r.recurringConfig!.dayOfWeek)?.label;
      return `${wn} ${wd} monthly`;
    }
    return r.recurring;
  };

  const selectedCount = selectedIds.size;
  const allSelected = reminders.length > 0 && selectedCount === reminders.length;

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(reminders.map((r) => r.id)));
  }, [reminders]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const bulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const label = ids.length === 1 ? 'this reminder' : `${ids.length} reminders`;
    if (!window.confirm(`Delete ${label}?`)) return;
    setBulkBusy(true);
    try {
      for (const id of ids) await deleteReminder(id);
      setSelectedIds(new Set());
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, deleteReminder]);

  const bulkMarkDone = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      for (const id of ids) {
        const r = reminders.find((x) => x.id === id);
        if (!r || isReminderCompleted(r, currentDate)) continue;
        await toggleReminderCompletion(id);
      }
      setSelectedIds(new Set());
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, reminders, currentDate, toggleReminderCompletion]);

  const canSubmit = Boolean(title.trim()) && (recurring !== '' || Boolean(date));

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle><IconBell /> Reminders</PageTitle>
          <PageSubtitle>One-off pings and recurring nudges</PageSubtitle>
        </div>
      </PageHeader>

      <Composer onSubmit={submit}>
        <ComposerTitle
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Remind me to…"
          required
        />
        {(showDescriptionField || description) && (
          <ComposerBody
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add notes…"
            rows={2}
          />
        )}

        <ComposerToolbar>
          <ChipGroup role="radiogroup" aria-label="Repeat">
            {(['', 'daily', 'weekly', 'monthly'] as const).map(r => (
              <Chip
                key={r || 'once'}
                type="button"
                $active={recurring === r}
                $tone="info"
                onClick={() => setRecurring(r)}
                aria-pressed={recurring === r}
              >
                {r === '' ? 'Once' : r[0].toUpperCase() + r.slice(1)}
              </Chip>
            ))}
          </ChipGroup>

          {showDate && (
            <GhostInput
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required={recurring === ''}
              aria-label="Date"
            />
          )}

          <GhostInput
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            aria-label="Time"
          />

          {recurring === 'weekly' && (
            <Select
              value={weeklyDay}
              onChange={e => setWeeklyDay(Number(e.target.value))}
              style={{ width: 'auto', height: 28, padding: '0 28px 0 10px', fontSize: 12, borderRadius: 999 }}
            >
              {daysOfWeek.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </Select>
          )}

          {recurring === 'monthly' && (
            <>
              <Select
                value={monthlyType}
                onChange={e => setMonthlyType(e.target.value as 'dayOfMonth' | 'relativeDay')}
                style={{ width: 'auto', height: 28, padding: '0 28px 0 10px', fontSize: 12, borderRadius: 999 }}
              >
                <option value="dayOfMonth">Day of month</option>
                <option value="relativeDay">Specific week</option>
              </Select>
              {monthlyType === 'dayOfMonth' ? (
                <Select
                  value={monthlyDay}
                  onChange={e => setMonthlyDay(Number(e.target.value))}
                  style={{ width: 'auto', height: 28, padding: '0 28px 0 10px', fontSize: 12, borderRadius: 999 }}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Day {d}</option>)}
                </Select>
              ) : (
                <>
                  <Select
                    value={monthlyWeekNum}
                    onChange={e => setMonthlyWeekNum(Number(e.target.value))}
                    style={{ width: 'auto', height: 28, padding: '0 28px 0 10px', fontSize: 12, borderRadius: 999 }}
                  >
                    {weekNumbers.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </Select>
                  <Select
                    value={monthlyWeekDay}
                    onChange={e => setMonthlyWeekDay(Number(e.target.value))}
                    style={{ width: 'auto', height: 28, padding: '0 28px 0 10px', fontSize: 12, borderRadius: 999 }}
                  >
                    {daysOfWeek.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </Select>
                </>
              )}
            </>
          )}

          <Chip type="button" $active={showDescriptionField} onClick={() => setShowDescriptionField(s => !s)}>
            <IconEdit /> {showDescriptionField ? 'Hide notes' : 'Notes'}
          </Chip>

          <ComposerSpacer />
          {recurring && (
            <span style={{ fontSize: 11, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconRepeat /> {previewText()}
            </span>
          )}
          {(title || description) && (
            <Chip type="button" onClick={reset}>Clear</Chip>
          )}
          <Button $variant="primary" $size="sm" type="submit" disabled={!canSubmit}>
            <IconPlus /> Add reminder
          </Button>
        </ComposerToolbar>
      </Composer>

      <Card>
        <CardHeader>
          <CardTitle><IconBell /> Active <CardSubtle>{reminders.length}</CardSubtle></CardTitle>
          {reminders.length > 0 && selectedCount === 0 && (
            <Button type="button" $size="sm" $variant="ghost" onClick={selectAll}>
              Select
            </Button>
          )}
        </CardHeader>
        {selectedCount > 0 && (
          <BulkBar>
            <span className="count">{selectedCount} selected</span>
            <Button type="button" $size="sm" $variant="ghost" onClick={allSelected ? clearSelection : selectAll} disabled={bulkBusy}>
              {allSelected ? 'Clear' : 'Select all'}
            </Button>
            <ComposerSpacer />
            <Button type="button" $size="sm" $variant="secondary" onClick={() => void bulkMarkDone()} disabled={bulkBusy}>
              <IconCheck /> Mark done
            </Button>
            <Button type="button" $size="sm" $variant="danger" onClick={() => void bulkDelete()} disabled={bulkBusy}>
              <IconTrash /> Delete
            </Button>
            <IconButton type="button" $size="sm" onClick={clearSelection} title="Clear selection" disabled={bulkBusy}>
              <IconX />
            </IconButton>
          </BulkBar>
        )}
        <CardBody>
          {reminders.length === 0 ? (
            <EmptyState><IconBell /><div>No reminders yet.</div></EmptyState>
          ) : reminders.map(reminder => {
            if (editingId === reminder.id) {
              return (
                <ReminderEditForm
                  key={reminder.id}
                  reminder={reminder}
                  onSave={(id, updates) => {
                    updateReminder(id, updates);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            const due = isReminderDueToday(reminder);
            const completedToday = isReminderCompleted(reminder, currentDate);
            const taskCreatedToday = reminder.recurring
              ? (reminder.convertedToTaskDates || []).some(d => {
                  const t = new Date(currentDate); t.setHours(0,0,0,0);
                  const converted = parseReminderDate(d);
                  return converted ? isSameDay(converted, t) : false;
                })
              : reminder.convertedToTask && due;
            const reminderDate = parseReminderDate(reminder.date);
            const selected = selectedIds.has(reminder.id);

            return (
              <ReminderRow
                key={reminder.id}
                $today={due && !completedToday && !taskCreatedToday}
                $converted={taskCreatedToday}
                $selected={selected}
              >
                <Checkbox
                  type="button"
                  $checked={selected}
                  onClick={() => toggleSelected(reminder.id)}
                  title="Select reminder"
                  aria-label={`Select ${reminder.title}`}
                  style={{ marginTop: 3 }}
                />
                <Body>
                  <Title>
                    {reminder.title}
                    {due && !completedToday && !taskCreatedToday && <Badge $variant="success">Today</Badge>}
                    {taskCreatedToday && <Badge $variant="purple">Task created</Badge>}
                    {completedToday && <Badge $variant="neutral">Done</Badge>}
                    {reminder.recurring && <Badge $variant="info"><IconRepeat /> {reminder.recurring}</Badge>}
                  </Title>
                  {reminder.description && (
                    <Description>
                      <LinkifyText text={displayNotes(reminder.description)} />
                    </Description>
                  )}
                  <MetaRow>
                    {!reminder.recurring && reminderDate && (
                      <span><IconClock /> {format(reminderDate, 'MMM d, yyyy · HH:mm')}</span>
                    )}
                    {reminder.recurring && <span><IconRepeat /> {formatRecurring(reminder)}</span>}
                  </MetaRow>
                </Body>
                <Actions>
                  {due && !taskCreatedToday && !completedToday && (
                    <Button $size="sm" $variant="ghost" onClick={() => convertReminderToTask(reminder.id)}>
                      <IconPlus /> Task
                    </Button>
                  )}
                  <IconButton $size="sm" onClick={() => setEditingId(reminder.id)} title="Edit">
                    <IconEdit />
                  </IconButton>
                  <IconButton $size="sm" $variant="danger" onClick={() => deleteReminder(reminder.id)} title="Delete">
                    <IconTrash />
                  </IconButton>
                </Actions>
              </ReminderRow>
            );
          })}
        </CardBody>
      </Card>
    </PageContainer>
  );
};

export default Reminders;
