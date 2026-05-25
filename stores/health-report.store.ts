import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface HealthReport {
  id: string;
  pet_id: string;
  report_month: string; // YYYY-MM-01
  completion_rate: number | null;
  avg_delay_days: number | null;
  total_walks: number | null;
  total_distance: number | null;
  total_duration: number | null;
  ai_summary: string | null;
  created_at: string;
}

interface HealthReportStore {
  reports: Record<string, HealthReport>; // key: YYYY-MM-01
  loading: boolean;
  generating: boolean;
  fetchReport: (petId: string, month: string) => Promise<void>;
  generateReport: (petId: string, month: string) => Promise<void>;
}

export const useHealthReportStore = create<HealthReportStore>((set, get) => ({
  reports: {},
  loading: false,
  generating: false,

  fetchReport: async (petId, month) => {
    if (get().reports[month]) return;
    set({ loading: true });
    const { data } = await supabase
      .from('health_reports')
      .select('*')
      .eq('pet_id', petId)
      .eq('report_month', month)
      .single();
    if (data) {
      set(s => ({ reports: { ...s.reports, [month]: data as HealthReport } }));
    }
    set({ loading: false });
  },

  generateReport: async (petId, month) => {
    set({ generating: true });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-health-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ petId }),
      });
      // 생성 후 다시 조회
      set(s => ({ reports: { ...s.reports, [month]: undefined as any } }));
      const { data } = await supabase
        .from('health_reports')
        .select('*')
        .eq('pet_id', petId)
        .eq('report_month', month)
        .single();
      if (data) {
        set(s => ({ reports: { ...s.reports, [month]: data as HealthReport } }));
      }
    } finally {
      set({ generating: false });
    }
  },
}));
