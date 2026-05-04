import type { Task, Meeting, Reminder, Journal } from '../types';

/**
 * REST clients for Piovra. All endpoints are mounted under `/v1/...` and
 * authenticate via the `piovra_sid` session cookie set by the OAuth flow.
 *
 * Configure `VITE_PIOVRA_BASE_URL` to the public Piovra origin (or leave
 * empty to use a same-origin proxy in production).
 */
const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const API_URL = `${PIOVRA_BASE_URL}/v1`;

/** Piovra stores `durationMinutes`; the SPA uses `duration` (minutes). */
function mapMeetingFromServer(raw: unknown): Meeting {
  const r = raw as Record<string, unknown>;
  const dm = r.durationMinutes;
  const legacy = r.duration;
  const duration =
    typeof dm === 'number' ? dm : typeof legacy === 'number' ? legacy : 30;
  const { durationMinutes: _dm, duration: _d, ...rest } = r;
  return { ...(rest as Omit<Meeting, 'duration'>), duration };
}

function mapMeetingToApiBody(updates: Partial<Meeting>): Record<string, unknown> {
  const { duration, ...rest } = updates;
  const body: Record<string, unknown> = { ...rest };
  if (duration !== undefined) body.durationMinutes = duration;
  return body;
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}/${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API request failed with status ${response.status}`);
  }

  if (response.status === 204) return undefined as unknown as T;
  return response.json();
}

export const TasksAPI = {
  getAll: (): Promise<Task[]> => fetchApi<Task[]>('tasks'),

  getById: (id: string): Promise<Task> => fetchApi<Task>(`tasks/${id}`),

  create: (task: Omit<Task, 'id' | 'createdAt' | 'timeSpent' | 'timers'>): Promise<Task> =>
    fetchApi<Task>('tasks', {
      method: 'POST',
      body: JSON.stringify({
        ...task,
        id: crypto.randomUUID(),
      }),
    }),

  update: (id: string, updates: Partial<Task>): Promise<Task> =>
    fetchApi<Task>(`tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  delete: (id: string): Promise<void> =>
    fetchApi<void>(`tasks/${id}`, {
      method: 'DELETE',
    }),
};

export const MeetingsAPI = {
  getAll: async (): Promise<Meeting[]> => {
    const rows = await fetchApi<unknown[]>('meetings');
    return rows.map(mapMeetingFromServer);
  },

  getById: async (id: string): Promise<Meeting> =>
    mapMeetingFromServer(await fetchApi<unknown>(`meetings/${id}`)),

  create: async (meeting: Omit<Meeting, 'id'>): Promise<Meeting> => {
    const { duration, ...rest } = meeting;
    const raw = await fetchApi<unknown>('meetings', {
      method: 'POST',
      body: JSON.stringify({
        ...rest,
        durationMinutes: duration,
        id: crypto.randomUUID(),
      }),
    });
    return mapMeetingFromServer(raw);
  },

  update: async (id: string, updates: Partial<Meeting>): Promise<Meeting> => {
    const raw = await fetchApi<unknown>(`meetings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(mapMeetingToApiBody(updates)),
    });
    return mapMeetingFromServer(raw);
  },

  delete: (id: string): Promise<void> =>
    fetchApi<void>(`meetings/${id}`, {
      method: 'DELETE',
    }),
};

export const RemindersAPI = {
  getAll: (): Promise<Reminder[]> => fetchApi<Reminder[]>('reminders'),

  getById: (id: string): Promise<Reminder> => fetchApi<Reminder>(`reminders/${id}`),

  create: (reminder: Omit<Reminder, 'id'>): Promise<Reminder> =>
    fetchApi<Reminder>('reminders', {
      method: 'POST',
      body: JSON.stringify({
        ...reminder,
        id: crypto.randomUUID(),
      }),
    }),

  update: (id: string, updates: Partial<Reminder>): Promise<Reminder> =>
    fetchApi<Reminder>(`reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  delete: (id: string): Promise<void> =>
    fetchApi<void>(`reminders/${id}`, {
      method: 'DELETE',
    }),
};

export const JournalsAPI = {
  getAll: (): Promise<Journal[]> => fetchApi<Journal[]>('journals'),

  getById: (id: string): Promise<Journal> => fetchApi<Journal>(`journals/${id}`),

  create: (journal: Omit<Journal, 'id' | 'createdAt'>): Promise<Journal> =>
    fetchApi<Journal>('journals', {
      method: 'POST',
      body: JSON.stringify({
        ...journal,
        id: crypto.randomUUID(),
      }),
    }),

  update: (id: string, updates: Partial<Journal>): Promise<Journal> =>
    fetchApi<Journal>(`journals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  delete: (id: string): Promise<void> =>
    fetchApi<void>(`journals/${id}`, {
      method: 'DELETE',
    }),

  search: (query: string): Promise<Journal[]> =>
    fetchApi<Journal[]>(`journals?search=${encodeURIComponent(query)}`),
};
