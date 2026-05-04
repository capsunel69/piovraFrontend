/**
 * Thin client for the Piovra orchestrator.
 *
 * All requests target Piovra directly (cross-origin if needed) and rely on
 * the `piovra_sid` session cookie set by the Google OAuth flow. No
 * shared-secret API key in the browser anymore.
 *
 * This file intentionally has no UI dependencies — it mirrors the structure
 * of `src/services/api.ts`. The Agents Hub UI (Definitions, Instances,
 * Schedules, Runs, Reports) is built on top of these calls.
 */

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const BASE_URL = `${PIOVRA_BASE_URL}/v1`;

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error';
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type AgentStep =
  | { kind: 'thought'; text: string; at: string }
  | { kind: 'tool_call'; skill: string; toolCallId: string; args: unknown; at: string }
  | { kind: 'tool_result'; skill: string; toolCallId: string; result: unknown; at: string }
  | { kind: 'message'; role: 'assistant' | 'user'; content: string; at: string }
  | { kind: 'error'; message: string; at: string };

export interface AgentDefinition {
  id: string;
  name: string;
  description: string | null;
  model: string;
  systemPrompt: string;
  skills: string[];
  temperature: number | null;
  maxTokens: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentInstance {
  id: string;
  definitionId: string;
  name: string;
  status: AgentStatus;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  instanceId: string;
  /** Set when the run was triggered by a scheduled job (or "run now" on a job). */
  jobId: string | null;
  input: string;
  status: RunStatus;
  steps: AgentStep[];
  output: string | null;
  error: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: string | null;
  langfuseTraceId: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface UsageTotals {
  runs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  unknownPricingRows: number;
}

export interface UsageByModelRow {
  model: string;
  runs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null;
  hasPricing: boolean;
  lastRunAt: string | null;
}

export interface UsageByInstanceRow extends UsageByModelRow {
  instanceId: string;
  instanceName: string;
  definitionName: string;
}

export interface UsageResponse<T> {
  rows: T[];
  totals: UsageTotals;
}

export interface SkillDescriptor {
  id: string;
  description: string;
  source: 'builtin' | 'mcp';
  requiresConfirmation: boolean;
}

export interface DefinitionCreate {
  name: string;
  description?: string | null;
  model: string;
  systemPrompt: string;
  skills: string[];
  temperature?: number | null;
  maxTokens?: number | null;
}

export type DefinitionPatch = Partial<DefinitionCreate>;

export interface InstanceCreate {
  definitionId: string;
  name: string;
  status?: AgentStatus;
  configOverrides?: Record<string, unknown> | null;
  schedule?: { cron: string; enabled: boolean; nextRunAt?: string } | null;
}

export type InstancePatch = Partial<Omit<InstanceCreate, 'definitionId'>>;

export interface ScheduledJob {
  id: string;
  instanceId: string;
  name: string;
  cron: string;
  /** IANA timezone the cron expression is interpreted in. `null` falls back
   * to the server's local time. */
  tz: string | null;
  enabled: boolean;
  payload: { input: string; metadata?: Record<string, unknown> };
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export interface JobCreate {
  instanceId: string;
  name: string;
  cron: string;
  tz?: string | null;
  enabled?: boolean;
  payload: { input: string; metadata?: Record<string, unknown> };
}

export type JobPatch = Partial<Omit<JobCreate, 'instanceId'>>;

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** User image for vision (raw base64, no data-URL prefix). Matches Piovra `/orchestrate`. */
export type OrchestrateUserImage = {
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  data: string;
};

export interface OrchestrateOptions {
  input: string;
  instanceId?: string;
  signal?: AbortSignal;
  onStep?: (step: AgentStep) => void;
  onStarted?: (info: { instanceId: string; runId?: string }) => void;
  onCompleted?: (info: {
    runId: string;
    output: string;
    tokensIn: number | null;
    tokensOut: number | null;
  }) => void;
  onError?: (message: string) => void;
  /** Prior turns in this chat thread (oldest first). Lets the agent resolve
   * referents like "that task" without server-side thread persistence. */
  history?: ChatHistoryMessage[];
  /** Live workspace snapshot (active tasks, recently completed, meetings,
   * reminders). Appended to the system prompt for this turn so the agent
   * can act without first calling list skills. */
  context?: string;
  /** Images for this turn only (vision). Omitted from `history` on later calls. */
  images?: OrchestrateUserImage[];
  /** How long to keep polling after the SSE stream drops before giving up.
   * Defaults to 10 minutes — enough for Netlify Pro (10m) and most long runs. */
  pollTimeoutMs?: number;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Piovra GET ${path} -> ${res.status}`);
  return res.json();
}

async function sendJson<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Piovra ${method} ${path} -> ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const PiovraAPI = {
  listDefinitions: (): Promise<AgentDefinition[]> => getJson('/definitions'),
  getDefinition: (id: string): Promise<AgentDefinition> => getJson(`/definitions/${id}`),
  createDefinition: (body: DefinitionCreate): Promise<AgentDefinition> =>
    sendJson('/definitions', 'POST', body),
  updateDefinition: (id: string, body: DefinitionPatch): Promise<AgentDefinition> =>
    sendJson(`/definitions/${id}`, 'PATCH', body),
  deleteDefinition: (id: string): Promise<void> =>
    sendJson(`/definitions/${id}`, 'DELETE'),

  listInstances: (): Promise<AgentInstance[]> => getJson('/instances'),
  getInstance: (id: string): Promise<AgentInstance> => getJson(`/instances/${id}`),
  createInstance: (body: InstanceCreate): Promise<AgentInstance> =>
    sendJson('/instances', 'POST', body),
  updateInstance: (id: string, body: InstancePatch): Promise<AgentInstance> =>
    sendJson(`/instances/${id}`, 'PATCH', body),
  deleteInstance: (id: string): Promise<void> =>
    sendJson(`/instances/${id}`, 'DELETE'),

  listRuns: (instanceId?: string): Promise<AgentRun[]> =>
    getJson(`/runs${instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : ''}`),
  getRun: (id: string): Promise<AgentRun> => getJson(`/runs/${id}`),

  listSkills: (): Promise<SkillDescriptor[]> => getJson('/skills'),

  getUsageByModel: (sinceDays?: number): Promise<UsageResponse<UsageByModelRow>> =>
    getJson(`/usage/by-model${sinceDays ? `?sinceDays=${sinceDays}` : ''}`),
  getUsageByInstance: (
    sinceDays?: number,
  ): Promise<UsageResponse<UsageByInstanceRow>> =>
    getJson(`/usage/by-instance${sinceDays ? `?sinceDays=${sinceDays}` : ''}`),

  listJobs: (instanceId?: string): Promise<ScheduledJob[]> =>
    getJson(`/jobs${instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : ''}`),
  getJob: (id: string): Promise<ScheduledJob> => getJson(`/jobs/${id}`),
  createJob: (body: JobCreate): Promise<ScheduledJob> => sendJson('/jobs', 'POST', body),
  updateJob: (id: string, body: JobPatch): Promise<ScheduledJob> =>
    sendJson(`/jobs/${id}`, 'PATCH', body),
  deleteJob: (id: string): Promise<void> => sendJson(`/jobs/${id}`, 'DELETE'),
  runJobNow: (id: string): Promise<{ ok: true }> => sendJson(`/jobs/${id}/run`, 'POST'),

  /**
   * Start an orchestration turn and stream events.
   *
   * Netlify Functions cap synchronous execution at ~26s (free) / 10min (Pro),
   * which is well under some long-running agent runs. So if the SSE stream
   * drops before we see a terminal event, we transparently fall back to
   * polling `/runs/:id` until the run reaches `succeeded`/`failed`/`cancelled`,
   * replaying any steps we missed so the UI stays in sync.
   *
   * The promise resolves once either path (stream or polling) terminates.
   */
  orchestrate: async (opts: OrchestrateOptions): Promise<void> => {
    // Track state across SSE + polling so neither layer double-fires callbacks
    // or misses steps.
    const state: OrchestrateState = {
      runId: null,
      stepsEmitted: 0,
      terminalSeen: false,
    };

    // Wrap the caller's onStep so we always know how many steps have been
    // pushed to the consumer — polling uses this to avoid duplicates.
    const wrappedOnStep = (step: AgentStep): void => {
      state.stepsEmitted += 1;
      opts.onStep?.(step);
    };
    const wrappedOpts: OrchestrateOptions = { ...opts, onStep: wrappedOnStep };

    try {
      const timezone = (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
          return undefined;
        }
      })();

      const res = await fetch(`${BASE_URL}/orchestrate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          input: opts.input,
          instanceId: opts.instanceId,
          clientTime: new Date().toISOString(),
          timezone,
          history: opts.history,
          context: opts.context,
          images: opts.images,
        }),
        signal: opts.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Piovra orchestrate -> ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex: number;
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          handleEvent(rawEvent, wrappedOpts, state);
        }
      }
    } catch (err) {
      // Caller abort — surface it. Anything else (network blip, Netlify
      // function timeout, etc.) falls through to polling below.
      if (opts.signal?.aborted) throw err;
    }

    if (state.terminalSeen) return;
    if (opts.signal?.aborted) return;
    if (!state.runId) {
      opts.onError?.('Piovra stream closed before a run was created.');
      return;
    }

    await pollRunUntilDone(state.runId, wrappedOpts, state);
  },
};

