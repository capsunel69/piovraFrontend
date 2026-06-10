import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import type { Subtask, Task } from '../types';
import { Checkbox } from './ui/primitives';
import { IconPlus, IconTrash, IconEdit, IconCheck, IconX } from './ui/icons';

/**
 * Inline checklist for a Task.
 *
 * The list is intentionally tight (smaller font/padding than the parent task
 * row) so a task with several subtasks still feels like one block instead of
 * a deeply nested tree.
 *
 * Editing model: subtask titles are NOT inline-editable on every keystroke
 * (that caused a save-per-letter pattern that fought with optimistic updates
 * and stole focus). Instead, the user enters an explicit edit mode via the
 * pencil button, types freely, then commits with Enter / blur / Save and can
 * cancel with Esc.
 */

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0 2px;
`;

const Item = styled.div<{ $done?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: var(--s-2);
  padding: 4px 6px;
  border-radius: var(--r-xs);
  transition: background 0.15s;
  min-height: 28px;

  &:hover { background: var(--bg-3); }
  &:hover .actions > button { opacity: 1; }
`;

const TitleText = styled.button<{ $done?: boolean }>`
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 13px;
  color: ${(p) => (p.$done ? 'var(--text-3)' : 'var(--text-1)')};
  text-decoration: ${(p) => (p.$done ? 'line-through' : 'none')};
  padding: 4px 2px;
  text-align: left;
  cursor: text;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;

  &:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: 2px;
    border-radius: var(--r-xs);
  }

  @media (max-width: 720px) {
    font-size: 14px;
  }
`;

const EditInput = styled.input<{ $done?: boolean }>`
  flex: 1;
  min-width: 0;
  border: 1px solid var(--accent);
  background: var(--bg-2);
  font: inherit;
  font-size: 13px;
  color: ${(p) => (p.$done ? 'var(--text-3)' : 'var(--text-1)')};
  text-decoration: ${(p) => (p.$done ? 'line-through' : 'none')};
  padding: 4px 6px;
  border-radius: var(--r-xs);
  outline: 0;
  box-shadow: 0 0 0 3px var(--accent-soft);

  @media (max-width: 720px) {
    font-size: 16px;
  }
`;

const Actions = styled.div`
  display: inline-flex;
  align-items: flex-start;
  gap: 2px;
  flex-shrink: 0;
  padding-top: 2px;
`;

const ActionBtn = styled.button<{ $tone?: 'default' | 'danger' | 'accent' }>`
  opacity: 0;
  background: transparent;
  border: 0;
  padding: 4px;
  border-radius: var(--r-xs);
  color: ${(p) =>
    p.$tone === 'danger' ? 'var(--text-3)' :
    p.$tone === 'accent' ? 'var(--accent)' :
    'var(--text-3)'};
  cursor: pointer;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
  display: flex;
  align-items: center;

  &:hover {
    color: ${(p) =>
      p.$tone === 'danger' ? 'var(--danger)' :
      p.$tone === 'accent' ? 'var(--accent-strong)' :
      'var(--text-1)'};
    background: ${(p) =>
      p.$tone === 'danger' ? 'var(--danger-soft)' :
      p.$tone === 'accent' ? 'var(--accent-soft)' :
      'var(--bg-2)'};
  }

  /* While editing the save/cancel buttons are always visible. */
  &[data-always='true'] {
    opacity: 1;
  }

  svg { width: 12px; height: 12px; }

  /* Always visible on touch devices where there's no hover. */
  @media (hover: none) {
    opacity: 0.6;
    &[data-always='true'] { opacity: 1; }
  }
`;

const AddRow = styled.form`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: 4px 6px;
  border-radius: var(--r-xs);
  min-height: 28px;

  &:focus-within { background: var(--bg-3); }
`;

const AddIcon = styled.span`
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  min-width: 18px;
  border-radius: var(--r-xs);
  border: 1.5px dashed var(--border-3);
  color: var(--text-3);

  svg { width: 12px; height: 12px; }
`;

const AddInput = styled.input`
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 13px;
  color: var(--text-1);
  padding: 4px 2px;
  outline: 0;

  &::placeholder { color: var(--text-4); }

  @media (max-width: 720px) {
    font-size: 16px;
  }
`;

const Progress = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  padding: 2px 6px;

  .bar {
    flex: 1;
    height: 3px;
    border-radius: 999px;
    background: var(--bg-3);
    overflow: hidden;
    max-width: 140px;
  }

  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--purple));
    transition: width 0.25s ease;
  }
