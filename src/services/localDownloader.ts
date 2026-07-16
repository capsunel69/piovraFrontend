/**
 * Client for the optional local download helper
 * (piovra repo: `npm run local-downloader`).
 *
 * YouTube blocks the server's datacenter IP, so when this helper is running
 * on the user's machine we download the audio locally (with the user's IP and
 * browser cookies) and upload the resulting MP3 to the server instead of
 * asking the server to download it.
 */

const HELPER_URL = 'http://127.0.0.1:3939';

export async function isLocalDownloaderRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${HELPER_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = (await res.json()) as { service?: string };
    return data.service === 'piovra-local-downloader';
  } catch {
    return false;
  }
}

export async function downloadViaLocalHelper(
  url: string,
  onProgress: (percent: number) => void,
): Promise<{ file: File; title: string }> {
  const res = await fetch(`${HELPER_URL}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok || !res.body) {
    throw new Error('Local downloader request failed');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let token = '';
  let title = '';

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
        token?: string;
        title?: string;
        error?: string;
      };
      if (event.type === 'progress') onProgress(event.percent ?? 0);
      if (event.type === 'complete') {
        token = event.token ?? '';
        title = event.title ?? '';
      }
      if (event.type === 'error') {
        throw new Error(event.error || 'Local download failed');
      }
    }
  }

  if (!token) throw new Error('Local downloader returned no file');

  const fileRes = await fetch(`${HELPER_URL}/file/${token}`);
  if (!fileRes.ok) throw new Error('Could not read downloaded file from local helper');
  const blob = await fileRes.blob();

  const safeName = (title || 'audio').replace(/[/\\:*?"<>|]/g, '_').slice(0, 120);
  const file = new File([blob], `${safeName}.mp3`, { type: 'audio/mpeg' });
  return { file, title };
}
