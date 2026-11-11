import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageSubtitle,
  Button,
  Input,
  Select,
  Spinner,
} from '../components/ui/primitives';
import { IconCheck, IconEdit, IconPlus, IconRefresh, IconTrash, IconX } from '../components/ui/icons';
import ErrorMessage from '../components/shared/ErrorMessage';
import {
  WellnessAPI,
  fetchImageBlobUrl,
  type DayTotals,
  type FoodLog,
  type MealType,
  type NutritionProfile,
  type Overview,
  type WaMessage,
  type WaStatus,
  type WeightLog,
} from '../services/wellness';

/* ── palette: one colour per macro, used everywhere ─────────────────────── */

const C = {
  kcal: '#ff8a4c',
  protein: '#ff5d8f',
  carbs: '#f5b544',
  fat: '#b58aff',
  weight: '#4cc2ff',
  cost: '#22d39a',
  wa: '#25d366',
  waDeep: '#005c4b',
};

const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🥐',
  lunch: '🥗',
  dinner: '🍝',
  snack: '🍎',
};

type Tab = 'overview' | 'food' | 'weight' | 'whatsapp';
const TABS: Array<{ id: Tab; label: string; emoji: string }> = [
  { id: 'overview', label: 'Overview', emoji: '📊' },
  { id: 'food', label: 'Food log', emoji: '🍽️' },
  { id: 'weight', label: 'Weight', emoji: '⚖️' },
  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
];

/* ── helpers ────────────────────────────────────────────────────────────── */

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function shortDay(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}`;
}

function longDay(day: string, today: string): string {
  if (day === today) return 'Today';
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (day === y.toISOString().slice(0, 10)) return 'Yesterday';
  const d = new Date(`${day}T00:00:00Z`);
  return `${WD[d.getUTCDay()]}, ${shortDay(day)}.${day.slice(0, 4)}`;
}

function localDayOf(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  );
}

function timeOf(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

const usd = (n: number | null | undefined): string =>
  n == null ? '—' : n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;

const r0 = (n: number): string => Math.round(n).toLocaleString('en-US');

/** Owner-only images need the session cookie, so they're loaded as blobs. */
const AuthImage: React.FC<{ src: string; alt: string; className?: string; onClick?: () => void }> = ({
  src,
  alt,
  className,
  onClick,
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    fetchImageBlobUrl(src)
      .then((u) => {
        if (alive) {
          revoked = u;
          setUrl(u);
        } else URL.revokeObjectURL(u);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src]);
  if (failed) return <ImgFallback className={className}>📷</ImgFallback>;
  if (!url) return <ImgFallback className={className}><Spinner $size={14} /></ImgFallback>;
  return <img src={url} alt={alt} className={className} onClick={onClick} />;
};

/* ── motion ─────────────────────────────────────────────────────────────── */

const rise = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.55); }
  50%      { box-shadow: 0 0 0 6px rgba(37, 211, 102, 0); }
`;

const staggered = (i: number) => css`
  animation: ${rise} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  animation-delay: ${i * 60}ms;
`;

/* ── layout ─────────────────────────────────────────────────────────────── */

const Hero = styled.div`
  position: relative;
  border: 1px solid var(--border-1);
  border-radius: var(--r-xl);
  padding: var(--s-6);
  overflow: hidden;
  background:
    radial-gradient(600px 220px at 0% 0%, rgba(255, 138, 76, 0.14), transparent 70%),
    radial-gradient(500px 240px at 100% 0%, rgba(37, 211, 102, 0.12), transparent 70%),
    linear-gradient(180deg, var(--bg-2), var(--bg-1));
  margin-bottom: var(--s-5);

  @media (max-width: 720px) { padding: var(--s-4); border-radius: var(--r-lg); }
`;

const HeroTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--s-4);
  flex-wrap: wrap;
`;

const StatusPill = styled.span<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid ${(p) => (p.$on ? 'rgba(37,211,102,0.35)' : 'var(--border-2)')};
  background: ${(p) => (p.$on ? 'rgba(37,211,102,0.1)' : 'var(--bg-3)')};
  color: ${(p) => (p.$on ? C.wa : 'var(--text-3)')};

  i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${(p) => (p.$on ? C.wa : 'var(--text-4)')};
    ${(p) => p.$on && css`animation: ${pulse} 2s infinite;`}
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 6px;
  margin-top: var(--s-5);
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const TabBtn = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid ${(p) => (p.$active ? 'var(--border-3)' : 'transparent')};
  background: ${(p) => (p.$active ? 'var(--bg-4)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-3)')};
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  &:hover { color: var(--text-1); background: var(--bg-3); }
`;

const RangeChips = styled.div`
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--r-md);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
`;

const RangeChip = styled.button<{ $active: boolean }>`
  padding: 4px 10px;
  border-radius: var(--r-sm);
  font-size: 12px;
  font-weight: 600;
  border: 0;
  cursor: pointer;
  background: ${(p) => (p.$active ? 'var(--bg-4)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-3)')};
`;

const KpiGrid = styled.div`
  display: grid;
  gap: var(--s-4);
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  > * { min-width: 0; }
  margin-bottom: var(--s-5);
`;

const Panel = styled.section<{ $i?: number; $accent?: string }>`
  position: relative;
  background: linear-gradient(180deg, var(--bg-3) 0%, var(--bg-2) 100%);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-5);
  overflow: hidden;
  ${(p) => staggered(p.$i ?? 0)}

  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: ${(p) => `linear-gradient(90deg, ${p.$accent ?? 'var(--accent)'}, transparent 75%)`};
  }
`;

const PanelHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
  margin-bottom: var(--s-4);
  flex-wrap: wrap;

  h3 {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--text-2);
  }
`;

const Big = styled.div`
  font-size: clamp(26px, 2.4vw, 34px);
  overflow-wrap: anywhere;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
  line-height: 1;

  small { font-size: 13px; font-weight: 600; color: var(--text-3); margin-left: 6px; letter-spacing: 0; white-space: nowrap; }
