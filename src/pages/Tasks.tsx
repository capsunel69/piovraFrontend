import React, { useState } from 'react';
import styled from 'styled-components';
import { format, isPast } from 'date-fns';
import { useAppContext } from '../context/AppContext';
import type { Task } from '../types';
import LinkifyText from '../components/shared/LinkifyText';
import LoadingState from '../components/shared/LoadingState';
import ErrorMessage from '../components/shared/ErrorMessage';
import TaskEditForm from '../components/TaskEditForm';
import SubtaskList from '../components/SubtaskList';
import {
  PageContainer, PageHeader, PageTitle, PageSubtitle,
  Card, CardHeader, CardTitle, CardSubtle, CardBody, CardSection,
  Button, IconButton, Badge, Checkbox, EmptyState, Select,
  Composer, ComposerTitle, ComposerBody, ComposerToolbar, ComposerSpacer,
  Chip, ChipGroup, GhostInput,
} from '../components/ui/primitives';
import {
  IconTasks, IconPlus, IconPlay, IconStop, IconEdit, IconTrash,
  IconGrip, IconClock, IconAlert, IconFilter, IconCheck, IconChevronDown, IconChevronRight,
} from '../components/ui/icons';

const formatTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
};

const TaskRow = styled.div<{ $done?: boolean; $dragging?: boolean; $over?: boolean }>`
  padding: var(--s-3) var(--s-5);
  display: flex;
  gap: var(--s-3);
  align-items: flex-start;
  border-top: 1px solid var(--border-1);
  background: ${p => p.$over ? 'var(--bg-3)' : 'transparent'};
  opacity: ${p => p.$dragging ? 0.4 : 1};
  transition: background 0.15s;

  &:first-child { border-top: none; }
  &:hover { background: var(--bg-3); }

  @media (max-width: 720px) {
    padding: var(--s-3);
    gap: var(--s-2);
    flex-wrap: wrap;
  }
`;

const Drag = styled.div`
  color: var(--text-4);
  cursor: grab;
  display: flex;
  align-items: center;
  padding: 4px;
  margin-top: 2px;

  &:hover { color: var(--text-2); }
  &:active { cursor: grabbing; }
`;

const TaskBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  flex-wrap: wrap;
`;

const Title = styled.span<{ $done?: boolean }>`
  font-weight: 500;
  font-size: 14px;
  color: ${p => p.$done ? 'var(--text-3)' : 'var(--text-1)'};
  text-decoration: ${p => p.$done ? 'line-through' : 'none'};
`;

const Description = styled.div`
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
`;

const MetaRow = styled.div`
  display: flex;
  gap: var(--s-4);
  font-size: 11.5px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;

  span { display: flex; align-items: center; gap: 4px; }
  svg { width: 12px; height: 12px; }
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

const FilterBar = styled.div`
  display: flex;
  gap: var(--s-3);
  align-items: center;
  padding: var(--s-3) var(--s-4);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  flex-wrap: wrap;

  .label { font-size: 11px; text-transform: uppercase; color: var(--text-3); letter-spacing: 0.06em; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .label svg { width: 14px; height: 14px; }

  @media (max-width: 720px) {
    gap: var(--s-2);
    padding: var(--s-3);
    > * {
      flex: 1 1 calc(50% - var(--s-2));
      min-width: 0;
    }
    .label { flex: 0 0 auto; }
  }
`;

const InlineSelect = styled(Select)`
  width: auto;
  min-width: 140px;
  padding: 6px 28px 6px 10px;
  font-size: 12px;
`;

const priorityVariant = (p: 'low' | 'medium' | 'high') =>
  p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'success';

