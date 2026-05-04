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
  getAll: (): Promise<Meeting[]> => fetchApi<Meeting[]>('meetings'),

  getById: (id: string): Promise<Meeting> => fetchApi<Meeting>(`meetings/${id}`),

  create: (meeting: Omit<Meeting, 'id'>): Promise<Meeting> =>
    fetchApi<Meeting>('meetings', {
      method: 'POST',
      body: JSON.stringify({
        ...meeting,
        id: crypto.randomUUID(),
      }),
    }),

  update: (id: string, updates: Partial<Meeting>): Promise<Meeting> =>
    fetchApi<Meeting>(`meetings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

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
