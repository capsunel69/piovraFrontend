const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const API_URL = `${PIOVRA_BASE_URL}/v1/transcribe`;

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speakerLabel?: string;
}

export interface SpeakerSegment extends TranscriptSegment {
  speaker: 'host' | 'guest';
  speakerLabel: string;
}

export interface TranscribeProgress {
  percent: number;
  message: string;
  stage: string;
}

export interface TranscribeCompleteResult {
  type: 'complete';
  id?: string;
  contentType: string;
  transcript: string;
  srt: string | null;
  segments: TranscriptSegment[] | null;
  speakerSegments: SpeakerSegment[] | null;
}

export interface TranscriptListItem {
  id: string;
  source: string;
  sourceName: string | null;
  language: string | null;
  mode: string;
  contentType: string;
  durationSec: number | null;
  createdAt: string;
}

export interface TranscriptDetail extends TranscriptListItem {
  transcript: string;
  srt: string | null;
  segments: TranscriptSegment[] | null;
  speakerSegments: SpeakerSegment[] | null;
}

async function readStreamResponse(
  response: Response,
  onProgress: (p: TranscribeProgress) => void,
): Promise<TranscribeCompleteResult> {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('ndjson')) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || 'Server error');
    }
    return payload as TranscribeCompleteResult;
  }

  if (!response.ok) {
    throw new Error('Server error');
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: TranscribeCompleteResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as {
        type: string;
        percent?: number;
        message?: string;
        stage?: string;
        error?: string;
        details?: string;
      };

      if (event.type === 'progress') {
        onProgress({
          percent: event.percent ?? 0,
          message: event.message || 'Processing...',
          stage: event.stage || 'working',
        });
      }

      if (event.type === 'complete') {
        result = event as TranscribeCompleteResult;
      }

      if (event.type === 'error') {
        throw new Error(event.details || event.error || 'Transcription failed.');
      }
    }
  }

  if (!result) {
    throw new Error('Incomplete server response.');
  }

  return result;
}

async function fetchTr<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}/${endpoint}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* use raw */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as unknown as T;
  return response.json() as Promise<T>;
}

export const TranscribeAPI = {
  async transcribeFile(
    file: File,
    opts: {
      language: string;
      mode: 'text' | 'subtitles';
      contentType: 'default' | 'podcast';
    },
    onProgress: (p: TranscribeProgress) => void,
  ): Promise<TranscribeCompleteResult> {
    const formData = new FormData();
    formData.append('audioFile', file);
    formData.append('language', opts.language);
    formData.append('mode', opts.mode);
    formData.append('contentType', opts.contentType);

    const res = await fetch(`${API_URL}/`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok && !contentType.includes('ndjson')) {
      if (res.status === 413) {
        throw new Error(
          `File too large for server (${(file.size / 1024 / 1024).toFixed(0)} MB). Limit is 2 GB.`,
        );
      }
      const e = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(e.error || 'Server error');
    }

    return readStreamResponse(res, onProgress);
  },

  async transcribeUrl(
    url: string,
    opts: {
      language: string;
      mode: 'text' | 'subtitles';
      contentType: 'default' | 'podcast';
    },
    onProgress: (p: TranscribeProgress) => void,
  ): Promise<TranscribeCompleteResult> {
    const res = await fetch(`${API_URL}/url`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url.trim(),
        language: opts.language,
        mode: opts.mode,
        contentType: opts.contentType,
      }),
    });

    return readStreamResponse(res, onProgress);
  },

  getHistory: () => fetchTr<TranscriptListItem[]>('history'),

  get: (id: string) => fetchTr<TranscriptDetail>(id),

  remove: (id: string) => fetchTr<void>(id, { method: 'DELETE' }),
};
