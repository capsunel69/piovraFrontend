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
import {
  IconChat,
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
  IconSend,
} from '../ui/icons';
import {
  PiovraAPI,
  WhatsAppConsentRequiredError,
  type AgentInstance,
  type WhatsAppAutoreplySettings,
  type WhatsAppCachePreview,
  type WhatsAppStatus,
} from '../../services/piovra';
import WhatsAppInbox from './WhatsAppInbox';

// ---------------------------------------------------------------------------
// Default Romanian persona for the autoreply agent. Surfaced via "Use default
// persona" so users don't have to copy/paste from a doc.
// ---------------------------------------------------------------------------

const DEFAULT_RO_PERSONA = `Esti un creator / builder din Europa de Est care lucreaza cu tech, automatizari si content.

Gandesti in sisteme, nu in idei.

Preferi viteza in loc de perfectiune si iteratii rapide in loc de planuri lungi.

Vorbesti casual, natural, in romana fara diacritice, uneori prescurtat.

Eviti fluff-ul, nu iti plac raspunsurile vagi si vrei lucruri care chiar functioneaza in realitate.

Dai raspunsuri scurte, clare si aplicabile.

Te duci direct la solutie, nu explici teorie inutila.

Daca ceva nu e clar, faci o presupunere rezonabila si mergi mai departe.

Iti rafinezi raspunsurile rapid pe baza de feedback (gen: "nu asa", "mai simplu", "fix asta dar...").

Stil:
- propozitii scurte sau medii
- uneori fragmentat
- fara introduceri lungi
- fara ton formal

Expresii uzuale:
- "ok"
- "bun"
- "nu asa"
- "prea complicat"
- "fa-l mai simplu"
- "exact asa dar..."

Reguli pentru autoreply:
- Raspunsul tau (ce scrii ca mesaj final) e trimis exact asa pe WhatsApp.
- Daca mesajul primit e spam, nesemnificativ, automat (notificare, link gol, sticker descris ca text), raspunde fix cu cuvantul NOREPLY si nimic altceva.
- Niciodata nu raspunde cu meta-comentarii gen "ca asistent...". Doar mesajul, ca si cum ai scrie tu de pe telefon.`;

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

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

