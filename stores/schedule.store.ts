import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { rescheduleAfterDone, scheduleDailySummary, cancelDailySummary, notifyFamilyCareCompleted } from '@/lib/notifications';
import { useSettingsStore } from '@/stores/settings.store';
import { usePetStore } from '@/stores/pet.store';
import { useFamilyStore } from '@/stores/family.store';
import { getStreak, markStreakComplete } from '@/lib/care-streak';

let scheduleChannel: RealtimeChannel | null = null;

// markDone 시 원래 next_due_at을 기억해뒀다가 markUndone 때 복구에 사용
const undoMap: Record<string, string> = {};

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
  careStreak: number;
  fetchSchedules: (petId: string) => Promise<void>;
  markDone: (id: string, frequency: Frequency) => Promise<void>;
  markUndone: (id: string) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  unsubscribeSchedules: () => Promise<void>;
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
    const base = baseDueAt ? new Date(baseDueAt) : d;
    d.setFullYear(base.getFullYear(), base.getMonth() + 1, base.getDate());
    d.setHours(h, m, 0, 0);
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
  other:        require('@/assets/images/care/nail.png'),
};

export const useCareStore = create<ScheduleStore>((set, get) => ({
  schedules: [],
  loading: false,
  careStreak: 0,

  fetchSchedules: async (petId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('care_schedules')
      .select('*')
      .eq('pet_id', petId)
      .order('next_due_at', { ascending: true });
    if (!error && data) {
      const streak = await getStreak();
      set({ schedules: data as CareSchedule[], careStreak: streak });
      const petName = usePetStore.getState().pets[0]?.name ?? '반려동물';
      const summaryHour = useSettingsStore.getState().summaryHour;
      const hasIncomplete = (data as CareSchedule[]).some(sc => !isDoneToday(sc));
      if (hasIncomplete) {
        scheduleDailySummary(petName, summaryHour);
      } else {
        cancelDailySummary();
      }
      import('@/lib/widget-sync').then(({ syncWidgetData }) =>
        syncWidgetData(petName, data as CareSchedule[]),
      );
    }
    set({ loading: false });

    // 기존 채널 정리 후 새 구독 시작
    if (scheduleChannel) {
      await supabase.removeChannel(scheduleChannel);
      scheduleChannel = null;
    }
    scheduleChannel = supabase
      .channel(`care_schedules_${petId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'care_schedules', filter: `pet_id=eq.${petId}` },
        (payload) => {
          const { eventType } = payload;
          let updated: CareSchedule[];
          if (eventType === 'INSERT') {
            updated = [...get().schedules, payload.new as CareSchedule];
          } else if (eventType === 'UPDATE') {
            updated = get().schedules.map(sc =>
              sc.id === (payload.new as CareSchedule).id ? (payload.new as CareSchedule) : sc,
            );
          } else if (eventType === 'DELETE') {
            updated = get().schedules.filter(sc => sc.id !== (payload.old as { id: string }).id);
          } else {
            return;
          }
          set({ schedules: updated });
          const petName = usePetStore.getState().pets[0]?.name ?? '반려동물';
          import('@/lib/widget-sync').then(({ syncWidgetData }) =>
            syncWidgetData(petName, updated),
          );
        },
      )
      .subscribe();
  },

  markDone: async (id, frequency) => {
    const sc = get().schedules.find(s => s.id === id);
    if (!sc) return;
    const now = new Date();
    const nowISO = now.toISOString();
    const nextDue = calcNextDue(frequency, sc.days_of_week, sc.next_due_at);
    undoMap[id] = sc.next_due_at; // 실수 취소 시 복구를 위해 원래 날짜 보존
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
      const updated = get().schedules.map(sc =>
        sc.id === id ? { ...sc, last_done_at: nowISO, next_due_at: nextDue } : sc,
      );

      // 오늘 해야 할 항목(daily + 밀린 것) 전부 완료 시 스트릭 업데이트
      const todayStr = localDateStr();
      const todayItems = updated.filter(sc =>
        sc.frequency === 'daily' ||
        sc.next_due_at.slice(0, 10) <= todayStr ||
        (sc.last_done_at !== null && sc.last_done_at.slice(0, 10) === todayStr),
      );
      const allDone = todayItems.length > 0 && todayItems.every(isDoneToday);
      const newStreak = allDone ? await markStreakComplete() : get().careStreak;

      set({ schedules: updated, careStreak: newStreak });

      const petName = usePetStore.getState().pets[0]?.name ?? '반려동물';
      const schedule = updated.find(sc => sc.id === id);
      if (schedule) rescheduleAfterDone(schedule, petName);

      const hasIncomplete = updated.some(sc => !isDoneToday(sc));
      if (!hasIncomplete) cancelDailySummary();

      import('@/lib/widget-sync').then(({ syncWidgetData }) =>
        syncWidgetData(petName, updated),
      );

      // 가족 구성원에게 푸시 알림
      const { family, myUserId, members } = useFamilyStore.getState();
      if (family && myUserId) {
        const doerName = members.find(m => m.user_id === myUserId)?.display_name ?? '가족';
        notifyFamilyCareCompleted(family.id, myUserId, doerName, sc.label, petName);
      }
    }
  },

  markUndone: async (id) => {
    const sc = get().schedules.find(s => s.id === id);
    const isDaily = sc?.frequency === 'daily';

    // non-daily 항목은 체크 전 next_due_at으로 복구 (undoMap 우선, 없으면 care_completions 조회)
    let originalNextDueAt: string | undefined = undoMap[id];
    if (!isDaily && !originalNextDueAt) {
      const { data } = await supabase
        .from('care_completions')
        .select('scheduled_at')
        .eq('schedule_id', id)
        .order('done_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      originalNextDueAt = data?.scheduled_at ?? undefined;
    }

    const updatePayload: Record<string, string | null> = { last_done_at: null };
    if (!isDaily && originalNextDueAt) {
      updatePayload.next_due_at = originalNextDueAt;
    }

    const { error } = await supabase
      .from('care_schedules')
      .update(updatePayload)
      .eq('id', id);

    if (!error) {
      // 완료 기록 삭제
      if (!isDaily && originalNextDueAt) {
        await supabase
          .from('care_completions')
          .delete()
          .eq('schedule_id', id)
          .eq('scheduled_at', originalNextDueAt);
        delete undoMap[id];
      }

      const updated = get().schedules.map(s =>
        s.id === id
          ? { ...s, last_done_at: null, ...(!isDaily && originalNextDueAt ? { next_due_at: originalNextDueAt } : {}) }
          : s,
      );
      set({ schedules: updated });

      const petName = usePetStore.getState().pets[0]?.name ?? '반려동물';
      scheduleDailySummary(petName);
      import('@/lib/widget-sync').then(({ syncWidgetData }) =>
        syncWidgetData(petName, updated),
      );
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

  unsubscribeSchedules: async () => {
    if (scheduleChannel) {
      await supabase.removeChannel(scheduleChannel);
      scheduleChannel = null;
    }
  },
}));
