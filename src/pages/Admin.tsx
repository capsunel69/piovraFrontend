import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled, { css } from 'styled-components';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
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
  CardSubtle,
  CardBody,
  Badge,
  Button,
  Row,
  Stack,
  Grid,
  CardSection,
} from '../components/ui/primitives';
import {
  IconUsers,
  IconSpark,
  IconRefresh,
  IconDashboard,
  IconTerminal,
  IconLock,
  IconCheck,
  IconChat,
  IconCommentSentinel,
} from '../components/ui/icons';

const MOBILE_BP = 720;

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const ADMIN_URL = `${PIOVRA_BASE_URL}/v1/admin`;

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  role: 'user' | 'admin';
  disabledAt: string | null;
  disabledSkills: string[];
  disabledFeatures: string[];
  lastSeenAt: string | null;
  createdAt: string;
  runCount: number;
  totalCostUsd: number;
  taskCount: number;
  reminderCount: number;
  meetingCount: number;
  journalCount: number;
  noteCount: number;
  googleConnected: boolean;
  googleScopes: string[];
}

interface AdminMetrics {
  totalUsers: number;
  activeUsers30d: number;
  totalRuns: number;
  totalCostUsd: number;
  signupsByDay: Array<{ day: string; count: number }>;
  runsByDay: Array<{ day: string; count: number; costUsd: number }>;
  queue?: Record<string, unknown> | null;
}

interface SkillCatalog {
  defaultSkillIds: string[];
  builtins: Array<{ id: string; description: string }>;
}

interface CsAdminProject {
  userId: string;
  userEmail: string;
  projectId: string;
  projectName: string;
  isActive: boolean;
  createdAt: string;
  commentCount: number;
}

const MODULE_FEATURES: Array<{
  id: 'whatsapp' | 'comment_sentinel';
  label: string;
  description: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>;
}> = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'Pairing, inbox, autoreply, and WhatsApp agent skills.',
    Icon: IconChat,
  },
  {
    id: 'comment_sentinel',
    label: 'Comment Sentinel',
    description: 'Comment monitoring projects, scheduled runs, dashboard.',
    Icon: IconCommentSentinel,
  },
];

function canonSkillId(id: string): string {
  return id.startsWith('capsuna.') ? `piovra.${id.slice('capsuna.'.length)}` : id;
}