`;

const Muted = styled.div`
  font-size: 12px;
  color: var(--text-3);
  margin-top: 6px;
  overflow-wrap: anywhere;
`;

const ChartGrid = styled.div`
  display: grid;
  gap: var(--s-4);
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  @media (max-width: 720px) { grid-template-columns: 1fr; }
`;

const ImgFallback = styled.div`
  display: grid;
  place-items: center;
  background: var(--bg-4);
  color: var(--text-3);
  font-size: 20px;
`;

/* ── kcal ring ──────────────────────────────────────────────────────────── */

const RingWrap = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-4);
  flex-wrap: wrap;
  > div { flex: 1 1 110px; min-width: 0; }
`;

const Ring: React.FC<{ value: number; target: number | null; size?: number }> = ({ value, target, size = 112 }) => {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = target ? Math.min(value / target, 1.5) : 0;
  const over = target ? value > target * 1.05 : false;
  const dash = Math.min(pct, 1) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-4)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={over ? 'var(--danger)' : C.kcal}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.2,0.7,0.2,1)' }}
      />
      <text x="50%" y="47%" textAnchor="middle" fontSize={size * 0.2} fontWeight="800" fill="var(--text-1)">
        {target ? `${Math.round(pct * 100)}%` : '🔥'}
      </text>
      <text x="50%" y="64%" textAnchor="middle" fontSize="10" fill="var(--text-3)">
        {target ? 'of target' : 'no target'}
      </text>
    </svg>
  );
};

/* ── macro bars ─────────────────────────────────────────────────────────── */

const MacroRow = styled.div`
  display: grid;
  grid-template-columns: 74px 1fr auto;
  align-items: center;
  gap: var(--s-3);
  font-size: 12.5px;
  & + & { margin-top: 10px; }
  span:first-child { color: var(--text-2); font-weight: 600; }
  span:last-child { color: var(--text-1); font-variant-numeric: tabular-nums; font-weight: 600; }
`;

const Track = styled.div`
  height: 8px;
  border-radius: 99px;
  background: var(--bg-4);
  overflow: hidden;
`;

const Fill = styled.div<{ $pct: number; $color: string }>`
  height: 100%;
  width: ${(p) => Math.min(p.$pct, 100)}%;
  background: ${(p) => p.$color};
  border-radius: 99px;
  box-shadow: 0 0 12px ${(p) => `${p.$color}66`};
  transition: width 0.8s cubic-bezier(0.2, 0.7, 0.2, 1);
`;

const Macro: React.FC<{ label: string; value: number; target: number | null; color: string }> = ({
  label,
  value,
  target,
  color,
}) => (
  <MacroRow>
    <span>{label}</span>
    <Track>
      <Fill $pct={target ? (value / target) * 100 : value > 0 ? 100 : 0} $color={color} />
    </Track>
    <span>
      {r0(value)}g{target ? <span style={{ color: 'var(--text-3)', fontWeight: 500 }}> / {target}g</span> : null}
    </span>
  </MacroRow>
);

/* ── charts ─────────────────────────────────────────────────────────────── */

const tooltipStyle = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border-2)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text-1)',
};

const axis = { stroke: 'var(--text-4)', fontSize: 11, tickLine: false, axisLine: false } as const;

const KcalChart: React.FC<{ data: DayTotals[]; target: number | null }> = ({ data, target }) => (
  <ResponsiveContainer width="100%" height={240}>
    <BarChart data={data.map((d) => ({ ...d, label: shortDay(d.day) }))} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
      <XAxis dataKey="label" {...axis} minTickGap={12} />
      <YAxis {...axis} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v: number) => [`${r0(v)} kcal`, 'Calories']} />
      {target ? <ReferenceLine y={target} stroke={C.kcal} strokeDasharray="4 4" label={{ value: `🎯 ${target}`, fill: C.kcal, fontSize: 11, position: 'insideTopRight' }} /> : null}
      <Bar dataKey="kcal" fill={C.kcal} radius={[6, 6, 0, 0]} maxBarSize={28} />
    </BarChart>
  </ResponsiveContainer>
);

const MacroChart: React.FC<{ data: DayTotals[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={240}>
    <BarChart data={data.map((d) => ({ ...d, label: shortDay(d.day) }))} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
      <XAxis dataKey="label" {...axis} minTickGap={12} />
      <YAxis {...axis} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v: number, n: string) => [`${r0(v)} g`, n]} />
      <Bar dataKey="proteinG" name="Protein" stackId="m" fill={C.protein} maxBarSize={28} />
      <Bar dataKey="carbsG" name="Carbs" stackId="m" fill={C.carbs} maxBarSize={28} />
      <Bar dataKey="fatG" name="Fat" stackId="m" fill={C.fat} radius={[6, 6, 0, 0]} maxBarSize={28} />
    </BarChart>
  </ResponsiveContainer>
);

const WeightChart: React.FC<{ data: WeightLog[]; goal: number | null }> = ({ data, goal }) => {
  const vals = data.map((w) => w.kg);
  const lo = Math.floor(Math.min(...vals, goal ?? Infinity) - 1);
  const hi = Math.ceil(Math.max(...vals) + 1);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data.map((w) => ({ ...w, label: shortDay(w.measuredOn) }))} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="label" {...axis} minTickGap={12} />
        <YAxis {...axis} domain={[lo, hi]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)} kg`, 'Weight']} />
        {goal ? <ReferenceLine y={goal} stroke={C.cost} strokeDasharray="4 4" label={{ value: `🎯 ${goal} kg`, fill: C.cost, fontSize: 11, position: 'insideBottomRight' }} /> : null}
        <Line type="monotone" dataKey="kg" stroke={C.weight} strokeWidth={2.5} dot={{ r: 3, fill: C.weight }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const CostChart: React.FC<{ data: Overview['costByDay'] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={240}>
    <BarChart data={data.map((d) => ({ ...d, label: shortDay(d.day) }))} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
      <XAxis dataKey="label" {...axis} minTickGap={12} />
      <YAxis {...axis} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v: number) => [usd(v), 'LLM cost']} />
      <Bar dataKey="costUsd" fill={C.cost} radius={[6, 6, 0, 0]} maxBarSize={28} />
    </BarChart>
  </ResponsiveContainer>
);

const EmptyChart = styled.div`
  height: 240px;
  display: grid;
  place-items: center;
  color: var(--text-3);
  font-size: 13px;
  text-align: center;
  line-height: 1.6;
