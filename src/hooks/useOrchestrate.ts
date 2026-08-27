import { useCallback, useRef, useState } from 'react';
import {
  PiovraAPI,
  type AgentStep,
  type ChatHistoryMessage,
  type NeedsConsentInfo,
  type OrchestrateUserFile,
} from '../services/piovra';
import { useAppContext } from '../context/AppContext';
import type { Contact, Journal, Meeting, Reminder, Task } from '../types';

export type ChatStatus = 'idle' | 'streaming' | 'error';

export interface TurnFileMeta {
  name: string;
  size: number;
}

export interface ChatTurn {
  id: string;
  input: string;
  /** Files sent with this turn (names + sizes; bytes are not kept). */
  files?: TurnFileMeta[];
  /** Server-extracted content of this turn's attachments, replayed into
   *  later turns' history so the whole chat keeps access to the files. */
  attachmentMemory?: Array<{ name: string; text?: string }>;
  steps: AgentStep[];
  output: string | null;
  error: string | null;
  needsConsent: NeedsConsentInfo | null;
  status: ChatStatus;
  runId: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  startedAt: string;
}

interface UseOrchestrateResult {
  turns: ChatTurn[];
  status: ChatStatus;
  send: (input: string, files?: OrchestrateUserFile[]) => Promise<void>;
  abort: () => void;
  reset: () => void;
}

