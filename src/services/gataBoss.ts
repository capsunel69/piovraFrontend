const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const API_URL = `${PIOVRA_BASE_URL}/v1/gata-boss`;

export const GATA_UPLOAD_ACCEPT =
  '.pdf,.docx,.txt,.md,.markdown,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json';

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

export interface GbChatAttachment {
  name: string;
  content: string;
}

export interface GbExtractedFile {
  name: string;
  content: string;
  kind: string;
  charCount: number;
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
    const body = (await res.json()) as { error?: string; errors?: Array<{ name: string; error: string }> };
    if (body.error === 'extraction_failed' && body.errors?.length) {
      return body.errors.map((e) => `${e.name}: ${e.error}`).join('; ');
    }
    return body.error || `HTTP ${res.status}`;
  } catch {
    if (res.status === 413) {
      return 'File too large for the server upload limit (max 128 MB per file)';
    }
    return `HTTP ${res.status}`;
  }
}

function networkErrorMessage(err: unknown): string {
  if (err instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(err.message)) {
    return 'Upload blocked by the server (likely nginx body-size limit on backend.piovra-op.com). Add a /v1/gata-boss location with client_max_body_size 128m, then reload nginx.';
  }
  if (err instanceof Error) return err.message;
  return 'Request failed';
}

async function gataFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, { credentials: 'include', ...init });
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }
}

export async function listDocuments(): Promise<GbDocumentListItem[]> {
  const res = await gataFetch(`${API_URL}/documents`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getDocument(id: string): Promise<GbDocumentDetail> {
  const res = await gataFetch(`${API_URL}/documents/${id}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createDocument(input: {
  title?: string;
  content: string;
}): Promise<GbDocumentDetail> {
  const res = await gataFetch(`${API_URL}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function uploadDocuments(files: File[], title?: string): Promise<{
  documents: Array<{ id: string; title: string; summary: string }>;
  errors: Array<{ name: string; error: string }>;
}> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  if (title?.trim()) form.append('title', title.trim());
  const res = await gataFetch(`${API_URL}/documents/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function extractFiles(files: File[]): Promise<{
  files: GbExtractedFile[];
  errors: Array<{ name: string; error: string }>;
}> {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const res = await gataFetch(`${API_URL}/extract`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await gataFetch(`${API_URL}/documents/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseError(res));
}

export interface GbThreadListItem {
  id: string;
  title: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GbThreadMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | string;
  content: string;
  fileNames: string[];
  createdAt: string;
}

export interface GbThreadDetail extends GbThreadListItem {
  messages: GbThreadMessage[];
}

export async function listThreads(): Promise<GbThreadListItem[]> {
  const res = await gataFetch(`${API_URL}/threads`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createThread(input?: {
  title?: string;
  model?: string;
}): Promise<GbThreadListItem> {
  const res = await gataFetch(`${API_URL}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getThread(id: string): Promise<GbThreadDetail> {
  const res = await gataFetch(`${API_URL}/threads/${id}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function deleteThread(id: string): Promise<void> {
  const res = await gataFetch(`${API_URL}/threads/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseError(res));
}

export interface GbChatHandlers {
  onStarted?: (info: { model: string; threadId?: string; title?: string }) => void;
  onToken?: (text: string, threadId?: string) => void;
  onCompleted?: (info: {
    text: string;
    tokensIn: number | null;
    tokensOut: number | null;
    model: string;
    threadId?: string;
    title?: string;
  }) => void;
  onFailed?: (error: string, threadId?: string) => void;
}

export async function streamChat(
  input: {
    message: string;
    history?: GbChatHistoryItem[];
    model?: string;
    attachments?: GbChatAttachment[];
    threadId?: string;
  },
  handlers: GbChatHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await gataFetch(`${API_URL}/chat`, {
    method: 'POST',
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
    const threadId = typeof obj.threadId === 'string' ? obj.threadId : undefined;
    switch (name) {
      case 'chat.started':
        handlers.onStarted?.({
          model: String(obj.model ?? ''),
          threadId,
          title: typeof obj.title === 'string' ? obj.title : undefined,
        });
        break;
      case 'token':
        handlers.onToken?.(String(obj.text ?? ''), threadId);
        break;
      case 'chat.completed':
        handlers.onCompleted?.({
          text: String(obj.text ?? ''),
          tokensIn: typeof obj.tokensIn === 'number' ? obj.tokensIn : null,
          tokensOut: typeof obj.tokensOut === 'number' ? obj.tokensOut : null,
          model: String(obj.model ?? ''),
          threadId,
          title: typeof obj.title === 'string' ? obj.title : undefined,
        });
        break;
      case 'chat.failed':
        handlers.onFailed?.(String(obj.error ?? 'Chat failed'), threadId);
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
