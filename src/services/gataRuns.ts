import {
  getThread,
  streamChat,
  type GbChatAttachment,
  type GbChatHistoryItem,
} from './gataBoss';

/**
 * Single source of truth for in-flight GATA Bo$$ generations.
 *
 * Lives at module scope so a run keeps accumulating tokens while the page is
 * unmounted (user switched tabs/routes). The page renders from this store
 * instead of local state, so remounting shows the real progress with no
 * duplicated bubbles and no refresh.
 */

export type GataRunPhase = 'chat' | 'image';
export type GataRunStatus = 'streaming' | 'done' | 'error' | 'aborted';

export interface GataRun {
  threadId: string;
  assistantId: string;
  phase: GataRunPhase;
  status: GataRunStatus;
  /** Tokens accumulated so far (markdown, may contain the image tag). */
  text: string;
  /** Provisional thread title, used for toasts before the server names it. */
  title: string;
  userMessage: string;
  fileNames: string[];
  hasImage: boolean;
  startedAt: number;
  error?: string;
  /** True while this tab owns the SSE connection. False after a page reload. */
  live: boolean;
  /** Set before a completion toast fires so it can never fire twice. */
  announced: boolean;
}

type PersistedRun = Omit<GataRun, 'live' | 'announced'>;

const PERSIST_KEY = 'gata_boss_runs';
const POLL_MS = 2500;
/** Give up on a recovered run that never produces a reply. */
const RECOVERY_TIMEOUT_MS = 6 * 60 * 1000;

const runs = new Map<string, GataRun>();
const aborts = new Map<string, AbortController>();
const listeners = new Set<() => void>();

let snapshot: Record<string, GataRun> = {};
let pollTimer: number | null = null;
let persistTimer: number | null = null;

function writeStorage(): void {
  try {
    const payload: PersistedRun[] = [];
    for (const run of runs.values()) {
      if (run.status !== 'streaming') continue;
      payload.push({
        threadId: run.threadId,
        assistantId: run.assistantId,
        phase: run.phase,
        status: run.status,
        text: run.text,
        title: run.title,
        userMessage: run.userMessage,
        fileNames: run.fileNames,
        hasImage: run.hasImage,
        startedAt: run.startedAt,
        error: run.error,
      });
    }
    if (payload.length === 0) sessionStorage.removeItem(PERSIST_KEY);
    else sessionStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable */
  }
}

/** Tokens arrive many times a second; coalesce the storage writes they cause. */
function persist(immediate: boolean): void {
  if (immediate) {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    writeStorage();
    return;
  }
  if (persistTimer !== null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    writeStorage();
  }, 500);
}

function rebuildSnapshot(): void {
  const next: Record<string, GataRun> = {};
  for (const [id, run] of runs) next[id] = run;
  snapshot = next;
}

function emit(options: { immediatePersist?: boolean } = {}): void {
  rebuildSnapshot();
  persist(options.immediatePersist ?? true);
  syncPoller();
  for (const fn of listeners) fn();
}

function patch(
  threadId: string,
  updates: Partial<GataRun>,
  options?: { immediatePersist?: boolean },
): void {
  const current = runs.get(threadId);
  if (!current) return;
  runs.set(threadId, { ...current, ...updates });
  emit(options);
}

