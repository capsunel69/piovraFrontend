import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Button, Card, CardHeader, CardTitle, CardSubtle, EmptyState, Spinner } from '../ui/primitives';
import { IconBot, IconSend, IconStop, IconRefresh, IconImage, IconX } from '../ui/icons';
import { useOrchestrate } from '../../hooks/useOrchestrate';
import type { OrchestrateUserImage } from '../../services/piovra';
import { ORCHESTRATE_IMAGE_MAX_COUNT, filesToOrchestrateImages } from '../../utils/orchestrateImages';
import StepCard from './StepCard';
import GoogleConsentPrompt from './GoogleConsentPrompt';

const Shell = styled(Card)`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 220px);
  min-height: 480px;
`;

const Scroller = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: var(--s-4) var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
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
  padding: var(--s-3) var(--s-4);
  display: flex;
  gap: var(--s-3);
  align-items: flex-end;
  background: var(--bg-1);
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

type PendingImage = { id: string; preview: string; file: File };

const ChatPanel: React.FC<ChatPanelProps> = ({ instanceId, instanceName }) => {
  const { turns, status, send, abort, reset } = useOrchestrate(instanceId);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState<PendingImage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, status]);

  const streaming = status === 'streaming';

  const addFiles = (files: FileList | File[]): void => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    setPending((prev) => {
      const next = [...prev];
      for (const f of list) {
        if (next.length >= ORCHESTRATE_IMAGE_MAX_COUNT) break;
        next.push({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) });
      }
      return next;
    });
  };

  const removePending = (id: string): void => {
    setPending((prev) => {
      const t = prev.find((p) => p.id === id);
      if (t) URL.revokeObjectURL(t.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (streaming) return;
    if (!value.trim() && pending.length === 0) return;
    const text = value;
    const toSend = pending;

    let images: OrchestrateUserImage[] | undefined;
    try {
      if (toSend.length > 0) {
        images = await filesToOrchestrateImages(toSend.map((t) => t.file));
      }
    } catch {
      return;
    }
    setValue('');
    setPending([]);
    for (const p of toSend) URL.revokeObjectURL(p.preview);
    void send(text, images);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  const onPasteImages = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = e.clipboardData.files;
    if (!files?.length) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) return;
    e.preventDefault();
    addFiles(imgs);
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

      <Scroller ref={scrollRef}>
        {turns.length === 0 ? (
          <EmptyState>
            <IconBot />
            <div>Ask the agent anything — schedule, create tasks, read/send email, or look up info.</div>
          </EmptyState>
        ) : (
          turns.map((turn) => {
            const u = turn.input.trim();
            const userLabel =
              u ||
              (turn.imageCount
                ? turn.imageCount === 1
                  ? 'Image'
                  : `${turn.imageCount} images`
                : '');
            return (
              <Turn key={turn.id}>
                <UserLine>
                  {userLabel}
                  {u && turn.imageCount ? ` · ${turn.imageCount} image(s)` : ''}
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

      <Composer onSubmit={handleSubmit}>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
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
          title="Add image"
          aria-label="Add image"
        >
          <IconImage />
        </AttachButton>
        <ComposerMain>
          {pending.length > 0 && (
            <AttachmentStrip>
              {pending.map((p) => (
                <ThumbWrap key={p.id}>
                  <img src={p.preview} alt="" />
                  <ThumbRemove type="button" onClick={() => removePending(p.id)} aria-label="Remove image">
                    <IconX />
                  </ThumbRemove>
                </ThumbWrap>
              ))}
            </AttachmentStrip>
          )}
          <TextInput
            placeholder="Ask the agent… (tasks, meetings, reminders, email)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            onPaste={onPasteImages}
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
    </Shell>
  );
};

export default ChatPanel;
