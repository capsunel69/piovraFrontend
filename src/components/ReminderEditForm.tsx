import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import type { Reminder } from '../types';
import {
  Stack,
  Row,
  Field,
  FieldGroup,
  Label,
  Input,
  Select,
  Textarea,
  Button,
} from './ui/primitives';
import { IconCheck, IconX, IconEdit } from './ui/icons';

interface ReminderEditFormProps {
  reminder: Reminder;
  onSave: (reminderId: string, updatedReminder: Partial<Reminder>) => void;
  onCancel: () => void;
}

const Wrap = styled.div`
  padding: var(--s-4) var(--s-5);
  background: var(--bg-3);
  border-left: 2px solid var(--accent);
  border-top: 1px solid var(--border-1);

  &:first-child { border-top: none; }
`;

const Heading = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: var(--s-3);

  svg { width: 14px; height: 14px; color: var(--accent); }
`;

const RecurringBox = styled.div<{ $hidden?: boolean }>`
  display: ${({ $hidden }) => ($hidden ? 'none' : 'block')};
  background: var(--bg-1);
  border: 1px dashed var(--border-1);
  border-radius: var(--r-md);
  padding: var(--s-3);
`;

function toLocalDatetimeValue(value: Date | string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const ReminderEditForm: React.FC<ReminderEditFormProps> = ({ reminder, onSave, onCancel }) => {
  const [title, setTitle] = useState(reminder.title);
  const [description, setDescription] = useState(reminder.description ?? '');
  const [date, setDate] = useState(toLocalDatetimeValue(reminder.date));
  const [recurring, setRecurring] = useState(reminder.recurring || '');
  const [recurringSubtype, setRecurringSubtype] = useState<'dayOfMonth' | 'relativeDay'>(
    reminder.recurringConfig?.subtype || 'dayOfMonth'
  );
  const [dayOfWeek, setDayOfWeek] = useState(
    reminder.recurringConfig?.dayOfWeek?.toString() || '1'
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    reminder.recurringConfig?.dayOfMonth?.toString() || '1'
  );
  const [weekNum, setWeekNum] = useState(
    reminder.recurringConfig?.weekNum?.toString() || '1'
  );

  useEffect(() => {
    setTitle(reminder.title);
    setDescription(reminder.description ?? '');
    setDate(toLocalDatetimeValue(reminder.date));
    setRecurring(reminder.recurring || '');
    setRecurringSubtype(reminder.recurringConfig?.subtype || 'dayOfMonth');
    setDayOfWeek(reminder.recurringConfig?.dayOfWeek?.toString() || '1');
    setDayOfMonth(reminder.recurringConfig?.dayOfMonth?.toString() || '1');
    setWeekNum(reminder.recurringConfig?.weekNum?.toString() || '1');
  }, [reminder]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const updatedReminder: Partial<Reminder> = {
      title: title.trim(),
      description,
      date: date ? new Date(date) : undefined,
    };

    if (!recurring) {
      updatedReminder.recurring = '';
      updatedReminder.recurringConfig = null;
    } else {
      updatedReminder.recurring = recurring as Reminder['recurring'];
      if (recurring === 'weekly') {
        updatedReminder.recurringConfig = {
          type: 'weekly',
          dayOfWeek: parseInt(dayOfWeek, 10),
        };
      } else if (recurring === 'monthly') {
        if (recurringSubtype === 'dayOfMonth') {
          updatedReminder.recurringConfig = {
            type: 'monthly',
            subtype: 'dayOfMonth',
            dayOfMonth: parseInt(dayOfMonth, 10),
          };
        } else {
          updatedReminder.recurringConfig = {
            type: 'monthly',
            subtype: 'relativeDay',
            dayOfWeek: parseInt(dayOfWeek, 10),
            weekNum: parseInt(weekNum, 10),
          };
        }
      } else {
        updatedReminder.recurringConfig = null;
      }
    }

    onSave(reminder.id, updatedReminder);
  };

  return (
    <Wrap>
      <Heading><IconEdit /> Edit reminder</Heading>
      <form onSubmit={handleSubmit}>
        <Stack $gap={3}>
          <Field>
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>

          <Field>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>

          <FieldGroup $cols={2}>
            <Field>
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required={recurring === ''}
              />
            </Field>
            <Field>
              <Label htmlFor="edit-recurring">Recurring</Label>
              <Select
                id="edit-recurring"
                value={recurring}
                onChange={(e) => setRecurring(e.target.value)}
              >
                <option value="">Not recurring</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>
          </FieldGroup>

          <RecurringBox $hidden={recurring !== 'weekly' && recurring !== 'monthly'}>
            {recurring === 'weekly' && (
              <Field>
                <Label htmlFor="edit-dayOfWeek">Day of week</Label>
                <Select
                  id="edit-dayOfWeek"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </Select>
              </Field>
            )}

            {recurring === 'monthly' && (
              <Stack $gap={3}>
                <Field>
                  <Label htmlFor="edit-recurringSubtype">Type</Label>
                  <Select
                    id="edit-recurringSubtype"
                    value={recurringSubtype}
                    onChange={(e) =>
                      setRecurringSubtype(e.target.value as 'dayOfMonth' | 'relativeDay')
                    }
                  >
                    <option value="dayOfMonth">Day of month</option>
                    <option value="relativeDay">Relative day</option>
                  </Select>
                </Field>

                {recurringSubtype === 'dayOfMonth' ? (
                  <Field>
                    <Label htmlFor="edit-dayOfMonth">Day of month</Label>
                    <Select
                      id="edit-dayOfMonth"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(e.target.value)}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day.toString()}>
                          {day}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <FieldGroup $cols={2}>
                    <Field>
                      <Label htmlFor="edit-weekNum">Week</Label>
                      <Select
                        id="edit-weekNum"
                        value={weekNum}
                        onChange={(e) => setWeekNum(e.target.value)}
                      >
                        <option value="1">First</option>
                        <option value="2">Second</option>
                        <option value="3">Third</option>
                        <option value="4">Fourth</option>
                        <option value="-1">Last</option>
                      </Select>
                    </Field>
                    <Field>
                      <Label htmlFor="edit-relDayOfWeek">Day</Label>
                      <Select
                        id="edit-relDayOfWeek"
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(e.target.value)}
                      >
                        <option value="0">Sunday</option>
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                      </Select>
                    </Field>
                  </FieldGroup>
                )}
              </Stack>
            )}
          </RecurringBox>

          <Row $gap={2} style={{ justifyContent: 'flex-end' }}>
            <Button type="button" $variant="ghost" onClick={onCancel}>
              <IconX size={14} /> Cancel
            </Button>
            <Button type="submit" $variant="primary" disabled={!title.trim()}>
              <IconCheck size={14} /> Save changes
            </Button>
          </Row>
        </Stack>
      </form>
    </Wrap>
  );
};

export default ReminderEditForm;