`;

/* ── targets editor ─────────────────────────────────────────────────────── */

const TargetGrid = styled.div`
  display: grid;
  gap: var(--s-3);
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  label { display: block; font-size: 11px; color: var(--text-3); margin-bottom: 4px; font-weight: 600; }
`;

const TargetsPanel: React.FC<{ profile: NutritionProfile; onSaved: () => void; i: number }> = ({ profile, onSaved, i }) => {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(profile), [profile]);
  const num = (k: keyof NutritionProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value === '' ? null : Number(e.target.value) }));
  const save = async () => {
    setSaving(true);
    try {
      await WellnessAPI.updateProfile({
        targetKcal: draft.targetKcal,
        targetProteinG: draft.targetProteinG,
        targetCarbsG: draft.targetCarbsG,
        targetFatG: draft.targetFatG,
        goalWeightKg: draft.goalWeightKg,
        heightCm: draft.heightCm,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };
  const fields: Array<[keyof NutritionProfile, string]> = [
    ['targetKcal', '🔥 Calories / day'],
    ['targetProteinG', '🥩 Protein g'],
    ['targetCarbsG', '🍚 Carbs g'],
    ['targetFatG', '🧈 Fat g'],
    ['goalWeightKg', '🎯 Goal weight kg'],
    ['heightCm', '📏 Height cm'],
  ];
  return (
    <Panel $i={i} $accent={C.carbs}>
      <PanelHead>
        <h3>🎯 Daily targets</h3>
        <Button $size="sm" $variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? <Spinner $size={12} /> : <IconCheck />} Save
        </Button>
      </PanelHead>
      <TargetGrid>
        {fields.map(([k, label]) => (
          <div key={k}>
            <label>{label}</label>
            <Input type="number" step="any" value={(draft[k] as number | null) ?? ''} onChange={num(k)} placeholder="—" />
          </div>
        ))}
      </TargetGrid>
      <Muted>You can also just tell the assistant: “my target is 2200 kcal and 160 g protein”.</Muted>
    </Panel>
  );
};

/* ── overview tab ───────────────────────────────────────────────────────── */

const OverviewTab: React.FC<{ data: Overview; reload: () => void }> = ({ data, reload }) => {
  const todayTotals = data.daily.find((d) => d.day === data.today) ?? {
    kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, entries: 0, day: data.today,
  };
  const p = data.profile;
  const logged = data.daily.filter((d) => d.entries > 0);
  const avgKcal = logged.length ? logged.reduce((s, d) => s + d.kcal, 0) / logged.length : 0;
  const weights = data.weights;
  const latest = weights[weights.length - 1];
  const weekAgo = latest
    ? [...weights].reverse().find((w) => w.measuredOn <= shiftDay(latest.measuredOn, -7))
    : undefined;
  const delta = latest && weekAgo ? latest.kg - weekAgo.kg : null;
  const remaining = p.targetKcal ? p.targetKcal - todayTotals.kcal : null;

  return (
    <>
      <KpiGrid>
        <Panel $i={0} $accent={C.kcal}>
          <PanelHead><h3>🔥 Today</h3><Muted style={{ margin: 0 }}>{todayTotals.entries} meals</Muted></PanelHead>
          <RingWrap>
            <Ring value={todayTotals.kcal} target={p.targetKcal} size={92} />
            <div>
              <Big>{r0(todayTotals.kcal)}<small>kcal</small></Big>
              <Muted>
                {remaining == null
                  ? 'Set a target below'
                  : remaining >= 0
                    ? `${r0(remaining)} kcal left 🙌`
                    : `${r0(-remaining)} kcal over ⚠️`}
              </Muted>
              <Muted>Avg {r0(avgKcal)} kcal over {logged.length} logged days</Muted>
            </div>
          </RingWrap>
        </Panel>

        <Panel $i={1} $accent={C.protein}>
          <PanelHead><h3>🥗 Macros today</h3></PanelHead>
          <Macro label="Protein" value={todayTotals.proteinG} target={p.targetProteinG} color={C.protein} />
          <Macro label="Carbs" value={todayTotals.carbsG} target={p.targetCarbsG} color={C.carbs} />
          <Macro label="Fat" value={todayTotals.fatG} target={p.targetFatG} color={C.fat} />
          <Muted>🌾 Fiber {r0(todayTotals.fiberG)} g</Muted>
        </Panel>

        <Panel $i={2} $accent={C.weight}>
          <PanelHead><h3>⚖️ Weight</h3>{latest ? <Muted style={{ margin: 0 }}>{shortDay(latest.measuredOn)}</Muted> : null}</PanelHead>
          {latest ? (
            <>
              <Big>{latest.kg.toFixed(1)}<small>kg</small></Big>
              <Muted>
                {delta == null ? 'Log a few days to see the trend' : `${delta <= 0 ? '📉' : '📈'} ${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg vs a week ago`}
              </Muted>
              {p.goalWeightKg ? <Muted>🎯 {(latest.kg - p.goalWeightKg).toFixed(1)} kg to goal ({p.goalWeightKg} kg)</Muted> : null}
            </>
          ) : (
            <Muted>Send “82.4” to yourself on WhatsApp to log today’s weight.</Muted>
          )}
        </Panel>

        <Panel $i={3} $accent={C.cost}>
          <PanelHead><h3>💸 LLM spend</h3><Muted style={{ margin: 0 }}>{data.cost.calls} calls</Muted></PanelHead>
          <Big>{usd(data.cost.monthUsd)}<small>this month</small></Big>
          <Muted>Today {usd(data.cost.todayUsd)} · All-time {usd(data.cost.totalUsd)}</Muted>
        </Panel>
      </KpiGrid>

      <ChartGrid>
        <Panel $i={4} $accent={C.kcal}>
          <PanelHead><h3>Calories per day</h3></PanelHead>
          {logged.length ? <KcalChart data={data.daily} target={p.targetKcal} /> : <EmptyChart>📸 Send a food photo to yourself on WhatsApp<br />and it will show up here.</EmptyChart>}
        </Panel>
        <Panel $i={5} $accent={C.protein}>
          <PanelHead><h3>Macros per day</h3></PanelHead>
          {logged.length ? <MacroChart data={data.daily} /> : <EmptyChart>No meals logged in this range yet.</EmptyChart>}
        </Panel>
        <Panel $i={6} $accent={C.weight}>
          <PanelHead><h3>Weight trend</h3></PanelHead>
          {weights.length >= 2 ? <WeightChart data={weights} goal={p.goalWeightKg} /> : <EmptyChart>Log your weight on two different days to see a trend.</EmptyChart>}
        </Panel>
        <Panel $i={7} $accent={C.cost}>
          <PanelHead><h3>LLM cost per day</h3></PanelHead>
          {data.costByDay.length ? <CostChart data={data.costByDay} /> : <EmptyChart>No assistant usage in this range.</EmptyChart>}
        </Panel>
        <TargetsPanel profile={p} onSaved={reload} i={8} />
      </ChartGrid>
    </>
  );
};

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/* ── food tab ───────────────────────────────────────────────────────────── */

const DayGroup = styled.div<{ $i: number }>`
  ${(p) => staggered(p.$i)}
  & + & { margin-top: var(--s-6); }
`;

const DayHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s-3);
  padding: 0 4px var(--s-3);
  border-bottom: 1px dashed var(--border-2);
  margin-bottom: var(--s-3);
  flex-wrap: wrap;

  h4 { font-size: 15px; font-weight: 800; color: var(--text-1); letter-spacing: -0.01em; }
`;

const DayTotalsLine = styled.div`
  display: flex;
  gap: 10px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-wrap: wrap;
`;

const Dot = styled.span<{ $c: string }>`
  color: ${(p) => p.$c};
`;

const FoodCard = styled.article`
  display: grid;
  grid-template-columns: 84px 1fr auto;
  gap: var(--s-4);
  padding: var(--s-3);
  border-radius: var(--r-lg);
  border: 1px solid var(--border-1);
  background: var(--bg-2);
  transition: border-color 0.15s, transform 0.15s;
  & + & { margin-top: var(--s-2); }
  &:hover { border-color: var(--border-3); }

  @media (max-width: 560px) { grid-template-columns: 64px 1fr; }

  .thumb {
    width: 84px;
    height: 84px;
    border-radius: var(--r-md);
    object-fit: cover;
    cursor: zoom-in;
    @media (max-width: 560px) { width: 64px; height: 64px; }
  }
`;

const FoodTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Tag = styled.span<{ $c?: string }>`
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  background: ${(p) => (p.$c ? `${p.$c}1f` : 'var(--bg-4)')};
  color: ${(p) => p.$c ?? 'var(--text-3)'};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const MacroChips = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
`;

const MacroChip = styled.span<{ $c: string }>`
  font-size: 12px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: var(--r-sm);
  background: ${(p) => `${p.$c}17`};
  color: ${(p) => p.$c};
  font-variant-numeric: tabular-nums;
`;

const Items = styled.ul`
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--text-2);
  li { display: flex; justify-content: space-between; gap: 12px; padding: 2px 0; }
  li span:last-child { color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
`;

const CardActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  @media (max-width: 560px) { grid-column: 1 / -1; flex-direction: row; justify-content: flex-end; }
`;

const IconBtn = styled.button<{ $danger?: boolean }>`
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-1);
  background: var(--bg-3);
  color: ${(p) => (p.$danger ? 'var(--danger)' : 'var(--text-2)')};
  cursor: pointer;
  svg { width: 14px; height: 14px; }
  &:hover { border-color: ${(p) => (p.$danger ? 'rgba(255,93,108,0.4)' : 'var(--border-3)')}; color: ${(p) => (p.$danger ? 'var(--danger)' : 'var(--text-1)')}; }