export function subscribeRuns(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRunsSnapshot(): Record<string, GataRun> {
  return snapshot;
}

export function getRun(threadId: string): GataRun | undefined {
  return runs.get(threadId);
}

export function markRunAnnounced(threadId: string): void {
  const run = runs.get(threadId);
  if (!run || run.announced) return;
  runs.set(threadId, { ...run, announced: true });
  rebuildSnapshot();
}

export function clearRun(threadId: string): void {
  if (!runs.delete(threadId)) return;
  aborts.delete(threadId);
  emit();
}

export function abortRun(threadId: string): void {
  aborts.get(threadId)?.abort();
}

export interface StartRunInput {
  threadId: string;
  message: string;
  userMessage: string;
  fileNames: string[];
  title: string;
  model: string;
  attachments?: GbChatAttachment[];
  history?: GbChatHistoryItem[];
}

export function startRun(input: StartRunInput): void {
  const { threadId } = input;
  if (runs.get(threadId)?.status === 'streaming') return;

  const abort = new AbortController();
  aborts.set(threadId, abort);

  const startedAt = Date.now();
  runs.set(threadId, {
    threadId,
    assistantId: `run-${startedAt}`,
    phase: 'chat',
    status: 'streaming',
    text: '',
    title: input.title,
    userMessage: input.userMessage,
    fileNames: input.fileNames,
    hasImage: false,
    startedAt,
    live: true,
    announced: false,
  });
  emit();

  void (async () => {
    try {
      await streamChat(
        {
          message: input.message,
          model: input.model,
          attachments: input.attachments,
          history: input.history,
          threadId,
        },
        {
          onStarted: (info) => {
            if (info.title) patch(threadId, { title: info.title });
          },
          onImageStarted: () => {
            patch(threadId, { phase: 'image' });
          },
          onToken: (delta) => {
            const run = runs.get(threadId);
            if (!run) return;
            patch(threadId, { text: run.text + delta }, { immediatePersist: false });
          },
          onCompleted: (info) => {
            const run = runs.get(threadId);
            patch(threadId, {
              status: 'done',
              text: info.text || run?.text || '',
              title: info.title || run?.title || '',
              hasImage: Boolean(info.images?.length) || Boolean(run?.hasImage),
            });
          },
          onFailed: (error) => {
            patch(threadId, { status: 'error', error });
          },
        },
        abort.signal,
      );
      // Stream closed without a terminal event (e.g. proxy timeout): fall back
      // to polling the thread so the reply still lands.
      const run = runs.get(threadId);
      if (run?.status === 'streaming') patch(threadId, { live: false });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        patch(threadId, { status: 'aborted' });
      } else {
        patch(threadId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Chat failed',
        });
      }
    } finally {
      aborts.delete(threadId);
    }
  })();
}

/**
 * Finalize runs this tab no longer streams (page was reloaded, or the SSE
 * connection dropped) by polling the thread until the assistant reply appears.
 */
function syncPoller(): void {
  const needsPoll = [...runs.values()].some((r) => r.status === 'streaming' && !r.live);

  if (!needsPoll) {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    return;
  }
  if (pollTimer !== null) return;

  pollTimer = window.setInterval(() => {
    void (async () => {
      for (const run of [...runs.values()]) {
        if (run.status !== 'streaming' || run.live) continue;
        try {
          const detail = await getThread(run.threadId);
          // The backend stores the user message before generating, so the reply
          // has landed exactly when the thread's last message is the assistant's.
          const last = detail.messages[detail.messages.length - 1];
          const content = last?.role === 'assistant' ? last.content.trim() : '';
          if (!content) {
            if (Date.now() - run.startedAt > RECOVERY_TIMEOUT_MS) {
              patch(run.threadId, {
                status: 'error',
                error: 'Generation did not finish. Try again.',
              });
            }
            continue;
          }
          patch(run.threadId, {
            status: 'done',
            text: content,
            title: detail.title || run.title,
            hasImage: content.includes('![GATA visual]'),
          });
        } catch {
          /* transient; retry on next tick */
        }
      }
    })();
  }, POLL_MS);
}

function hydrate(): void {
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedRun[];
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      if (!item?.threadId) continue;
      runs.set(item.threadId, { ...item, live: false, announced: false });
    }
    rebuildSnapshot();
    syncPoller();
  } catch {
    /* ignore malformed state */
  }
}

hydrate();

// A reload mid-generation would otherwise lose the tokens buffered since the
// last throttled write.
window.addEventListener('beforeunload', () => persist(true));
