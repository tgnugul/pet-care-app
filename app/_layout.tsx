import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { useFonts } from 'expo-font';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { requestNotificationPermission, registerPushToken, setupNotificationCategories, rescheduleAfterDone } from '@/lib/notifications';
import { useCareStore, calcNextDue } from '@/stores/schedule.store';
import type { CareSchedule, Frequency } from '@/stores/schedule.store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetRevenueCatUser } from '@/lib/revenuecat';
import { usePetStore } from '@/stores/pet.store';
import { useWalkStore } from '@/stores/walk.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useFamilyStore } from '@/stores/family.store';

// 시스템 글씨 크기 최대 설정 시 UI가 깨지지 않도록 1.25배로 캡 적용
(Text as any).defaultProps = { ...((Text as any).defaultProps ?? {}), maxFontSizeMultiplier: 1.25 };
(TextInput as any).defaultProps = { ...((TextInput as any).defaultProps ?? {}), maxFontSizeMultiplier: 1.25 };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { loadSettings } = useSettingsStore();
  const [fontsLoaded] = useFonts({
    PretendardVariable: require('@/assets/fonts/PretendardVariable.ttf'),
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    (Text as any).defaultProps = {
      ...((Text as any).defaultProps ?? {}),
      style: { fontFamily: 'PretendardVariable' },
    };
    (TextInput as any).defaultProps = {
      ...((TextInput as any).defaultProps ?? {}),
      style: { fontFamily: 'PretendardVariable' },
    };
  }, [fontsLoaded]);

  useEffect(() => {
    loadSettings();

    requestNotificationPermission().then(granted => {
      if (granted) registerPushToken();
    });
    setupNotificationCategories();

    // 앱 시작 시 위젯을 최신 코드로 재렌더 (OTA 업데이트 후 클릭 액션 반영)
    if (Platform.OS === 'android') {
      (async () => {
        try {
          const { requestWidgetUpdate } = await import('react-native-android-widget');
          const { WalkWidget } = await import('@/widgets/WalkWidget');
          const { getWalkState } = await import('@/lib/widget-storage');
          const walkState = await getWalkState();
          await requestWidgetUpdate({
            widgetName: 'WalkWidget',
            renderWidget: () => WalkWidget({ state: walkState }),
            widgetNotFound: () => {},
          });
        } catch {}
      })();
    }

    // OAuth 딥링크 처리
    const handleDeepLink = async (url: string | null) => {
      if (!url || (!url.startsWith('pawmate://') && !url.startsWith('exp+pawmate://'))) return;

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
        await useCareStore.getState().unsubscribeSchedules();
        usePetStore.setState({ pets: [] });
        useCareStore.setState({ schedules: [] });
        useWalkStore.setState({ logs: [] });
        useFamilyStore.setState({ family: null, members: [], pendingRequests: [], myPendingRequest: null });
        if (Platform.OS === 'android') {
          try {
            const { clearWidgetData } = await import('@/lib/widget-storage');
            const { requestWidgetUpdate } = await import('react-native-android-widget');
            const { CareWidget } = await import('@/widgets/CareWidget');
            const { WalkWidget } = await import('@/widgets/WalkWidget');
            await clearWidgetData();
            await Promise.all([
              requestWidgetUpdate({ widgetName: 'CareWidget', renderWidget: () => CareWidget({ data: null, loggedOut: true }), widgetNotFound: () => {} }),
              requestWidgetUpdate({ widgetName: 'WalkWidget', renderWidget: () => WalkWidget({ state: null, loggedOut: true }), widgetNotFound: () => {} }),
            ]);
          } catch {}
        }
        router.replace('/(auth)/login');
      }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) {
          registerPushToken();
          useFamilyStore.getState().fetchFamily();
          if (event === 'SIGNED_IN' && !session.user.user_metadata?.display_name) {
            router.replace('/nickname-setup');
          }
        }
      }
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      // 산책 알림 탭 → 산책 화면 바로 진입
      if (response.notification.request.content.data?.type === 'walk-reminder') {
        router.push('/walk-active');
        return;
      }
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

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#FFF8EF' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
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
        <Stack.Screen name="nickname-setup" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
