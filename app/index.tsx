import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/design';

type Dest = '/(auth)/login' | '/(onboarding)/splash' | '/(onboarding)/welcome' | '/(tabs)';

export default function RootIndex() {
  const [dest, setDest] = useState<Dest | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    AsyncStorage.getItem('splash_seen').then(splashSeen => {
      if (!mounted) return;

      if (splashSeen !== 'true') {
        setDest('/(onboarding)/splash');
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event !== 'INITIAL_SESSION' || !mounted) return;

        if (!session) {
          if (mounted) setDest('/(tabs)');
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

      unsubscribe = () => subscription.unsubscribe();
    });

    return () => {
      mounted = false;
      unsubscribe?.();
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
