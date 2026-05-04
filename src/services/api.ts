import type { Task, Meeting, Reminder, Journal, Contact, GmailCorrespondentSuggestion } from '../types';

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

/** Readable message from a failed `fetchApi` call (response body is often JSON `{ error }`). */
export function piovraFetchErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Request failed';
  const raw = err.message.trim();
  try {
    const j = JSON.parse(raw) as { error?: string };
    if (typeof j.error === 'string') {
      if (j.error === 'duplicate_email') return 'That email is already in your contacts.';
      if (/relation\s+["']?contacts["']?\s+does\s+not\s+exist/i.test(j.error)) {
        return 'Server is missing the contacts table — on Piovra run: npm run db:migrate';
      }
      return j.error.length > 200 ? `${j.error.slice(0, 200)}…` : j.error;
    }
  } catch {
    /* plain text body */
  }
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return 'Cannot reach Piovra — check VITE_PIOVRA_BASE_URL and that the API is running.';
  }
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
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

function mapContactRaw(raw: unknown): Contact {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id),
    displayName: String(r.displayName ?? ''),
    email: String(r.email ?? ''),
    description: String(r.description ?? ''),
    createdAt: new Date(String(r.createdAt ?? 0)),
    updatedAt: new Date(String(r.updatedAt ?? 0)),
  };
}

export const ContactsAPI = {
  getAll: async (): Promise<Contact[]> => {
    const rows = await fetchApi<unknown[]>('contacts');
    return rows.map(mapContactRaw);
  },

  create: async (input: {
    displayName: string;
    email: string;
    description?: string;
  }): Promise<Contact> => {
    const raw = await fetchApi<unknown>('contacts', {
      method: 'POST',
      body: JSON.stringify({
        id: crypto.randomUUID(),
        displayName: input.displayName,
        email: input.email,
        description: input.description ?? '',
      }),
    });
    return mapContactRaw(raw);
  },

  update: async (id: string, updates: Partial<Pick<Contact, 'displayName' | 'email' | 'description'>>): Promise<Contact> => {
    const raw = await fetchApi<unknown>(`contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return mapContactRaw(raw);
  },

  delete: (id: string): Promise<void> =>
    fetchApi<void>(`contacts/${id}`, {
      method: 'DELETE',
    }),

  /** Uses Gmail thread metadata (existing consent). Returns [] if Google is not connected (428). */
  gmailSuggestions: async (query?: string): Promise<GmailCorrespondentSuggestion[]> => {
    const qs = query?.trim() ? `?query=${encodeURIComponent(query.trim())}` : '';
    const url = `${API_URL}/contacts/gmail-suggestions${qs}`;
    const res = await fetch(url, { credentials: 'include' });
    if (res.status === 428) return [];
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `gmail-suggestions -> ${res.status}`);
    }
    const data = (await res.json()) as { suggestions?: GmailCorrespondentSuggestion[] };
    return data.suggestions ?? [];
  },
};
