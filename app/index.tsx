import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/design';

type Dest = '/(auth)/login' | '/(onboarding)/welcome' | '/(tabs)';

export default function RootIndex() {
  const [dest, setDest] = useState<Dest | null>(null);

  useEffect(() => {
    let mounted = true;

    // getSession()은 SecureStore 복구 완료 전에 호출되면 null을 반환할 수 있음.
    // INITIAL_SESSION은 저장소 복구가 끝난 뒤 정확히 한 번 발생하므로 안전함.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'INITIAL_SESSION' || !mounted) return;

      if (!session) {
        if (mounted) setDest('/(auth)/login');
        return;
      }

      const onboardingSeen = await AsyncStorage.getItem('onboarding_seen');
      if (!mounted) return;
      if (onboardingSeen === 'true') { setDest('/(tabs)'); return; }

      const { count } = await supabase
        .from('pets')
        .select('id', { count: 'exact', head: true });
      if (!mounted) return;
      setDest(count === 0 ? '/(onboarding)/welcome' : '/(tabs)');
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!dest) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return <Redirect href={dest} />;
}