`;

const EditGrid = styled.div`
  display: grid;
  gap: 8px;
  grid-template-columns: 2fr 1fr repeat(4, 1fr);
  margin-top: 4px;
  @media (max-width: 720px) { grid-template-columns: 1fr 1fr; }
  label { font-size: 10.5px; color: var(--text-3); font-weight: 600; display: block; margin-bottom: 2px; }
  input, select { padding: 6px 8px; font-size: 12.5px; }
`;

const Lightbox = styled.div`
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(3, 5, 8, 0.86);
  display: grid;
  place-items: center;
  cursor: zoom-out;
  img { max-width: 92vw; max-height: 88vh; border-radius: var(--r-lg); box-shadow: var(--shadow-lg); }
`;

type FoodDraft = Pick<FoodLog, 'title' | 'mealType' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>;

const FoodEntry: React.FC<{
  f: FoodLog;
  tz: string;
  onChanged: () => void;
  onZoom: (src: string) => void;
}> = ({ f, tz, onChanged, onZoom }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FoodDraft>(f);
  const [busy, setBusy] = useState(false);
  const [showItems, setShowItems] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await WellnessAPI.updateFood(f.id, draft);
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete “${f.title}”?`)) return;
    setBusy(true);
    try {
      await WellnessAPI.deleteFood(f.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const numField = (k: keyof FoodDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: Number(e.target.value) || 0 }));

  const imgSrc = f.imagePath ? WellnessAPI.foodImageUrl(f.id) : null;

  return (
    <FoodCard>
      {imgSrc ? (
        <AuthImage src={imgSrc} alt={f.title} className="thumb" onClick={() => onZoom(imgSrc)} />
      ) : (
        <ImgFallback className="thumb" style={{ borderRadius: 'var(--r-md)', fontSize: 30 }}>
          {f.mealType ? MEAL_EMOJI[f.mealType] : '🍽️'}
        </ImgFallback>
      )}
      <div style={{ minWidth: 0 }}>
        {editing ? (
          <EditGrid>
            <div>
              <label>Title</label>
              <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            </div>
            <div>
              <label>Meal</label>
              <Select value={draft.mealType ?? ''} onChange={(e) => setDraft((d) => ({ ...d, mealType: (e.target.value || null) as MealType | null }))}>
                <option value="">—</option>
                {(Object.keys(MEAL_EMOJI) as MealType[]).map((m) => <option key={m} value={m}>{MEAL_EMOJI[m]} {m}</option>)}
              </Select>
            </div>
            <div><label>kcal</label><Input type="number" value={draft.kcal} onChange={numField('kcal')} /></div>
            <div><label>Protein g</label><Input type="number" value={draft.proteinG} onChange={numField('proteinG')} /></div>
            <div><label>Carbs g</label><Input type="number" value={draft.carbsG} onChange={numField('carbsG')} /></div>
            <div><label>Fat g</label><Input type="number" value={draft.fatG} onChange={numField('fatG')} /></div>
          </EditGrid>
        ) : (
          <>
            <FoodTitle>
              {f.title}
              {f.mealType ? <Tag>{MEAL_EMOJI[f.mealType]} {f.mealType}</Tag> : null}
              <Tag>{timeOf(f.eatenAt, tz)}</Tag>
              {f.source === 'image' ? <Tag $c={C.wa}>📸 photo</Tag> : f.source === 'manual' ? <Tag>✍️ manual</Tag> : <Tag $c={C.wa}>💬 text</Tag>}
              {f.confidence != null ? <Tag $c={f.confidence >= 0.7 ? C.cost : C.carbs}>{Math.round(f.confidence * 100)}% sure</Tag> : null}
            </FoodTitle>
            <MacroChips>
              <MacroChip $c={C.kcal}>🔥 {r0(f.kcal)} kcal</MacroChip>
              <MacroChip $c={C.protein}>🥩 {r0(f.proteinG)}g P</MacroChip>
              <MacroChip $c={C.carbs}>🍚 {r0(f.carbsG)}g C</MacroChip>
              <MacroChip $c={C.fat}>🧈 {r0(f.fatG)}g F</MacroChip>
            </MacroChips>
            {f.items.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowItems((v) => !v)}
                style={{ background: 'none', border: 0, color: 'var(--text-3)', fontSize: 11.5, marginTop: 6, cursor: 'pointer', padding: 0 }}
              >
                {showItems ? '▾' : '▸'} {f.items.length} item{f.items.length === 1 ? '' : 's'}
              </button>
            ) : null}
            {showItems ? (
              <Items>
                {f.items.map((it, i) => (
                  <li key={i}>
                    <span>{it.name} <em style={{ color: 'var(--text-3)' }}>({it.portion})</em></span>
                    <span>{r0(it.kcal)} kcal · {r0(it.proteinG)}/{r0(it.carbsG)}/{r0(it.fatG)}</span>
                  </li>
                ))}
              </Items>
            ) : null}
            {f.notes ? <Muted>💡 {f.notes}</Muted> : null}
          </>
        )}
      </div>
      <CardActions>
        {editing ? (
          <>
            <IconBtn onClick={() => void save()} disabled={busy} title="Save"><IconCheck /></IconBtn>
            <IconBtn onClick={() => { setDraft(f); setEditing(false); }} title="Cancel"><IconX /></IconBtn>
          </>
        ) : (
          <>
            <IconBtn onClick={() => setEditing(true)} title="Edit"><IconEdit /></IconBtn>
            <IconBtn $danger onClick={() => void remove()} disabled={busy} title="Delete"><IconTrash /></IconBtn>
          </>
        )}
      </CardActions>
    </FoodCard>
  );
};

