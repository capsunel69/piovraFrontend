import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle } from '../ui/primitives';
import LoadingState from '../shared/LoadingState';
import ErrorMessage from '../shared/ErrorMessage';
import { AdTopBarBlock, DataTable } from './AdShared';
import { clearAdUsage, fetchAdUsage } from '../../services/analyticsDashboard';

const UsageTab: React.FC = () => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    if (refresh) setBusy(true);
    else setLoading(true);
    try {
      const res = (await fetchAdUsage(refresh)) as Record<string, unknown>;
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading && !data) return <LoadingState message="Loading API usage…" />;

  const summary = (data?.summary ?? {}) as Record<string, number>;
  const sc = (data?.scrapecreators ?? {}) as Record<string, unknown>;

  return (
    <>
      <AdTopBarBlock title="API Usage" subtitle="Local events + ScrapeCreators credits" busy={busy} onRefresh={() => void load(true)} />
      {error && <ErrorMessage message={error} onRetry={() => void load(false)} />}

      <Card>
        <CardHeader><CardTitle>Last 30 days (local)</CardTitle></CardHeader>
        <CardBody>
          <DataTable>
            <tbody>
              <tr><td>Total credits</td><td>{summary.totalCredits ?? 0}</td></tr>
              <tr><td>Cached hits</td><td>{summary.fromCache ?? 0}</td></tr>
              <tr><td>Live calls</td><td>{summary.liveCalls ?? 0}</td></tr>
            </tbody>
          </DataTable>
        </CardBody>
      </Card>

      {Boolean(sc.configured) && (
        <Card>
          <CardHeader><CardTitle>ScrapeCreators</CardTitle></CardHeader>
          <CardBody>
            <pre style={{ fontSize: 12, overflow: 'auto', color: 'var(--text-2)' }}>
              {JSON.stringify(sc, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}

      <Button type="button" $variant="danger" $size="sm" onClick={async () => {
        if (!confirm('Clear local usage events?')) return;
        await clearAdUsage();
        await load(false);
      }}>Clear local usage</Button>
    </>
  );
};

export default UsageTab;
