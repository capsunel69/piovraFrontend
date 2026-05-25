import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { format, formatDistanceToNow } from 'date-fns';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MeetingsAPI } from '../services/api';
import type { Meeting, CalendarStatus } from '../types';
import LinkifyText from '../components/shared/LinkifyText';
import { useToast } from '../components/ui/Toast';
import {
  PageContainer, PageHeader, PageTitle, PageSubtitle,
  Card, CardHeader, CardTitle, CardSubtle, CardBody, CardSection,
  Button, IconButton, Badge, Checkbox, EmptyState,
  Stack, Row, Textarea, Input,
  ModalOverlay, ModalCard,
  Composer, ComposerTitle, ComposerBody, ComposerToolbar, ComposerSpacer,
  Chip, GhostInput,
} from '../components/ui/primitives';
import {
  IconCalendar, IconPlus, IconTrash, IconEdit, IconClock, IconUsers, IconX,
  IconRefresh, IconExternal, IconGrid, IconList, IconSpark,
} from '../components/ui/icons';
import MonthCalendar from '../components/meetings/MonthCalendar';

const ViewToggle = styled.div`
  display: inline-flex;
  background: var(--bg-3);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  padding: 3px;
  gap: 2px;
`;

const ViewBtn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  border-radius: calc(var(--r-md) - 4px);
  border: none;
  cursor: pointer;
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-3)')};
  background: ${(p) => (p.$active ? 'var(--bg-1)' : 'transparent')};
  box-shadow: ${(p) => (p.$active ? '0 1px 2px rgba(0,0,0,0.15)' : 'none')};
  transition: background 0.12s ease, color 0.12s ease;

  &:hover { color: var(--text-1); }
  svg { width: 14px; height: 14px; }
`;

const ConnectBanner = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  background: linear-gradient(135deg,
    color-mix(in oklab, #4285F4 14%, var(--bg-2)),
    color-mix(in oklab, #4285F4 6%, var(--bg-2)));
  border: 1px solid color-mix(in oklab, #4285F4 30%, var(--border-1));
  border-radius: var(--r-md);
  margin-bottom: var(--s-3);

  @media (max-width: 720px) {
    flex-wrap: wrap;
  }
`;

const BannerIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: #fff;
  color: #4285F4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 800;
  font-size: 16px;
`;

const BannerBody = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-2);

  strong { display: block; color: var(--text-1); margin-bottom: 2px; font-size: 14px; }
`;

const SyncBar = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: 12px;
  color: var(--text-3);

  svg { width: 13px; height: 13px; }
`;

const SyncedTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 999px;
  background: color-mix(in oklab, #4285F4 18%, var(--bg-3));
  color: #4285F4;
  font-weight: 600;

  svg { width: 11px; height: 11px; }
`;

const MeetingRow = styled.div<{ $done?: boolean }>`
  padding: var(--s-4) var(--s-5);
  display: flex;
  gap: var(--s-3);
  align-items: flex-start;
  border-top: 1px solid var(--border-1);

  &:first-child { border-top: none; }
  &:hover { background: var(--bg-3); }

  ${p => p.$done && `opacity: 0.7;`}

  @media (max-width: 720px) {
    padding: var(--s-3);
    gap: var(--s-2);
    flex-wrap: wrap;
  }
`;

const Title = styled.h3<{ $done?: boolean }>`
  font-size: 14px;
  font-weight: 600;
  color: ${p => p.$done ? 'var(--text-3)' : 'var(--text-1)'};
  text-decoration: ${p => p.$done ? 'line-through' : 'none'};
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
`;

const Description = styled.p`
  font-size: 13px;
  color: var(--text-2);
  margin: 6px 0 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-4);
  font-size: 12px;
  color: var(--text-3);
  margin-top: var(--s-2);

  span { display: flex; align-items: center; gap: 6px; }
  svg { width: 13px; height: 13px; }
`;

