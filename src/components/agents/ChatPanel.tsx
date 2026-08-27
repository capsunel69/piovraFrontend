import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Button, Card, CardHeader, CardTitle, CardSubtle, EmptyState, Spinner } from '../ui/primitives';
import { IconBot, IconSend, IconStop, IconRefresh, IconPaperclip, IconFileText, IconX } from '../ui/icons';
import { useOrchestrate } from '../../hooks/useOrchestrate';
import type { OrchestrateUserFile } from '../../services/piovra';
import {
  ORCHESTRATE_FILE_ACCEPT,
  ORCHESTRATE_FILE_MAX_BYTES,
  ORCHESTRATE_FILE_MAX_COUNT,
  ORCHESTRATE_FILES_MAX_TOTAL_BYTES,
  filesToOrchestrateFiles,
  formatChatLimitsLine,
  isOrchestrateAttachable,
} from '../../utils/orchestrateImages';
import StepCard from './StepCard';
import GoogleConsentPrompt from './GoogleConsentPrompt';
import ConnectGmailBanner from './ConnectGmailBanner';

const Shell = styled(Card)`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 220px);
  max-height: calc(100vh - 220px);
  min-height: 480px;
  overflow: hidden;
`;

const MessagesRegion = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const Scroller = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--s-4) var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
`;

const ScrollFadeTop = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  pointer-events: none;
  z-index: 2;
  background: linear-gradient(
    180deg,
    var(--bg-1) 0%,
    color-mix(in srgb, var(--bg-1) 70%, transparent) 45%,
    transparent 100%
  );
`;

const Turn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
`;

const UserLine = styled.div`
  align-self: flex-end;
  background: var(--accent-soft);
  color: var(--text-1);
  border-radius: var(--r-md);
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  max-width: 80%;
  word-wrap: break-word;
`;

const AgentColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  align-self: flex-start;
  max-width: 100%;
  width: 100%;
`;

const TurnFooter = styled.div`
  display: flex;
  gap: var(--s-3);
  font-size: 11px;
  color: var(--text-3);
  padding: 0 2px;
  font-family: var(--font-mono);
`;

const Composer = styled.form`
  border-top: 1px solid var(--border-1);
  padding: var(--s-3) var(--s-4) 0;
  display: flex;
  gap: var(--s-3);
  align-items: flex-end;
  background: var(--bg-1);
  flex-shrink: 0;
`;

const LimitsLine = styled.div`
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-3);
  padding: 6px var(--s-4) 10px;
  background: var(--bg-1);
  flex-shrink: 0;
`;

const TextInput = styled.textarea`
  flex: 1;
  min-height: 44px;
  max-height: 180px;
  resize: none;
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: var(--r-sm);
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  line-height: 1.5;
  outline: none;

  &:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  &::placeholder { color: var(--text-4); }
`;

