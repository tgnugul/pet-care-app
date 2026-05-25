import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { requestNotificationPermission, registerPushToken, setupNotificationCategories, rescheduleAfterDone } from '@/lib/notifications';
import { useCareStore, calcNextDue } from '@/stores/schedule.store';
import type { CareSchedule, Frequency } from '@/stores/schedule.store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initRevenueCat, identifyRevenueCatUser, resetRevenueCatUser } from '@/lib/revenuecat';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { usePetStore } from '@/stores/pet.store';
import { useWalkStore } from '@/stores/walk.store';
import { useCareStore } from '@/stores/schedule.store';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { fetchStatus } = useSubscriptionStore();

  useEffect(() => {
    initRevenueCat();

    requestNotificationPermission().then(granted => {
      if (granted) registerPushToken();
    });
    setupNotificationCategories();

    // OAuth 딥링크 처리
    const handleDeepLink = async (url: string | null) => {
      if (!url || !url.startsWith('pawmate://')) return;

      const hasCode = url.includes('code=');
      const hasToken = url.includes('access_token=');

      if (hasCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (!error) router.replace('/');
      } else if (hasToken) {
        const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
        const params = new URLSearchParams(fragment);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token') ?? '';
        if (access_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) router.replace('/');
        }
      }
    };
    Linking.getInitialURL().then(handleDeepLink);
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        await resetRevenueCatUser();
        await AsyncStorage.removeItem('onboarding_seen');
        usePetStore.setState({ pets: [] });
        useCareStore.setState({ schedules: [] });
        useWalkStore.setState({ logs: [] });
        router.replace('/(auth)/login');
      }
      if (event === 'SIGNED_IN') {
        registerPushToken();
        if (session?.user.id) {
          await identifyRevenueCatUser(session.user.id);
          fetchStatus();
        }
      }
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
      linkingSub.remove();
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
        <Stack.Screen name="pet-edit" options={{ headerShown: false }} />
        <Stack.Screen name="walk-active" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="care-add" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="recommend" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="walk-detail" options={{ headerShown: false }} />
        <Stack.Screen name="health-report" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
