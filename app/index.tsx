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
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setDest('/(auth)/login'); return; }

      const onboardingSeen = await AsyncStorage.getItem('onboarding_seen');
      if (onboardingSeen === 'true') { setDest('/(tabs)'); return; }

      const { count } = await supabase
        .from('pets')
        .select('id', { count: 'exact', head: true });
      setDest(count === 0 ? '/(onboarding)/welcome' : '/(tabs)');
    }
    check();
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