function normalizeUserDisabled(raw: string[], defaults: string[]): string[] {
  const allowed = new Set(defaults);
  const out = new Set<string>();
  for (const id of raw) {
    const c = canonSkillId(id);
    if (allowed.has(c)) out.add(c);
  }
  return [...out];
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ADMIN_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const StatCard = styled(Card)`
  padding: var(--s-4) var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
`;

const StatLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;

  svg {
    width: 14px;
    height: 14px;
    color: var(--accent);
  }
`;

const StatValue = styled.div`
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;

  @media (max-width: ${MOBILE_BP}px) {
    font-size: 22px;
  }
`;

const StatHint = styled.div`
  font-size: 11px;
  color: var(--text-3);
`;

const AdminPageHeader = styled(PageHeader)`
  @media (max-width: ${MOBILE_BP}px) {
    flex-direction: column;
    align-items: stretch;
    gap: var(--s-3);

    button {
      width: 100%;
      justify-content: center;
    }
  }
`;

const DesktopOnlyTable = styled.div`
  overflow: hidden;

  @media (max-width: ${MOBILE_BP}px) {
    display: none;
  }
`;

const MobileUserList = styled.div`
  display: none;

  @media (max-width: ${MOBILE_BP}px) {
    display: flex;
    flex-direction: column;
  }
`;

const MobileUserCard = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  border-bottom: 1px solid var(--border-1);
  background: transparent;
  padding: var(--s-4) var(--s-3);
  cursor: pointer;
  color: inherit;
  font: inherit;
  -webkit-tap-highlight-color: transparent;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background: rgba(255, 255, 255, 0.04);
  }
`;

const MobileUserTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
`;

const MobileUserMeta = styled.div`
  font-size: 12px;
  color: var(--text-3);
  margin-top: var(--s-2);
  line-height: 1.4;
`;

const TableWrap = styled.div`
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;

  th,
  td {
    padding: 14px 16px;
    text-align: left;
    font-size: 13px;
    border-bottom: 1px solid var(--border-1);
    vertical-align: middle;
  }

  th {
    color: var(--text-3);
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    background: var(--bg-3);
    white-space: nowrap;
  }

  tbody tr {
    transition: background 0.12s ease;
  }

  tbody tr:hover td {
    background: rgba(255, 255, 255, 0.02);
  }

  tbody tr[data-clickable='true']:hover td {
    background: rgba(255, 255, 255, 0.04);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .col-user {
    width: 55%;
  }

  .col-status {
    width: 28%;
  }

  .col-active {
    width: 17%;
  }
`;

const UserCell = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-width: 0;
`;

const Avatar = styled.div<{ $src?: string | null }>`
  width: 40px;
  height: 40px;
  border-radius: 999px;
  flex-shrink: 0;
  border: 1px solid var(--border-2);
  background: var(--bg-4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  font-size: 14px;
  font-weight: 600;

  ${(p) =>
    p.$src &&
    css`
      background-image: url(${p.$src});
      background-size: cover;
      background-position: center;
      color: transparent;
    `}
`;

const UserText = styled.div`
  flex: 1;
  min-width: 0;

  .name {
    font-weight: 600;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .email {
    font-size: 12px;
    color: var(--text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
  }
`;

const UsageCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-variant-numeric: tabular-nums;

  .runs {
    font-weight: 600;
    color: var(--text-1);
  }

  .spend {
    font-size: 12px;
    color: var(--text-3);
  }
`;

const MetaMuted = styled.span`
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
`;

const ActionsStack = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
`;

const StatusCell = styled.div`
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
  overflow: hidden;

  > * {
    flex-shrink: 0;
  }
`;

const RowHint = styled.span`
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  flex-shrink: 0;
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--s-3);
`;

const DetailStat = styled.div`
  padding: var(--s-3);
  border-radius: var(--r-sm);
  border: 1px solid var(--border-1);
  background: var(--bg-3);

  .label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
    margin-bottom: 4px;
  }

  .value {
    font-size: 18px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text-1);
  }
`;

const ScopeList = styled.ul`
  margin: 0;
  padding-left: var(--s-4);
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.45;
  max-height: 160px;
  overflow-y: auto;
`;

const DetailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
`;

const DetailSectionTitle = styled.div`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-3);
`;

const FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
`;

const FeatureRow = styled.label<{ $enabled: boolean; $busy: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: 12px 14px;
  border-radius: var(--r-md);
  border: 1px solid ${(p) => (p.$enabled ? 'rgba(76, 194, 255, 0.35)' : 'var(--border-1)')};
  background: ${(p) =>
    p.$enabled
      ? 'linear-gradient(135deg, rgba(76, 194, 255, 0.08), rgba(164, 120, 255, 0.04))'
      : 'var(--bg-3)'};
  cursor: ${(p) => (p.$busy ? 'progress' : 'pointer')};
  opacity: ${(p) => (p.$busy ? 0.65 : 1)};
  transition: border-color 0.15s, background 0.15s, transform 0.05s;

  &:hover {
    border-color: ${(p) => (p.$enabled ? 'var(--accent)' : 'var(--border-2, var(--border-1))')};
  }

  &:active {
    transform: ${(p) => (p.$busy ? 'none' : 'translateY(1px)')};
  }
`;

const FeatureIconWrap = styled.div<{ $enabled: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: ${(p) => (p.$enabled ? 'var(--accent-soft, rgba(76, 194, 255, 0.18))' : 'var(--bg-2, rgba(255,255,255,0.04))')};
  color: ${(p) => (p.$enabled ? 'var(--accent, #4cc2ff)' : 'var(--text-3)')};
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;

  svg {
    width: 18px;
    height: 18px;
  }
`;

const FeatureBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  .name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-1);
  }

  .desc {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.35;
  }
`;

const FeatureSwitch = styled.span<{ $enabled: boolean }>`
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: ${(p) => (p.$enabled ? 'var(--accent, #4cc2ff)' : 'var(--bg-2, rgba(255,255,255,0.08))')};
  border: 1px solid ${(p) => (p.$enabled ? 'var(--accent, #4cc2ff)' : 'var(--border-1)')};
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
  box-shadow: ${(p) => (p.$enabled ? '0 0 0 4px rgba(76, 194, 255, 0.12)' : 'none')};

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${(p) => (p.$enabled ? '18px' : '2px')};
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: left 0.15s ease;
  }