interface OrchestrateState {
  runId: string | null;
  stepsEmitted: number;
  terminalSeen: boolean;
}

function handleEvent(raw: string, opts: OrchestrateOptions, state: OrchestrateState): void {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) continue; // heartbeat
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;

  let data: unknown;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[piovra] SSE data JSON parse failed', err, dataLines.join('\n').slice(0, 500));
    }
    return;
  }

  switch (event) {
    case 'run.started': {
      const info = data as { instanceId: string; runId?: string };
      if (info.runId) state.runId = info.runId;
      opts.onStarted?.(info);
      break;
    }
    case 'step':
      opts.onStep?.(data as AgentStep);
      break;
    case 'run.completed':
      state.terminalSeen = true;
      opts.onCompleted?.(
        data as { runId: string; output: string; tokensIn: number | null; tokensOut: number | null },
      );
      break;
    case 'run.failed':
      state.terminalSeen = true;
      opts.onError?.((data as { error: string }).error);
      break;
  }
}

async function pollRunUntilDone(
  runId: string,
  opts: OrchestrateOptions,
  state: OrchestrateState,
): Promise<void> {
  const deadline = Date.now() + (opts.pollTimeoutMs ?? 10 * 60 * 1000);
  const intervalMs = 2_000;

  while (Date.now() < deadline) {
    if (opts.signal?.aborted) return;

    let run: AgentRun;
    try {
      run = await PiovraAPI.getRun(runId);
    } catch {
      // Transient network blip — keep trying until the deadline.
      await sleep(intervalMs);
      continue;
    }

    // Replay any steps we haven't already pushed to the consumer.
    if (Array.isArray(run.steps) && run.steps.length > state.stepsEmitted) {
      for (let i = state.stepsEmitted; i < run.steps.length; i++) {
        opts.onStep?.(run.steps[i]);
      }
    }

    if (run.status === 'succeeded') {
      state.terminalSeen = true;
      opts.onCompleted?.({
        runId: run.id,
        output: run.output ?? '',
        tokensIn: run.tokensIn,
        tokensOut: run.tokensOut,
      });
      return;
    }
    if (run.status === 'failed' || run.status === 'cancelled') {
      state.terminalSeen = true;
      opts.onError?.(run.error ?? run.status);
      return;
    }

    await sleep(intervalMs);
  }

  opts.onError?.('Timed out waiting for run to finish. It may still be running server-side.');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
