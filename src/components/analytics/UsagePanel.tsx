import React from 'react';
import styled from 'styled-components';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnPlatform, AnUsageResponse } from '../../types/analytics';
import { PLATFORM_GLYPHS, PLATFORM_META } from './platformMeta';
import { formatDateRo, formatDayMonthRo } from '../../utils/dateFormat';

const Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: var(--s-3);
`;

const Card = styled.div<{ $accent?: string }>`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-5);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 2px;
    background: linear-gradient(90deg, ${(p) => p.$accent ?? 'var(--accent)'}, transparent 70%);
  }

  .title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .value {
    margin-top: var(--s-2);
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-1);
    font-variant-numeric: tabular-nums;
  }

  .sub {
    margin-top: var(--s-2);
    font-size: 12px;
    color: var(--text-3);
  }
`;

const ChartCard = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-5);

  h4 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
    margin-bottom: var(--s-4);
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td {
    text-align: left;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-1);
    white-space: nowrap;
  }

  th {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-3);
    background: var(--bg-3);
  }

  td { color: var(--text-2); font-variant-numeric: tabular-nums; }
  tbody tr:last-child td { border-bottom: none; }
`;

const PlatformChips = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Chip = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: ${(p) => p.$color};
`;

function formatUsd(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function formatNum(value: number): string {
  return new Intl.NumberFormat('ro-RO').format(value);
}

interface Props {
  usage: AnUsageResponse;
}

export const UsagePanel: React.FC<Props> = ({ usage }) => {
  return (
    <>
      <Cards>
        <Card $accent="#4cc2ff">
          <p className="title">ScrapeCreators credits</p>
          <p className="value">{formatNum(usage.totals.scCredits)}</p>
          <p className="sub">FB / IG / TikTok live calls</p>
        </Card>
        <Card $accent="#34d399">
          <p className="title">Estimated cost</p>
          <p className="value">{formatUsd(usage.totals.estCostUsd)}</p>
          <p className="sub">{formatUsd(usage.creditCostUsd)} / credit</p>
        </Card>
        <Card $accent={PLATFORM_META.youtube.color}>
          <p className="title">YouTube quota units</p>
          <p className="value">{formatNum(usage.totals.ytUnits)}</p>
          <p className="sub">Free — 10K units / day limit</p>
        </Card>
        <Card>
          <p className="title">API calls</p>
          <p className="value">{formatNum(usage.totals.calls)}</p>
          <p className="sub">Live requests (cache hits cost nothing)</p>
        </Card>
      </Cards>

      {usage.daily.length > 0 && (
        <ChartCard>
          <h4>Daily usage</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={usage.daily}>
              <CartesianGrid stroke="var(--border-1)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--text-3)' }}
                tickFormatter={formatDayMonthRo}
              />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-1)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(label: string) => formatDateRo(label)}
              />
              <Legend />
              <Bar dataKey="scCredits" name="SC credits" fill="#4cc2ff" />
              <Bar dataKey="ytUnits" name="YouTube units" fill={PLATFORM_META.youtube.color} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-1)', borderRadius: 'var(--r-lg)' }}>
        <Table>
          <thead>
            <tr>
              <th>Project</th>
              <th>SC credits</th>
              <th>Est. cost</th>
              <th>YouTube units</th>
              <th>Per platform</th>
            </tr>
          </thead>
          <tbody>
            {usage.projects.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-3)' }}>
                  No API usage in this period. Usage is recorded on every live pull (cache hits are free).
                </td>
              </tr>
            )}
            {usage.projects.map((p) => (
              <tr key={p.projectId ?? 'unknown'}>
                <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{p.projectName}</td>
                <td>{formatNum(p.scCredits)}</td>
                <td>{formatUsd(p.estCostUsd)}</td>
                <td>{formatNum(p.ytUnits)}</td>
                <td>
                  <PlatformChips>
                    {Object.entries(p.byPlatform).map(([platform, bucket]) => {
                      const meta = PLATFORM_META[platform as AnPlatform];
                      const Glyph = PLATFORM_GLYPHS[platform as AnPlatform];
                      if (!meta) return null;
                      const units = platform === 'youtube' ? bucket.ytUnits : bucket.scCredits;
                      return (
                        <Chip key={platform} $color={meta.color}>
                          <Glyph size={12} /> {formatNum(units)}
                        </Chip>
                      );
                    })}
                  </PlatformChips>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
};