`;

const HiddenCheckbox = styled.input.attrs({ type: 'checkbox' })`
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
`;

const EmptyHint = styled.div`
  padding: var(--s-6);
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--s-6);
  overflow-y: auto;

  @media (max-width: ${MOBILE_BP}px) {
    padding: var(--s-3);
    align-items: flex-end;
  }
`;

const ModalPanel = styled(Card)`
  width: min(560px, 100%);
  margin: var(--s-8) auto;
  max-height: min(720px, calc(100vh - var(--s-10)));
  display: flex;
  flex-direction: column;

  @media (max-width: ${MOBILE_BP}px) {
    margin: 0;
    width: 100%;
    max-height: min(92vh, 720px);
    border-radius: var(--r-lg) var(--r-lg) 0 0;
  }
`;

const UserModalPanel = styled(ModalPanel)`
  width: min(640px, 100%);

  @media (max-width: ${MOBILE_BP}px) {
    width: 100%;
  }
`;

const SkillCheckRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  padding: 10px 12px;
  border-radius: var(--r-sm);
  cursor: pointer;
  border: 1px solid transparent;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: var(--border-1);
  }

  input {
    margin-top: 3px;
    flex-shrink: 0;
  }

  .meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .id {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: var(--text-1);
    word-break: break-all;
  }

  .desc {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.35;
  }
`;

const SkillScroll = styled.div`
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ModalFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  justify-content: flex-end;
  padding-top: var(--s-4);
  border-top: 1px solid var(--border-1);
`;

const DetailModalFooter = styled(ModalFooter)`
  @media (max-width: ${MOBILE_BP}px) {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: var(--s-3);

    .admin-detail-actions {
      flex-direction: column;
      width: 100%;

      button {
        width: 100%;
        justify-content: center;
      }
    }

    > button {
      width: 100%;
      justify-content: center;
    }
  }
`;

const SkillModalFooter = styled(ModalFooter)`
  @media (max-width: ${MOBILE_BP}px) {
    flex-direction: column-reverse;
    align-items: stretch;

    button {
      width: 100%;
      justify-content: center;
    }
  }
`;

