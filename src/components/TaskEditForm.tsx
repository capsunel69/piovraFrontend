import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import type { Task } from '../types';
import {
  Stack, Row, Field, FieldGroup, Label, Input, Select, Textarea, Button,
} from './ui/primitives';
import { IconEdit, IconCheck } from './ui/icons';

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

interface Props {
  task: Task;
  onSave: (taskId: string, updated: Partial<Task>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const TaskEditForm: React.FC<Props> = ({ task, onSave, onCancel, isLoading }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');
  }, [task]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(task.id, {
      title,
      description,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
    });
  };

  return (
    <Wrap>
      <Heading><IconEdit /> Edit task</Heading>
      <form onSubmit={submit}>
        <Stack $gap={3}>
          <Field>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} required disabled={isLoading} />
          </Field>
          <Field>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} disabled={isLoading} />
          </Field>
          <FieldGroup>
            <Field>
              <Label>Priority</Label>
              <Select value={priority} onChange={e => setPriority(e.target.value as any)} disabled={isLoading}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </Field>
            <Field>
              <Label>Due date</Label>
              <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={isLoading} />
            </Field>
          </FieldGroup>
          <Row $gap={2}>
            <Button $variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Saving…' : <><IconCheck /> Save</>}
            </Button>
            <Button $variant="ghost" type="button" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          </Row>
        </Stack>
      </form>
    </Wrap>
  );
};

export default TaskEditForm;
