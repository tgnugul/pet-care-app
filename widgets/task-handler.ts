import { registerWidgetTaskHandler } from 'react-native-android-widget';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { calcNextDue, CARE_TYPE_META } from '@/stores/schedule.store';
import type { Frequency, CareType } from '@/stores/schedule.store';
import { getWidgetData, setWidgetData, getWalkState, setWalkState, clearWalkState, getWalkWidgetCache, type WidgetData } from '@/lib/widget-storage';
import { calcDistance } from '@/lib/gps';
import { WALK_LOCATION_TASK, WALK_ROUTE_KEY } from '@/lib/walk-task'; // defineTask를 headless 컨텍스트에서도 등록
import { CareWidget } from './CareWidget';
import { WalkWidget } from './WalkWidget';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchAndBuildWidgetData(): Promise<WidgetData | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: pet } = await supabase
      .from('pets')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (!pet) return null;

    const today = todayStr();
    const { data: schedules } = await supabase
      .from('care_schedules')
      .select('id, type, label, frequency, days_of_week, next_due_at, last_done_at')
      .eq('pet_id', pet.id);
    if (!schedules) return null;

    const todayItems = schedules.filter(s =>
      s.frequency === 'daily' || s.next_due_at.slice(0, 10) <= today,
    );

    const sorted = [...todayItems].sort((a, b) => {
      const aDone = a.last_done_at ? a.last_done_at.slice(0, 10) === today : false;
      const bDone = b.last_done_at ? b.last_done_at.slice(0, 10) === today : false;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime();
    });

    const items = sorted.slice(0, 4).map(s => {
      const done = s.last_done_at ? s.last_done_at.slice(0, 10) === today : false;
      const meta = CARE_TYPE_META[s.type as CareType];
      return {
        id: s.id,
        type: s.type as string,
        emoji: meta?.emoji ?? '🐾',
        label: s.label,
        done,
        frequency: s.frequency,
        nextDueAt: s.next_due_at,
      };
    });

    return { petName: pet.name, date: today, items };
  } catch {
    return null;
  }
}

export function registerWidgetTaskHandlers(): void {
  registerWidgetTaskHandler(async ({ widgetAction, widgetInfo, clickAction, clickActionData, renderWidget }) => {
    if (widgetAction === 'WIDGET_DELETED') return;

    const widgetName = widgetInfo?.widgetName ?? '';

    try {
      if (widgetName === 'WalkWidget') {
        if (widgetAction === 'WIDGET_CLICK' && clickAction === 'STOP_WALK') {
          await stopWalkFromWidget(renderWidget);
        } else {
          try {
            const [walkState, cache] = await Promise.all([getWalkState(), getWalkWidgetCache()]);
            renderWidget(WalkWidget({ state: walkState, cache }));
          } catch {
            renderWidget(WalkWidget({ state: null, cache: null }));
          }
        }
        return;
      }

      // CareWidget (default)
      if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TOGGLE_DONE') {
        const { id, done } = (clickActionData ?? {}) as { id?: string; done?: boolean };
        if (id !== undefined && done !== undefined) {
          await toggleScheduleDone(id, done, renderWidget);
          return;
        }
      }

      const today = todayStr();
      let data = await getWidgetData();
      if (!data || data.date !== today) {
        const fresh = await fetchAndBuildWidgetData();
        if (fresh) {
          await setWidgetData(fresh);
          data = fresh;
        }
      }
      renderWidget(CareWidget({ data: data ?? { petName: '뽀시래기', items: [] } }));
    } catch {
      // 최후 안전망 — 어떤 오류가 나도 위젯이 투명해지지 않도록 기본 UI를 렌더
      if (widgetName === 'WalkWidget') {
        renderWidget(WalkWidget({ state: null }));
      } else {
        renderWidget(CareWidget({ data: { petName: '뽀시래기', items: [] } }));
      }
    }
  });
}

