const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const API_URL = `${PIOVRA_BASE_URL}/v1/wa-assistant`;

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodItem {
  name: string;
  portion: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodLog {
  id: string;
  eatenAt: string;
  mealType: MealType | null;
  title: string;
  items: FoodItem[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  confidence: number | null;
  imagePath: string | null;
  source: 'image' | 'text' | 'manual';
  notes: string | null;
}

export interface WeightLog {
  id: string;
  measuredOn: string;
  kg: number;
  note: string | null;
}

export interface NutritionProfile {
  targetKcal: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  goalWeightKg: number | null;
  heightCm: number | null;
  timezone: string;
}

export interface DayTotals {
  day: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  entries: number;
}

export interface Overview {
  today: string;
  timezone: string;
  daily: DayTotals[];
  weights: WeightLog[];
  profile: NutritionProfile;
  cost: { todayUsd: number; monthUsd: number; totalUsd: number; calls: number };
  costByDay: Array<{ day: string; costUsd: number; tokensIn: number; tokensOut: number }>;
}

export interface WaStatus {
  configured: boolean;
  status: string | null;
  me: { id: string; pushName?: string } | null;
  engine?: string | null;
  phone: string | null;
}

export interface WaMessage {
  id: string;
  direction: 'in' | 'out';
  body: string;
  hasMedia: boolean;
  mediaPath: string | null;
  createdAt: string;
  costUsd: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
}

async function req<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...rest,
    headers: json === undefined ? rest.headers : { 'Content-Type': 'application/json', ...rest.headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text;
    try {
      const j = JSON.parse(text) as { error?: unknown };
      if (typeof j.error === 'string') message = j.error;
    } catch {
      /* plain text */
    }
    throw new Error(message || `${init?.method ?? 'GET'} ${path} -> ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const WellnessAPI = {
  overview: (days = 30) => req<Overview>(`/overview?days=${days}`),
  listFood: (fromDay?: string, toDay?: string) => {
    const q = new URLSearchParams();
    if (fromDay) q.set('fromDay', fromDay);
    if (toDay) q.set('toDay', toDay);
    return req<FoodLog[]>(`/food?${q.toString()}`);
  },
  createFood: (body: Partial<FoodLog> & { title: string; kcal: number }) =>
    req<FoodLog>('/food', { method: 'POST', json: body }),
  updateFood: (id: string, patch: Partial<FoodLog>) =>
    req<FoodLog>(`/food/${id}`, { method: 'PATCH', json: patch }),
  deleteFood: (id: string) => req<void>(`/food/${id}`, { method: 'DELETE' }),
  foodImageUrl: (id: string) => `${API_URL}/food/${id}/image`,
  messageImageUrl: (id: string) => `${API_URL}/messages/${id}/image`,

  listWeight: () => req<WeightLog[]>('/weight'),
  logWeight: (day: string, kg: number, note?: string | null) =>
    req<WeightLog>('/weight', { method: 'POST', json: { day, kg, note } }),
  updateWeight: (id: string, patch: { day?: string; kg?: number; note?: string | null }) =>
    req<WeightLog>(`/weight/${id}`, { method: 'PATCH', json: patch }),
  deleteWeight: (id: string) => req<void>(`/weight/${id}`, { method: 'DELETE' }),

  getProfile: () => req<NutritionProfile>('/profile'),
  updateProfile: (patch: Partial<NutritionProfile>) =>
    req<NutritionProfile>('/profile', { method: 'PUT', json: patch }),

  status: () => req<WaStatus>('/status'),
  startSession: () => req<WaStatus>('/session/start', { method: 'POST' }),
  logout: () => req<{ ok: true }>('/session/logout', { method: 'POST' }),
  qr: () => req<{ dataUrl: string }>('/qr'),
  messages: (limit = 150) => req<WaMessage[]>(`/messages?limit=${limit}`),
};

/** Fetches an owner-only image with the session cookie and returns a blob URL. */
export async function fetchImageBlobUrl(url: string): Promise<string> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`image ${res.status}`);
  return URL.createObjectURL(await res.blob());
}
