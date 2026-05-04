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
} from '../components/ui/icons';

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
}

interface SkillCatalog {
  defaultSkillIds: string[];
  builtins: Array<{ id: string; description: string }>;
}

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
`;

const StatHint = styled.div`
  font-size: 11px;
  color: var(--text-3);
`;

const TableScroll = styled.div`
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  @media (max-width: 1100px) {
    margin: 0 calc(-1 * var(--s-3));
    padding: 0 var(--s-3);
  }
`;

const Table = styled.table`
  width: 100%;
  min-width: 920px;
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

  tbody tr:last-child td {
    border-bottom: none;
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

const StatStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const MiniStat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  min-width: 72px;
  background: var(--bg-3);
  border: 1px solid var(--border-1);
  border-radius: var(--r-sm);
`;

const MiniStatLabel = styled.span`
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
`;

const MiniStatVal = styled.span`
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
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
  flex-direction: column;
  gap: 6px;
  align-items: stretch;

  @media (min-width: 1100px) {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
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
`;

const ModalPanel = styled(Card)`
  width: min(560px, 100%);
  margin: var(--s-8) auto;
  max-height: min(720px, calc(100vh - var(--s-10)));
  display: flex;
  flex-direction: column;
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

const Admin: React.FC = () => {
  const { me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [skillCatalog, setSkillCatalog] = useState<SkillCatalog | null>(null);
  const [skillModalUser, setSkillModalUser] = useState<AdminUser | null>(null);
  const [draftDisabledSkills, setDraftDisabledSkills] = useState<string[]>([]);
  const [skillSaveBusy, setSkillSaveBusy] = useState(false);
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
      const [u, m, cat] = await Promise.all([
        adminFetch<AdminUser[]>('/users'),
        adminFetch<AdminMetrics>('/metrics'),
        adminFetch<SkillCatalog>('/skill-catalog'),
      ]);
      setUsers(u);
      setMetrics(m);
      setSkillCatalog(cat);
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

  if (me?.role !== 'admin') {
    return (
      <PageContainer style={{ padding: 'var(--s-5)' }}>
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
      <PageContainer style={{ padding: 'var(--s-5)' }}>
        <LoadingState message="Loading admin dashboard…" />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer style={{ padding: 'var(--s-5)' }}>
        <ErrorMessage message={`Failed to load admin data: ${error}`} onRetry={() => void load()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer style={{ padding: 'var(--s-5)' }}>
      <PageHeader>
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
      </PageHeader>

      <Grid $min="200px">
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
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Access</th>
                  <th>Google</th>
                  <th>Workspace</th>
                  <th>Usage</th>
                  <th>Last active</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyHint>No users yet.</EmptyHint>
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <UserCell>
                          <Avatar $src={u.pictureUrl}>
                            {!u.pictureUrl ? (u.name?.[0] ?? u.email[0] ?? '?').toUpperCase() : null}
                          </Avatar>
                          <UserText>
                            <div className="name">{u.name ?? u.email}</div>
                            <div className="email">{u.email}</div>
                          </UserText>
                        </UserCell>
                      </td>
                      <td>
                        <Row $gap={2} $wrap>
                          <Badge $variant={u.role === 'admin' ? 'accent' : 'neutral'}>{u.role}</Badge>
                          {u.disabledAt && <Badge $variant="danger">disabled</Badge>}
                          {(u.disabledSkills?.length ?? 0) > 0 && (
                            <Badge $variant="neutral" title="Skills turned off for this user">
                              {u.disabledSkills.length} skill{u.disabledSkills.length !== 1 ? 's' : ''} off
                            </Badge>
                          )}
                        </Row>
                      </td>
                      <td>
                        <Stack $gap={2}>
                          <Badge $variant={u.googleConnected ? 'success' : 'warning'}>
                            {u.googleConnected ? 'Connected' : 'Not linked'}
                          </Badge>
                          {u.googleConnected && (
                            <MetaMuted>{u.googleScopes.length} OAuth scopes</MetaMuted>
                          )}
                        </Stack>
                      </td>
                      <td>
                        <StatStrip>
                          <MiniStat title="Tasks">
                            <MiniStatLabel>Tasks</MiniStatLabel>
                            <MiniStatVal>{u.taskCount}</MiniStatVal>
                          </MiniStat>
                          <MiniStat title="Reminders">
                            <MiniStatLabel>Reminders</MiniStatLabel>
                            <MiniStatVal>{u.reminderCount}</MiniStatVal>
                          </MiniStat>
                          <MiniStat title="Meetings">
                            <MiniStatLabel>Meetings</MiniStatLabel>
                            <MiniStatVal>{u.meetingCount}</MiniStatVal>
                          </MiniStat>
                          <MiniStat title="Journals">
                            <MiniStatLabel>Journals</MiniStatLabel>
                            <MiniStatVal>{u.journalCount}</MiniStatVal>
                          </MiniStat>
                          <MiniStat title="Notes">
                            <MiniStatLabel>Notes</MiniStatLabel>
                            <MiniStatVal>{u.noteCount}</MiniStatVal>
                          </MiniStat>
                        </StatStrip>
                      </td>
                      <td>
                        <UsageCell>
                          <span className="runs">{u.runCount} runs</span>
                          <span className="spend">${u.totalCostUsd.toFixed(2)} spend</span>
                        </UsageCell>
                      </td>
                      <td>
                        <MetaMuted title={u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : undefined}>
                          {u.lastSeenAt
                            ? formatDistanceToNow(new Date(u.lastSeenAt), { addSuffix: true })
                            : 'Never'}
                        </MetaMuted>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <ActionsStack>
                          <Button
                            type="button"
                            $variant="secondary"
                            $size="sm"
                            disabled={u.id === me?.id}
                            title={
                              u.id === me?.id
                                ? 'Adjust others only — use DB or another admin for your account'
                                : undefined
                            }
                            onClick={() => {
                              setSkillModalUser(u);
                              setDraftDisabledSkills(
                                normalizeUserDisabled(
                                  u.disabledSkills ?? [],
                                  skillCatalog?.defaultSkillIds ?? [],
                                ),
                              );
                            }}
                          >
                            Skills
                          </Button>
                          <Button
                            type="button"
                            $variant="secondary"
                            $size="sm"
                            disabled={u.id === me?.id && u.role === 'admin'}
                            title={u.id === me?.id ? 'Cannot demote yourself' : undefined}
                            onClick={async () => {
                              await adminFetch(`/users/${u.id}/role`, {
                                method: 'PATCH',
                                body: JSON.stringify({
                                  role: u.role === 'admin' ? 'user' : 'admin',
                                }),
                              });
                              void load();
                            }}
                          >
                            {u.role === 'admin' ? 'Demote to user' : 'Make admin'}
                          </Button>
                          <Button
                            type="button"
                            $variant={u.disabledAt ? 'success' : 'danger'}
                            $size="sm"
                            disabled={u.id === me?.id}
                            title={u.id === me?.id ? 'Cannot disable yourself' : undefined}
                            onClick={async () => {
                              await adminFetch(`/users/${u.id}/disabled`, {
                                method: 'PATCH',
                                body: JSON.stringify({ disabled: !u.disabledAt }),
                              });
                              void load();
                            }}
                          >
                            {u.disabledAt ? 'Enable account' : 'Disable account'}
                          </Button>
                        </ActionsStack>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableScroll>
        </CardBody>
      </Card>

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
              <ModalFooter>
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
              </ModalFooter>
            </CardBody>
          </ModalPanel>
        </ModalBackdrop>
      )}
    </PageContainer>
  );
};

export default Admin;
