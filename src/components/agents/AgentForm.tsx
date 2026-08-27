import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  Button, Field, FieldGroup, Input, Label, Select, Stack, Textarea,
  Spinner,
} from '../ui/primitives';
import { IconTrash, IconSearch, IconCheck } from '../ui/icons';
import {
  PiovraAPI,
  type AgentDefinition,
  type DefinitionCreate,
  type SkillDescriptor,
} from '../../services/piovra';
import {
  AGENT_MODEL_GROUPS,
  ALL_AGENT_MODEL_IDS,
  DEFAULT_AGENT_MODEL_ID,
} from '../../constants/agentModels';

/* ── Skill picker ──────────────────────────────────────────────────────── */

const SkillPicker = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  border: 1px solid var(--border-2);
  border-radius: var(--r-md);
  background: var(--bg-1);
  padding: var(--s-3);
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: var(--r-sm);
  padding: 0 10px;

  svg { width: 14px; height: 14px; color: var(--text-4); flex-shrink: 0; }
  input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--text-1);
    font: inherit;
    font-size: 13px;
    padding: 8px 0;
    &::placeholder { color: var(--text-4); }
  }
`;

const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
  padding: 0 2px;

  .count { color: var(--text-1); font-weight: 500; }
`;

const SummaryActions = styled.div`
  display: flex;
  gap: 6px;
`;

const MiniBtn = styled.button`
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 999px;
  border: 1px solid var(--border-2);
  background: var(--bg-2);
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;

  &:hover { background: var(--bg-3); color: var(--text-1); border-color: var(--border-3); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Groups = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  max-height: 420px;
  overflow-y: auto;
  padding-right: 2px;

  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
`;

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border-1);
  border-radius: var(--r-sm);
  padding: 10px;
  background: var(--bg-2);
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const GroupName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
  font-family: var(--font-mono);

  strong {
    color: var(--text-1);
    font-weight: 600;
  }
`;

const SourcePill = styled.span<{ $source: 'builtin' | 'mcp' }>`
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${(p) => (p.$source === 'mcp' ? 'var(--purple-soft)' : 'var(--accent-soft)')};
  color: ${(p) => (p.$source === 'mcp' ? 'var(--purple)' : 'var(--accent)')};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px;
`;

const SkillTile = styled.button<{ $checked: boolean }>`
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  border: 1px solid ${(p) => (p.$checked ? 'var(--accent)' : 'var(--border-1)')};
  background: ${(p) => (p.$checked ? 'var(--accent-soft)' : 'var(--bg-1)')};
  cursor: pointer;
  text-align: left;
  min-width: 0;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  position: relative;

  &:hover {
    background: ${(p) => (p.$checked ? 'var(--accent-soft)' : 'var(--bg-3)')};
    border-color: ${(p) => (p.$checked ? 'var(--accent)' : 'var(--border-2)')};
  }
  &:active { transform: scale(0.98); }
`;

const Checkbox = styled.div<{ $checked: boolean }>`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1.5px solid ${(p) => (p.$checked ? 'var(--accent)' : 'var(--border-3)')};
  background: ${(p) => (p.$checked ? 'var(--accent)' : 'transparent')};
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-top: 1px;
  transition: background 0.15s, border-color 0.15s;

  svg {
    width: 11px;
    height: 11px;
    color: #06121d;
    stroke-width: 3;
    opacity: ${(p) => (p.$checked ? 1 : 0)};
    transition: opacity 0.1s;
  }
`;

const SkillMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;

  .id {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-1);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .desc {
    font-size: 11px;
    color: var(--text-3);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

const ConfirmBadge = styled.span`
  display: inline-flex;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--warning-soft);
  color: var(--warning);
  margin-left: 4px;
`;

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

const EmptySearch = styled.div`
  padding: 24px;
  text-align: center;
  color: var(--text-4);
  font-size: 12px;
  font-style: italic;
`;

const StaleBanner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--warning);
  background: var(--warning-soft);
  color: var(--text-1);
  border-radius: var(--r-sm);
  padding: 10px 12px;
  font-size: 12px;

  .title {
    font-weight: 600;
    color: var(--warning);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .ids {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
`;

const StalePill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.25);
  color: var(--text-2);
  border: 1px solid var(--border-2);

  button {
    appearance: none;
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;
    color: var(--text-3);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    &:hover { color: var(--danger); }
  }
