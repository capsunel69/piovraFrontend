import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, Row, Stack } from '../ui/primitives';
import ErrorMessage from '../shared/ErrorMessage';
import { AdTopBarBlock, Dot, Field, Select } from './AdShared';
import { useAdWorkspace } from '../../context/AdWorkspaceContext';
import {
  AD_PLATFORM_COLORS,
  AD_PLATFORM_LABELS,
  adOAuthUrl,
  createAdAccount,
  createAdProject,
  fetchAdConnections,
  fetchAdSocialProfiles,
  saveAdSocialProfiles,
  type AdConnectedAccount,
  type AdPlatform,
} from '../../services/analyticsDashboard';

const SettingsTab: React.FC = () => {
  const { projects, accounts, activeProjectId, setActiveProject, refresh } = useAdWorkspace();
  const [connections, setConnections] = useState<AdConnectedAccount[]>([]);
  const [oauth, setOauth] = useState({ youtube: false, tiktok: false, sc: false });
  const [profiles, setProfiles] = useState({ tiktok: '', instagram: '', facebook: '' });
  const [newProjectName, setNewProjectName] = useState('');
  const [newAccount, setNewAccount] = useState({ platform: 'youtube' as AdPlatform, handle: '', label: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [conn, social] = await Promise.all([fetchAdConnections(), fetchAdSocialProfiles()]);
      setConnections(conn.accounts);
      setOauth({
        youtube: conn.oauthConfigured,
        tiktok: conn.tiktokOAuthConfigured,
        sc: conn.scrapeCreatorsConfigured && conn.scrapeCreatorsTokenSet,
      });
      setProfiles({
        tiktok: social.profiles.tiktok ?? '',
        instagram: social.profiles.instagram ?? '',
        facebook: social.profiles.facebook ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AdTopBarBlock title="Settings" subtitle="Projects, connections, ScrapeCreators profiles" />

      {error && <ErrorMessage message={error} onRetry={() => void load()} />}

      <Card>
        <CardHeader><CardTitle>Project</CardTitle></CardHeader>
        <CardBody>
          <Stack $gap={3}>
            <Select value={activeProjectId ?? ''} onChange={(e) => void setActiveProject(e.target.value)} disabled={busy}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Row $gap={2}>
              <Field placeholder="New project name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
              <Button type="button" $size="sm" disabled={busy || !newProjectName.trim()} onClick={async () => {
                setBusy(true);
                try {
                  await createAdProject(newProjectName.trim());
                  setNewProjectName('');
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              }}>Add</Button>
            </Row>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Connections</CardTitle></CardHeader>
        <CardBody>
          <Stack $gap={2}>
            {connections.map((c) => (
              <Row key={c.platform} $gap={2} style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span><Dot $color={AD_PLATFORM_COLORS[c.platform]} />{c.label}{c.username ? ` — ${c.username}` : ''}</span>
                <span style={{ color: c.connected ? 'var(--success)' : 'var(--text-3)' }}>
                  {c.connected ? (c.authMethod ?? 'connected') : 'not connected'}
                </span>
              </Row>
            ))}
            <Row $gap={2} style={{ flexWrap: 'wrap' }}>
              {oauth.youtube && (
                <Button type="button" $size="sm" $variant="secondary" onClick={() => { window.location.href = adOAuthUrl('youtube'); }}>
                  Connect YouTube
                </Button>
              )}
              {oauth.tiktok && (
                <Button type="button" $size="sm" $variant="secondary" onClick={() => { window.location.href = adOAuthUrl('tiktok'); }}>
                  Connect TikTok
                </Button>
              )}
            </Row>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>ScrapeCreators profiles</CardTitle></CardHeader>
        <CardBody>
          <Stack $gap={3}>
            <Field placeholder="TikTok @username" value={profiles.tiktok} onChange={(e) => setProfiles((p) => ({ ...p, tiktok: e.target.value }))} />
            <Field placeholder="Instagram username" value={profiles.instagram} onChange={(e) => setProfiles((p) => ({ ...p, instagram: e.target.value }))} />
            <Field placeholder="Facebook page URL" value={profiles.facebook} onChange={(e) => setProfiles((p) => ({ ...p, facebook: e.target.value }))} />
            <Button type="button" $size="sm" disabled={busy || !oauth.sc} onClick={async () => {
              setBusy(true);
              try {
                await saveAdSocialProfiles(profiles);
                await load();
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            }}>Save profiles</Button>
          </Stack>
        </CardBody>
      </Card>

      {activeProjectId && (
        <Card>
          <CardHeader><CardTitle>Accounts in project</CardTitle></CardHeader>
          <CardBody>
            <Stack $gap={3}>
              {accounts.map((a) => (
                <Row key={a.id} $gap={2}>
                  <span>{AD_PLATFORM_LABELS[a.platform]}</span>
                  <span>{a.label}</span>
                  <span style={{ color: 'var(--text-3)' }}>{a.handle}</span>
                </Row>
              ))}
              <Select value={newAccount.platform} onChange={(e) => setNewAccount((s) => ({ ...s, platform: e.target.value as AdPlatform }))}>
                {(['youtube', 'tiktok', 'instagram', 'facebook'] as AdPlatform[]).map((p) => (
                  <option key={p} value={p}>{AD_PLATFORM_LABELS[p]}</option>
                ))}
              </Select>
              <Field placeholder="Handle / channel ID" value={newAccount.handle} onChange={(e) => setNewAccount((s) => ({ ...s, handle: e.target.value }))} />
              <Field placeholder="Label (optional)" value={newAccount.label} onChange={(e) => setNewAccount((s) => ({ ...s, label: e.target.value }))} />
              <Button type="button" $size="sm" disabled={busy || !newAccount.handle.trim()} onClick={async () => {
                if (!activeProjectId) return;
                setBusy(true);
                try {
                  await createAdAccount(activeProjectId, {
                    platform: newAccount.platform,
                    handle: newAccount.handle.trim(),
                    label: newAccount.label.trim() || undefined,
                  });
                  setNewAccount({ platform: 'youtube', handle: '', label: '' });
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              }}>Add account</Button>
            </Stack>
          </CardBody>
        </Card>
      )}
    </>
  );
};

export default SettingsTab;
