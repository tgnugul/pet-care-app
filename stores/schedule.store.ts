import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { rescheduleAfterDone, scheduleDailySummary, cancelDailySummary } from '@/lib/notifications';
import { useSettingsStore } from '@/stores/settings.store';
import { usePetStore } from '@/stores/pet.store';

export type CareType =
  | 'meal' | 'medicine' | 'hospital' | 'ear_cleaning' | 'bath' | 'nail' | 'other';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface CareSchedule {
  id: string;
  pet_id: string;
  type: CareType;
  label: string;          // 표시 이름 (예: "아침 밥")
  frequency: Frequency;
  days_of_week: number[] | null; // 0=일 ~ 6=토, weekly 선택 시만 사용
  next_due_at: string;    // ISO datetime
  last_done_at: string | null;
  notes: string | null;
}

interface ScheduleStore {
  schedules: CareSchedule[];
  loading: boolean;
  fetchSchedules: (petId: string) => Promise<void>;
  markDone: (id: string, frequency: Frequency) => Promise<void>;
  markUndone: (id: string) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
}

export function calcNextDue(frequency: Frequency, daysOfWeek?: number[] | null, baseDueAt?: string | null): string {
  const now = new Date();
  const today = now.getDay();

  // 원래 등록된 시간(HH:MM)을 보존 — baseDueAt 없으면 현재 시각 사용
  const timeBase = baseDueAt ? new Date(baseDueAt) : now;
  const h = timeBase.getHours();
  const m = timeBase.getMinutes();

  // 오늘 날짜 + 원래 시간으로 시작
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

  if (frequency === 'daily') {
    d.setDate(d.getDate() + 1);
  } else if (frequency === 'weekly') {
    if (daysOfWeek?.length) {
      const sorted = [...daysOfWeek].sort((a, b) => a - b);
      const nextDay = sorted.find(day => day > today) ?? sorted[0];
      const daysUntil = nextDay > today ? nextDay - today : 7 - today + nextDay;
      d.setDate(d.getDate() + daysUntil);
    } else {
      d.setDate(d.getDate() + 7);
    }
  } else if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isDoneToday(schedule: CareSchedule): boolean {
  if (!schedule.last_done_at) return false;
  return localDateStr(new Date(schedule.last_done_at)) === localDateStr();
}

export const CARE_TYPE_META: Record<CareType, { emoji: string; label: string }> = {
  meal:         { emoji: '🍚', label: '밥' },
  medicine:     { emoji: '💊', label: '약' },
  hospital:     { emoji: '🏥', label: '병원' },
  ear_cleaning: { emoji: '👂', label: '귀 청소' },
  bath:         { emoji: '🛁', label: '목욕' },
  nail:         { emoji: '✂️', label: '발톱' },
  other:        { emoji: '🐾', label: '기타' },
};

export const CARE_TYPE_IMAGES: Record<CareType, number> = {
  meal:         require('@/assets/images/care/meal.png'),
  medicine:     require('@/assets/images/care/medicine.png'),
  hospital:     require('@/assets/images/care/hospital.png'),
  ear_cleaning: require('@/assets/images/care/ear_cleaning.png'),
  bath:         require('@/assets/images/care/bath.png'),
  nail:         require('@/assets/images/care/nail.png'),
  other:        require('@/assets/images/care/other.png'),
};

export const useCareStore = create<ScheduleStore>((set, get) => ({
  schedules: [],
  loading: false,

  fetchSchedules: async (petId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('care_schedules')
      .select('*')
      .eq('pet_id', petId)
      .order('next_due_at', { ascending: true });
    if (!error && data) {
      set({ schedules: data as CareSchedule[] });
      const petName = usePetStore.getState().pets[0]?.name ?? '반려동물';
      const summaryHour = useSettingsStore.getState().summaryHour;
      const hasIncomplete = (data as CareSchedule[]).some(sc => !isDoneToday(sc));
      if (hasIncomplete) {
        scheduleDailySummary(petName, summaryHour);
      } else {
        cancelDailySummary();
      }
    }
    set({ loading: false });
  },

  markDone: async (id, frequency) => {
    const sc = get().schedules.find(s => s.id === id);
    if (!sc) return;
    const now = new Date();
    const nowISO = now.toISOString();
    const nextDue = calcNextDue(frequency, sc.days_of_week, sc.next_due_at);
    const { error } = await supabase
      .from('care_schedules')
      .update({ last_done_at: nowISO, next_due_at: nextDue })
      .eq('id', id);
    if (!error) {
      // 케어 완료 기록 (지연 일수 포함)
      const scheduledDate = new Date(sc.next_due_at);
      const delayDays = Math.max(0, Math.floor(
        (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
         Date.UTC(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate())) / 86400000,
      ));
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('care_completions').insert({
          schedule_id: sc.id,
          pet_id: sc.pet_id,
          user_id: userData.user.id,
          care_type: sc.type,
          care_label: sc.label,
          scheduled_at: sc.next_due_at,
          done_at: nowISO,
          delay_days: delayDays,
        });
      }
      set(s => {
        const updated = s.schedules.map(sc =>
          sc.id === id ? { ...sc, last_done_at: nowISO, next_due_at: nextDue } : sc,
        );
        const petName = usePetStore.getState().pets[0]?.name ?? '반려동물';
        const schedule = updated.find(sc => sc.id === id);
        if (schedule) rescheduleAfterDone(schedule, petName);

        // 모든 일정 완료 시 오늘 저녁 요약 알림 취소
        const hasIncomplete = updated.some(sc => !isDoneToday(sc));
        if (!hasIncomplete) cancelDailySummary();

        return { schedules: updated };
      });
    }
  },

  markUndone: async (id) => {
    const { error } = await supabase
      .from('care_schedules')
      .update({ last_done_at: null })
      .eq('id', id);
    if (!error) {
      set(s => ({
        schedules: s.schedules.map(sc =>
          sc.id === id ? { ...sc, last_done_at: null } : sc,
        ),
      }));
      // 미완료 일정이 다시 생겼으므로 요약 알림 재예약
      const petName = usePetStore.getState().pets[0]?.name ?? '반려동물';
      scheduleDailySummary(petName);
    }
  },

  deleteSchedule: async (id) => {
    const { error } = await supabase.from('care_schedules').delete().eq('id', id);
    if (!error) {
      const { cancelNotification } = await import('@/lib/notifications');
      cancelNotification(id);
      set(s => ({ schedules: s.schedules.filter(sc => sc.id !== id) }));
    }
  },
}));
