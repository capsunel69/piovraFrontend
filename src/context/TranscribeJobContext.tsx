import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  TranscribeAPI,
  type TranscribeCompleteResult,
  type TranscribeProgress,
} from '../services/transcribe';
import { downloadViaLocalHelper, isLocalDownloaderRunning } from '../services/localDownloader';
import { useToast } from '../components/ui/Toast';

export interface TranscribeJobOptions {
  language: string;
  mode: 'text' | 'subtitles';
  contentType: 'default' | 'podcast';
}

export type TranscribeJobSource = { kind: 'file'; file: File } | { kind: 'url'; url: string };

type JobStatus = 'idle' | 'running' | 'done' | 'error';

interface TranscribeJobContextType {
  status: JobStatus;
  progress: TranscribeProgress | null;
  result: TranscribeCompleteResult | null;
  error: string | null;
  /** Options the current/last job was started with (drives result rendering). */
  jobOptions: TranscribeJobOptions | null;
  start: (source: TranscribeJobSource, opts: TranscribeJobOptions) => void;
  /** Clear a finished/failed job (e.g. when the user edits inputs). */
  clear: () => void;
  /** Transcribe page reports mount/unmount so background toasts fire only when away. */
  setPageActive: (active: boolean) => void;
}

const TranscribeJobContext = createContext<TranscribeJobContextType | undefined>(undefined);

export const TranscribeJobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<JobStatus>('idle');
  const [progress, setProgress] = useState<TranscribeProgress | null>(null);
  const [result, setResult] = useState<TranscribeCompleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobOptions, setJobOptions] = useState<TranscribeJobOptions | null>(null);

  const statusRef = useRef<JobStatus>('idle');
  const pageActiveRef = useRef(false);
  const toast = useToast();

  const updateStatus = (s: JobStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  const start = useCallback(
    (source: TranscribeJobSource, opts: TranscribeJobOptions) => {
      if (statusRef.current === 'running') return;
      updateStatus('running');
      setResult(null);
      setError(null);
      setJobOptions(opts);
      setProgress({ percent: 2, message: 'Starting...', stage: 'starting' });

      void (async () => {
        try {
          let data: TranscribeCompleteResult;
          if (source.kind === 'file') {
            data = await TranscribeAPI.transcribeFile(source.file, opts, setProgress);
          } else if (await isLocalDownloaderRunning()) {
            // Download on this machine (user's IP + cookies bypass YouTube's
            // bot wall), then upload the MP3 to the server for transcription.
            setProgress({
              percent: 3,
              message: 'Downloading on your machine...',
              stage: 'downloading',
            });
            const { file: dlFile } = await downloadViaLocalHelper(source.url, (pct) =>
              setProgress({
                percent: Math.round(3 + pct * 0.22),
                message: `Downloading on your machine... ${pct.toFixed(0)}%`,
                stage: 'downloading',
              }),
            );
            data = await TranscribeAPI.transcribeFile(dlFile, opts, (p) =>
              setProgress({ ...p, percent: Math.round(25 + p.percent * 0.75) }),
            );
          } else {
            data = await TranscribeAPI.transcribeUrl(source.url, opts, setProgress);
          }

          setResult(data);
          setProgress({ percent: 100, message: 'Done!', stage: 'complete' });
          updateStatus('done');
          if (!pageActiveRef.current) {
            toast.success('Transcription complete', 'Open Transcribe to view the result.');
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Transcription failed';
          setError(msg);
          setProgress(null);
          updateStatus('error');
          if (!pageActiveRef.current) {
            toast.error('Transcription failed', msg);
          }
        }
      })();
    },
    [toast],
  );

  const clear = useCallback(() => {
    if (statusRef.current === 'running') return;
    updateStatus('idle');
    setProgress(null);
    setResult(null);
    setError(null);
    setJobOptions(null);
  }, []);

  const setPageActive = useCallback(
    (active: boolean) => {
      pageActiveRef.current = active;
      if (!active && statusRef.current === 'running') {
        toast.info(
          'Transcription still running',
          'It keeps processing in the background — come back anytime.',
        );
      }
    },
    [toast],
  );

  return (
    <TranscribeJobContext.Provider
      value={{ status, progress, result, error, jobOptions, start, clear, setPageActive }}
    >
      {children}
    </TranscribeJobContext.Provider>
  );
};

export const useTranscribeJob = (): TranscribeJobContextType => {
  const ctx = useContext(TranscribeJobContext);
  if (!ctx) throw new Error('useTranscribeJob must be used within a TranscribeJobProvider');
  return ctx;
};