export function useOrchestrate(instanceId?: string): UseOrchestrateResult {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const {
    tasks,
    meetings,
    reminders,
    journals,
    contacts,
    refreshTasks,
    refreshMeetings,
    refreshReminders,
    refreshJournals,
  } = useAppContext();

  // Keep the latest workspace data in refs so `send` (a stable callback)
  // always builds the snapshot from up-to-date state without forcing the
  // callback to re-create on every tasks/meetings/reminders mutation.
  const tasksRef = useRef<Task[]>(tasks);
  const meetingsRef = useRef<Meeting[]>(meetings);
  const remindersRef = useRef<Reminder[]>(reminders);
  const journalsRef = useRef<Journal[]>(journals);
  const contactsRef = useRef<Contact[]>(contacts);
  tasksRef.current = tasks;
  meetingsRef.current = meetings;
  remindersRef.current = reminders;
  journalsRef.current = journals;
  contactsRef.current = contacts;

  /**
   * Watch each agent step. When the agent calls a Piovra workspace mutation
   * skill (anything except `.list`) and gets a successful tool_result back,
   * refresh the matching resource so the rest of the UI shows the change live.
   *
   * Note: the AI SDK normalises skill ids by replacing dots with underscores.
   * We still match legacy `capsuna_*` step ids for older runs.
   */
  const reactToStep = useCallback(
    (step: AgentStep): void => {
      if (step.kind !== 'tool_result') return;
      const skill = (step.skill ?? '').replace(/\./g, '_');
      const workspace =
        skill.startsWith('piovra_') ||
        skill.startsWith('capsuna_');
      if (!workspace) return;
      if (skill.endsWith('_list')) return;
      if (
        skill.startsWith('piovra_tasks_') ||
        skill.startsWith('capsuna_tasks_')
      )
        void refreshTasks();
      else if (
        skill.startsWith('piovra_meetings_') ||
        skill.startsWith('capsuna_meetings_')
      )
        void refreshMeetings();
      else if (
        skill.startsWith('piovra_reminders_') ||
        skill.startsWith('capsuna_reminders_')
      )
        void refreshReminders();
      else if (
        skill.startsWith('piovra_notes_') ||
        skill.startsWith('capsuna_notes_') ||
        skill.startsWith('piovra_journals_') ||
        skill.startsWith('capsuna_journals_')
      )
        void refreshJournals();
    },
    [refreshTasks, refreshMeetings, refreshReminders, refreshJournals],
  );

  const updateTurn = (id: string, patch: Partial<ChatTurn>): void => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const appendStep = (id: string, step: AgentStep): void => {
    setTurns((prev) =>
      prev.map((t) => (t.id === id ? { ...t, steps: [...t.steps, step] } : t)),
    );
  };

  const turnsRef = useRef<ChatTurn[]>(turns);
  turnsRef.current = turns;

  const send = useCallback(
    async (input: string, files?: OrchestrateUserFile[]): Promise<void> => {
      const trimmed = input.trim();
      const fileList = files?.length ? files : undefined;
      if (!trimmed && !fileList?.length) return;

      const history = buildHistory(turnsRef.current);
      const context = buildContextSnapshot({
        tasks: tasksRef.current,
        meetings: meetingsRef.current,
        reminders: remindersRef.current,
        journals: journalsRef.current,
        contacts: contactsRef.current,
      });

      const turnId = crypto.randomUUID();
      const newTurn: ChatTurn = {
        id: turnId,
        input: trimmed,
        files: fileList?.map((f, i) => ({
          name: f.filename?.trim() || `file ${i + 1}`,
          // base64 → raw bytes
          size: Math.round((f.data.length * 3) / 4),
        })),
        steps: [],
        output: null,
        error: null,
        needsConsent: null,
        status: 'streaming',
        runId: null,
        tokensIn: null,
        tokensOut: null,
        startedAt: new Date().toISOString(),
      };
      setTurns((prev) => [...prev, newTurn]);
      setStatus('streaming');

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await PiovraAPI.orchestrate({
          input: trimmed,
          instanceId,
          history,
          context,
          files: fileList,
          signal: controller.signal,
          onStep: (step) => {
            if (step.kind === 'attachments') {
              // Not rendered as a step — stored on the turn and replayed into
              // history so later messages keep access to the file content.
              updateTurn(turnId, { attachmentMemory: step.files });
              return;
            }
            appendStep(turnId, step);
            reactToStep(step);
          },
          onCompleted: ({ runId, output, tokensIn, tokensOut }) => {
            updateTurn(turnId, {
              status: 'idle',
              runId,
              output,
              tokensIn,
              tokensOut,
            });
          },
          onError: (message) => {
            updateTurn(turnId, { status: 'error', error: message });
          },
          onNeedsConsent: (info) => {
            updateTurn(turnId, { status: 'error', needsConsent: info, error: null });
          },
        });
        setStatus('idle');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        updateTurn(turnId, { status: 'error', error: message });
        setStatus('error');
      } finally {
        abortRef.current = null;
      }
    },
    [instanceId, reactToStep],
  );

  const abort = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setTurns((prev) =>
      prev.map((t) =>
        t.status === 'streaming' ? { ...t, status: 'error', error: 'aborted' } : t,
      ),
    );
  }, []);

  const reset = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setTurns([]);
    setStatus('idle');
  }, []);

  return { turns, status, send, abort, reset };
}

/**
 * Flatten completed turns into a chat history the orchestrator can replay.
 * Each prior turn contributes the user input plus, if the assistant produced
 * a final message, that final assistant text. Tool calls/results are
 * intentionally omitted — the agent re-derives ids each turn via
 * capsuna.*.list, which is cheap and avoids tool-message format drift.
 *
 * Attachment content extracted server-side (turn.attachmentMemory) is
 * replayed inside the user message that sent the files, so the whole chat
 * keeps access to file contents — not just the turn that uploaded them.
 * Newest turns get budget priority; older files degrade to names only.
 *
 * Capped to the last N messages so prompt cost stays bounded.
 */
const MEMORY_TOTAL_BUDGET = 800_000;
const MEMORY_PER_TURN = 200_000;
const HISTORY_MESSAGE_MAX = 380_000;

