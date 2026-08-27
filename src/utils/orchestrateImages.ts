import type { OrchestrateUserFile } from '../services/piovra';

export const ORCHESTRATE_FILE_MAX_COUNT = 6;
export const ORCHESTRATE_FILE_MAX_BYTES = 80 * 1024 * 1024;
export const ORCHESTRATE_FILES_MAX_TOTAL_BYTES = 90 * 1024 * 1024;

/** @deprecated use ORCHESTRATE_FILE_MAX_COUNT */
export const ORCHESTRATE_IMAGE_MAX_COUNT = ORCHESTRATE_FILE_MAX_COUNT;
/** @deprecated use ORCHESTRATE_FILE_MAX_BYTES */
export const ORCHESTRATE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/jpg']);
const AUDIO_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/flac',
]);
const DOC_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroenabled.12',
]);

export const ORCHESTRATE_FILE_ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  '.pdf',
  '.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/csv',
  'application/json',
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.xlsx',
  '.xls',
  '.xlsm',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  '.mp3',
  '.wav',
  '.m4a',
  '.ogg',
  '.webm',
  '.aac',
].join(',');

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function inferOrchestrateMime(file: File): string {
  const mime = (file.type || '').toLowerCase().split(';')[0]!.trim();
  if (mime === 'image/jpg') return 'image/jpeg';
  if (mime === 'audio/mp3') return 'audio/mpeg';
  if (mime && mime !== 'application/octet-stream') return mime;
  switch (extOf(file.name)) {
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
    case '.txt':
      return 'text/plain';
    case '.md':
    case '.markdown':
      return 'text/markdown';
    case '.csv':
      return 'text/csv';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.xlsm':
      return 'application/vnd.ms-excel.sheet.macroenabled.12';
    case '.json':
      return 'application/json';
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
      return mime;
  }
}

export function isOrchestrateAttachable(file: File): boolean {
  const mime = inferOrchestrateMime(file);
  const ext = extOf(file.name);
  if (IMAGE_MIME.has(mime) || AUDIO_MIME.has(mime) || DOC_MIME.has(mime)) return true;
  if (mime.startsWith('audio/')) return true;
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.docx', '.txt', '.md', '.markdown', '.csv', '.json', '.xlsx', '.xls', '.xlsm', '.mp3', '.wav', '.webm', '.ogg', '.m4a', '.aac'].includes(ext);
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
  for (const f of files) {
    if (!isOrchestrateAttachable(f)) {
      throw new Error(`Unsupported file type: ${f.name || 'unknown'}`);
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