/** Compact, chevron-toggled section header for collapsible cards. */
const CollapseHeader = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border-1);
  padding: var(--s-4) var(--s-5);
  cursor: pointer;
  color: var(--text-1);
  text-align: left;

  &:hover { background: var(--bg-1); }

  .left { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
  .right { display: flex; align-items: center; gap: 8px; }
`;

const POLL_MS = 2_000;
const CACHE_POLL_MS = 12_000;

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
  const [cachePreview, setCachePreview] = useState<WhatsAppCachePreview | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [autoreplyOpen, setAutoreplyOpen] = useState(false);
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

  const loadCachePreview = useCallback(async (): Promise<void> => {
    if (!status?.connected) return;
    setCacheBusy(true);
    try {
      const data = await PiovraAPI.getWhatsAppCachePreview();
      setCachePreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCacheBusy(false);
    }
  }, [status?.connected]);

  useEffect(() => {
    if (!status?.connected) {
      setCachePreview(null);
      return;
    }
    void loadCachePreview();
    const id = window.setInterval(() => void loadCachePreview(), CACHE_POLL_MS);
    return () => clearInterval(id);
  }, [status?.connected, loadCachePreview]);

  useEffect(() => {
    void refresh();
    void loadAutoreply();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [refresh, loadAutoreply]);

  useEffect(() => {
    if (!status || status.connected || status.pairingActive || status.requiresConsentForQrPairing) {
      return;
    }
    if (!status.hasSavedSession) return;
    void PiovraAPI.resumeWhatsApp()
      .then(() => refresh())
      .catch(() => undefined);
  }, [status, refresh]);

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

  const hasAutoreplyConfigured = Boolean(
    autoreply && autoreply.instanceId && autoreply.replyPrompt.trim(),
  );

  const renderAutoreplyCard = (): React.ReactNode => {
    if (!autoreply || !status?.connected) return null;
    return (
      <Card style={{ marginTop: 'var(--s-4)' }}>
        <CollapseHeader
          type="button"
          onClick={() => setAutoreplyOpen((v) => !v)}
          aria-expanded={autoreplyOpen}
        >
          <span className="left">
            <IconSend />
            Autoreply persona
            {autoreply.enabled ? (
              <Badge $variant="success">on</Badge>
            ) : (
              <Badge>off</Badge>
            )}
            {!hasAutoreplyConfigured ? (
              <Badge $variant="warning">needs setup</Badge>
            ) : null}
          </span>
          <span className="right">
            {autoreply.updatedAt ? (
              <CardSubtle style={{ fontSize: 11 }}>
                saved {new Date(autoreply.updatedAt).toLocaleString()}
              </CardSubtle>
            ) : null}
            {autoreplyOpen ? <IconChevronDown /> : <IconChevronRight />}
          </span>
        </CollapseHeader>

        {autoreplyOpen ? (
          <Section>
            <Intro>
              When enabled, every inbound DM that passes the policy below triggers a single
              agent run on the selected instance. Reactions, stickers, voice and other media are
              ignored. The agent's final text is sent verbatim as the reply — answer with the
              single token <code>NOREPLY</code> to skip an inbound silently.
            </Intro>

            <form onSubmit={(e) => void onSubmitAutoreply(e)}>
              <Stack $gap={3}>
                <Field>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <Label style={{ marginBottom: 0 }}>Reply policy prompt (persona)</Label>
                    <Button
                      type="button"
                      $variant="ghost"
                      $size="sm"
                      onClick={() =>
                        setAutoreply({ ...autoreply, replyPrompt: DEFAULT_RO_PERSONA })
                      }
                    >
                      Use default persona
                    </Button>
                  </div>
                  <Textarea
                    rows={10}
                    placeholder="Describe how the agent should write replies (tone, language, length, when to ignore)..."
                    value={autoreply.replyPrompt}
                    onChange={(e) =>
                      setAutoreply({ ...autoreply, replyPrompt: e.target.value })
                    }
                  />
                  <SmallNote>
                    The full persona is sent as the per-run instruction. The agent also receives
                    the last 10 text messages of the chat as conversation history.
                  </SmallNote>
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
                    Any instance works — the bridge sends the agent's final text directly, no
                    extra skill needed on the definition.
                  </SmallNote>
                </Field>

                <ToggleRow>
                  <input
                    type="checkbox"
                    checked={autoreply.dmOnly}
                    onChange={(e) => setAutoreply({ ...autoreply, dmOnly: e.target.checked })}
                  />
                  <span>Direct messages only (recommended — the bridge ignores groups anyway)</span>
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
                      Empty allowlist + DM-only off would let any sender trigger the agent —
                      leave DM-only on or list trusted jids here.
                    </SmallNote>
                  </Field>
                )}

                <Field>
                  <Label>Burst window per chat (seconds)</Label>
                  <Input
                    type="number"
                    min={2}
                    max={60}
                    value={autoreply.cooldownSeconds}
                    onChange={(e) =>
                      setAutoreply({
                        ...autoreply,
                        cooldownSeconds: Number(e.target.value) || 4,
                      })
                    }
                    style={{ maxWidth: 140 }}
                  />
                  <SmallNote>
                    After the first message arrives, we wait this long for more from the
                    same chat — any follow-ups inside the window get folded into ONE
                    reply. Reply is sent with a length-proportional typing delay so it
                    doesn&apos;t feel instant. Try 4–8s.
                  </SmallNote>
                </Field>

                <ToggleRow>
                  <input
                    type="checkbox"
                    checked={autoreply.enabled}
                    onChange={(e) => setAutoreply({ ...autoreply, enabled: e.target.checked })}
                  />
                  <span>
                    <strong>Enable autoreply</strong> — agent runs trigger automatically on
                    inbound DMs (text only).
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
                </StatusRow>
              </Stack>
            </form>
          </Section>
        ) : null}
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

        {status.pairingIssue ? (
          <Section>
            <ErrorBox>{status.pairingIssue}</ErrorBox>
          </Section>
        ) : null}

        {status.connected ? (
          <Section>
            <StatusRow>
              <span style={{ fontSize: 12.5, color: 'var(--text-2)', flex: 1 }}>
                Linked. Inbound DMs are mirrored to the inbox below; the autoreply persona +
                per-chat overrides decide what (if anything) the agent answers.
              </span>
              <Button
                type="button"
                $variant="ghost"
                $size="sm"
                onClick={() => void refresh()}
              >
                <IconRefresh />
                Status
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

      {renderAutoreplyCard()}

      {status.connected ? (
        <Card style={{ marginTop: 'var(--s-4)' }}>
          <CardHeader>
            <CardTitle>
              <IconChat />
              Inbox
            </CardTitle>
            <CardSubtle>What agents see + manual review</CardSubtle>
          </CardHeader>
          <Section style={{ padding: 'var(--s-4)' }}>
            <WhatsAppInbox
              chats={cachePreview?.chats ?? []}
              cacheBusy={cacheBusy}
              totals={cachePreview?.totals ?? null}
              onRefreshCache={loadCachePreview}
              onChatsMutated={loadCachePreview}
              hasAutoreplyConfigured={hasAutoreplyConfigured}
            />
            {cachePreview?.note ? <SmallNote>{cachePreview.note}</SmallNote> : null}
          </Section>
        </Card>
      ) : null}
    </>
  );
};

export default WhatsAppPanel;
