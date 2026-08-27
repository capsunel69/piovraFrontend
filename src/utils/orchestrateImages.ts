import type { OrchestrateUserFile } from '../services/piovra';

export const ORCHESTRATE_FILE_MAX_COUNT = 20;
export const ORCHESTRATE_FILE_MAX_BYTES = 80 * 1024 * 1024;
export const ORCHESTRATE_FILES_MAX_TOTAL_BYTES = 90 * 1024 * 1024;

/** Human-readable limits, shown wherever files can be attached. */
export function formatAttachLimitBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function chatLimitsForModel(modelId: string | null): {
  maxFiles: number;
  maxPerFile: string;
  maxTotal: string;
  images: boolean | null;
  contextHint: string;
  modelLabel: string | null;
} {
  const images = modelSupportsImages(modelId);
  const raw = modelId ?? '';
  const colon = raw.indexOf(':');
  const name = colon >= 0 ? raw.slice(colon + 1) : raw;
  const modelLabel = name || null;
  let contextHint = '128k context';
  if (/gpt-5|gpt-4\.1|gemini-2|gemini-3/i.test(name)) contextHint = '1M context';
  else if (/gpt-4o/i.test(name)) contextHint = '128k context';
  return {
    maxFiles: ORCHESTRATE_FILE_MAX_COUNT,
    maxPerFile: formatAttachLimitBytes(ORCHESTRATE_FILE_MAX_BYTES),
    maxTotal: formatAttachLimitBytes(ORCHESTRATE_FILES_MAX_TOTAL_BYTES),
    images,
    contextHint,
    modelLabel,
  };
}

function modelSupportsImages(modelId: string | null): boolean | null {
  if (!modelId) return null;
  const [providerRaw, ...rest] = modelId.split(':');
  const provider = rest.length > 0 ? providerRaw : 'openai';
  const name = rest.length > 0 ? rest.join(':') : modelId;
  if (provider === 'google') return true;
  if (provider === 'openai') return !/^o\d/i.test(name);
  return true;
}

/** @deprecated use ORCHESTRATE_FILE_MAX_COUNT */
export const ORCHESTRATE_IMAGE_MAX_COUNT = ORCHESTRATE_FILE_MAX_COUNT;
/** @deprecated use ORCHESTRATE_FILE_MAX_BYTES */
export const ORCHESTRATE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** Code/config/markup extensions treated as plain text (mirrors backend). */
const TEXT_EXT = [
  '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.jsonl', '.ndjson',
  '.xml', '.html', '.htm', '.css', '.scss', '.less', '.svg',
  '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf', '.env', '.properties',
  '.log', '.tex', '.rst', '.srt', '.vtt',
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.rb', '.php',
  '.java', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs',
  '.swift', '.kt', '.scala', '.sql', '.sh', '.bash', '.zsh', '.ps1',
  '.r', '.lua', '.pl', '.dart', '.vue', '.svelte', '.graphql', '.proto',
];

/** Accept every file type the OS picker offers. */
export const ORCHESTRATE_FILE_ACCEPT = '*/*';

export function formatChatLimitsLine(
  modelId: string | null,
  pending?: { count: number; bytes: number },
): string {
  const L = chatLimitsForModel(modelId);
  if (pending && pending.count > 0) {
    return `${pending.count}/${L.maxFiles} files · ${formatAttachLimitBytes(pending.bytes)} of ${L.maxTotal} · ${L.maxPerFile} per file`;
  }
  return `${L.maxFiles} files max · ${L.maxPerFile} per file · ${L.maxTotal} total · any type`;
}

export function formatChatModelLine(modelId: string | null): string {
  const L = chatLimitsForModel(modelId);
  if (!L.modelLabel) return '';
  const img = L.images === false ? 'no image input' : L.images ? 'images ok' : '';
  return [L.modelLabel, L.contextHint, img].filter(Boolean).join(' · ');
}

/** @deprecated use formatChatLimitsLine */
export const ORCHESTRATE_FILE_LIMITS_LABEL = formatChatLimitsLine(null);

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function inferOrchestrateMime(file: File): string {
  const mime = (file.type || '').toLowerCase().split(';')[0]!.trim();
  const ext = extOf(file.name);
  if (mime === 'image/jpg') return 'image/jpeg';
  if (mime === 'audio/mp3') return 'audio/mpeg';
  if (TEXT_EXT.includes(ext) && !mime.startsWith('text/')) return 'text/plain';
  if (mime && mime !== 'application/octet-stream') return mime;
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.xlsm':
      return 'application/vnd.ms-excel.sheet.macroenabled.12';
    case '.zip':
      return 'application/zip';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.webm':
      return 'audio/webm';
    case '.ogg':
    case '.oga':
      return 'audio/ogg';
    case '.m4a':
      return 'audio/mp4';
    case '.aac':
      return 'audio/aac';
    default:
      return mime || 'application/octet-stream';
  }
}

/** Any file can be attached; the server extracts text or notes that it could not. */
export function isOrchestrateAttachable(_file: File): boolean {
  return true;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const m = /^data:[^;]+;base64,(.+)$/.exec(s);
      resolve(m ? m[1]! : s.replace(/\s/g, ''));
    };
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsDataURL(file);
  });
}

export async function filesToOrchestrateFiles(files: File[]): Promise<OrchestrateUserFile[]> {
  let total = 0;
  const out: OrchestrateUserFile[] = [];
  if (files.length > ORCHESTRATE_FILE_MAX_COUNT) {
    throw new Error(`At most ${ORCHESTRATE_FILE_MAX_COUNT} files per message`);
  }
  for (const f of files) {
    if (!isOrchestrateAttachable(f)) {
      throw new Error(`Could not attach ${f.name || 'file'}`);
    }
    if (f.size > ORCHESTRATE_FILE_MAX_BYTES) {
      throw new Error(`${f.name || 'File'} must be 80MB or smaller`);
    }
    total += f.size;
    if (total > ORCHESTRATE_FILES_MAX_TOTAL_BYTES) {
      throw new Error('Attachments together must be 90MB or smaller');
    }
    out.push({
      mimeType: inferOrchestrateMime(f),
      data: await fileToBase64(f),
      filename: f.name || undefined,
    });
  }
  return out;
}

/** @deprecated use filesToOrchestrateFiles */
export const filesToOrchestrateImages = filesToOrchestrateFiles;