`;

interface AgentFormProps {
  existing?: AgentDefinition | null;
  onSaved: (def: AgentDefinition) => void;
  onDeleted?: () => void;
  onCancel: () => void;
}

/**
 * Bucket a skill id into a group label. Groups are namespaced by everything up
 * to (but not including) the last `.` segment — e.g. `capsuna.tasks.create` →
 * `capsuna.tasks`. Single-segment ids (like `echo`) live under `general`.
 */
function groupKey(id: string): string {
  const parts = id.split('.');
  if (parts.length <= 1) return 'general';
  return parts.slice(0, -1).join('.');
}

const AgentForm: React.FC<AgentFormProps> = ({ existing, onSaved, onDeleted, onCancel }) => {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [model, setModel] = useState(existing?.model ?? DEFAULT_AGENT_MODEL_ID);
  const [systemPrompt, setSystemPrompt] = useState(existing?.systemPrompt ?? '');
  const [temperature, setTemperature] = useState<string>(
    existing?.temperature != null ? String(existing.temperature) : '0.2',
  );
  const [maxTokens, setMaxTokens] = useState<string>(
    existing?.maxTokens != null ? String(existing.maxTokens) : '1024',
  );
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(
    new Set(existing?.skills ?? []),
  );
  const [allSkills, setAllSkills] = useState<SkillDescriptor[] | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    PiovraAPI.listSkills()
      .then((s) => { if (!cancelled) setAllSkills(s); })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => {
    if (!allSkills) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allSkills.filter(
          (s) =>
            s.id.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q),
        )
      : allSkills;

    const buckets = new Map<string, { key: string; source: 'builtin' | 'mcp'; items: SkillDescriptor[] }>();
    for (const s of filtered) {
      const k = groupKey(s.id);
      const compositeKey = `${s.source}:${k}`;
      if (!buckets.has(compositeKey)) {
        buckets.set(compositeKey, { key: k, source: s.source, items: [] });
      }
      buckets.get(compositeKey)!.items.push(s);
    }
    return Array.from(buckets.values()).sort((a, b) => {
      if (a.source !== b.source) return a.source === 'builtin' ? -1 : 1;
      return a.key.localeCompare(b.key);
    });
  }, [allSkills, search]);

  const toggleSkill = (id: string): void => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInGroup = (ids: string[], select: boolean): void => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const selectAll = (): void => {
    if (!allSkills) return;
    setSelectedSkills(new Set(allSkills.map((s) => s.id)));
  };

  const clearAll = (): void => setSelectedSkills(new Set());

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const body: DefinitionCreate = {
        name: name.trim(),
        description: description.trim() || null,
        model,
        systemPrompt,
        skills: Array.from(selectedSkills),
        temperature: temperature === '' ? null : Number(temperature),
        maxTokens: maxTokens === '' ? null : Number(maxTokens),
      };
      const saved = existing
        ? await PiovraAPI.updateDefinition(existing.id, body)
        : await PiovraAPI.createDefinition(body);
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!existing) return;
    if (!window.confirm(`Delete agent "${existing.name}"? This cascades to instances + runs.`)) return;
    setSaving(true);
    try {
      await PiovraAPI.deleteDefinition(existing.id);
      onDeleted?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const availableIds = useMemo(
    () => new Set((allSkills ?? []).map((s) => s.id)),
    [allSkills],
  );
  const staleIds = useMemo(
    () => (allSkills ? Array.from(selectedSkills).filter((id) => !availableIds.has(id)) : []),
    [allSkills, selectedSkills, availableIds],
  );
  const totalSkills = allSkills?.length ?? 0;
  const selectedActiveCount = Array.from(selectedSkills).filter((id) => availableIds.has(id)).length;

  const removeStale = (id?: string): void => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (id) next.delete(id);
      else for (const s of staleIds) next.delete(s);
      return next;
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack $gap={4}>
        {err && <ErrorNote>{err}</ErrorNote>}

        <Field>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="default-assistant"
          />
        </Field>

        <Field>
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short summary shown in the list"
          />
        </Field>

        <FieldGroup $cols={3}>
          <Field>
            <Label>Model</Label>
            <Select value={model} onChange={(e) => setModel(e.target.value)}>
              {AGENT_MODEL_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}{m.hint ? ` — ${m.hint}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
              {!ALL_AGENT_MODEL_IDS.includes(model) && (
                <optgroup label="Custom / legacy">
                  <option value={model}>{model}</option>
                </optgroup>
              )}
            </Select>
          </Field>
          <Field>
            <Label>Temperature</Label>
            <Input
              type="number"
              step="0.05"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
          </Field>
          <Field>
            <Label>Max tokens</Label>
            <Input
              type="number"
              min="16"
              max="32000"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
            />
          </Field>
        </FieldGroup>

        <Field>
          <Label>System prompt</Label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={10}
            required
            placeholder="You are Piovra, a helpful orchestration agent…"
          />
        </Field>

        <Field>
          <Label>Allowed skills</Label>
          {!allSkills ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)' }}>
              <Spinner $size={14} /> Loading skill registry…
            </div>
          ) : (
            <SkillPicker>
              <SearchBar>
                <IconSearch />
                <input
                  type="text"
                  placeholder="Search skills…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </SearchBar>

              <SummaryRow>
                <span>
                  <span className="count">{selectedActiveCount}</span> of {totalSkills} selected
                  {staleIds.length > 0 && (
                    <>
                      {' '}· <span style={{ color: 'var(--warning)' }}>{staleIds.length} stale</span>
                    </>
                  )}
                </span>
                <SummaryActions>
                  <MiniBtn type="button" onClick={selectAll} disabled={selectedActiveCount === totalSkills}>
                    Select all
                  </MiniBtn>
                  <MiniBtn type="button" onClick={clearAll} disabled={selectedSkills.size === 0}>
                    Clear
                  </MiniBtn>
                </SummaryActions>
              </SummaryRow>

              {staleIds.length > 0 && (
                <StaleBanner>
                  <div className="title">
                    <span>
                      {staleIds.length} selected skill{staleIds.length === 1 ? '' : 's'} no longer
                      exist in the registry
                    </span>
                    <MiniBtn type="button" onClick={() => removeStale()}>
                      Remove all
                    </MiniBtn>
                  </div>
                  <div className="ids">
                    {staleIds.map((id) => (
                      <StalePill key={id} title={id}>
                        {id}
                        <button
                          type="button"
                          aria-label={`Remove ${id}`}
                          onClick={() => removeStale(id)}
                        >
                          ×
                        </button>
                      </StalePill>
                    ))}
                  </div>
                </StaleBanner>
              )}

              <Groups>
                {groups.length === 0 ? (
                  <EmptySearch>No skills match "{search}"</EmptySearch>
                ) : (
                  groups.map((g) => {
                    const ids = g.items.map((s) => s.id);
                    const allSelected = ids.every((id) => selectedSkills.has(id));
                    const someSelected = !allSelected && ids.some((id) => selectedSkills.has(id));
                    return (
                      <Group key={`${g.source}:${g.key}`}>
                        <GroupHeader>
                          <GroupName>
                            <SourcePill $source={g.source}>{g.source}</SourcePill>
                            <strong>{g.key}</strong>
                            <span>· {g.items.length}</span>
                          </GroupName>
                          <MiniBtn
                            type="button"
                            onClick={() => selectAllInGroup(ids, !allSelected)}
                          >
                            {allSelected ? 'Clear' : someSelected ? 'Select rest' : 'Select all'}
                          </MiniBtn>
                        </GroupHeader>
                        <Grid>
                          {g.items.map((s) => {
                            const checked = selectedSkills.has(s.id);
                            const shortId = s.id.split('.').pop() ?? s.id;
                            return (
                              <SkillTile
                                key={s.id}
                                $checked={checked}
                                type="button"
                                onClick={() => toggleSkill(s.id)}
                                title={s.id}
                              >
                                <Checkbox $checked={checked}>
                                  <IconCheck />
                                </Checkbox>
                                <SkillMeta>
                                  <span className="id">
                                    {shortId}
                                    {s.requiresConfirmation && <ConfirmBadge>confirm</ConfirmBadge>}
                                  </span>
                                  <span className="desc">{s.description}</span>
                                </SkillMeta>
                              </SkillTile>
                            );
                          })}
                        </Grid>
                      </Group>
                    );
                  })
                )}
              </Groups>
            </SkillPicker>
          )}
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
            <Button type="submit" $variant="primary" disabled={saving || !name.trim() || !systemPrompt.trim()}>
              {saving ? 'Saving…' : existing ? 'Save changes' : 'Create agent'}
            </Button>
          </div>
        </Footer>
      </Stack>
    </form>
  );
};

export default AgentForm;
