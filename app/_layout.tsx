import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { requestNotificationPermission, registerPushToken, setupNotificationCategories, rescheduleAfterDone } from '@/lib/notifications';
import { useCareStore, calcNextDue } from '@/stores/schedule.store';
import type { CareSchedule, Frequency } from '@/stores/schedule.store';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    requestNotificationPermission().then(granted => {
      if (granted) registerPushToken();
    });
    setupNotificationCategories();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/(auth)/login');
      if (event === 'SIGNED_IN') registerPushToken();
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      if (response.actionIdentifier !== 'MARK_DONE') return;
      const { scheduleId, petId, petName } = response.notification.request.content.data as {
        scheduleId: string; petId: string; petName: string;
      };
      if (!scheduleId || !petId) return;

      // 알림 팝업 즉시 닫기
      await Notifications.dismissNotificationAsync(response.notification.request.identifier);

      const { data: sc } = await supabase
        .from('care_schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();
      if (!sc) return;

      const now = new Date().toISOString();
      const nextDue = calcNextDue(sc.frequency as Frequency, sc.days_of_week, sc.next_due_at);
      await supabase
        .from('care_schedules')
        .update({ last_done_at: now, next_due_at: nextDue })
        .eq('id', scheduleId);

      await rescheduleAfterDone(sc as CareSchedule, petName ?? '반려동물');
      useCareStore.getState().fetchSchedules(petId);
    });

    return () => {
      subscription.unsubscribe();
      responseSub.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="pet/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="walk-active" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="care-add" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="recommend" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