const AddRow = styled.form`
  display: grid;
  grid-template-columns: 2fr 1fr repeat(4, 1fr) auto;
  gap: 8px;
  align-items: end;
  margin-bottom: var(--s-5);
  padding: var(--s-4);
  border-radius: var(--r-lg);
  border: 1px dashed var(--border-2);
  background: var(--bg-1);
  @media (max-width: 860px) { grid-template-columns: 1fr 1fr; }
  label { font-size: 10.5px; color: var(--text-3); font-weight: 600; display: block; margin-bottom: 2px; }
`;

const FoodTab: React.FC<{ tz: string; today: string; fromDay: string; onChanged: () => void }> = ({ tz, today, fromDay, onChanged }) => {
  const [rows, setRows] = useState<FoodLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<FoodDraft>({ title: '', mealType: null, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });

  const load = useCallback(async () => {
    try {
      setRows(await WellnessAPI.listFood(fromDay, today));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [fromDay, today]);
  useEffect(() => void load(), [load]);

  const changed = () => {
    void load();
    onChanged();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setAdding(true);
    try {
      await WellnessAPI.createFood({ ...draft, title: draft.title.trim() });
      setDraft({ title: '', mealType: null, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
      changed();
    } finally {
      setAdding(false);
    }
  };

  const groups = useMemo(() => {
    const m = new Map<string, FoodLog[]>();
    for (const r of rows ?? []) {
      const d = localDayOf(r.eatenAt, tz);
      m.set(d, [...(m.get(d) ?? []), r]);
    }
    return [...m.entries()];
  }, [rows, tz]);

  const numField = (k: keyof FoodDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: Number(e.target.value) || 0 }));

  return (
    <>
      <AddRow onSubmit={(e) => void add(e)}>
        <div><label>✍️ Add manually</label><Input placeholder="e.g. Protein shake" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} /></div>
        <div>
          <label>Meal</label>
          <Select value={draft.mealType ?? ''} onChange={(e) => setDraft((d) => ({ ...d, mealType: (e.target.value || null) as MealType | null }))}>
            <option value="">—</option>
            {(Object.keys(MEAL_EMOJI) as MealType[]).map((m) => <option key={m} value={m}>{MEAL_EMOJI[m]} {m}</option>)}
          </Select>
        </div>
        <div><label>kcal</label><Input type="number" value={draft.kcal || ''} onChange={numField('kcal')} /></div>
        <div><label>Protein g</label><Input type="number" value={draft.proteinG || ''} onChange={numField('proteinG')} /></div>
        <div><label>Carbs g</label><Input type="number" value={draft.carbsG || ''} onChange={numField('carbsG')} /></div>
        <div><label>Fat g</label><Input type="number" value={draft.fatG || ''} onChange={numField('fatG')} /></div>
        <Button type="submit" $variant="primary" disabled={adding || !draft.title.trim()}><IconPlus /> Add</Button>
      </AddRow>

      {error ? <ErrorMessage message={error} /> : null}
      {rows === null ? <Spinner /> : null}
      {rows?.length === 0 ? <EmptyChart>🍽️ Nothing logged in this range yet.<br />Snap your next meal and send it to yourself on WhatsApp.</EmptyChart> : null}

      {groups.map(([day, list], gi) => {
        const t = list.reduce(
          (s, f) => ({ kcal: s.kcal + f.kcal, p: s.p + f.proteinG, c: s.c + f.carbsG, f: s.f + f.fatG }),
          { kcal: 0, p: 0, c: 0, f: 0 },
        );
        return (
          <DayGroup key={day} $i={gi}>
            <DayHead>
              <h4>{longDay(day, today)}</h4>
              <DayTotalsLine>
                <Dot $c={C.kcal}>🔥 {r0(t.kcal)} kcal</Dot>
                <Dot $c={C.protein}>P {r0(t.p)}g</Dot>
                <Dot $c={C.carbs}>C {r0(t.c)}g</Dot>
                <Dot $c={C.fat}>F {r0(t.f)}g</Dot>
              </DayTotalsLine>
            </DayHead>
            {list.map((f) => <FoodEntry key={f.id} f={f} tz={tz} onChanged={changed} onZoom={setZoom} />)}
          </DayGroup>
        );
      })}

      {zoom ? (
        <Lightbox onClick={() => setZoom(null)}>
          <AuthImage src={zoom} alt="Food photo" />
        </Lightbox>
      ) : null}
    </>
  );
};

/* ── weight tab ─────────────────────────────────────────────────────────── */

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-3); padding: 8px 10px; border-bottom: 1px solid var(--border-1); }
  td { padding: 8px 10px; border-bottom: 1px solid var(--border-1); color: var(--text-1); font-variant-numeric: tabular-nums; }
  tr:hover td { background: var(--bg-3); }
  input { padding: 5px 8px; font-size: 12.5px; max-width: 140px; }