`;

interface Props {
  task: Task;
  onChange: (taskId: string, updates: Partial<Task>) => void;
  disabled?: boolean;
  /** When true, render in a compact read-only-ish mode (used in the
   *  completed list where subtasks are just historical context). */
  compact?: boolean;
}

const SubtaskList: React.FC<Props> = ({ task, onChange, disabled, compact }) => {
  const subtasks = task.subtasks ?? [];
  const [draftTitle, setDraftTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  // True when the user pressed Esc / Cancel and we shouldn't commit on blur.
  const cancelEditRef = useRef(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const persist = (next: Subtask[]): void => {
    onChange(task.id, { subtasks: next });
  };

  const toggle = (id: string): void => {
    persist(
      subtasks.map((s) =>
        s.id === id ? { ...s, completed: !s.completed } : s,
      ),
    );
  };

  const remove = (id: string): void => {
    if (editingId === id) setEditingId(null);
    persist(subtasks.filter((s) => s.id !== id));
  };

  const startEdit = (s: Subtask): void => {
    cancelEditRef.current = false;
    setEditDraft(s.title);
    setEditingId(s.id);
  };

  const cancelEdit = (): void => {
    cancelEditRef.current = true;
    setEditingId(null);
    setEditDraft('');
  };

  const commitEdit = (): void => {
    if (!editingId || cancelEditRef.current) return;
    const trimmed = editDraft.trim();
    const original = subtasks.find((s) => s.id === editingId);
    if (!original) {
      setEditingId(null);
      return;
    }
    if (!trimmed) {
      // Empty title → treat as cancel rather than wiping the row.
      setEditingId(null);
      setEditDraft('');
      return;
    }
    if (trimmed !== original.title) {
      persist(
        subtasks.map((s) =>
          s.id === editingId ? { ...s, title: trimmed } : s,
        ),
      );
    }
    setEditingId(null);
    setEditDraft('');
  };

  // Focus + select-all when entering edit mode so the existing text is
  // immediately replaceable.
  useEffect(() => {
    if (!editingId) return;
    const el = editInputRef.current;
    if (!el) return;
    // requestAnimationFrame ensures the input is mounted.
    const handle = requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(handle);
  }, [editingId]);

  const add = (e: React.FormEvent): void => {
    e.preventDefault();
    const title = draftTitle.trim();
    if (!title) return;
    const newItem: Subtask = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: new Date(),
    };
    persist([...subtasks, newItem]);
    setDraftTitle('');
    // Keep focus so the user can add several in a row.
    requestAnimationFrame(() => addInputRef.current?.focus());
  };

  const total = subtasks.length;
  const done = subtasks.filter((s) => s.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  if (compact) {
    if (total === 0) return null;
    return (
      <Progress aria-label={`${done} of ${total} subtasks complete`}>
        <span>{done}/{total}</span>
        <span className="bar"><span className="fill" style={{ width: `${pct}%` }} /></span>
      </Progress>
    );
  }

  return (
    <Wrap>
      {total > 0 && (
        <Progress aria-label={`${done} of ${total} subtasks complete`}>
          <span>{done}/{total}</span>
          <span className="bar"><span className="fill" style={{ width: `${pct}%` }} /></span>
        </Progress>
      )}

      {subtasks.map((s) => {
        const isEditing = editingId === s.id;
        return (
          <Item key={s.id} $done={s.completed}>
            <Checkbox
              $checked={s.completed}
              onClick={() => toggle(s.id)}
              disabled={disabled || isEditing}
              aria-label={s.completed ? 'Mark incomplete' : 'Mark complete'}
            />

            {isEditing ? (
              <>
                <EditInput
                  ref={editInputRef}
                  value={editDraft}
                  $done={s.completed}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitEdit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  onBlur={() => {
                    // Defer so a click on Save/Cancel registers first.
                    setTimeout(() => {
                      if (editingId === s.id) commitEdit();
                    }, 0);
                  }}
                  aria-label="Edit subtask title"
                />
                <Actions className="actions">
                  <ActionBtn
                    type="button"
                    data-always="true"
                    $tone="accent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={commitEdit}
                    aria-label="Save subtask"
                    title="Save (Enter)"
                  >
                    <IconCheck />
                  </ActionBtn>
                  <ActionBtn
                    type="button"
                    data-always="true"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={cancelEdit}
                    aria-label="Cancel edit"
                    title="Cancel (Esc)"
                  >
                    <IconX />
                  </ActionBtn>
                </Actions>
              </>
            ) : (
              <>
                <TitleText
                  type="button"
                  $done={s.completed}
                  onClick={() => startEdit(s)}
                  disabled={disabled}
                  title="Click to edit"
                >
                  {s.title}
                </TitleText>
                <Actions className="actions">
                  <ActionBtn
                    type="button"
                    onClick={() => startEdit(s)}
                    disabled={disabled}
                    aria-label="Edit subtask"
                    title="Edit"
                  >
                    <IconEdit />
                  </ActionBtn>
                  <ActionBtn
                    type="button"
                    $tone="danger"
                    onClick={() => remove(s.id)}
                    disabled={disabled}
                    aria-label="Delete subtask"
                    title="Delete subtask"
                  >
                    <IconTrash />
                  </ActionBtn>
                </Actions>
              </>
            )}
          </Item>
        );
      })}

      <AddRow onSubmit={add}>
        <AddIcon><IconPlus /></AddIcon>
        <AddInput
          ref={addInputRef}
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={total === 0 ? 'Add a subtask…' : 'Add another…'}
          disabled={disabled}
        />
      </AddRow>
    </Wrap>
  );
};

export default SubtaskList;
