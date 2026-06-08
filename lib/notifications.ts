import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import type { CareSchedule, CareType, Frequency } from '@/stores/schedule.store';
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

// ── 알림 문구 ────────────────────────────────────────────────────────

function buildNotifContent(
  type: CareType,
  label: string,
  petName: string,
): { title: string; body: string } {
  switch (type) {
    case 'meal':
      return {
        title: `${petName} ${label} 시간이에요 🍚`,
        body: '따뜻하게 챙겨주세요',
      };
    case 'medicine':
      return {
        title: `오늘 ${label} 빠뜨리지 마세요 💊`,
        body: `${petName}의 건강을 위해 지금 챙겨주세요`,
      };
    case 'hospital':
      return {
        title: `오늘 ${label} 예약일이에요 🏥`,
        body: '미리 챙겨두세요',
      };
    case 'ear_cleaning':
    case 'bath':
    case 'nail':
      return {
        title: `${petName} ${label} 날이에요 🛁`,
        body: '오늘도 뽀송하게',
      };
    default:
      return {
        title: `${label} 시간이에요 🐾`,
        body: `${petName}의 일정이에요`,
      };
  }
}

function buildMorningContent(
  type: CareType,
  label: string,
  petName: string,
): { title: string; body: string } {
  switch (type) {
    case 'hospital':
      return {
        title: `오늘 ${label} 예약이 있어요 🏥`,
        body: `${petName} 데려갈 준비 미리 해두세요`,
      };
    case 'medicine':
      return {
        title: `오늘 ${label} 잊지 마세요 💊`,
        body: `${petName}의 약, 오늘 챙겨줘야 해요`,
      };
    default:
      return {
        title: `오늘 ${label} 일정이 있어요 ☀️`,
        body: `${petName}의 일정을 미리 확인해두세요`,
      };
  }
}

// ── 트리거 빌더 ──────────────────────────────────────────────────────

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
      weekday: fireAt.getDay() + 1,
      hour,
      minute,
    };
  }
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt };
}

// ── 알림 예약 ────────────────────────────────────────────────────────

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
  const content = buildNotifContent(schedule.type, schedule.label, petName);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: schedule.id,
      content: {
        title: content.title,
        body: content.body,
        sound: true,
        data: { scheduleId: schedule.id, petId: schedule.pet_id, petName },
        categoryIdentifier: 'CARE_DONE',
      },
      trigger: buildTrigger(schedule.frequency, due),
    });
  } catch {}

  // monthly/custom 일정은 당일 아침 8시에 예고 알림 추가
  if (schedule.frequency === 'monthly' || schedule.frequency === 'custom') {
    await scheduleMorningHeadsUp(schedule, petName);
  }
}

async function scheduleMultiDayWeekly(
  schedule: CareSchedule,
  petName: string,
): Promise<void> {
  const due = new Date(schedule.next_due_at);
  const hour = due.getHours();
  const minute = due.getMinutes();
  const content = buildNotifContent(schedule.type, schedule.label, petName);

  for (const day of schedule.days_of_week!) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${schedule.id}-d${day}`,
        content: {
          title: content.title,
          body: content.body,
          sound: true,
          data: { scheduleId: schedule.id, petId: schedule.pet_id, petName },
          categoryIdentifier: 'CARE_DONE',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1,
          hour,
          minute,
        },
      });
    } catch {}
  }
}

async function scheduleMorningHeadsUp(
  schedule: CareSchedule,
  petName: string,
): Promise<void> {
  const due = new Date(schedule.next_due_at);
  const morning = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 8, 0, 0);
  if (morning <= new Date()) return;

  const content = buildMorningContent(schedule.type, schedule.label, petName);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${schedule.id}-morning`,
      content: {
        title: content.title,
        body: content.body,
        sound: true,
        data: { scheduleId: schedule.id, petId: schedule.pet_id, petName },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: morning,
      },
    });
  } catch {}
}

export async function cancelNotification(scheduleId: string): Promise<void> {
  const ids = [scheduleId, `${scheduleId}-morning`];
  for (let day = 0; day <= 6; day++) {
    ids.push(`${scheduleId}-d${day}`);
  }
  for (const id of ids) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  }
}

export async function rescheduleAfterDone(
  schedule: CareSchedule,
  petName: string,
): Promise<void> {
  if (schedule.frequency === 'daily' || schedule.frequency === 'weekly') return;
  await cancelNotification(schedule.id);
  await scheduleNotification(schedule, petName);
}

// ── 저녁 미완료 요약 알림 ────────────────────────────────────────────

const SUMMARY_ID = 'daily-care-summary';
const SUMMARY_HOUR = 20;

export async function scheduleDailySummary(petName: string, hour = SUMMARY_HOUR): Promise<void> {
  const now = new Date();
  const fireAt = new Date();
  fireAt.setHours(hour, 0, 0, 0);
  if (fireAt <= now) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: SUMMARY_ID,
      content: {
        title: `${petName}의 오늘 케어가 남아있어요 🌙`,
        body: '자기 전에 한 번만 확인해봐요',
        sound: true,
        data: { type: 'daily-summary' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
  } catch {}
}

export async function cancelDailySummary(): Promise<void> {
  try { await Notifications.cancelScheduledNotificationAsync(SUMMARY_ID); } catch {}
}

const WALK_REMINDER_ID = 'walk-reminder';

export async function scheduleWalkReminder(petName: string, hour: number, minute: number): Promise<void> {
  await cancelWalkReminder();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: WALK_REMINDER_ID,
      content: {
        title: `${petName} 산책 시간이에요! 🐾`,
        body: '오늘 산책 아직 안 했죠? 지금 나가요!',
        sound: true,
        data: { type: 'walk-reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch {}
}

export async function cancelWalkReminder(): Promise<void> {
  try { await Notifications.cancelScheduledNotificationAsync(WALK_REMINDER_ID); } catch {}
}

// ── 가족 공유 푸시 알림 ──────────────────────────────────────────────

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
  } catch {}
}

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
      title: `${petName} 케어가 추가됐어요 🐾`,
      body: `${petName}의 ${careLabel}, 같이 챙겨봐요!`,
      sound: 'default',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {}
}

export async function notifyFamilyWalkStarted(
  familyId: string,
  myUserId: string,
  doerName: string,
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
      title: `${petName} 산책 시작! 🐾`,
      body: `${doerName}님이 ${petName}와 산책을 시작했어요`,
      sound: 'default',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {}
}

export async function notifyFamilyWalkCompleted(
  familyId: string,
  myUserId: string,
  doerName: string,
  petName: string,
  distanceKm: number,
  durationSec: number,
): Promise<void> {
  if (!useSettingsStore.getState().familyNotifEnabled) return;

  const mins = Math.round(durationSec / 60);
  const timeStr = mins < 60 ? `${mins}분` : `${Math.floor(mins / 60)}시간 ${mins % 60}분`;

  try {
    const { data: rows } = await supabase.rpc('get_family_push_tokens', {
      p_family_id: familyId,
      p_my_user_id: myUserId,
    });
    if (!rows?.length) return;

    const messages = (rows as { token: string }[]).map(({ token }) => ({
      to: token,
      title: `${petName} 산책 완료! 🐾`,
      body: `${doerName}님이 ${distanceKm.toFixed(2)}km, ${timeStr} 산책했어요`,
      sound: 'default',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {}
}

export async function notifyFamilyCareCompleted(
  familyId: string,
  myUserId: string,
  doerName: string,
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
      title: `${petName} 케어 완료 ✅`,
      body: `${doerName}님이 ${petName}의 ${careLabel} 케어를 완료했어요`,
      sound: 'default',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {}
}