const NotesBox = styled.div`
  margin-top: var(--s-3);
  padding: var(--s-3);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-left: 2px solid var(--accent);
  border-radius: var(--r-sm);
  font-size: 13px;
  color: var(--text-2);
  white-space: pre-wrap;
  line-height: 1.55;

  strong { color: var(--text-1); margin-right: 6px; }
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

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

type View = 'list' | 'calendar';

function toLocalInputValue(d: Date): string {
  // YYYY-MM-DDTHH:MM in local time, suitable for <input type="datetime-local">
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const Meetings: React.FC = () => {
  const { meetings, addMeeting, updateMeeting, deleteMeeting, toggleMeetingCompletion } = useAppContext();
  const { googleCalendarUpgradeUrl } = useAuth();
  const toast = useToast();

  const [view, setView] = useState<View>('calendar');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState(30);
  const [participants, setParticipants] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [open, setOpen] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  // Edit modal (full meeting edit)
  const [editing, setEditing] = useState<Meeting | null>(null);

  // Calendar sync state
  const [calStatus, setCalStatus] = useState<CalendarStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      setCalStatus(await MeetingsAPI.calendarStatus());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await MeetingsAPI.sync();
      const changed = res.changed + res.deleted;
      toast.success(
        changed > 0 ? `Synced: ${res.changed} updated, ${res.deleted} removed` : 'Calendar is up to date',
      );
      await refreshStatus();
      const fresh = await MeetingsAPI.getAll();
      for (const m of fresh) {
        const existing = meetings.find((x) => x.id === m.id);
        if (existing) updateMeeting(m.id, m);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      try {
        const j = JSON.parse(msg) as { error?: string; message?: string };
        if (j.error === 'calendar_not_connected') {
          toast.error('Connect Google Calendar to enable sync.');
          return;
        }
        if (j.error === 'calendar_sync_failed') {
          toast.error(`Sync failed: ${j.message ?? 'Google rejected the request.'}`);
          await refreshStatus();
          return;
        }
      } catch {
        /* not JSON */
      }
      toast.error('Calendar sync failed.');
    } finally {
      setSyncing(false);
    }
  }, [syncing, toast, refreshStatus, meetings, updateMeeting]);

  // First-load opportunistic pull (fire and forget).
  useEffect(() => {
    if (calStatus?.calendarConnected) {
      void MeetingsAPI.listWithSync().catch(() => undefined);
    }
  }, [calStatus?.calendarConnected]);

  const reset = (): void => {
    setTitle(''); setDescription(''); setDate(''); setDuration(30); setParticipants('');
    setShowDescription(false); setShowParticipants(false);
  };

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    addMeeting({
      title, description, date: new Date(date), duration,
      participants: participants.split(',').map(p => p.trim()).filter(Boolean),
      notes: '', completed: false,
    });
    reset();
  };

  const openNotes = (m: Meeting): void => {
    setEditingId(m.id); setEditingNotes(m.notes || ''); setOpen(true);
  };
  const saveNotes = (): void => {
    if (editingId) {
      updateMeeting(editingId, { notes: editingNotes });
      setOpen(false); setEditingId(null); setEditingNotes('');
    }
  };

  const onPickDay = useCallback((day: Date): void => {
    // Pre-fill the composer with that day at 09:00 local.
    const d = new Date(day);
    d.setHours(9, 0, 0, 0);
    setDate(toLocalInputValue(d));
    // Scroll to composer (top of page)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const onPickMeeting = useCallback((m: Meeting): void => setEditing(m), []);

  const upcoming = useMemo(() => meetings.filter((m) => !m.completed), [meetings]);
  const completed = useMemo(() => meetings.filter((m) => m.completed), [meetings]);

  const lastSyncedLabel = calStatus?.lastSyncedAt
    ? `Synced ${formatDistanceToNow(new Date(calStatus.lastSyncedAt), { addSuffix: true })}`
    : null;

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle><IconCalendar /> Meetings</PageTitle>
          <PageSubtitle>Schedule, attend, document — synced with Google Calendar</PageSubtitle>
        </div>
        <Row $gap={2}>
          <ViewToggle>
            <ViewBtn $active={view === 'calendar'} onClick={() => setView('calendar')}>
              <IconGrid /> Calendar
            </ViewBtn>
            <ViewBtn $active={view === 'list'} onClick={() => setView('list')}>
              <IconList /> List
            </ViewBtn>
          </ViewToggle>
        </Row>
      </PageHeader>

      {calStatus && !calStatus.calendarConnected && (
        <ConnectBanner>
          <BannerIcon>G</BannerIcon>
          <BannerBody>
            <strong>Connect Google Calendar</strong>
            Two-way sync your Piovra meetings with your Google Calendar — new and edited events flow both ways automatically.
          </BannerBody>
          <Button
            $variant="primary"
            $size="sm"
            onClick={() => {
              window.location.href = googleCalendarUpgradeUrl;
            }}
          >
            <IconExternal /> Connect
          </Button>
        </ConnectBanner>
      )}

      {calStatus?.calendarConnected && (
        <SyncBar>
          <SyncedTag><IconExternal /> Google Calendar connected</SyncedTag>
          {lastSyncedLabel && <span>{lastSyncedLabel}</span>}
          {calStatus.syncError && (
            <Badge $variant="danger">Sync error</Badge>
          )}
          <ComposerSpacer />
          <Button $size="sm" $variant="ghost" onClick={handleSync} disabled={syncing}>
            <IconRefresh />
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        </SyncBar>
      )}

      <Composer onSubmit={submit}>
        <ComposerTitle
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Meeting title…"
          required
        />
        {(showDescription || description) && (
          <ComposerBody
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Agenda, links, context…"
            rows={2}
          />
        )}
        {(showParticipants || participants) && (
          <ComposerBody
            value={participants}
            onChange={e => setParticipants(e.target.value)}
            placeholder="Participants — comma separated"
            rows={1}
            style={{ minHeight: 28 }}
          />
        )}
        <ComposerToolbar>
          <GhostInput
            type="datetime-local"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            aria-label="Date and time"
          />
          <GhostInput
            type="number"
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            min={5}
            step={5}
            aria-label="Duration in minutes"
            title="Duration (min)"
          />
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>min</span>

          <Chip type="button" $active={showDescription} onClick={() => setShowDescription(s => !s)}>
            <IconEdit /> {showDescription ? 'Hide agenda' : 'Agenda'}
          </Chip>
          <Chip type="button" $active={showParticipants} onClick={() => setShowParticipants(s => !s)}>
            <IconUsers /> {showParticipants ? 'Hide people' : 'People'}
          </Chip>

          <ComposerSpacer />
          {(title || description || date || participants) && (
            <Chip type="button" onClick={reset}>Clear</Chip>
          )}
          <Button $variant="primary" $size="sm" type="submit" disabled={!title.trim() || !date}>
            <IconPlus /> Schedule
          </Button>
        </ComposerToolbar>
      </Composer>

      {view === 'calendar' ? (
        <MonthCalendar
          meetings={meetings}
          onPickDay={onPickDay}
          onPickMeeting={onPickMeeting}
        />
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle><IconCalendar /> Upcoming <CardSubtle>{upcoming.length}</CardSubtle></CardTitle></CardHeader>
            <CardBody>
              {upcoming.length === 0 ? (
                <EmptyState><IconCalendar /><div>No upcoming meetings.</div></EmptyState>
              ) : upcoming.map(m => (
                <MeetingRow key={m.id}>
                  <Checkbox $checked={false} onClick={() => toggleMeetingCompletion(m.id)} style={{ marginTop: 3 }} />
                  <Body>
                    <Title>
                      {m.title}
                      {m.googleEventId && (
                        <SyncedTag><IconExternal /> Google</SyncedTag>
                      )}
                      {new Date(m.date) < new Date() && <Badge $variant="danger">Overdue</Badge>}
                    </Title>
                    {m.description && <Description><LinkifyText text={m.description} /></Description>}
                    <MetaRow>
                      <span><IconClock /> {format(new Date(m.date), 'MMM d, yyyy · HH:mm')}</span>
                      <span><IconClock /> {m.duration} min</span>
                      {m.participants.length > 0 && <span><IconUsers /> {m.participants.join(', ')}</span>}
                    </MetaRow>
                    {m.notes && <NotesBox><strong>Notes</strong>{m.notes}</NotesBox>}
                  </Body>
                  <Actions>
                    {m.googleHtmlLink && (
                      <IconButton
                        $size="sm"
                        $variant="ghost"
                        as="a"
                        href={m.googleHtmlLink}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in Google Calendar"
                      >
                        <IconExternal />
                      </IconButton>
                    )}
                    <Button $size="sm" $variant="ghost" onClick={() => setEditing(m)}>
                      <IconEdit /> Edit
                    </Button>
                    <Button $size="sm" $variant="ghost" onClick={() => openNotes(m)}>
                      <IconSpark /> {m.notes ? 'Notes' : 'Add notes'}
                    </Button>
                    <IconButton $size="sm" $variant="danger" onClick={() => deleteMeeting(m.id)} title="Delete">
                      <IconTrash />
                    </IconButton>
                  </Actions>
                </MeetingRow>
              ))}
            </CardBody>
          </Card>

          {completed.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Completed <CardSubtle>{completed.length}</CardSubtle></CardTitle></CardHeader>
              <CardBody>
                {completed.map(m => (
                  <MeetingRow key={m.id} $done>
                    <Checkbox $checked={true} onClick={() => toggleMeetingCompletion(m.id)} style={{ marginTop: 3 }} />
                    <Body>
                      <Title $done>{m.title}</Title>
                      <MetaRow>
                        <span><IconClock /> {format(new Date(m.date), 'MMM d, yyyy')}</span>
                        <span><IconClock /> {m.duration} min</span>
                      </MetaRow>
                    </Body>
                    <Actions>
                      <IconButton $size="sm" $variant="danger" onClick={() => deleteMeeting(m.id)} title="Delete">
                        <IconTrash />
                      </IconButton>
                    </Actions>
                  </MeetingRow>
                ))}
              </CardBody>
            </Card>
          )}
        </>
      )}

      {open && (
        <ModalOverlay onClick={() => setOpen(false)}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle><IconEdit /> Meeting notes</CardTitle>
              <IconButton $variant="ghost" $size="sm" onClick={() => setOpen(false)}><IconX /></IconButton>
            </CardHeader>
            <CardSection>
              <Stack $gap={3}>
                <Textarea value={editingNotes} onChange={e => setEditingNotes(e.target.value)} rows={8} placeholder="Capture key points, decisions, action items…" autoFocus />
                <Row $gap={2}>
                  <Button $variant="primary" onClick={saveNotes}>Save notes</Button>
                  <Button $variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                </Row>
              </Stack>
            </CardSection>
          </ModalCard>
        </ModalOverlay>
      )}

      {editing && (
        <EditMeetingModal
          meeting={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateMeeting(editing.id, patch);
            setEditing(null);
          }}
          onDelete={() => {
            deleteMeeting(editing.id);
            setEditing(null);
          }}
        />
      )}
    </PageContainer>
  );
};

interface EditModalProps {
  meeting: Meeting;
  onClose: () => void;
  onSave: (patch: Partial<Meeting>) => void;
  onDelete: () => void;
}

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: var(--s-3);
  align-items: center;

  @media (max-width: 540px) {
    grid-template-columns: 1fr;
    gap: 4px;
  }
`;