`;

const WeightRow: React.FC<{ w: WeightLog; prev?: WeightLog; onChanged: () => void }> = ({ w, prev, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [kg, setKg] = useState(String(w.kg));
  const [note, setNote] = useState(w.note ?? '');
  const delta = prev ? w.kg - prev.kg : null;
  const save = async () => {
    await WellnessAPI.updateWeight(w.id, { kg: Number(kg), note: note || null });
    setEditing(false);
    onChanged();
  };
  const remove = async () => {
    if (!window.confirm(`Delete weight for ${w.measuredOn}?`)) return;
    await WellnessAPI.deleteWeight(w.id);
    onChanged();
  };
  return (
    <tr>
      <td>{w.measuredOn}</td>
      <td>{editing ? <Input type="number" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} /> : <strong>{w.kg.toFixed(1)} kg</strong>}</td>
      <td style={{ color: delta == null ? 'var(--text-3)' : delta <= 0 ? 'var(--success)' : 'var(--warning)' }}>
        {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
      </td>
      <td>{editing ? <Input value={note} onChange={(e) => setNote(e.target.value)} /> : <span style={{ color: 'var(--text-2)' }}>{w.note ?? ''}</span>}</td>
      <td style={{ width: 80 }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {editing ? (
            <>
              <IconBtn onClick={() => void save()} title="Save"><IconCheck /></IconBtn>
              <IconBtn onClick={() => setEditing(false)} title="Cancel"><IconX /></IconBtn>
            </>
          ) : (
            <>
              <IconBtn onClick={() => setEditing(true)} title="Edit"><IconEdit /></IconBtn>
              <IconBtn $danger onClick={() => void remove()} title="Delete"><IconTrash /></IconBtn>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

const WeightTab: React.FC<{ today: string; goal: number | null; onChanged: () => void }> = ({ today, goal, onChanged }) => {
  const [rows, setRows] = useState<WeightLog[] | null>(null);
  const [day, setDay] = useState(today);
  const [kg, setKg] = useState('');
  const load = useCallback(async () => setRows(await WellnessAPI.listWeight()), []);
  useEffect(() => void load(), [load]);
  const changed = () => {
    void load();
    onChanged();
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kg) return;
    await WellnessAPI.logWeight(day, Number(kg));
    setKg('');
    changed();
  };
  const asc = useMemo(() => [...(rows ?? [])].reverse(), [rows]);
  return (
    <ChartGrid>
      <Panel $i={0} $accent={C.weight}>
        <PanelHead><h3>⚖️ Trend</h3></PanelHead>
        {asc.length >= 2 ? <WeightChart data={asc.slice(-90)} goal={goal} /> : <EmptyChart>Two entries needed for a trend line.</EmptyChart>}
      </Panel>
      <Panel $i={1} $accent={C.weight}>
        <PanelHead>
          <h3>📒 Entries</h3>
          <form onSubmit={(e) => void add(e)} style={{ display: 'flex', gap: 6 }}>
            <Input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} style={{ padding: '5px 8px', fontSize: 12.5 }} />
            <Input type="number" step="0.1" placeholder="kg" value={kg} onChange={(e) => setKg(e.target.value)} style={{ padding: '5px 8px', fontSize: 12.5, width: 80 }} />
            <Button type="submit" $size="sm" $variant="primary" disabled={!kg}><IconPlus /> Log</Button>
          </form>
        </PanelHead>
        {rows === null ? <Spinner /> : rows.length === 0 ? (
          <EmptyChart>Send “82.4” to yourself on WhatsApp, or log it here.</EmptyChart>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <Table>
              <thead><tr><th>Day</th><th>Weight</th><th>Δ</th><th>Note</th><th /></tr></thead>
              <tbody>
                {rows.map((w, i) => <WeightRow key={w.id} w={w} prev={rows[i + 1]} onChanged={changed} />)}
              </tbody>
            </Table>
          </div>
        )}
      </Panel>
    </ChartGrid>
  );
};

/* ── whatsapp tab ───────────────────────────────────────────────────────── */

const WaShell = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: var(--s-4);
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

const Phone = styled.div`
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid var(--border-2);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  height: min(72vh, 720px);
  background: #0b141a;
