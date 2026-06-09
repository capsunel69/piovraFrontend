import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useSearchParams } from 'react-router-dom';
import LoadingState from '../components/shared/LoadingState';
import ErrorMessage from '../components/shared/ErrorMessage';
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageSubtitle,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Badge,
  Grid,
  Stack,
  Row,
} from '../components/ui/primitives';
import { IconDashboard, IconRefresh, IconSettings } from '../components/ui/icons';
import {
  AD_PLATFORM_COLORS,
  AD_PLATFORM_LABELS,
  adDateRange,
  adOAuthUrl,
  createAdAccount,
  createAdProject,
  fetchAdAnalytics,
  fetchAdConnections,
  fetchAdSocialProfiles,
  fetchAdWorkspace,
  saveAdSocialProfiles,
  setAdActiveProject,
  type AdConnectedAccount,
  type AdDataPoint,
  type AdPlatform,
  type AdProject,
  type AdSocialAccount,
} from '../services/analyticsDashboard';

type Tab = 'overview' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof IconDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: IconDashboard },
  { id: 'settings', label: 'Settings', icon: IconSettings },
];

const HeaderCard = styled.div`
  background: linear-gradient(135deg, rgba(76, 194, 255, 0.06), rgba(164, 120, 255, 0.06));
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-5) var(--s-5) 0;
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
`;

const TabBar = styled.div`
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 0;
  border-bottom: 1px solid var(--border-1);
`;

const TabBtn = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-bottom: 2px solid ${(p) => (p.$active ? 'var(--accent)' : 'transparent')};
  background: transparent;
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-3)')};
  font-size: 13px;
  font-weight: ${(p) => (p.$active ? 600 : 500)};
  cursor: pointer;
  white-space: nowrap;
  margin-bottom: -1px;

  svg {
    width: 15px;
    height: 15px;
  }
`;

const StatCard = styled(Card)`
  padding: var(--s-4);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const StatLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const StatValue = styled.div`
  font-size: 26px;
  font-weight: 600;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
`;

const RangeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-1);
    font-size: 13px;
  }

  th {
    color: var(--text-3);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  td {
    font-variant-numeric: tabular-nums;
  }
`;

const PlatformDot = styled.span<{ $color: string }>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(p) => p.$color};
  margin-right: 8px;
`;

const Field = styled.input`
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-1);
  background: var(--bg-3);
  color: var(--text-1);
  font-size: 13px;
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-1);
  background: var(--bg-3);
  color: var(--text-1);
  font-size: 13px;
`;

const Hint = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.45;
`;

const ErrorBanner = styled.div`
  padding: 12px 14px;
  border-radius: var(--r-md);
  border: 1px solid rgba(255, 120, 120, 0.35);
  background: rgba(255, 80, 80, 0.08);
  color: var(--text-2);
  font-size: 13px;
`;

function sumMetric(rows: AdDataPoint[], key: keyof Pick<AdDataPoint, 'views' | 'posts' | 'likes' | 'shares' | 'comments'>): number {
  return rows.reduce((acc, row) => acc + row[key], 0);
}

function platformTotals(rows: AdDataPoint[]): Record<AdPlatform, AdDataPoint> {
  const out = {} as Record<AdPlatform, AdDataPoint>;
  for (const row of rows) {
    const prev = out[row.platform];
    if (!prev) {
      out[row.platform] = { ...row };
    } else {
      prev.views += row.views;
      prev.posts += row.posts;
      prev.likes += row.likes;
      prev.shares += row.shares;
      prev.comments += row.comments;
    }
  }
  return out;
}

const AnalyticsDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') === 'settings' ? 'settings' : 'overview') as Tab;
  const setTab = (next: Tab) => setSearchParams(next === 'overview' ? {} : { tab: next });

  const [rangeDays, setRangeDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdDataPoint[]>([]);
  const [platformErrors, setPlatformErrors] = useState<Record<string, string>>({});
  const [workspace, setWorkspace] = useState<{
    projects: AdProject[];
    accounts: AdSocialAccount[];
    activeProjectId: string | null;
  } | null>(null);
  const [connections, setConnections] = useState<AdConnectedAccount[]>([]);
  const [oauthFlags, setOauthFlags] = useState({ youtube: false, tiktok: false, sc: false });
  const [profiles, setProfiles] = useState({ tiktok: '', instagram: '', facebook: '' });
  const [newProjectName, setNewProjectName] = useState('');
  const [newAccount, setNewAccount] = useState({ platform: 'youtube' as AdPlatform, handle: '', label: '' });
  const [settingsBusy, setSettingsBusy] = useState(false);

  const { startDate, endDate } = useMemo(() => adDateRange(rangeDays), [rangeDays]);

  const loadOverview = useCallback(
    async (refresh = false) => {
      setError(null);
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetchAdAnalytics({
          startDate,
          endDate,
          refresh,
          projectId: workspace?.activeProjectId ?? undefined,
        });
        setData(res.data);
        setPlatformErrors(res.errors ?? {});
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, endDate, workspace?.activeProjectId],
  );

  const loadSettings = useCallback(async () => {
    try {
      const [ws, conn, social] = await Promise.all([
        fetchAdWorkspace(),
        fetchAdConnections(),
        fetchAdSocialProfiles(),
      ]);
      setWorkspace({
        projects: ws.projects,
        accounts: ws.accounts,
        activeProjectId: ws.activeProjectId,
      });
      setConnections(conn.accounts);
      setOauthFlags({
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
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (tab === 'overview') void loadOverview(false);
  }, [tab, loadOverview]);

  const totals = useMemo(() => platformTotals(data), [data]);
  const platforms = Object.keys(totals) as AdPlatform[];

  if (loading && tab === 'overview' && data.length === 0 && !error) {
    return (
      <PageContainer>
        <LoadingState message="Loading analytics…" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <HeaderCard>
        <PageHeader style={{ padding: 0, border: 'none' }}>
          <div>
            <PageTitle>
              <IconDashboard />
              Analytics
            </PageTitle>
            <PageSubtitle>YouTube, TikTok, Facebook, Instagram — scraped via Piovra API</PageSubtitle>
          </div>
          {tab === 'overview' && (
            <Button
              type="button"
              $variant="secondary"
              $size="sm"
              disabled={refreshing}
              onClick={() => void loadOverview(true)}
            >
              <IconRefresh />
              {refreshing ? 'Scraping…' : 'Refresh'}
            </Button>
          )}
        </PageHeader>
        <TabBar>
          {TABS.map((t) => (
            <TabBtn key={t.id} type="button" $active={tab === t.id} onClick={() => setTab(t.id)}>
              <t.icon />
              {t.label}
            </TabBtn>
          ))}
        </TabBar>
      </HeaderCard>

      {error && (
        <ErrorMessage message={error} onRetry={() => (tab === 'overview' ? void loadOverview() : void loadSettings())} />
      )}

      {tab === 'overview' && (
        <Stack $gap={4}>
          <RangeRow>
            {[7, 14, 30].map((d) => (
              <Button
                key={d}
                type="button"
                $size="sm"
                $variant={rangeDays === d ? 'primary' : 'secondary'}
                onClick={() => setRangeDays(d)}
              >
                Last {d} days
              </Button>
            ))}
            <Hint as="span" style={{ marginLeft: 8 }}>
              {startDate} → {endDate}
            </Hint>
          </RangeRow>

          {Object.keys(platformErrors).length > 0 && (
            <ErrorBanner>
              Some platforms failed:{' '}
              {Object.entries(platformErrors)
                .map(([p, msg]) => `${AD_PLATFORM_LABELS[p as AdPlatform] ?? p}: ${msg}`)
                .join(' · ')}
            </ErrorBanner>
          )}

          <Grid $min="140px">
            <StatCard>
              <StatLabel>Views</StatLabel>
              <StatValue>{sumMetric(data, 'views').toLocaleString()}</StatValue>
            </StatCard>
            <StatCard>
              <StatLabel>Posts</StatLabel>
              <StatValue>{sumMetric(data, 'posts').toLocaleString()}</StatValue>
            </StatCard>
            <StatCard>
              <StatLabel>Likes</StatLabel>
              <StatValue>{sumMetric(data, 'likes').toLocaleString()}</StatValue>
            </StatCard>
            <StatCard>
              <StatLabel>Comments</StatLabel>
              <StatValue>{sumMetric(data, 'comments').toLocaleString()}</StatValue>
            </StatCard>
            <StatCard>
              <StatLabel>Shares</StatLabel>
              <StatValue>{sumMetric(data, 'shares').toLocaleString()}</StatValue>
            </StatCard>
          </Grid>

          <Card>
            <CardHeader>
              <CardTitle>By platform</CardTitle>
            </CardHeader>
            <CardBody style={{ padding: 0 }}>
              {platforms.length === 0 ? (
                <Hint style={{ padding: 16 }}>No data yet. Check Settings → connections and env keys, then Refresh.</Hint>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Views</th>
                      <th>Posts</th>
                      <th>Likes</th>
                      <th>Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platforms.map((p) => (
                      <tr key={p}>
                        <td>
                          <PlatformDot $color={AD_PLATFORM_COLORS[p]} />
                          {AD_PLATFORM_LABELS[p]}
                        </td>
                        <td>{totals[p]!.views.toLocaleString()}</td>
                        <td>{totals[p]!.posts.toLocaleString()}</td>
                        <td>{totals[p]!.likes.toLocaleString()}</td>
                        <td>{totals[p]!.comments.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </Stack>
      )}

      {tab === 'settings' && workspace && (
        <Stack $gap={4}>
          <Card>
            <CardHeader>
              <CardTitle>Project</CardTitle>
            </CardHeader>
            <CardBody>
              <Stack $gap={3}>
                <Select
                  value={workspace.activeProjectId ?? ''}
                  onChange={async (e) => {
                    const id = e.target.value;
                    if (!id) return;
                    setSettingsBusy(true);
                    try {
                      await setAdActiveProject(id);
                      await loadSettings();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setSettingsBusy(false);
                    }
                  }}
                  disabled={settingsBusy}
                >
                  {workspace.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Row $gap={2}>
                  <Field
                    placeholder="New project name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                  <Button
                    type="button"
                    $size="sm"
                    disabled={settingsBusy || !newProjectName.trim()}
                    onClick={async () => {
                      setSettingsBusy(true);
                      try {
                        await createAdProject(newProjectName.trim());
                        setNewProjectName('');
                        await loadSettings();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setSettingsBusy(false);
                      }
                    }}
                  >
                    Add
                  </Button>
                </Row>
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connections</CardTitle>
            </CardHeader>
            <CardBody>
              <Stack $gap={2}>
                {connections.map((c) => (
                  <Row key={c.platform} $gap={2} style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span>
                      <PlatformDot $color={AD_PLATFORM_COLORS[c.platform]} />
                      {c.label}
                      {c.username ? ` — ${c.username}` : ''}
                    </span>
                    <Badge $variant={c.connected ? 'success' : 'warning'}>
                      {c.connected ? (c.authMethod ?? 'connected') : 'not connected'}
                    </Badge>
                  </Row>
                ))}
                <Hint>
                  YouTube/TikTok use server env keys (`YOUTUBE_API_KEY`, `SCRAPECREATORS_API_KEY`) or OAuth below.
                </Hint>
                <Row $gap={2} style={{ flexWrap: 'wrap' }}>
                  {oauthFlags.youtube ? (
                    <Button type="button" $size="sm" $variant="secondary" onClick={() => { window.location.href = adOAuthUrl('youtube'); }}>
                      Connect YouTube (OAuth)
                    </Button>
                  ) : (
                    <Hint>YouTube OAuth not configured on server (`YOUTUBE_CLIENT_ID`). API key mode still works.</Hint>
                  )}
                  {oauthFlags.tiktok && (
                    <Button type="button" $size="sm" $variant="secondary" onClick={() => { window.location.href = adOAuthUrl('tiktok'); }}>
                      Connect TikTok
                    </Button>
                  )}
                </Row>
              </Stack>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ScrapeCreators profiles</CardTitle>
            </CardHeader>
            <CardBody>
              <Stack $gap={3}>
                <Field placeholder="@tiktok username" value={profiles.tiktok} onChange={(e) => setProfiles((p) => ({ ...p, tiktok: e.target.value }))} />
                <Field placeholder="Instagram username" value={profiles.instagram} onChange={(e) => setProfiles((p) => ({ ...p, instagram: e.target.value }))} />
                <Field placeholder="Facebook page URL" value={profiles.facebook} onChange={(e) => setProfiles((p) => ({ ...p, facebook: e.target.value }))} />
                <Button
                  type="button"
                  $size="sm"
                  disabled={settingsBusy || !oauthFlags.sc}
                  onClick={async () => {
                    setSettingsBusy(true);
                    try {
                      await saveAdSocialProfiles(profiles);
                      await loadSettings();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setSettingsBusy(false);
                    }
                  }}
                >
                  Save profiles
                </Button>
                {!oauthFlags.sc && <Hint>Set `SCRAPECREATORS_API_KEY` on the server for TikTok / IG / FB scraping.</Hint>}
              </Stack>
            </CardBody>
          </Card>

          {workspace.activeProjectId && (
            <Card>
              <CardHeader>
                <CardTitle>Accounts in project</CardTitle>
              </CardHeader>
              <CardBody>
                <Stack $gap={3}>
                  {workspace.accounts.length === 0 ? (
                    <Hint>No accounts yet — add a handle below.</Hint>
                  ) : (
                    workspace.accounts.map((a) => (
                      <Row key={a.id} $gap={2}>
                        <Badge $variant="neutral">{a.platform}</Badge>
                        <span>{a.label}</span>
                        <span style={{ color: 'var(--text-3)' }}>{a.handle}</span>
                      </Row>
                    ))
                  )}
                  <Select value={newAccount.platform} onChange={(e) => setNewAccount((s) => ({ ...s, platform: e.target.value as AdPlatform }))}>
                    {(['youtube', 'tiktok', 'instagram', 'facebook'] as AdPlatform[]).map((p) => (
                      <option key={p} value={p}>{AD_PLATFORM_LABELS[p]}</option>
                    ))}
                  </Select>
                  <Field placeholder="Handle / channel ID / @username" value={newAccount.handle} onChange={(e) => setNewAccount((s) => ({ ...s, handle: e.target.value }))} />
                  <Field placeholder="Label (optional)" value={newAccount.label} onChange={(e) => setNewAccount((s) => ({ ...s, label: e.target.value }))} />
                  <Button
                    type="button"
                    $size="sm"
                    disabled={settingsBusy || !newAccount.handle.trim()}
                    onClick={async () => {
                      if (!workspace.activeProjectId) return;
                      setSettingsBusy(true);
                      try {
                        await createAdAccount(workspace.activeProjectId, {
                          platform: newAccount.platform,
                          handle: newAccount.handle.trim(),
                          label: newAccount.label.trim() || undefined,
                        });
                        setNewAccount({ platform: 'youtube', handle: '', label: '' });
                        await loadSettings();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err));
                      } finally {
                        setSettingsBusy(false);
                      }
                    }}
                  >
                    Add account
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          )}
        </Stack>
      )}
    </PageContainer>
  );
};

export default AnalyticsDashboard;
