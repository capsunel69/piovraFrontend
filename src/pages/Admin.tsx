import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const ADMIN_URL = `${PIOVRA_BASE_URL}/v1/admin`;

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  role: 'user' | 'admin';
  disabledAt: string | null;
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

const Wrap = styled.div`
  padding: var(--s-5);
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
`;

const KpiRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--s-4);
`;

const Kpi = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  padding: var(--s-4);

  .label { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
  .value { font-size: 26px; font-weight: 600; color: var(--text-1); margin-top: 4px; }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  overflow: hidden;

  th, td {
    padding: 10px 12px;
    text-align: left;
    font-size: 13px;
    border-bottom: 1px solid var(--border-1);
  }
  th { color: var(--text-3); font-weight: 500; background: var(--bg-3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  tr:last-child td { border-bottom: none; }
  td.muted { color: var(--text-3); }
`;

const Badge = styled.span<{ $kind?: 'admin' | 'user' | 'disabled' | 'connected' | 'disconnected' }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: ${(p) =>
    p.$kind === 'admin'
      ? 'rgba(76,194,255,0.15)'
      : p.$kind === 'disabled'
      ? 'rgba(255,93,108,0.15)'
      : p.$kind === 'connected'
      ? 'rgba(80, 200, 120, 0.15)'
      : p.$kind === 'disconnected'
      ? 'rgba(255,158,0,0.15)'
      : 'rgba(255,255,255,0.06)'};
  color: ${(p) =>
    p.$kind === 'admin'
      ? 'var(--accent)'
      : p.$kind === 'disabled'
      ? 'var(--danger)'
      : p.$kind === 'connected'
      ? 'var(--success)'
      : p.$kind === 'disconnected'
      ? 'var(--warning, #ff9e00)'
      : 'var(--text-2)'};
`;

const Button = styled.button`
  background: var(--bg-3);
  border: 1px solid var(--border-2);
  border-radius: var(--r-sm);
  color: var(--text-1);
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 4px;

  &:hover { border-color: var(--accent); }
`;

const Admin: React.FC = () => {
  const { me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    try {
      const [u, m] = await Promise.all([
        adminFetch<AdminUser[]>('/users'),
        adminFetch<AdminMetrics>('/metrics'),
      ]);
      setUsers(u);
      setMetrics(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sortedUsers = useMemo(
    () =>
      users
        ? [...users].sort((a, b) =>
            (b.lastSeenAt ?? b.createdAt).localeCompare(a.lastSeenAt ?? a.createdAt),
          )
        : [],
    [users],
  );

  if (me?.role !== 'admin') {
    return <Wrap>Not authorized.</Wrap>;
  }

  if (error) {
    return <Wrap>Failed to load admin data: {error}</Wrap>;
  }

  return (
    <Wrap>
      <KpiRow>
        <Kpi>
          <div className="label">Total users</div>
          <div className="value">{metrics?.totalUsers ?? '—'}</div>
        </Kpi>
        <Kpi>
          <div className="label">Active (30d)</div>
          <div className="value">{metrics?.activeUsers30d ?? '—'}</div>
        </Kpi>
        <Kpi>
          <div className="label">Total runs</div>
          <div className="value">{metrics?.totalRuns ?? '—'}</div>
        </Kpi>
        <Kpi>
          <div className="label">Total spend</div>
          <div className="value">${metrics ? metrics.totalCostUsd.toFixed(2) : '—'}</div>
        </Kpi>
      </KpiRow>

      <Table>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Google</th>
            <th>Tasks/Reminders/Meetings</th>
            <th>Journals/Notes</th>
            <th>Runs</th>
            <th>Spend</th>
            <th>Last seen</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((u) => (
            <tr key={u.id}>
              <td>
                <strong>{u.name ?? u.email}</strong>
                <br />
                <span className="muted">{u.email}</span>
              </td>
              <td>
                <Badge $kind={u.role === 'admin' ? 'admin' : 'user'}>{u.role}</Badge>
                {u.disabledAt && (
                  <>
                    {' '}
                    <Badge $kind="disabled">disabled</Badge>
                  </>
                )}
              </td>
              <td>
                <Badge $kind={u.googleConnected ? 'connected' : 'disconnected'}>
                  {u.googleConnected ? 'connected' : 'none'}
                </Badge>
                {u.googleConnected && (
                  <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                    {u.googleScopes.length} scopes
                  </div>
                )}
              </td>
              <td>
                {u.taskCount}/{u.reminderCount}/{u.meetingCount}
              </td>
              <td>
                {u.journalCount}/{u.noteCount}
              </td>
              <td>{u.runCount}</td>
              <td>${u.totalCostUsd.toFixed(2)}</td>
              <td className="muted">
                {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : 'never'}
              </td>
              <td>
                <Button
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
                  {u.role === 'admin' ? 'Demote' : 'Promote'}
                </Button>
                <Button
                  onClick={async () => {
                    await adminFetch(`/users/${u.id}/disabled`, {
                      method: 'PATCH',
                      body: JSON.stringify({ disabled: !u.disabledAt }),
                    });
                    void load();
                  }}
                >
                  {u.disabledAt ? 'Enable' : 'Disable'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Wrap>
  );
};

export default Admin;