`;

const PhoneBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #202c33;
  color: #e9edef;

  .avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 20px;
    background: linear-gradient(135deg, ${C.wa}, ${C.waDeep});
  }
  .name { font-weight: 600; font-size: 14.5px; }
  .sub { font-size: 12px; color: #8696a0; }
`;

const ChatScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 6%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background-color: #0b141a;
  background-image:
    radial-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    radial-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 22px 22px, 11px 11px;
  background-position: 0 0, 5px 5px;
`;

const DayDivider = styled.div`
  align-self: center;
  margin: 10px 0 6px;
  padding: 5px 12px;
  border-radius: 8px;
  background: #182229;
  color: #8696a0;
  font-size: 11.5px;
  font-weight: 600;
`;

const Bubble = styled.div<{ $mine: boolean }>`
  align-self: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
  max-width: min(78%, 560px);
  padding: 6px 9px 6px;
  border-radius: 10px;
  ${(p) => (p.$mine ? 'border-top-right-radius: 2px;' : 'border-top-left-radius: 2px;')}
  background: ${(p) => (p.$mine ? C.waDeep : '#202c33')};
  color: #e9edef;
  font-size: 13.8px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.25);

  img { display: block; width: 100%; max-width: 320px; border-radius: 7px; margin-bottom: 4px; cursor: zoom-in; }
  code { font-family: var(--font-mono); font-size: 12px; background: rgba(0,0,0,0.25); padding: 0 3px; border-radius: 3px; }
`;

const Meta = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
  font-size: 10.5px;
  color: rgba(233, 237, 239, 0.55);
  font-variant-numeric: tabular-nums;
`;

const Qr = styled.div`
  display: grid;
  place-items: center;
  padding: var(--s-4);
  border-radius: var(--r-lg);
  background: #fff;
  img { width: 100%; max-width: 240px; image-rendering: pixelated; }
`;

const Steps = styled.ol`
  margin: var(--s-3) 0 0;
  padding-left: 18px;
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.7;
`;

