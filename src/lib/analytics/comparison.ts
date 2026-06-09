import type { AdMetricKey } from '../../services/analyticsDashboard';

export interface MetricComparison {
  percentChange: number | null;
  delta: number;
  previous: number;
  current: number;
}

export function computePercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function buildMetricComparisons(
  current: Record<AdMetricKey, number>,
  previous: Record<AdMetricKey, number>,
): Record<AdMetricKey, MetricComparison> {
  const keys: AdMetricKey[] = ['views', 'posts', 'likes', 'shares', 'comments'];
  const result = {} as Record<AdMetricKey, MetricComparison>;
  for (const key of keys) {
    const cur = current[key] ?? 0;
    const prev = previous[key] ?? 0;
    result[key] = {
      current: cur,
      previous: prev,
      delta: cur - prev,
      percentChange: computePercentChange(cur, prev),
    };
  }
  return result;
}

export function formatPercentChange(value: number | null): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}