async function toggleScheduleDone(
  scheduleId: string,
  currentlyDone: boolean,
  renderWidget: (widget: React.ReactElement) => void,
): Promise<void> {
  // Optimistic update — render immediately so the widget feels responsive
  const cached = await getWidgetData();
  if (!cached) return;

  const item = cached.items.find(i => i.id === scheduleId);
  if (!item) return;

  cached.items = cached.items.map(i =>
    i.id === scheduleId ? { ...i, done: !currentlyDone } : i,
  );

  // Sort: undone items by time, done items at the bottom
  cached.items = [
    ...cached.items.filter(i => !i.done).sort((a, b) =>
      new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime(),
    ),
    ...cached.items.filter(i => i.done),
  ];

  await setWidgetData(cached);
  renderWidget(CareWidget({ data: cached }));

  // DB work after render (failures don't affect the displayed state)
  try {
    if (currentlyDone) {
      await supabase
        .from('care_schedules')
        .update({ last_done_at: null, next_due_at: item.nextDueAt })
        .eq('id', scheduleId);

      await supabase
        .from('care_completions')
        .delete()
        .eq('schedule_id', scheduleId)
        .eq('scheduled_at', item.nextDueAt);
    } else {
      const { data: sc } = await supabase
        .from('care_schedules')
        .select('id, frequency, days_of_week, next_due_at, pet_id, type, label')
        .eq('id', scheduleId)
        .single();

      if (!sc) return;

      const now = new Date().toISOString();
      const nextDue = calcNextDue(sc.frequency as Frequency, sc.days_of_week, sc.next_due_at);

      await supabase
        .from('care_schedules')
        .update({ last_done_at: now, next_due_at: nextDue })
        .eq('id', scheduleId);

      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const scheduledDate = new Date(sc.next_due_at);
        const nowDate = new Date();
        const delayDays = Math.max(0, Math.floor(
          (Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()) -
           Date.UTC(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate())) / 86400000,
        ));
        await supabase.from('care_completions').insert({
          schedule_id: sc.id,
          pet_id: sc.pet_id,
          user_id: userData.user.id,
          care_type: sc.type,
          care_label: sc.label,
          scheduled_at: sc.next_due_at,
          done_at: now,
          delay_days: delayDays,
        });
      }
    }
  } catch {
    // DB sync failed — widget already shows optimistic state; will reconcile on next app open
  }
}

async function startWalkFromWidget(
  renderWidget: (widget: React.ReactElement) => void,
): Promise<void> {
  try {
    const { status: fg } = await Location.getForegroundPermissionsAsync();
    const { status: bg } = await Location.getBackgroundPermissionsAsync();
    if (fg !== 'granted' || bg !== 'granted') {
      renderWidget(WalkWidget({ state: null }));
      return;
    }

    const now = new Date();
    const startedAt = now.toISOString();
    const walkState = { isWalking: true, startedAt, distanceKm: 0, durationSec: 0 };

    await AsyncStorage.setItem(WALK_ROUTE_KEY, JSON.stringify([]));
    await setWalkState(walkState);
    renderWidget(WalkWidget({ state: walkState }));

    await Location.startLocationUpdatesAsync(WALK_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      foregroundService: {
        notificationTitle: '뽀시래기 산책 중',
        notificationBody: '산책 경로를 기록하고 있어요.',
        notificationColor: '#F5A623',
      },
      pausesUpdatesAutomatically: false,
    });
  } catch {
    await clearWalkState().catch(() => {});
    renderWidget(WalkWidget({ state: null }));
  }
}

async function stopWalkFromWidget(
  renderWidget: (widget: React.ReactElement) => void,
): Promise<void> {
  try {
    const walkState = await getWalkState();
    const endedAt = new Date().toISOString();

    try { await Location.stopLocationUpdatesAsync(WALK_LOCATION_TASK); } catch {}

    const stored = await AsyncStorage.getItem(WALK_ROUTE_KEY);
    const finalRoute: Array<{ latitude: number; longitude: number }> = stored ? JSON.parse(stored) : [];
    await AsyncStorage.removeItem(WALK_ROUTE_KEY);

    let totalDistance = 0;
    for (let i = 1; i < finalRoute.length; i++) {
      totalDistance += calcDistance(
        finalRoute[i - 1].latitude, finalRoute[i - 1].longitude,
        finalRoute[i].latitude, finalRoute[i].longitude,
      );
    }

    const startedAt = walkState?.startedAt ?? endedAt;
    const elapsedSec = Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);

    await clearWalkState();
    const cache = await getWalkWidgetCache().catch(() => null);
    renderWidget(WalkWidget({ state: null, cache }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && elapsedSec > 0) {
        await supabase.from('walk_logs').insert({
          user_id: user.id,
          started_at: startedAt,
          ended_at: endedAt,
          duration_minutes: Math.round((elapsedSec / 60) * 10) / 10,
          distance_km: Math.round(totalDistance * 1000) / 1000,
          route_coordinates: finalRoute,
        });
      }
    } catch {}
  } catch {
    await clearWalkState().catch(() => {});
    renderWidget(WalkWidget({ state: null }));
  }
}