const ComposerMain = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const AttachmentStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 8px;
`;

const ThumbWrap = styled.div`
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border-2);
  background: var(--bg-3);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const FileChip = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 180px;
  height: 44px;
  padding: 0 24px 0 8px;
  border-radius: 6px;
  border: 1px solid var(--border-2);
  background: var(--bg-3);

  .icon {
    color: var(--text-2);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .name {
    min-width: 0;
    font-size: 11px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const ThumbRemove = styled.button`
  position: absolute;
  top: 1px;
  right: 1px;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  padding: 0;

  svg {
    width: 9px;
    height: 9px;
  }
`;

const AttachButton = styled.button`
  width: 40px;
  height: 44px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-2);
  background: var(--bg-2);
  color: var(--text-2);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    color: var(--text-1);
    background: var(--bg-3);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

interface ChatPanelProps {
  instanceId?: string;
  instanceName?: string | null;
}

type PendingFile = { id: string; preview: string | null; file: File };

const ChatPanel: React.FC<ChatPanelProps> = ({ instanceId, instanceName }) => {
  const { turns, status, send, abort, reset } = useOrchestrate(instanceId);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState<PendingFile[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, status]);

  useEffect(() => {
    return () => {
      for (const p of pendingRef.current) {
        if (p.preview) URL.revokeObjectURL(p.preview);
      }
    };
  }, []);

  const streaming = status === 'streaming';

  const addFiles = (files: FileList | File[]): void => {
    const list = Array.from(files).filter(isOrchestrateAttachable);
    if (list.length === 0) return;
    setPending((prev) => {
      const next = [...prev];
      let total = next.reduce((s, p) => s + p.file.size, 0);
      for (const f of list) {
        if (next.length >= ORCHESTRATE_FILE_MAX_COUNT) break;
        if (f.size > ORCHESTRATE_FILE_MAX_BYTES) continue;
        if (total + f.size > ORCHESTRATE_FILES_MAX_TOTAL_BYTES) break;
        total += f.size;
        next.push({
          id: crypto.randomUUID(),
          file: f,
          preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        });
      }
      return next;
    });
  };

  const removePending = (id: string): void => {
    setPending((prev) => {
      const t = prev.find((p) => p.id === id);
      if (t?.preview) URL.revokeObjectURL(t.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (streaming) return;
    if (!value.trim() && pending.length === 0) return;
    const text = value;
    const toSend = pending;

    let files: OrchestrateUserFile[] | undefined;
    try {
      if (toSend.length > 0) {
        files = await filesToOrchestrateFiles(toSend.map((t) => t.file));
      }
    } catch {
      return;
    }
    setValue('');
    setPending([]);
    for (const p of toSend) {
      if (p.preview) URL.revokeObjectURL(p.preview);
    }
    void send(text, files);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  const onPasteFiles = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = e.clipboardData.files;
    if (!files?.length) return;
    const list = Array.from(files).filter(isOrchestrateAttachable);
    if (list.length === 0) return;
    e.preventDefault();
    addFiles(list);
  };

  return (
    <Shell>
      <CardHeader>
        <CardTitle>
          <IconBot />
          {instanceName ? `Chat · ${instanceName}` : 'Chat'}
        </CardTitle>
        <CardSubtle>
          {status === 'streaming' ? 'streaming…' : turns.length ? `${turns.length} turn${turns.length === 1 ? '' : 's'}` : 'idle'}
          {turns.length > 0 ? (
            <Button
              type="button"
              $variant="ghost"
              $size="sm"
              onClick={reset}
              style={{ marginLeft: 12 }}
            >
              <IconRefresh />
              Reset
            </Button>
          ) : null}
        </CardSubtle>
      </CardHeader>

      <MessagesRegion>
      <ScrollFadeTop aria-hidden />
      <Scroller ref={scrollRef}>
        <ConnectGmailBanner compact />
        {turns.length === 0 ? (
          <EmptyState>
            <IconBot />
            <div>Ask the agent anything — schedule, create tasks, read/send email, or look up info.</div>
          </EmptyState>
        ) : (
          turns.map((turn) => {
            const u = turn.input.trim();
            const fileNames = (turn.files ?? []).map((f) => f.name);
            return (
              <Turn key={turn.id}>
                <UserLine>
                  {u || (fileNames.length > 0 ? 'Sent files' : '')}
                  {fileNames.length > 0 ? `\n${fileNames.join('\n')}` : ''}
                </UserLine>
                <AgentColumn>
                  {turn.steps.map((step, i) => (
                    <StepCard key={i} step={step} />
                  ))}
                  {turn.status === 'streaming' && (
                    <TurnFooter>
                      <Spinner $size={12} /> thinking…
                    </TurnFooter>
                  )}
                  {turn.needsConsent && <GoogleConsentPrompt consent={turn.needsConsent} />}
                  {turn.error && (
                    <TurnFooter style={{ color: 'var(--danger)' }}>{turn.error}</TurnFooter>
                  )}
                  {turn.status === 'idle' && turn.runId && (
                    <TurnFooter>
                      <span>run {turn.runId.slice(0, 8)}</span>
                      {turn.tokensIn !== null && <span>in {turn.tokensIn}</span>}
                      {turn.tokensOut !== null && <span>out {turn.tokensOut}</span>}
                    </TurnFooter>
                  )}
                </AgentColumn>
              </Turn>
            );
          })
        )}
      </Scroller>
      </MessagesRegion>

      <Composer onSubmit={handleSubmit}>
        <input
          ref={fileRef}
          type="file"
          accept={ORCHESTRATE_FILE_ACCEPT}
          multiple
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
          aria-hidden
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <AttachButton
          type="button"
          disabled={streaming}
          onClick={() => fileRef.current?.click()}
          title={formatChatLimitsLine(null)}
          aria-label="Attach files"
        >
          <IconPaperclip />
        </AttachButton>
        <ComposerMain>
          {pending.length > 0 && (
            <AttachmentStrip>
              {pending.map((p) =>
                p.preview && p.file.type.startsWith('image/') ? (
                  <ThumbWrap key={p.id}>
                    <img src={p.preview} alt="" />
                    <ThumbRemove type="button" onClick={() => removePending(p.id)} aria-label={`Remove ${p.file.name || 'file'}`}>
                      <IconX />
                    </ThumbRemove>
                  </ThumbWrap>
                ) : (
                  <FileChip key={p.id}>
                    <span className="icon"><IconFileText size={14} /></span>
                    <span className="name">{p.file.name || 'File'}</span>
                    <ThumbRemove type="button" onClick={() => removePending(p.id)} aria-label={`Remove ${p.file.name || 'file'}`}>
                      <IconX />
                    </ThumbRemove>
                  </FileChip>
                ),
              )}
            </AttachmentStrip>
          )}
          <TextInput
            placeholder="Ask the agent… (tasks, meetings, reminders, email)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            onPaste={onPasteFiles}
            rows={1}
          />
        </ComposerMain>
        {status === 'streaming' ? (
          <Button type="button" $variant="danger" onClick={abort}>
            <IconStop />
            Stop
          </Button>
        ) : (
          <Button type="submit" $variant="primary" disabled={!value.trim() && pending.length === 0}>
            <IconSend />
            Send
          </Button>
        )}
      </Composer>
      <LimitsLine>
        {formatChatLimitsLine(
          null,
          pending.length > 0
            ? { count: pending.length, bytes: pending.reduce((s, p) => s + p.file.size, 0) }
            : undefined,
        )}
      </LimitsLine>
    </Shell>
  );
};

export default ChatPanel;