const Tasks: React.FC = () => {
  const {
    tasks, addTask, updateTask, deleteTask, toggleTaskCompletion, reorderTasks,
    startTimer, stopTimer, activeTaskId,
    isLoading, isAddingTask, isDeletingTask, isUpdatingTask, isTogglingTask, error,
  } = useAppContext();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');
  const [completedLimit, setCompletedLimit] = useState(10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const reset = () => {
    setTitle(''); setDescription(''); setPriority('medium'); setDueDate('');
    setShowDescription(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // New tasks go to the top: one below the smallest existing manual order.
    const minOrder = tasks
      .filter(t => !t.completed && typeof t.order === 'number')
      .reduce((min, t) => Math.min(min, t.order as number), 0);
    addTask({
      title, description, priority, completed: false,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      order: minOrder - 1,
    });
    reset();
  };

  const isOverdue = (task: Task) => !!task.dueDate && !task.completed && isPast(new Date(task.dueDate));

  const filterTasks = (list: Task[]): Task[] => list.filter(task => {
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    if (timeFilter !== 'all') {
      const today = new Date(); today.setHours(0,0,0,0);
      const taskDate = task.dueDate ? new Date(task.dueDate) : null;
      switch (timeFilter) {
        case 'overdue': return isOverdue(task);
        case 'today': {
          if (!taskDate) return false;
          const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
          return taskDate >= today && taskDate < tomorrow;
        }
        case 'upcoming':
          if (!taskDate) return false;
          return taskDate > new Date();
      }
    }
    return true;
  });

  const onDragStart = (e: React.DragEvent, id: string) => { setDraggedId(id); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); if (id !== draggedId) setOverId(id); };
  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setOverId(null); return; }
    const list = tasks.filter(t => !t.completed).sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    const di = list.findIndex(t => t.id === draggedId);
    const ti = list.findIndex(t => t.id === targetId);
    if (di === -1 || ti === -1) { setDraggedId(null); setOverId(null); return; }
    const next = [...list];
    const [d] = next.splice(di, 1); next.splice(ti, 0, d);
    const reordered = next.map((t, i) => ({ ...t, order: i }));
    reorderTasks([...reordered, ...tasks.filter(t => t.completed)]);
    setDraggedId(null); setOverId(null);
  };

  const incompleteTasks = filterTasks(
    tasks.filter(t => !t.completed).sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  );
  const allCompleted = tasks
    .filter(t => t.completed)
    .sort((a,b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
  const completed = allCompleted.slice(0, completedLimit);

  if (isLoading && tasks.length === 0) return <LoadingState message="Loading tasks…" />;
  if (error && tasks.length === 0) return <ErrorMessage message={error} />;

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle><IconTasks /> Tasks</PageTitle>
          <PageSubtitle>Plan, prioritize, and execute</PageSubtitle>
        </div>
      </PageHeader>

      <Composer onSubmit={submit}>
        <ComposerTitle
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Add a task… ⌘ + Enter to save"
          required
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              if (title.trim()) submit(e as any);
            }
          }}
        />
        {(showDescription || description) && (
          <ComposerBody
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add notes, links, context…"
            rows={2}
          />
        )}
        <ComposerToolbar>
          <ChipGroup role="radiogroup" aria-label="Priority">
            {(['low', 'medium', 'high'] as const).map(p => (
              <Chip
                key={p}
                type="button"
                $active={priority === p}
                $tone={p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'success'}
                onClick={() => setPriority(p)}
                aria-pressed={priority === p}
              >
                {p[0].toUpperCase() + p.slice(1)}
              </Chip>
            ))}
          </ChipGroup>

          <GhostInput
            type="datetime-local"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            aria-label="Due date"
          />

          <Chip
            type="button"
            $active={showDescription}
            onClick={() => setShowDescription(s => !s)}
          >
            <IconEdit /> {showDescription ? 'Hide notes' : 'Add notes'}
          </Chip>

          <ComposerSpacer />

          {(title || description || dueDate) && (
            <Chip type="button" onClick={reset}>Clear</Chip>
          )}
          <Button $variant="primary" $size="sm" type="submit" disabled={isAddingTask || !title.trim()}>
            {isAddingTask ? 'Adding…' : <><IconPlus /> Add task</>}
          </Button>
        </ComposerToolbar>
      </Composer>

      <FilterBar>
        <span className="label"><IconFilter /> Filter</span>
        <InlineSelect value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as any)}>
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </InlineSelect>
        <InlineSelect value={timeFilter} onChange={e => setTimeFilter(e.target.value as any)}>
          <option value="all">Any time</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="upcoming">Upcoming</option>
        </InlineSelect>
      </FilterBar>

      <Card>
        <CardHeader>
          <CardTitle><IconTasks /> Active <CardSubtle>{incompleteTasks.length}</CardSubtle></CardTitle>
        </CardHeader>
        <CardBody>
          {incompleteTasks.length === 0 ? (
            <EmptyState>
              <IconCheck />
              <div>{(priorityFilter !== 'all' || timeFilter !== 'all') ? 'No tasks match your filters.' : 'All clear. Add your first task above.'}</div>
            </EmptyState>
          ) : incompleteTasks.map(task => (
            <React.Fragment key={task.id}>
              {editingId === task.id ? (
                <TaskEditForm task={task} onSave={(id, u) => { updateTask(id, u); setEditingId(null); }} onCancel={() => setEditingId(null)} isLoading={isUpdatingTask} />
              ) : (
                <TaskRow
                  draggable
                  onDragStart={e => onDragStart(e, task.id)}
                  onDragOver={e => onDragOver(e, task.id)}
                  onDragLeave={() => setOverId(null)}
                  onDrop={e => onDrop(e, task.id)}
                  onDragEnd={() => { setDraggedId(null); setOverId(null); }}
                  $dragging={draggedId === task.id}
                  $over={overId === task.id}
                >
                  <Drag title="Drag to reorder"><IconGrip /></Drag>
                  <Checkbox $checked={false} onClick={() => toggleTaskCompletion(task.id)} disabled={isTogglingTask} style={{ marginTop: 3 }} />
                  <TaskBody>
                    <TitleRow>
                      <Title>{task.title}</Title>
                      <Badge $variant={priorityVariant(task.priority)}>{task.priority}</Badge>
                      {isOverdue(task) && <Badge $variant="danger"><IconAlert /> Overdue</Badge>}
                      {task.convertedFromReminder && <Badge $variant="purple">From reminder</Badge>}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <Badge $variant="neutral">
                          <IconCheck />
                          {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                        </Badge>
                      )}
                    </TitleRow>
                    {task.description && <Description><LinkifyText text={task.description} /></Description>}
                    {(task.dueDate || task.timeSpent > 0) && (
                      <MetaRow>
                        {task.dueDate && <span><IconClock /> {format(new Date(task.dueDate), 'MMM d · HH:mm')}</span>}
                        {task.timeSpent > 0 && <span><IconClock /> {formatTime(task.timeSpent)}</span>}
                      </MetaRow>
                    )}
                    <SubtaskList
                      task={task}
                      onChange={updateTask}
                      disabled={isUpdatingTask}
                    />
                  </TaskBody>
                  <Actions>
                    {task.id === activeTaskId ? (
                      <Button $variant="danger" $size="sm" onClick={() => stopTimer(task.id)} disabled={isUpdatingTask}>
                        <IconStop /> Stop
                      </Button>
                    ) : (
                      <Button $variant="success" $size="sm" onClick={() => startTimer(task.id)} disabled={!!activeTaskId || isUpdatingTask}>
                        <IconPlay /> Start
                      </Button>
                    )}
                    {!task.convertedFromReminder && (
                      <IconButton $size="sm" onClick={() => setEditingId(task.id)} disabled={isUpdatingTask} title="Edit">
                        <IconEdit />
                      </IconButton>
                    )}
                    <IconButton $size="sm" $variant="danger" onClick={() => deleteTask(task.id)} disabled={isDeletingTask} title="Delete">
                      <IconTrash />
                    </IconButton>
                  </Actions>
                </TaskRow>
              )}
            </React.Fragment>
          ))}
        </CardBody>
      </Card>

      {allCompleted.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle><IconCheck /> Completed <CardSubtle>{allCompleted.length}</CardSubtle></CardTitle>
            <Button $variant="ghost" $size="sm" onClick={() => setShowCompleted(s => !s)}>
              {showCompleted ? <IconChevronDown /> : <IconChevronRight />}
              {showCompleted ? 'Hide' : 'Show'}
            </Button>
          </CardHeader>
          {showCompleted && (
            <CardBody>
              {completed.map(task => (
                <TaskRow key={task.id} $done>
                  <div style={{ width: 22 }} />
                  <Checkbox $checked={true} onClick={() => toggleTaskCompletion(task.id)} style={{ marginTop: 3 }} />
                  <TaskBody>
                    <TitleRow>
                      <Title $done>{task.title}</Title>
                      <Badge $variant={priorityVariant(task.priority)}>{task.priority}</Badge>
                      {task.subtasks && task.subtasks.length > 0 && (
                        <Badge $variant="neutral">
                          <IconCheck />
                          {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                        </Badge>
                      )}
                    </TitleRow>
                    {task.description && <Description><LinkifyText text={task.description} /></Description>}
                    <MetaRow>
                      {task.timeSpent > 0 && <span><IconClock /> {formatTime(task.timeSpent)}</span>}
                      <span>Completed {format(new Date(task.completedAt || task.createdAt), 'MMM d')}</span>
                    </MetaRow>
                    <SubtaskList task={task} onChange={updateTask} compact />
                  </TaskBody>
                  <Actions>
                    <IconButton $size="sm" $variant="danger" onClick={() => deleteTask(task.id)} title="Delete">
                      <IconTrash />
                    </IconButton>
                  </Actions>
                </TaskRow>
              ))}
              {completedLimit < allCompleted.length && (
                <CardSection>
                  <Button $block $variant="ghost" onClick={() => setCompletedLimit(p => p + 10)}>
                    Load more · {allCompleted.length - completedLimit} remaining
                  </Button>
                </CardSection>
              )}
            </CardBody>
          )}
        </Card>
      )}
    </PageContainer>
  );
};

export default Tasks;
