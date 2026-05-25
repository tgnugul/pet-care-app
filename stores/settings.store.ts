import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';

const KEY_SUMMARY_HOUR = 'notif_summary_hour';
const KEY_FAMILY_NOTIF = 'notif_family_enabled';
const KEY_CARE_PAUSED = 'notif_care_paused';

interface SettingsStore {
  summaryHour: number;
  familyNotifEnabled: boolean;
  careNotifPaused: boolean;
  loadSettings: () => Promise<void>;
  setSummaryHour: (hour: number) => Promise<void>;
  setFamilyNotifEnabled: (val: boolean) => Promise<void>;
  setCareNotifPaused: (val: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  summaryHour: 20,
  familyNotifEnabled: true,
  careNotifPaused: false,

  loadSettings: async () => {
    const hour = await SecureStore.getItemAsync(KEY_SUMMARY_HOUR);
    const family = await SecureStore.getItemAsync(KEY_FAMILY_NOTIF);
    const paused = await SecureStore.getItemAsync(KEY_CARE_PAUSED);
    set({
      ...(hour !== null && { summaryHour: parseInt(hour, 10) }),
      ...(family !== null && { familyNotifEnabled: family === 'true' }),
      ...(paused !== null && { careNotifPaused: paused === 'true' }),
    });
  },

  setSummaryHour: async (hour) => {
    await SecureStore.setItemAsync(KEY_SUMMARY_HOUR, String(hour));
    set({ summaryHour: hour });
  },

  setFamilyNotifEnabled: async (val) => {
    await SecureStore.setItemAsync(KEY_FAMILY_NOTIF, String(val));
    set({ familyNotifEnabled: val });
  },

  setCareNotifPaused: async (val) => {
    await SecureStore.setItemAsync(KEY_CARE_PAUSED, String(val));
    set({ careNotifPaused: val });
    if (val) await Notifications.cancelAllScheduledNotificationsAsync();
  },
}));

export function formatHour(hour: number): string {
  if (hour === 0) return '오전 12시';
  if (hour < 12) return `오전 ${hour}시`;
  if (hour === 12) return '오후 12시';
  return `오후 ${hour - 12}시`;
}
