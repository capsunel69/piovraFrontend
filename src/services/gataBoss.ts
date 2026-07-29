const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const API_URL = `${PIOVRA_BASE_URL}/v1/gata-boss`;

export interface GbDocumentListItem {
  id: string;
  title: string;
  summary: string;
  contentLength: number;
  createdByUserId: string;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GbDocumentDetail extends Omit<GbDocumentListItem, 'contentLength'> {
  content: string;
}

export interface GbChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface GbChatModel {
  id: string;
  label: string;
  provider: 'openai' | 'google';
}

export const GATA_DEFAULT_MODEL = 'openai:gpt-5.4';

export const GATA_CHAT_MODELS: GbChatModel[] = [
  { id: 'openai:gpt-5.4', label: 'GPT-5.4', provider: 'openai' },
  { id: 'openai:gpt-5.4-mini', label: 'GPT-5.4 Mini', provider: 'openai' },
  { id: 'openai:gpt-5', label: 'GPT-5', provider: 'openai' },
  { id: 'openai:gpt-5-mini', label: 'GPT-5 Mini', provider: 'openai' },
  { id: 'openai:gpt-4.1', label: 'GPT-4.1', provider: 'openai' },
  { id: 'openai:gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai' },
  { id: 'google:gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google' },
  { id: 'google:gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google' },
  { id: 'google:gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', provider: 'google' },
  { id: 'google:gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'google' },
];

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function listDocuments(): Promise<GbDocumentListItem[]> {
  const res = await fetch(`${API_URL}/documents`, { credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getDocument(id: string): Promise<GbDocumentDetail> {
  const res = await fetch(`${API_URL}/documents/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createDocument(input: {
  title?: string;
  content: string;
}): Promise<GbDocumentDetail> {
  const res = await fetch(`${API_URL}/documents`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/documents/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseError(res));
}

export interface GbChatHandlers {
  onStarted?: (info: { model: string }) => void;
  onToken?: (text: string) => void;
  onCompleted?: (info: {
    text: string;
    tokensIn: number | null;
    tokensOut: number | null;
    model: string;
  }) => void;
  onFailed?: (error: string) => void;
}

export async function streamChat(
  input: { message: string; history: GbChatHistoryItem[]; model?: string },
  handlers: GbChatHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';

  const dispatch = (name: string, data: string) => {
    let parsed: unknown = data;
    try {
      parsed = JSON.parse(data);
    } catch {
      /* keep raw */
    }
    const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
    switch (name) {
      case 'chat.started':
        handlers.onStarted?.({ model: String(obj.model ?? '') });
        break;
      case 'token':
        handlers.onToken?.(String(obj.text ?? ''));
        break;
      case 'chat.completed':
        handlers.onCompleted?.({
          text: String(obj.text ?? ''),
          tokensIn: typeof obj.tokensIn === 'number' ? obj.tokensIn : null,
          tokensOut: typeof obj.tokensOut === 'number' ? obj.tokensOut : null,
          model: String(obj.model ?? ''),
        });
        break;
      case 'chat.failed':
        handlers.onFailed?.(String(obj.error ?? 'Chat failed'));
        break;
      default:
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';

    for (const line of parts) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dispatch(eventName, line.slice(5).trim());
        eventName = 'message';
      } else if (line.startsWith(':')) {
        /* heartbeat */
      } else if (line === '') {
        eventName = 'message';
      }
    }
  }
}
