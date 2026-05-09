import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface WalkLog {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  distance_km: number;
  route_coordinates: { latitude: number; longitude: number }[] | null;
  notes: string | null;
}

export interface WalkMonthStats {
  totalDistanceKm: number;
  count: number;
  avgMinutes: number;
}

interface WalkStore {
  logs: WalkLog[];
  loading: boolean;
  fetchLogs: () => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
}

export const useWalkStore = create<WalkStore>((set) => ({
  logs: [],
  loading: false,

  fetchLogs: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('walk_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);
    if (!error && data) set({ logs: data as WalkLog[] });
    set({ loading: false });
  },

  deleteLog: async (id: string) => {
    await supabase.from('walk_logs').delete().eq('id', id);
    set(state => ({ logs: state.logs.filter(l => l.id !== id) }));
  },
}));

export function calcMonthStats(logs: WalkLog[]): WalkMonthStats {
  const now = new Date();
  const monthLogs = logs.filter(l => {
    const d = new Date(l.started_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  if (monthLogs.length === 0) return { totalDistanceKm: 0, count: 0, avgMinutes: 0 };
  const totalDistanceKm = monthLogs.reduce((s, l) => s + l.distance_km, 0);
  const avgMinutes = monthLogs.reduce((s, l) => s + l.duration_minutes, 0) / monthLogs.length;
  return { totalDistanceKm, count: monthLogs.length, avgMinutes };
}

const WALK_EMOJIS = ['🌅', '🌿', '☀️', '🌙', '🌈', '🍃', '🌸'];

export function walkEmoji(log: WalkLog): string {
  const h = new Date(log.started_at).getHours();
  if (h >= 5 && h < 8) return '🌅';
  if (h >= 8 && h < 12) return '☀️';
  if (h >= 12 && h < 17) return '🌿';
  if (h >= 17 && h < 20) return '🌆';
  return '🌙';
}

export function formatWalkDate(iso: string): string {
  const d = new Date(iso);
  const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_KO[d.getDay()]}요일`;
}