/** Renders WhatsApp markup (*bold*, _italic_, ~strike~, `code`) safely as React nodes. */
function renderWa(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const inner = tok.slice(1, -1);
    if (tok[0] === '*') out.push(<strong key={k++}>{inner}</strong>);
    else if (tok[0] === '_') out.push(<em key={k++}>{inner}</em>);
    else if (tok[0] === '~') out.push(<s key={k++}>{inner}</s>);
    else out.push(<code key={k++}>{inner}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const WhatsAppTab: React.FC<{ tz: string; today: string; status: WaStatus | null; refreshStatus: () => void }> = ({
  tz,
  today,
  status,
  refreshStatus,
}) => {
  const [msgs, setMsgs] = useState<WaMessage[] | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const connected = status?.status === 'WORKING';

  const loadMsgs = useCallback(async () => {
    try {
      setMsgs(await WellnessAPI.messages(200));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadMsgs();
    const t = window.setInterval(() => void loadMsgs(), 8000);
    return () => window.clearInterval(t);
  }, [loadMsgs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs?.length]);

  useEffect(() => {
    if (status?.status !== 'SCAN_QR_CODE') {
      setQr(null);
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const r = await WellnessAPI.qr();
        if (alive) setQr(r.dataUrl);
      } catch {
        /* QR rotates; next tick */
      }
      refreshStatus();
    };
    void tick();
    const t = window.setInterval(() => void tick(), 5000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [status?.status, refreshStatus]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await WellnessAPI.startSession();
      refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!window.confirm('Unlink WhatsApp from Piovra?')) return;
    setBusy(true);
    try {
      await WellnessAPI.logout();
      refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  let lastDay = '';
  const totalCost = (msgs ?? []).reduce((s, m) => s + (m.costUsd ?? 0), 0);

  return (
    <WaShell>
      <Panel $i={0} $accent={C.wa}>
        <PanelHead><h3>📱 Connection</h3></PanelHead>
        <StatusPill $on={connected}><i />{status?.configured === false ? 'WAHA not configured' : connected ? 'Connected' : status?.status ?? '…'}</StatusPill>
        {status?.me ? <Muted>Linked as {status.me.pushName ?? ''} +{status.me.id.split('@')[0]}</Muted> : null}
        {status?.engine ? <Muted>Engine: {status.engine}</Muted> : null}

        {qr ? (
          <div style={{ marginTop: 16 }}>
            <Qr><img src={qr} alt="WhatsApp pairing QR" /></Qr>
            <Steps>
              <li>Open WhatsApp on your phone</li>
              <li>Settings → Linked devices → Link a device</li>
              <li>Scan this code</li>
            </Steps>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {!connected && status?.configured ? (
            <Button $variant="primary" onClick={() => void start()} disabled={busy}>
              {busy ? <Spinner $size={12} /> : '🔗'} {status?.status === 'SCAN_QR_CODE' ? 'Refresh session' : 'Connect WhatsApp'}
            </Button>
          ) : null}
          {connected ? <Button $variant="danger" $size="sm" onClick={() => void logout()} disabled={busy}>Unlink</Button> : null}
          <Button $variant="ghost" $size="sm" onClick={refreshStatus}><IconRefresh /> Status</Button>
        </div>
        {error ? <div style={{ marginTop: 12 }}><ErrorMessage message={error} /></div> : null}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-1)' }}>
          <Muted style={{ marginTop: 0, fontWeight: 600, color: 'var(--text-2)' }}>💡 Try sending yourself</Muted>
          <Steps style={{ listStyle: 'none', paddingLeft: 0 }}>
            <li>📸 a photo of your plate</li>
            <li>⚖️ “82.4”</li>
            <li>📊 “chart my calories this week”</li>
            <li>🍽️ “how much did I eat yesterday?”</li>
            <li>✅ “add a task: call the accountant tomorrow”</li>
          </Steps>
          <Muted>Only messages you send to <strong>yourself</strong> from +{status?.phone ?? '…'} are processed.</Muted>
        </div>
      </Panel>

      <Phone>
        <PhoneBar>
          <div className="avatar">🐙</div>
          <div style={{ flex: 1 }}>
            <div className="name">Piovra · You</div>
            <div className="sub">{connected ? 'online' : 'offline'} · {msgs?.length ?? 0} messages · {usd(totalCost)}</div>
          </div>
        </PhoneBar>
        <ChatScroll ref={scrollRef}>
          {msgs === null ? <Spinner /> : null}
          {msgs?.length === 0 ? <DayDivider>Say hi to yourself on WhatsApp 👋</DayDivider> : null}
          {msgs?.map((m) => {
            const d = localDayOf(m.createdAt, tz);
            const divider = d !== lastDay ? <DayDivider key={`d-${d}`}>{longDay(d, today)}</DayDivider> : null;
            lastDay = d;
            const img = m.mediaPath ? WellnessAPI.messageImageUrl(m.id) : null;
            return (
              <React.Fragment key={m.id}>
                {divider}
                <Bubble $mine={m.direction === 'in'}>
                  {img ? <AuthImage src={img} alt="Sent photo" onClick={() => setZoom(img)} /> : null}
                  {m.body ? renderWa(m.body) : m.hasMedia && !img ? <em>📷 photo unavailable</em> : null}
                  <Meta>
                    {m.direction === 'out' && m.costUsd != null ? <span title={`${m.tokensIn ?? 0} in / ${m.tokensOut ?? 0} out tokens`}>{usd(m.costUsd)}</span> : null}
                    {m.direction === 'in' && m.costUsd != null ? <span title={`${m.tokensIn ?? 0} in / ${m.tokensOut ?? 0} out tokens`}>💸 {usd(m.costUsd)}</span> : null}
                    <span>{timeOf(m.createdAt, tz)}</span>
                    {m.direction === 'in' ? <span style={{ color: '#53bdeb' }}>✓✓</span> : null}
                  </Meta>
                </Bubble>
              </React.Fragment>
            );
          })}
        </ChatScroll>
      </Phone>

      {zoom ? (
        <Lightbox onClick={() => setZoom(null)}>
          <AuthImage src={zoom} alt="Photo" />
        </Lightbox>
      ) : null}
    </WaShell>
  );
};

/* ── page ───────────────────────────────────────────────────────────────── */

const Wellness: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await WellnessAPI.overview(days));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [days]);

  const refreshStatus = useCallback(() => {
    WellnessAPI.status().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => void load(), [load]);
  useEffect(() => refreshStatus(), [refreshStatus]);

  const connected = status?.status === 'WORKING';
  const fromDay = data ? shiftDay(data.today, -(days - 1)) : '';

  return (
    <PageContainer>
      <Hero>
        <HeroTop>
          <PageHeader style={{ margin: 0 }}>
            <PageTitle>🐙 Wellness</PageTitle>
            <PageSubtitle>Your WhatsApp self-chat assistant: meals, macros, weight and what it all costs.</PageSubtitle>
          </PageHeader>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusPill $on={connected}><i />{connected ? 'WhatsApp connected' : 'WhatsApp offline'}</StatusPill>
            <RangeChips>
              {[7, 30, 90].map((d) => (
                <RangeChip key={d} $active={days === d} onClick={() => setDays(d)}>{d}d</RangeChip>
              ))}
            </RangeChips>
          </div>
        </HeroTop>
        <Tabs>
          {TABS.map((t) => (
            <TabBtn key={t.id} $active={tab === t.id} onClick={() => setTab(t.id)}>
              <span>{t.emoji}</span>{t.label}
            </TabBtn>
          ))}
        </Tabs>
      </Hero>

      {error ? <ErrorMessage message={error} /> : null}
      {!data && !error ? <Spinner /> : null}

      {data && tab === 'overview' ? <OverviewTab data={data} reload={() => void load()} /> : null}
      {data && tab === 'food' ? <FoodTab tz={data.timezone} today={data.today} fromDay={fromDay} onChanged={() => void load()} /> : null}
      {data && tab === 'weight' ? <WeightTab today={data.today} goal={data.profile.goalWeightKg} onChanged={() => void load()} /> : null}
      {data && tab === 'whatsapp' ? <WhatsAppTab tz={data.timezone} today={data.today} status={status} refreshStatus={refreshStatus} /> : null}
    </PageContainer>
  );
};

export default Wellness;