const FieldLabel = styled.label`
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
`;

const EditMeetingModal: React.FC<EditModalProps> = ({ meeting, onClose, onSave, onDelete }) => {
  const [title, setTitle] = useState(meeting.title);
  const [description, setDescription] = useState(meeting.description);
  const [date, setDate] = useState(toLocalInputValue(new Date(meeting.date)));
  const [duration, setDuration] = useState(meeting.duration);
  const [participants, setParticipants] = useState(meeting.participants.join(', '));
  const [notes, setNotes] = useState(meeting.notes);

  const save = (): void => {
    onSave({
      title,
      description,
      date: new Date(date),
      duration,
      participants: participants.split(',').map((p) => p.trim()).filter(Boolean),
      notes,
    });
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <CardHeader>
          <CardTitle>
            <IconEdit /> Edit meeting
            {meeting.googleEventId && <SyncedTag><IconExternal /> Google</SyncedTag>}
          </CardTitle>
          <IconButton $variant="ghost" $size="sm" onClick={onClose}><IconX /></IconButton>
        </CardHeader>
        <CardSection>
          <Stack $gap={3}>
            <FieldRow>
              <FieldLabel htmlFor="m-title">Title</FieldLabel>
              <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </FieldRow>
            <FieldRow>
              <FieldLabel htmlFor="m-date">When</FieldLabel>
              <Input id="m-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </FieldRow>
            <FieldRow>
              <FieldLabel htmlFor="m-duration">Duration (min)</FieldLabel>
              <Input id="m-duration" type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </FieldRow>
            <FieldRow>
              <FieldLabel htmlFor="m-people">Participants</FieldLabel>
              <Input id="m-people" value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="comma separated" />
            </FieldRow>
            <FieldRow>
              <FieldLabel htmlFor="m-desc">Agenda</FieldLabel>
              <Textarea id="m-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </FieldRow>
            <FieldRow>
              <FieldLabel htmlFor="m-notes">Notes</FieldLabel>
              <Textarea id="m-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FieldRow>

            <Row $gap={2}>
              <Button $variant="primary" onClick={save}>Save</Button>
              <Button $variant="ghost" onClick={onClose}>Cancel</Button>
              {meeting.googleHtmlLink && (
                <Button as="a" href={meeting.googleHtmlLink} target="_blank" rel="noreferrer" $variant="ghost">
                  <IconExternal /> Open in Google
                </Button>
              )}
              <ComposerSpacer />
              <IconButton $variant="danger" $size="sm" onClick={onDelete} title="Delete">
                <IconTrash />
              </IconButton>
            </Row>
          </Stack>
        </CardSection>
      </ModalCard>
    </ModalOverlay>
  );
};

export default Meetings;
