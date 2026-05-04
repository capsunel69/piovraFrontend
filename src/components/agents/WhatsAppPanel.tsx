import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardSubtle,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Label,
  Select,
  Spinner,
  Stack,
  Textarea,
} from '../ui/primitives';
import { IconChat, IconClock, IconRefresh, IconSend } from '../ui/icons';
import {
  PiovraAPI,
  WhatsAppConsentRequiredError,
  type AgentInstance,
  type WhatsAppAutoreplySettings,
  type WhatsAppStatus,
} from '../../services/piovra';

const Section = styled.div`
  padding: var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-4);

  & + & {
    border-top: 1px solid var(--border-1);
  }

  @media (max-width: 720px) {
    padding: var(--s-4);
  }
`;

const Disclosure = styled.pre`
  white-space: pre-wrap;
  font-family: var(--font-sans);
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-2);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  padding: var(--s-4);
  margin: 0;
`;

const ConsentRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  user-select: none;

  input { margin-top: 3px; }
`;

const QrFrame = styled.div`
  align-self: center;
  background: #ffffff;
  border-radius: var(--r-md);
  padding: 12px;
  border: 1px solid var(--border-1);

  img {
    display: block;
    width: 240px;
    height: 240px;
    image-rendering: pixelated;
  }
`;

const StatusRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3);
`;

const HelpList = styled.ul`
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  color: var(--text-3);
  line-height: 1.5;

  code {
    font-family: var(--font-mono);
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 11.5px;
    color: var(--text-2);
  }
`;

const ErrorBox = styled.div`
  font-size: 12.5px;
  color: var(--danger, #f87171);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  padding: var(--s-3) var(--s-4);
`;

const SmallNote = styled.div`
  margin-top: 6px;
  font-size: 11.5px;
  color: var(--text-3);
  line-height: 1.5;

  code {
    font-family: var(--font-mono);
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 11px;
    color: var(--text-2);
  }
`;

const Intro = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.55;

  code {
    font-family: var(--font-mono);
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 11.5px;
    color: var(--text-2);
  }
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  user-select: none;
  line-height: 1.5;

  input { margin-top: 3px; accent-color: var(--accent); }

  strong { color: var(--text-1); font-weight: 600; }
  code {
    font-family: var(--font-mono);
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 11px;
    color: var(--text-2);
  }