function buildHistory(turns: ChatTurn[]): ChatHistoryMessage[] {
  const MAX_MESSAGES = 200;
  const prior = turns.filter((t) => t.status !== 'streaming');

  // Allocate the replay budget newest-first so recent files stay complete.
  let budget = MEMORY_TOTAL_BUDGET;
  const memoryBlockByTurn = new Map<string, string>();
  for (let i = prior.length - 1; i >= 0; i--) {
    const t = prior[i];
    const mem = (t.attachmentMemory ?? []).filter((m) => m.text?.trim());
    if (mem.length === 0 || budget <= 200) continue;
    let block = '';
    let used = 0;
    for (const m of mem) {
      const text = m.text!.trim();
      const room = Math.min(MEMORY_PER_TURN, budget) - used;
      if (room <= 200) break;
      const body = text.length > room ? `${text.slice(0, room)}\n…(truncated)` : text;
      block += `\n\n### Content of attached file: ${m.name}\n${body}`;
      used += body.length;
    }
    if (block) {
      memoryBlockByTurn.set(t.id, block);
      budget -= used;
    }
  }

  const out: ChatHistoryMessage[] = [];
  for (const t of prior) {
    const u = t.input?.trim() ?? '';
    const names = (t.files ?? []).map((f) => f.name);
    if (u || names.length > 0) {
      let line = u || 'See attached file(s).';
      if (names.length > 0) line += `\n[Attached files: ${names.join(', ')}]`;
      const mem = memoryBlockByTurn.get(t.id);
      if (mem) line += mem;
      out.push({ role: 'user', content: line.slice(0, HISTORY_MESSAGE_MAX) });
    }
    const assistantText =
      (t.output && t.output.trim()) ||
      lastAssistantText(t.steps) ||
      '';
    if (assistantText) out.push({ role: 'assistant', content: assistantText });
  }
  return out.slice(-MAX_MESSAGES);
}

function lastAssistantText(steps: AgentStep[]): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.kind === 'message' && s.role === 'assistant' && s.content?.trim()) {
      return s.content;
    }
  }
  return '';
}

/**
 * Build a compact text snapshot of the user's current workspace, sent with
 * every orchestrate call so the agent can resolve referents and act
 * directly without first calling capsuna_*_list. Includes:
 *   - all active tasks (with id, priority, dueDate, description preview)
 *   - tasks completed in the last 2 days
 *   - meetings within ±2 days of now
 *   - all active reminders
 *   - contacts (display name, email, description) for resolving mail recipients
 *
 * IDs are the `id` field (uuid) used by the Piovra API — exactly what
 * capsuna_*_update / _complete / _delete skills expect.
 */
function buildContextSnapshot(params: {
  tasks: Task[];
  meetings: Meeting[];
  reminders: Reminder[];
  journals: Journal[];
  contacts: Contact[];
}): string {
  const { tasks, meetings, reminders, journals, contacts } = params;

  const now = new Date();
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const recentCutoff = new Date(now.getTime() - TWO_DAYS_MS);
  const upcomingCutoff = new Date(now.getTime() + TWO_DAYS_MS);

  const sections: string[] = [];

  const activeTasks = tasks.filter((t) => !t.completed);
  if (activeTasks.length > 0) {
    sections.push(
      `Active tasks (${activeTasks.length}):\n` +
        activeTasks.map(formatTaskLine).join('\n'),
    );
  } else {
    sections.push('Active tasks: (none)');
  }

  const recentlyDone = tasks.filter(
    (t) => t.completed && t.completedAt && new Date(t.completedAt) >= recentCutoff,
  );
  if (recentlyDone.length > 0) {
    sections.push(
      `Recently completed tasks (last 2 days, ${recentlyDone.length}):\n` +
        recentlyDone.map(formatTaskLine).join('\n'),
    );
  }

  const relevantMeetings = meetings.filter((m) => {
    if (!m.date) return false;
    const d = new Date(m.date);
    return d >= recentCutoff && d <= upcomingCutoff;
  });
  if (relevantMeetings.length > 0) {
    sections.push(
      `Meetings within ±2 days (${relevantMeetings.length}):\n` +
        relevantMeetings.map(formatMeetingLine).join('\n'),
    );
  }

  const activeReminders = reminders.filter((r) => !r.completed);
  if (activeReminders.length > 0) {
    sections.push(
      `Active reminders (${activeReminders.length}):\n` +
        activeReminders.map(formatReminderLine).join('\n'),
    );
  }

  if (journals.length > 0) {
    const recent = [...journals]
      .sort((a, b) => {
        const ta = new Date(a.updatedAt ?? a.createdAt ?? a.date ?? 0).getTime();
        const tb = new Date(b.updatedAt ?? b.createdAt ?? b.date ?? 0).getTime();
        return tb - ta;
      })
      .slice(0, 20);
    sections.push(
      `Recent notes (${recent.length}):\n` +
        recent.map(formatJournalLine).join('\n'),
    );
  }

  if (contacts.length > 0) {
    sections.push(
      `Contacts (${contacts.length}) — use these emails when the user refers to someone by name:\n` +
        contacts.map(formatContactLine).join('\n'),
    );
  }

  if (sections.length === 0) return '';
  return sections.join('\n\n');
}