const Admin: React.FC = () => {
  const { me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [skillCatalog, setSkillCatalog] = useState<SkillCatalog | null>(null);
  const [skillModalUser, setSkillModalUser] = useState<AdminUser | null>(null);
  const [draftDisabledSkills, setDraftDisabledSkills] = useState<string[]>([]);
  const [skillSaveBusy, setSkillSaveBusy] = useState(false);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [csProjects, setCsProjects] = useState<CsAdminProject[] | null>(null);
  const [featureSaveBusy, setFeatureSaveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const descBySkillId = useMemo(() => {
    const m = new Map<string, string>();
    if (!skillCatalog) return m;
    for (const b of skillCatalog.builtins) m.set(b.id, b.description);
    return m;
  }, [skillCatalog]);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [u, m, cat, cs] = await Promise.all([
        adminFetch<AdminUser[]>('/users'),
        adminFetch<AdminMetrics>('/metrics'),
        adminFetch<SkillCatalog>('/skill-catalog'),
        adminFetch<CsAdminProject[]>('/comment-sentinel/projects'),
      ]);
      setUsers(u);
      setMetrics(m);
      setSkillCatalog(cat);
      setCsProjects(cs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedUsers = useMemo(
    () =>
      users
        ? [...users].sort((a, b) =>
            (b.lastSeenAt ?? b.createdAt).localeCompare(a.lastSeenAt ?? a.createdAt),
          )
        : [],
    [users],
  );

  const loading = users === null && !error;

  const openSkillsForUser = useCallback(
    (u: AdminUser) => {
      setDetailUser(null);
      setSkillModalUser(u);
      setDraftDisabledSkills(
        normalizeUserDisabled(u.disabledSkills ?? [], skillCatalog?.defaultSkillIds ?? []),
      );
    },
    [skillCatalog?.defaultSkillIds],
  );

  if (me?.role !== 'admin') {
    return (
      <PageContainer>
        <Card>
          <CardSection>
            <Stack $gap={2}>
              <Row $gap={2}>
                <IconLock size={20} />
                <strong style={{ color: 'var(--text-1)' }}>Admin only</strong>
              </Row>
              <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 13 }}>
                Sign in with an account that has the admin role.
              </p>
            </Stack>
          </CardSection>
        </Card>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState message="Loading admin dashboard…" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorMessage message={`Failed to load admin data: ${error}`} onRetry={() => void load()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <AdminPageHeader>
        <div>
          <PageTitle>
            <IconDashboard />
            Admin
          </PageTitle>
          <PageSubtitle>Users, usage, and access control</PageSubtitle>
        </div>
        <Button type="button" $variant="secondary" $size="sm" onClick={() => void load()}>
          <IconRefresh />
          Refresh
        </Button>
      </AdminPageHeader>

      <Grid $min="160px">
        <StatCard>
          <StatLabel>
            <IconUsers /> Total users
          </StatLabel>
          <StatValue>{metrics?.totalUsers ?? '—'}</StatValue>
          <StatHint>Registered accounts</StatHint>
        </StatCard>
        <StatCard>
          <StatLabel>
            <IconCheck /> Active (30d)
          </StatLabel>
          <StatValue>{metrics?.activeUsers30d ?? '—'}</StatValue>
          <StatHint>Seen recently</StatHint>
        </StatCard>
        <StatCard>
          <StatLabel>
            <IconSpark /> Agent runs
          </StatLabel>
          <StatValue>{metrics?.totalRuns ?? '—'}</StatValue>
          <StatHint>All time</StatHint>
        </StatCard>
        <StatCard>
          <StatLabel>
            <IconTerminal /> Total spend
          </StatLabel>
          <StatValue>{metrics ? `$${metrics.totalCostUsd.toFixed(2)}` : '—'}</StatValue>
          <StatHint>Estimated USD</StatHint>
        </StatCard>
      </Grid>

      <Card>
        <CardHeader>
          <CardTitle>
            <IconUsers />
            Team
            <CardSubtle>{sortedUsers.length} user{sortedUsers.length !== 1 ? 's' : ''}</CardSubtle>
          </CardTitle>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          <DesktopOnlyTable>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th className="col-user">User</th>
                    <th className="col-status">Status</th>
                    <th className="col-active">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <EmptyHint>No users yet.</EmptyHint>
                      </td>
                    </tr>
                  ) : (
                    sortedUsers.map((u) => (
                      <tr
                        key={u.id}
                        data-clickable="true"
                        style={{ cursor: 'pointer' }}
                        title="View details"
                        onClick={() => setDetailUser(u)}
                      >
                        <td className="col-user">
                          <UserCell>
                            <Avatar $src={u.pictureUrl}>
                              {!u.pictureUrl ? (u.name?.[0] ?? u.email[0] ?? '?').toUpperCase() : null}
                            </Avatar>
                            <UserText>
                              <div className="name">{u.name ?? u.email}</div>
                              <div className="email">{u.email}</div>
                            </UserText>
                            <RowHint>Open →</RowHint>
                          </UserCell>
                        </td>
                        <td className="col-status">
                          <StatusCell>
                            <Badge $variant={u.role === 'admin' ? 'accent' : 'neutral'}>{u.role}</Badge>
                            {u.disabledAt && <Badge $variant="danger">Off</Badge>}
                            <Badge $variant={u.googleConnected ? 'success' : 'warning'}>
                              {u.googleConnected ? 'Google' : 'No Google'}
                            </Badge>
                          </StatusCell>
                        </td>
                        <td className="col-active">
                          <MetaMuted
                            style={{ whiteSpace: 'normal' }}
                            title={u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : undefined}
                          >
                            {u.lastSeenAt
                              ? formatDistanceToNow(new Date(u.lastSeenAt), { addSuffix: true })
                              : 'Never'}
                          </MetaMuted>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </TableWrap>
          </DesktopOnlyTable>
          <MobileUserList>
            {sortedUsers.length === 0 ? (
              <EmptyHint>No users yet.</EmptyHint>
            ) : (
              sortedUsers.map((u) => (
                <MobileUserCard key={u.id} type="button" onClick={() => setDetailUser(u)}>
                  <MobileUserTop>
                    <Avatar $src={u.pictureUrl}>
                      {!u.pictureUrl ? (u.name?.[0] ?? u.email[0] ?? '?').toUpperCase() : null}
                    </Avatar>
                    <UserText style={{ flex: 1 }}>
                      <div className="name">{u.name ?? u.email}</div>
                      <div className="email">{u.email}</div>
                    </UserText>
                  </MobileUserTop>
                  <StatusCell style={{ flexWrap: 'wrap', marginTop: 10 }}>
                    <Badge $variant={u.role === 'admin' ? 'accent' : 'neutral'}>{u.role}</Badge>
                    {u.disabledAt && <Badge $variant="danger">Off</Badge>}
                    <Badge $variant={u.googleConnected ? 'success' : 'warning'}>
                      {u.googleConnected ? 'Google' : 'No Google'}
                    </Badge>
                  </StatusCell>
                  <MobileUserMeta>
                    Last active{' '}
                    {u.lastSeenAt
                      ? formatDistanceToNow(new Date(u.lastSeenAt), { addSuffix: true })
                      : 'never'}
                  </MobileUserMeta>
                </MobileUserCard>
              ))
            )}
          </MobileUserList>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Comment Sentinel projects
            <CardSubtle>{csProjects?.length ?? 0} project{(csProjects?.length ?? 0) !== 1 ? 's' : ''}</CardSubtle>
          </CardTitle>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          <DesktopOnlyTable>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Owner</th>
                    <th>Comments</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!csProjects || csProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyHint>No Comment Sentinel projects yet.</EmptyHint>
                      </td>
                    </tr>
                  ) : (
                    csProjects.map((p) => (
                      <tr key={`${p.userId}:${p.projectId}`}>
                        <td>{p.projectName}</td>
                        <td>{p.userEmail}</td>
                        <td>{p.commentCount}</td>
                        <td>
                          <Badge $variant={p.isActive ? 'success' : 'warning'}>
                            {p.isActive ? 'Active' : 'Paused'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </TableWrap>
          </DesktopOnlyTable>
        </CardBody>
      </Card>

      {detailUser && (
        <ModalBackdrop
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailUser(null);
          }}
        >
          <UserModalPanel
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <CardHeader style={{ padding: 'var(--s-5) var(--s-6) var(--s-4)' }}>
              <CardTitle style={{ alignItems: 'center', gap: 'var(--s-3)', flexWrap: 'wrap' }}>
                <Avatar $src={detailUser.pictureUrl} style={{ width: 48, height: 48 }}>
                  {!detailUser.pictureUrl
                    ? (detailUser.name?.[0] ?? detailUser.email[0] ?? '?').toUpperCase()
                    : null}
                </Avatar>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                    {detailUser.name ?? detailUser.email}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-3)' }}>
                    {detailUser.email}
                  </span>
                </span>
              </CardTitle>
              <CardSubtle>User id: {detailUser.id}</CardSubtle>
            </CardHeader>
            <CardBody
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--s-5)',
                maxHeight: 'min(560px, calc(100vh - 200px))',
                overflowY: 'auto',
                padding: 'var(--s-4) var(--s-6) var(--s-6)',
              }}
            >
              <DetailSection>
                <DetailSectionTitle>Access</DetailSectionTitle>
                <StatusCell style={{ flexWrap: 'wrap' }}>
                  <Badge $variant={detailUser.role === 'admin' ? 'accent' : 'neutral'}>
                    {detailUser.role}
                  </Badge>
                  {detailUser.disabledAt && <Badge $variant="danger">Account disabled</Badge>}
                  {(detailUser.disabledSkills?.length ?? 0) > 0 && (
                    <Badge $variant="neutral" title="Skills turned off for this user">
                      {detailUser.disabledSkills.length} skill
                      {detailUser.disabledSkills.length !== 1 ? 's' : ''} off
                    </Badge>
                  )}
                </StatusCell>
              </DetailSection>

              <DetailSection>
                <DetailSectionTitle>Features</DetailSectionTitle>
                <FeatureList>
                  {MODULE_FEATURES.map((f) => {
                    const enabled = !(detailUser.disabledFeatures ?? []).includes(f.id);
                    const isSelf = detailUser.id === me?.id;
                    const disabledInput = featureSaveBusy || isSelf;
                    return (
                      <FeatureRow
                        key={f.id}
                        $enabled={enabled}
                        $busy={featureSaveBusy}
                        title={isSelf ? "You can't change your own feature flags here." : undefined}
                      >
                        <HiddenCheckbox
                          checked={enabled}
                          disabled={disabledInput}
                          onChange={async (e) => {
                            setFeatureSaveBusy(true);
                            try {
                              const disabledSet = new Set(detailUser.disabledFeatures ?? []);
                              if (e.target.checked) disabledSet.delete(f.id);
                              else disabledSet.add(f.id);
                              const nextDisabled = [...disabledSet];
                              const updated = await adminFetch<{ disabledFeatures?: string[] }>(
                                `/users/${detailUser.id}/disabled-features`,
                                {
                                  method: 'PATCH',
                                  body: JSON.stringify({ disabledFeatureIds: nextDisabled }),
                                },
                              );
                              const nextValue = (updated?.disabledFeatures ?? nextDisabled) as string[];
                              setUsers((prev) =>
                                prev?.map((u) =>
                                  u.id === detailUser.id ? { ...u, disabledFeatures: nextValue } : u,
                                ) ?? prev,
                              );
                              setDetailUser((prev) =>
                                prev ? { ...prev, disabledFeatures: nextValue } : prev,
                              );
                            } catch (err) {
                              setError(err instanceof Error ? err.message : String(err));
                            } finally {
                              setFeatureSaveBusy(false);
                            }
                          }}
                        />
                        <FeatureIconWrap $enabled={enabled}>
                          <f.Icon />
                        </FeatureIconWrap>
                        <FeatureBody>
                          <span className="name">{f.label}</span>
                          <span className="desc">{f.description}</span>
                        </FeatureBody>
                        <FeatureSwitch $enabled={enabled} aria-hidden />
                      </FeatureRow>
                    );
                  })}
                </FeatureList>
              </DetailSection>

              <DetailSection>
                <DetailSectionTitle>Google</DetailSectionTitle>
                <Stack $gap={2}>
                  <Badge $variant={detailUser.googleConnected ? 'success' : 'warning'}>
                    {detailUser.googleConnected ? 'Connected' : 'Not linked'}
                  </Badge>
                  {detailUser.googleConnected && detailUser.googleScopes.length > 0 && (
                    <ScopeList>
                      {detailUser.googleScopes.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ScopeList>
                  )}
                  {detailUser.googleConnected && detailUser.googleScopes.length === 0 && (
                    <MetaMuted>No scopes recorded</MetaMuted>
                  )}
                </Stack>
              </DetailSection>

              <DetailSection>
                <DetailSectionTitle>Workspace</DetailSectionTitle>
                <DetailGrid>
                  <DetailStat>
                    <div className="label">Tasks</div>
                    <div className="value">{detailUser.taskCount}</div>
                  </DetailStat>
                  <DetailStat>
                    <div className="label">Reminders</div>
                    <div className="value">{detailUser.reminderCount}</div>
                  </DetailStat>
                  <DetailStat>
                    <div className="label">Meetings</div>
                    <div className="value">{detailUser.meetingCount}</div>
                  </DetailStat>
                  <DetailStat>
                    <div className="label">Journals</div>
                    <div className="value">{detailUser.journalCount}</div>
                  </DetailStat>
                  <DetailStat>
                    <div className="label">Notes</div>
                    <div className="value">{detailUser.noteCount}</div>
                  </DetailStat>
                </DetailGrid>
              </DetailSection>

              <DetailSection>
                <DetailSectionTitle>Usage</DetailSectionTitle>
                <UsageCell>
                  <span className="runs">{detailUser.runCount} runs</span>
                  <span className="spend">${detailUser.totalCostUsd.toFixed(2)} spend</span>
                </UsageCell>
              </DetailSection>

              <DetailSection>
                <DetailSectionTitle>Last active</DetailSectionTitle>
                <MetaMuted style={{ whiteSpace: 'normal' }}>
                  {detailUser.lastSeenAt
                    ? `${formatDistanceToNow(new Date(detailUser.lastSeenAt), { addSuffix: true })} (${new Date(detailUser.lastSeenAt).toLocaleString()})`
                    : 'Never signed in'}
                </MetaMuted>
              </DetailSection>

              <DetailModalFooter style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Button type="button" $variant="secondary" $size="sm" onClick={() => setDetailUser(null)}>
                  Close
                </Button>
                <ActionsStack className="admin-detail-actions">
                  <Button
                    type="button"
                    $variant="secondary"
                    $size="sm"
                    disabled={detailUser.id === me?.id}
                    title={
                      detailUser.id === me?.id
                        ? 'Adjust others only — use DB or another admin for your account'
                        : undefined
                    }
                    onClick={() => openSkillsForUser(detailUser)}
                  >
                    Skills
                  </Button>
                  <Button
                    type="button"
                    $variant="secondary"
                    $size="sm"
                    disabled={detailUser.id === me?.id && detailUser.role === 'admin'}
                    title={detailUser.id === me?.id ? 'Cannot demote yourself' : undefined}
                    onClick={async () => {
                      await adminFetch(`/users/${detailUser.id}/role`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          role: detailUser.role === 'admin' ? 'user' : 'admin',
                        }),
                      });
                      setDetailUser(null);
                      void load();
                    }}
                  >
                    {detailUser.role === 'admin' ? 'Demote to user' : 'Make admin'}
                  </Button>
                  <Button
                    type="button"
                    $variant={detailUser.disabledAt ? 'success' : 'danger'}
                    $size="sm"
                    disabled={detailUser.id === me?.id}
                    title={detailUser.id === me?.id ? 'Cannot disable yourself' : undefined}
                    onClick={async () => {
                      await adminFetch(`/users/${detailUser.id}/disabled`, {
                        method: 'PATCH',
                        body: JSON.stringify({ disabled: !detailUser.disabledAt }),
                      });
                      setDetailUser(null);
                      void load();
                    }}
                  >
                    {detailUser.disabledAt ? 'Enable account' : 'Disable account'}
                  </Button>
                </ActionsStack>
              </DetailModalFooter>
            </CardBody>
          </UserModalPanel>
        </ModalBackdrop>
      )}

      {skillModalUser && skillCatalog && (
        <ModalBackdrop
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !skillSaveBusy) {
              setSkillModalUser(null);
            }
          }}
        >
          <ModalPanel
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <CardHeader>
              <CardTitle>
                Skills — {skillModalUser.email}
              </CardTitle>
              <CardSubtle>
                Unchecked tools are disabled for this user (default toolkit stays on for everyone until you turn pieces off).
              </CardSubtle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)', minHeight: 0 }}>
              <SkillScroll>
                {skillCatalog.defaultSkillIds.map((id) => {
                  const enabled = !draftDisabledSkills.includes(id);
                  return (
                    <SkillCheckRow key={id}>
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={skillSaveBusy}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setDraftDisabledSkills((prev) => {
                            const s = new Set(prev);
                            if (on) s.delete(id);
                            else s.add(id);
                            return [...s];
                          });
                        }}
                      />
                      <span className="meta">
                        <span className="id">{id}</span>
                        <span className="desc">{descBySkillId.get(id) ?? '—'}</span>
                      </span>
                    </SkillCheckRow>
                  );
                })}
              </SkillScroll>
              <SkillModalFooter>
                <Button
                  type="button"
                  $variant="secondary"
                  $size="sm"
                  disabled={skillSaveBusy}
                  onClick={() => setSkillModalUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  $variant="success"
                  $size="sm"
                  disabled={skillSaveBusy}
                  onClick={async () => {
                    setSkillSaveBusy(true);
                    try {
                      await adminFetch(`/users/${skillModalUser.id}/disabled-skills`, {
                        method: 'PATCH',
                        body: JSON.stringify({ disabledSkillIds: draftDisabledSkills }),
                      });
                      setSkillModalUser(null);
                      void load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setSkillSaveBusy(false);
                    }
                  }}
                >
                  Save
                </Button>
              </SkillModalFooter>
            </CardBody>
          </ModalPanel>
        </ModalBackdrop>
      )}
    </PageContainer>
  );
};

export default Admin;