`;

const POLL_MS = 2_000;

const WhatsAppPanel: React.FC = () => {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'pair' | 'disconnect' | 'autoreply' | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoreply, setAutoreply] = useState<WhatsAppAutoreplySettings | null>(null);
  const [instances, setInstances] = useState<AgentInstance[]>([]);
  const [allowFromText, setAllowFromText] = useState('');
  /** True after POST pairing until connected, QR visible, cancel, or error — bridges brief socket gaps. */
  const [pairingStarted, setPairingStarted] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async (): Promise<WhatsAppStatus | null> => {
    try {
      const next = await PiovraAPI.getWhatsAppStatus();
      setStatus(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAutoreply = useCallback(async (): Promise<void> => {
    try {
      const [conf, list] = await Promise.all([
        PiovraAPI.getWhatsAppAutoreply(),
        PiovraAPI.listInstances(),
      ]);
      setAutoreply(conf);
      setInstances(list);
      setAllowFromText(conf.allowFrom.join('\n'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadAutoreply();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [refresh, loadAutoreply]);

  useEffect(() => {
    if (!status) return;
    const shouldPoll =
      status.pairingActive ||
      (pairingStarted && !status.connected) ||
      (status.qrDataUrl != null && !status.connected);
    if (!shouldPoll) return;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(() => {
      void refresh();
    }, POLL_MS);
  }, [status, refresh, pairingStarted]);

  useEffect(() => {
    if (status?.connected || status?.qrDataUrl) setPairingStarted(false);
  }, [status?.connected, status?.qrDataUrl]);

  useEffect(() => {
    if (!pairingStarted) return;
    const t = setTimeout(() => setPairingStarted(false), 120_000);
    return () => clearTimeout(t);
  }, [pairingStarted]);

  const startPairing = async (): Promise<void> => {
    setError(null);
    setBusy('pair');
    try {
      setPairingStarted(true);
      await PiovraAPI.startWhatsAppPairing({ consentAcknowledged: true });
      await refresh();
    } catch (e) {
      setPairingStarted(false);
      if (e instanceof WhatsAppConsentRequiredError) {
        setError('Please acknowledge access before pairing.');
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (): Promise<void> => {
    setError(null);
    setBusy('disconnect');
    try {
      setPairingStarted(false);
      await PiovraAPI.disconnectWhatsApp();
      setConsent(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const saveAutoreply = async (patch: Partial<WhatsAppAutoreplySettings>): Promise<void> => {
    if (!autoreply) return;
    setError(null);
    setBusy('autoreply');
    try {
      const next = await PiovraAPI.updateWhatsAppAutoreply(patch);
      setAutoreply(next);
      setAllowFromText(next.allowFrom.join('\n'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onSubmitAutoreply = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!autoreply) return;
    const allowFrom = allowFromText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    await saveAutoreply({
      enabled: autoreply.enabled,
      instanceId: autoreply.instanceId,
      replyPrompt: autoreply.replyPrompt,
      dmOnly: autoreply.dmOnly,
      allowFrom,
      cooldownSeconds: autoreply.cooldownSeconds,
    });
  };

  if (loading) {
    return (
      <Card>
        <EmptyState>
          <Spinner /> Loading WhatsApp status…
        </EmptyState>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <EmptyState>Could not reach Piovra to load WhatsApp status.</EmptyState>
      </Card>
    );
  }

  const renderAutoreply = (): React.ReactNode => {
    if (!autoreply || !status?.connected) return null;
    return (
      <Card style={{ marginTop: 'var(--s-4)' }}>
        <CardHeader>
          <CardTitle>
            <IconSend />
            Autoreply
          </CardTitle>
          <CardSubtle>
            {autoreply.enabled ? (
              <Badge $variant="success">on</Badge>
            ) : (
              <Badge>off</Badge>
            )}
          </CardSubtle>
        </CardHeader>
        <Section>
          <Intro>
            When enabled, every inbound message that passes the policy below triggers a single
            agent run on the selected instance. The agent only sends a reply if its definition
            includes <code>whatsapp.messages.send</code>; the prompt below is appended to the
            run input alongside the inbound message details.
          </Intro>

          <form onSubmit={(e) => void onSubmitAutoreply(e)}>
            <Stack $gap={3}>
              <Field>
                <Label>Reply policy prompt</Label>
                <Textarea
                  rows={5}
                  placeholder="You are my WhatsApp autoreply assistant. Reply briefly in the sender's language. Only reply if the message looks like a question or scheduling request. Otherwise call no tools."
                  value={autoreply.replyPrompt}
                  onChange={(e) =>
                    setAutoreply({ ...autoreply, replyPrompt: e.target.value })
                  }
                />
              </Field>

              <Field>
                <Label>Agent instance</Label>
                <Select
                  value={autoreply.instanceId ?? ''}
                  onChange={(e) =>
                    setAutoreply({
                      ...autoreply,
                      instanceId: e.target.value || null,
                    })
                  }
                >
                  <option value="">— select instance —</option>
                  {instances.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
                <SmallNote>
                  The instance's definition must include <code>whatsapp.messages.send</code> for
                  the agent to actually reply.
                </SmallNote>
              </Field>

              <ToggleRow>
                <input
                  type="checkbox"
                  checked={autoreply.dmOnly}
                  onChange={(e) => setAutoreply({ ...autoreply, dmOnly: e.target.checked })}
                />
                <span>Direct messages only (recommended — ignore group chats)</span>
              </ToggleRow>

              {!autoreply.dmOnly && (
                <Field>
                  <Label>Allowlist (one jid per line)</Label>
                  <Textarea
                    rows={3}
                    placeholder={'1234567890@s.whatsapp.net\n9876543210-1700000000@g.us'}
                    value={allowFromText}
                    onChange={(e) => setAllowFromText(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  />
                  <SmallNote>
                    Empty allowlist + DM-only off would let any sender trigger the agent — leave
                    DM-only on or list trusted jids here.
                  </SmallNote>
                </Field>
              )}

              <Field>
                <Label>Cooldown per chat (seconds)</Label>
                <Input
                  type="number"
                  min={5}
                  max={3600}
                  value={autoreply.cooldownSeconds}
                  onChange={(e) =>
                    setAutoreply({
                      ...autoreply,
                      cooldownSeconds: Number(e.target.value) || 30,
                    })
                  }
                  style={{ maxWidth: 140 }}
                />
              </Field>

              <ToggleRow>
                <input
                  type="checkbox"
                  checked={autoreply.enabled}
                  onChange={(e) => setAutoreply({ ...autoreply, enabled: e.target.checked })}
                />
                <span>
                  <strong>Enable autoreply</strong> — agent runs trigger automatically on
                  inbound messages.
                </span>
              </ToggleRow>

              <StatusRow>
                <Button
                  type="submit"
                  $variant="primary"
                  $size="md"
                  disabled={
                    busy === 'autoreply' ||
                    (autoreply.enabled &&
                      (!autoreply.instanceId || !autoreply.replyPrompt.trim()))
                  }
                >
                  {busy === 'autoreply' ? 'Saving…' : 'Save autoreply settings'}
                </Button>
                {autoreply.updatedAt ? (
                  <CardSubtle>
                    Last saved {new Date(autoreply.updatedAt).toLocaleString()}
                  </CardSubtle>
                ) : null}
              </StatusRow>
            </Stack>
          </form>
        </Section>
      </Card>
    );
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>
          <IconChat />
          WhatsApp connection
        </CardTitle>
        <CardSubtle>
          {status.connected ? (
            <Badge $variant="success">connected</Badge>
          ) : status.pairingActive || pairingStarted ? (
            <Badge>pairing…</Badge>
          ) : (
            <Badge>disconnected</Badge>
          )}
        </CardSubtle>
      </CardHeader>

      {status.connected ? (
        <>
          <Section>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
              WhatsApp is linked to Piovra for this account. Agents with WhatsApp skills enabled
              on their definition can now read your chats and (when authorised) send replies.
            </p>
            <StatusRow>
              <Button
                type="button"
                $variant="secondary"
                $size="sm"
                onClick={() => void refresh()}
              >
                <IconRefresh />
                Refresh
              </Button>
              <Button
                type="button"
                $variant="danger"
                $size="sm"
                onClick={() => void disconnect()}
                disabled={busy === 'disconnect'}
              >
                {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect WhatsApp'}
              </Button>
            </StatusRow>
            {error ? <ErrorBox>{error}</ErrorBox> : null}
          </Section>

          <Section>
            <CardTitle as="h4">
              <IconClock />
              How agents use this
            </CardTitle>
            <HelpList>
              <li>
                <strong>Periodic summaries</strong> — create a <code>Schedule</code> with an
                instance whose definition includes <code>whatsapp.chats.list</code> and{' '}
                <code>whatsapp.messages.list</code>. The schedule's <em>input</em> is the
                summarization prompt (which chats, tone, length).
              </li>
              <li>
                <strong>Autoreply</strong> — needs <code>whatsapp.messages.send</code> on the
                definition plus a configured reply prompt; only enable on definitions you trust
                to act on incoming messages.
              </li>
              <li>
                Reports from scheduled runs appear under the <code>Reports</code> tab, like other
                cron-driven jobs.
              </li>
            </HelpList>
          </Section>
        </>
      ) : (status.pairingActive || pairingStarted) && status.qrDataUrl ? (
        <Section>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
            {status.scanReminder}
          </p>
          <QrFrame>
            <img src={status.qrDataUrl} alt="WhatsApp pairing QR code" />
          </QrFrame>
          <CardSubtle>QR refreshes automatically until your phone scans it.</CardSubtle>
          <StatusRow>
            <Button
              type="button"
              $variant="secondary"
              $size="sm"
              onClick={() => void refresh()}
            >
              <IconRefresh />
              Refresh
            </Button>
            <Button
              type="button"
              $variant="ghost"
              $size="sm"
              onClick={() => void disconnect()}
              disabled={busy === 'disconnect'}
            >
              {busy === 'disconnect' ? 'Cancelling…' : 'Cancel pairing'}
            </Button>
          </StatusRow>
          {error ? <ErrorBox>{error}</ErrorBox> : null}
        </Section>
      ) : status.pairingActive || pairingStarted ? (
        <Section>
          <EmptyState>
            <Spinner /> Generating QR code…
          </EmptyState>
          {error ? <ErrorBox>{error}</ErrorBox> : null}
        </Section>
      ) : status.requiresConsentForQrPairing ? (
        <Section>
          <Disclosure>{status.disclosure}</Disclosure>
          <ConsentRow>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I understand and want Piovra to access this WhatsApp account.
            </span>
          </ConsentRow>
          <StatusRow>
            <Button
              type="button"
              $variant="primary"
              $size="md"
              onClick={() => void startPairing()}
              disabled={!consent || busy === 'pair'}
            >
              {busy === 'pair' ? 'Starting…' : 'Start pairing'}
            </Button>
            <CardSubtle>
              You'll see a QR code to scan from WhatsApp → Settings → Linked Devices.
            </CardSubtle>
          </StatusRow>
          {error ? <ErrorBox>{error}</ErrorBox> : null}
        </Section>
      ) : (
        <Section>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
            A previous WhatsApp session is saved but the socket isn't currently open. Reopen
            it to resume agent access; you can also disconnect to wipe the saved session and
            re-pair from scratch.
          </p>
          <StatusRow>
            <Button
              type="button"
              $variant="primary"
              $size="md"
              onClick={() => void startPairing()}
              disabled={busy === 'pair'}
            >
              {busy === 'pair' ? 'Starting…' : 'Reconnect'}
            </Button>
            <Button
              type="button"
              $variant="danger"
              $size="sm"
              onClick={() => void disconnect()}
              disabled={busy === 'disconnect'}
            >
              {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </StatusRow>
          {error ? <ErrorBox>{error}</ErrorBox> : null}
        </Section>
      )}
    </Card>
    {renderAutoreply()}
    </>
  );
};

export default WhatsAppPanel;
