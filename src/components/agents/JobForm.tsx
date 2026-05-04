import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  Button, Field, FieldGroup, Input, Label, Select, Stack, Textarea,
} from '../ui/primitives';
import { IconTrash } from '../ui/icons';
import {
  PiovraAPI,
  type AgentInstance,
  type JobCreate,
  type ScheduledJob,
} from '../../services/piovra';

const PRESETS: { label: string; cron: string }[] = [
  { label: 'Every minute',      cron: '* * * * *' },
  { label: 'Every 5 minutes',   cron: '*/5 * * * *' },
  { label: 'Every hour',        cron: '0 * * * *' },
  { label: 'Every day 09:00',   cron: '0 9 * * *' },
  { label: 'Weekdays 09:00',    cron: '0 9 * * 1-5' },
  { label: 'Mondays 09:00',     cron: '0 9 * * 1' },
];

/** Small curated set + the user's local zone. Free-form input is also
 *  allowed via the underlying <Input>. */
const TZ_OPTIONS: string[] = [
  'UTC',
  'Europe/Bucharest',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
];

const browserTz = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: var(--s-3);
  align-items: center;
  margin-top: var(--s-4);
`;

const ErrorNote = styled.div`
  background: var(--danger-soft);
  color: var(--danger);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  font-size: 12px;
`;

const PresetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
`;

const PromptHint = styled.div`
  margin-top: 6px;
  font-size: 11.5px;
  color: var(--text-3);
  line-height: 1.5;

  strong { color: var(--text-2); font-weight: 600; }
  em { color: var(--text-2); font-style: italic; }
`;

const PresetChip = styled.button`
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  color: var(--text-3);
  font-size: 11.5px;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color .15s, color .15s;

  &:hover { color: var(--text-1); border-color: var(--border-3); }
`;

interface JobFormProps {
  existing?: ScheduledJob | null;
  instances: AgentInstance[];
  defaultInstanceId?: string;
  onSaved: (job: ScheduledJob) => void;
  onDeleted?: () => void;
  onCancel: () => void;
}

const JobForm: React.FC<JobFormProps> = ({
  existing,
  instances,
  defaultInstanceId,
  onSaved,
  onDeleted,
  onCancel,
}) => {
  const [instanceId, setInstanceId] = useState(
    existing?.instanceId ?? defaultInstanceId ?? instances[0]?.id ?? '',
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [cron, setCron] = useState(existing?.cron ?? '0 9 * * *');
  const [tz, setTz] = useState<string>(existing?.tz ?? browserTz());
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [input, setInput] = useState(existing?.payload.input ?? '');
  const [metaJson, setMetaJson] = useState<string>(
    existing?.payload.metadata ? JSON.stringify(existing.payload.metadata, null, 2) : '',
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!instanceId && instances[0]) setInstanceId(instances[0].id);
  }, [instances, instanceId]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErr(null);

    let metadata: Record<string, unknown> | undefined;
    if (metaJson.trim()) {
      try {
        const parsed = JSON.parse(metaJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          metadata = parsed as Record<string, unknown>;
        } else {
          setErr('Metadata must be a JSON object.');
          return;
        }
      } catch {
        setErr('Metadata is not valid JSON.');
        return;
      }
    }

    const payload: { input: string; metadata?: Record<string, unknown> } = { input };
    if (metadata) payload.metadata = metadata;
    const tzValue = tz.trim() || null;

    setSaving(true);
    try {
      if (existing) {
        const saved = await PiovraAPI.updateJob(existing.id, {
          name: name.trim(),
          cron: cron.trim(),
          tz: tzValue,
          enabled,
          payload,
        });
        onSaved(saved);
      } else {
        const body: JobCreate = {
          instanceId,
          name: name.trim(),
          cron: cron.trim(),
          tz: tzValue,
          enabled,
          payload,
        };
        const saved = await PiovraAPI.createJob(body);
        onSaved(saved);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!existing) return;
    if (!window.confirm(`Delete schedule "${existing.name}"?`)) return;
    setSaving(true);
    try {
      await PiovraAPI.deleteJob(existing.id);
      onDeleted?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack $gap={4}>
        {err && <ErrorNote>{err}</ErrorNote>}

        <FieldGroup $cols={2}>
          <Field>
            <Label>Instance</Label>
            <Select
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              disabled={!!existing}
              required
            >
              {instances.length === 0 && <option value="">No instances available</option>}
              {instances.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Daily standup digest"
            />
          </Field>
        </FieldGroup>

        <FieldGroup $cols={2}>
          <Field>
            <Label>Cron expression</Label>
            <Input
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              required
              placeholder="0 9 * * *"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <PresetRow>
              {PRESETS.map((p) => (
                <PresetChip key={p.cron} type="button" onClick={() => setCron(p.cron)}>
                  {p.label}
                </PresetChip>
              ))}
            </PresetRow>
          </Field>

          <Field>
            <Label>Timezone</Label>
            <Select value={tz} onChange={(e) => setTz(e.target.value)}>
              {[browserTz(), ...TZ_OPTIONS]
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === browserTz() ? `${opt} (you)` : opt}
                  </option>
                ))}
            </Select>
          </Field>
        </FieldGroup>

        <Field>
          <Label>Input prompt</Label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            required
            placeholder="Give me today's agenda and any overdue tasks."
          />
          <PromptHint>
            This text is sent to the agent on every run. The agent's <strong>system prompt</strong>
            (set on its definition) controls personality and rules; this <strong>input</strong>{' '}
            says <em>what to do this run</em>. For a WhatsApp digest, describe which chats matter,
            the tone, and the length — e.g. "Summarise unread family-group messages from the last
            24h, three bullet points per chat, neutral tone."
          </PromptHint>
        </Field>

        <Field>
          <Label>Metadata (optional, JSON object)</Label>
          <Textarea
            value={metaJson}
            onChange={(e) => setMetaJson(e.target.value)}
            rows={3}
            placeholder={'{ "kind": "ai-news", "channel": "morning-digest" }'}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
        </Field>

        <Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            Enabled
          </label>
        </Field>

        <Footer>
          {existing ? (
            <Button type="button" $variant="danger" onClick={handleDelete} disabled={saving}>
              <IconTrash />
              Delete
            </Button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" $variant="ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              $variant="primary"
              disabled={saving || !name.trim() || !cron.trim() || !input.trim() || !instanceId}
            >
              {saving ? 'Saving…' : existing ? 'Save changes' : 'Create schedule'}
            </Button>
          </div>
        </Footer>
      </Stack>
    </form>
  );
};

export default JobForm;