function formatTaskLine(t: Task): string {
  const parts: string[] = [`- [${t.id}] "${oneLine(t.title)}"`];
  parts.push(`priority=${t.priority}`);
  parts.push(`completed=${t.completed}`);
  if (t.dueDate) parts.push(`dueDate=${toIso(t.dueDate)}`);
  if (t.completedAt) parts.push(`completedAt=${toIso(t.completedAt)}`);
  if (t.description?.trim()) parts.push(`description="${truncate(oneLine(t.description), 160)}"`);
  let line = parts.join(' · ');
  if (t.subtasks && t.subtasks.length > 0) {
    const children = t.subtasks
      .map(
        (s) =>
          `    - [${s.id}] ${s.completed ? '[x]' : '[ ]'} "${truncate(oneLine(s.title), 120)}"`,
      )
      .join('\n');
    line += `\n  subtasks (${t.subtasks.filter((s) => s.completed).length}/${t.subtasks.length}):\n${children}`;
  }
  return line;
}

function formatMeetingLine(m: Meeting): string {
  const parts: string[] = [`- [${m.id}] "${oneLine(m.title)}"`];
  if (m.date) parts.push(`date=${toIso(m.date)}`);
  if (typeof m.duration === 'number') parts.push(`duration=${m.duration}m`);
  parts.push(`completed=${m.completed}`);
  if (m.participants?.length) parts.push(`participants=${m.participants.length}`);
  return parts.join(' · ');
}

function formatReminderLine(r: Reminder): string {
  const parts: string[] = [`- [${r.id}] "${oneLine(r.title)}"`];
  if (r.date) parts.push(`date=${toIso(r.date)}`);
  if (r.recurring) parts.push(`recurring=${r.recurring}`);
  parts.push(`completed=${r.completed}`);
  return parts.join(' · ');
}

function formatJournalLine(j: Journal): string {
  const parts: string[] = [`- [${j.id}] "${oneLine(j.title)}"`];
  if (j.date) parts.push(`date=${toIso(j.date)}`);
  if (j.updatedAt) parts.push(`updatedAt=${toIso(j.updatedAt)}`);
  if (j.tags?.length) parts.push(`tags=${j.tags.join(',')}`);
  parts.push(`content="${truncate(oneLine(stripHtml(j.content)), 160)}"`);
  return parts.join(' · ');
}

function formatContactLine(c: Contact): string {
  const parts: string[] = [`- "${oneLine(c.displayName)}" <${c.email.trim()}>`];
  if (c.description?.trim()) parts.push(`note="${truncate(oneLine(c.description), 120)}"`);
  return parts.join(' · ');
}

function oneLine(s: string): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function toIso(d: Date | string): string {
  try {
    return new Date(d).toISOString();
  } catch {
    return String(d);
  }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ');
}
