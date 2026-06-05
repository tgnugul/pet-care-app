import { Platform } from 'react-native';
import type { CareSchedule } from '@/stores/schedule.store';
import { CARE_TYPE_META } from '@/stores/schedule.store';
import { setWidgetData, setWalkWidgetCache, getWalkState, type WidgetData, type WalkWidgetCache } from './widget-storage';
import { fetchWalkWeatherFull } from './weather';
import type { WalkLog } from '@/stores/walk.store';

function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isDoneToday(schedule: CareSchedule): boolean {
  if (!schedule.last_done_at) return false;
  return localDateStr(new Date(schedule.last_done_at)) === localDateStr();
}

function buildWidgetData(petName: string, schedules: CareSchedule[]): WidgetData {
  const today = localDateStr();
  const todayItems = schedules.filter(s => {
    if (s.frequency === 'daily') return true;
    return s.next_due_at.slice(0, 10) <= today;
  });

  const sorted = [...todayItems].sort((a, b) => {
    const aDone = isDoneToday(a);
    const bDone = isDoneToday(b);
    if (aDone !== bDone) return aDone ? 1 : -1;
    return new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime();
  });

  return {
    petName,
    date: today,
    items: sorted.slice(0, 4).map(s => ({
      id: s.id,
      type: s.type,
      emoji: CARE_TYPE_META[s.type].emoji,
      label: s.label,
      done: isDoneToday(s),
      frequency: s.frequency,
      nextDueAt: s.next_due_at,
    })),
  };
}

export async function syncWalkWidgetData(
  petName: string,
  walkLogs: WalkLog[],
  location: { latitude: number; longitude: number } | null,
): Promise<void> {
  if (Platform.OS !== 'android') return;

  const today = localDateStr();
  const todayLogs = walkLogs.filter(l => l.started_at.slice(0, 10) === today);
  const walkedToday = todayLogs.length > 0;
  const todayDurationSec = todayLogs.reduce((s, l) => s + Math.round(l.duration_minutes * 60), 0);
  const todayDistanceKm = todayLogs.reduce((s, l) => s + l.distance_km, 0);

  const weather = location
    ? await fetchWalkWeatherFull(location.latitude, location.longitude).catch(() => ({ message: '오늘도 산책 나가볼까요? 🐾', chip: '' }))
    : { message: '오늘도 산책 나가볼까요? 🐾', chip: '' };

  const cache: WalkWidgetCache = {
    date: today,
    petName,
    weatherMessage: weather.message,
    weatherChip: weather.chip || undefined,
    walkedToday,
    todayDurationSec,
    todayDistanceKm,
  };

  await setWalkWidgetCache(cache);

  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    const { WalkWidget } = await import('@/widgets/WalkWidget');
    const walkState = await getWalkState();
    await requestWidgetUpdate({
      widgetName: 'WalkWidget',
      renderWidget: () => WalkWidget({ state: walkState, cache }),
      widgetNotFound: () => {},
    });
  } catch {}
}

export async function syncWidgetData(petName: string, schedules: CareSchedule[]): Promise<void> {
  if (Platform.OS !== 'android') return;

  const data = buildWidgetData(petName, schedules);
  await setWidgetData(data);

  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    const { CareWidget } = await import('@/widgets/CareWidget');
    await requestWidgetUpdate({
      widgetName: 'CareWidget',
      renderWidget: () => CareWidget({ data }),
      widgetNotFound: () => {},
    });
  } catch {
    // 위젯이 홈 화면에 없거나 네이티브 모듈 미로드 시 무시
  }
}
