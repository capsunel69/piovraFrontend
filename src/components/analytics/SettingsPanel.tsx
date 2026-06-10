import React, { useState } from 'react';
import styled from 'styled-components';
import { Button, Card, CardHeader, CardTitle, CardSection, Grid, Stack } from '../ui/primitives';
import type { AnAccount, AnPlatform, AnProject } from '../../types/analytics';
import { AN_PLATFORM_LABELS, AN_PLATFORMS } from '../../types/analytics';
import { AnalyticsAPI } from '../../services/analytics';

const Input = styled.input`
  font-size: 13px;
  padding: 8px 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-1);
  background: var(--bg-2);
  color: var(--text-1);
  width: 100%;
`;

const Select = styled.select`
  font-size: 13px;
  padding: 8px 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-1);
  background: var(--bg-2);
  color: var(--text-1);
`;

const AccountRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  padding: var(--s-3);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  flex-wrap: wrap;
`;

interface SettingsPanelProps {
  projects: AnProject[];
  activeProjectId: string;
  accounts: AnAccount[];
  onWorkspaceChange: () => Promise<void>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  projects,
  activeProjectId,
  accounts,
  onWorkspaceChange,
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [platform, setPlatform] = useState<AnPlatform>('youtube');
  const [label, setLabel] = useState('');
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onWorkspaceChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack $gap={4}>
      {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardSection>
          <Stack $gap={3}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {projects.map((p) => (
                <Button
                  key={p.id}
                  $size="sm"
                  $variant={p.id === activeProjectId ? 'primary' : 'ghost'}
                  disabled={busy || p.id === activeProjectId}
                  onClick={() => run(async () => { await AnalyticsAPI.switchProject(p.id); })}
                >
                  {p.name}
                </Button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                placeholder="New project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
              <Button
                $size="sm"
                disabled={busy || !newProjectName.trim()}
                onClick={() =>
                  run(async () => {
                    await AnalyticsAPI.createProject(newProjectName.trim());
                    setNewProjectName('');
                  })
                }
              >
                Add
              </Button>
            </div>
            {activeProject && projects.length > 1 && (
              <Button
                $size="sm"
                $variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!confirm(`Delete project "${activeProject.name}"?`)) return;
                    await AnalyticsAPI.deleteProject(activeProject.id);
                  })
                }
              >
                Delete active project
              </Button>
            )}
          </Stack>
        </CardSection>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social accounts — {activeProject?.name ?? 'Project'}</CardTitle>
        </CardHeader>
        <CardSection>
          <Stack $gap={3}>
            <Grid $cols={3} $min="160px">
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as AnPlatform)}>
                {AN_PLATFORMS.map((p) => (
                  <option key={p} value={p}>{AN_PLATFORM_LABELS[p]}</option>
                ))}
              </Select>
              <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Input
                placeholder={platform === 'facebook' ? 'Page URL or ID' : platform === 'youtube' ? 'Channel ID or @handle' : '@username'}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </Grid>
            <Button
              $size="sm"
              disabled={busy || !handle.trim()}
              onClick={() =>
                run(async () => {
                  await AnalyticsAPI.createAccount(activeProjectId, {
                    platform,
                    label: label.trim() || AN_PLATFORM_LABELS[platform],
                    handle: handle.trim(),
                  });
                  setLabel('');
                  setHandle('');
                })
              }
            >
              Add account
            </Button>

            <Stack $gap={2}>
              {accounts.length === 0 && (
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
                  No accounts yet. Add a handle for each platform you want to track.
                </p>
              )}
              {accounts.map((acc) => (
                <AccountRow key={acc.id}>
                  <div>
                    <strong style={{ fontSize: 13 }}>{acc.label}</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
                      {AN_PLATFORM_LABELS[acc.platform as AnPlatform]} · {acc.handle}
                    </p>
                  </div>
                  <Button
                    $size="sm"
                    $variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        if (!confirm(`Remove ${acc.label}?`)) return;
                        await AnalyticsAPI.deleteAccount(activeProjectId, acc.id);
                      })
                    }
                  >
                    Remove
                  </Button>
                </AccountRow>
              ))}
            </Stack>
          </Stack>
        </CardSection>
      </Card>
    </Stack>
  );
};
