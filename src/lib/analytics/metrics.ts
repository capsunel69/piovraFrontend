import type { AdDataPoint, AdMetricKey, AdPlatform } from '../../services/analyticsDashboard';

export const ALL_METRICS: AdMetricKey[] = ['views', 'posts', 'likes', 'shares', 'comments'];

export function sumMetric(data: AdDataPoint[], metric: AdMetricKey): number {
  return data.reduce((sum, point) => sum + point[metric], 0);
}

export function sumByPlatform(data: AdDataPoint[], metric: AdMetricKey): Record<AdPlatform, number> {
  return data.reduce(
    (acc, point) => {
      acc[point.platform] = (acc[point.platform] ?? 0) + point[metric];
      return acc;
    },
    {} as Record<AdPlatform, number>,
  );
}

export function mergeAnalyticsByDate(
  data: AdDataPoint[],
): Record<string, Record<AdPlatform, Pick<AdDataPoint, AdMetricKey>>> {
  return data.reduce<
    Record<string, Record<AdPlatform, Pick<AdDataPoint, AdMetricKey>>>
  >((acc, point) => {
    if (!acc[point.date]) acc[point.date] = {} as Record<AdPlatform, Pick<AdDataPoint, AdMetricKey>>;
    acc[point.date][point.platform] = {
      views: point.views,
      posts: point.posts,
      likes: point.likes,
      shares: point.shares,
      comments: point.comments,
    };
    return acc;
  }, {});
}

export function buildChartRows(
  data: AdDataPoint[],
  startDate: string,
  endDate: string,
  platforms: AdPlatform[],
  metric: AdMetricKey,
): Array<{ date: string; [key: string]: string | number }> {
  const merged = mergeAnalyticsByDate(data);
  const dates = getDatesInRangeSimple(startDate, endDate);
  return dates.map((date) => {
    const row: { date: string; [key: string]: string | number } = { date };
    for (const platform of platforms) {
      row[platform] = merged[date]?.[platform]?.[metric] ?? 0;
    }
    return row;
  });
}

function getDatesInRangeSimple(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
