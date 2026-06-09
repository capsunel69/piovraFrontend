import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle } from '../ui/primitives';
import LoadingState from '../shared/LoadingState';
import ErrorMessage from '../shared/ErrorMessage';
import { AdTopBarBlock } from './AdShared';
import { clearAdLogs, fetchAdLogs } from '../../services/analyticsDashboard';

const LogsTab: React.FC = () => {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchAdLogs();
      setLines(res.content ? res.content.split('\n').filter(Boolean) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState message="Loading logs…" />;

  return (
    <>
      <AdTopBarBlock title="Logs" subtitle="Analytics scrape log" onRefresh={() => void load()} />
      {error && <ErrorMessage message={error} onRetry={() => void load()} />}
      <Card>
        <CardHeader>
          <CardTitle>Recent lines</CardTitle>
        </CardHeader>
        <CardBody>
          <pre style={{ fontSize: 11, lineHeight: 1.45, maxHeight: 480, overflow: 'auto', color: 'var(--text-2)', margin: 0 }}>
            {lines.length ? lines.join('\n') : 'No log lines yet.'}
          </pre>
        </CardBody>
      </Card>
      <Button type="button" $variant="danger" $size="sm" onClick={async () => {
        if (!confirm('Clear log file?')) return;
        await clearAdLogs();
        await load();
      }}>Clear logs</Button>
    </>
  );
};

export default LogsTab;
