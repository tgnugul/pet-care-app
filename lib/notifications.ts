import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import type { CareSchedule, Frequency } from '@/stores/schedule.store';
import { useSettingsStore } from '@/stores/settings.store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotificationCategories(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setNotificationCategoryAsync('CARE_DONE', [
    {
      identifier: 'MARK_DONE',
      buttonTitle: '완료 ✓',
      options: { opensAppToForeground: false },
    },
  ]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('care-reminders', {
      name: '케어 리마인더',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

type Trigger = Notifications.NotificationTriggerInput;

function buildTrigger(frequency: Frequency, fireAt: Date): Trigger {
  const hour = fireAt.getHours();
  const minute = fireAt.getMinutes();

  if (frequency === 'daily') {
    return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute };
  }
  if (frequency === 'weekly') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: fireAt.getDay() + 1, // expo: 1=일 ~ 7=토
      hour,
      minute,
    };
  }
  // monthly / custom: 1회성 DATE 트리거
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt };
}

const REMINDER_STEPS = [
  { offsetMin: 30, suffix: '-30m', title: '30분 후 케어 예정이에요 🐾', bodyTpl: (label: string, pet: string) => `${pet}의 ${label}까지 30분 남았어요` },
  { offsetMin: 10, suffix: '-10m', title: '10분 후 케어 예정이에요 🐾', bodyTpl: (label: string, pet: string) => `${pet}의 ${label}까지 10분 남았어요` },
  { offsetMin: 0,  suffix: '',     title: '케어 시간이에요! 🐾',       bodyTpl: (label: string, pet: string) => `${pet}의 ${label} 시간이에요` },
];

export async function scheduleNotification(
  schedule: CareSchedule,
  petName: string,
): Promise<void> {
  if (useSettingsStore.getState().careNotifPaused) return;

  if (schedule.frequency === 'weekly' && schedule.days_of_week?.length) {
    await scheduleMultiDayWeekly(schedule, petName);
    return;
  }

  const due = new Date(schedule.next_due_at);
  const now = new Date();

  for (const step of REMINDER_STEPS) {
    const fireAt = new Date(due.getTime() - step.offsetMin * 60 * 1000);

    // monthly/custom는 이미 지난 시각이면 건너뜀
    if ((schedule.frequency === 'monthly' || schedule.frequency === 'custom') && fireAt <= now) {
      continue;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${schedule.id}${step.suffix}`,
        content: {
          title: step.title,
          body: step.bodyTpl(schedule.label, petName),
          sound: true,
          data: { scheduleId: schedule.id, petId: schedule.pet_id, petName },
          ...(step.suffix === '' ? { categoryIdentifier: 'CARE_DONE' } : {}),
        },
        trigger: buildTrigger(schedule.frequency, fireAt),
      });
    } catch {
      // 권한 없을 때 조용히 무시
    }
  }
}

async function scheduleMultiDayWeekly(schedule: CareSchedule, petName: string): Promise<void> {
  const due = new Date(schedule.next_due_at);
  const baseHour = due.getHours();
  const baseMinute = due.getMinutes();

  for (const day of schedule.days_of_week!) {
    for (const step of REMINDER_STEPS) {
      const totalMinutes = baseHour * 60 + baseMinute - step.offsetMin;
      if (totalMinutes < 0) continue; // 자정 이전으로 넘어가는 경우 스킵

      const fireHour = Math.floor(totalMinutes / 60);
      const fireMinute = totalMinutes % 60;
      // Expo weekday: 1=일(JS 0) ~ 7=토(JS 6)
      const expoWeekday = day + 1;

      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `${schedule.id}-d${day}${step.suffix}`,
          content: {
            title: step.title,
            body: step.bodyTpl(schedule.label, petName),
            sound: true,
            data: { scheduleId: schedule.id, petId: schedule.pet_id, petName },
            ...(step.suffix === '' ? { categoryIdentifier: 'CARE_DONE' } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: expoWeekday,
            hour: fireHour,
            minute: fireMinute,
          },
        });
      } catch {
        // 권한 없을 때 조용히 무시
      }
    }
  }
}

export async function cancelNotification(scheduleId: string): Promise<void> {
  const suffixes = ['', '-30m', '-10m'];
  for (const suffix of suffixes) {
    try { await Notifications.cancelScheduledNotificationAsync(`${scheduleId}${suffix}`); } catch {}
  }
  // 요일별 알림도 취소 (이전에 다중 요일 설정이 있었을 경우 대비)
  for (let day = 0; day <= 6; day++) {
    for (const suffix of suffixes) {
      try { await Notifications.cancelScheduledNotificationAsync(`${scheduleId}-d${day}${suffix}`); } catch {}
    }
  }
}

/** 완료 처리 후 monthly/custom 알림 재예약 */
export async function rescheduleAfterDone(
  schedule: CareSchedule,
  petName: string,
): Promise<void> {
  if (schedule.frequency === 'daily' || schedule.frequency === 'weekly') return;
  await cancelNotification(schedule.id);
  await scheduleNotification(schedule, petName);
}

// ── 일일 미완료 요약 알림 ─────────────────────────────────────────
const SUMMARY_ID = 'daily-care-summary';
const SUMMARY_HOUR = 20; // 오후 8시

export async function scheduleDailySummary(petName: string, hour = SUMMARY_HOUR): Promise<void> {
  const now = new Date();
  const fireAt = new Date();
  fireAt.setHours(hour, 0, 0, 0);

  if (fireAt <= now) return; // 이미 지난 시간이면 스케줄 안 함

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: SUMMARY_ID,
      content: {
        title: '오늘 케어 일정이 남아있어요 🐾',
        body: `${petName}의 미완료 케어를 확인해보세요`,
        sound: true,
        data: { type: 'daily-summary' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
  } catch {
    // 권한 없을 때 무시
  }
}

export async function cancelDailySummary(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(SUMMARY_ID);
  } catch {
    // 이미 없는 경우 무시
  }
}

// ── 가족 공유 푸시 알림 ───────────────────────────────────────────

/** 로그인/앱 시작 시 Expo 푸시 토큰을 Supabase에 등록 */
export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await supabase.from('push_tokens').upsert({
      user_id: session.user.id,
      token: tokenData.data,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // 시뮬레이터 등 토큰 발급 불가 환경은 무시
  }
}

/** 가족 멤버에게 새 케어 등록 알림 발송 (fire-and-forget) */
export async function notifyFamilyNewCare(
  familyId: string,
  myUserId: string,
  careLabel: string,
  petName: string,
): Promise<void> {
  if (!useSettingsStore.getState().familyNotifEnabled) return;

  try {
    const { data: rows } = await supabase.rpc('get_family_push_tokens', {
      p_family_id: familyId,
      p_my_user_id: myUserId,
    });
    if (!rows?.length) return;

    const messages = (rows as { token: string }[]).map(({ token }) => ({
      to: token,
      title: '새 케어 일정이 추가됐어요 🐾',
      body: `${petName}의 ${careLabel} 일정이 등록됐어요`,
      sound: 'default',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {
    // 알림 전송 실패는 케어 저장에 영향 없음
  }
}
