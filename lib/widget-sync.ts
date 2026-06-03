import { Platform } from 'react-native';
import type { CareSchedule } from '@/stores/schedule.store';
import { CARE_TYPE_META } from '@/stores/schedule.store';
import { setWidgetData, type WidgetData } from './widget-storage';

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

  return {
    petName,
    items: todayItems.slice(0, 4).map(s => ({
      id: s.id,
      emoji: CARE_TYPE_META[s.type].emoji,
      label: s.label,
      done: isDoneToday(s),
      frequency: s.frequency,
      nextDueAt: s.next_due_at,
    })),
  };
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
