import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Radius, Shadow } from '@/constants/design';

async function markOnboardingSeen() {
  await AsyncStorage.setItem('onboarding_seen', 'true');
}

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.emoji}>🐾</Text>
          <Text style={styles.title}>뽀시래기에{'\n'}오신 걸 환영해요!</Text>
          <Text style={styles.sub}>현재 반려동물을 키우고 계신가요?</Text>
        </View>

        <View style={styles.choices}>
          <TouchableOpacity
            style={styles.choiceYes}
            activeOpacity={0.85}
            onPress={() => { markOnboardingSeen(); router.push('/(onboarding)/register-pet'); }}
          >
            <Text style={styles.choiceEmoji}>🐶</Text>
            <Text style={styles.choiceYesLabel}>네, 키우고 있어요</Text>
            <Text style={styles.choiceYesSub}>아이를 바로 등록할게요</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.choiceNo}
            activeOpacity={0.85}
            onPress={() => { markOnboardingSeen(); router.push('/(onboarding)/survey'); }}
          >
            <Text style={styles.choiceEmoji}>🤔</Text>
            <Text style={styles.choiceNoLabel}>아직 없어요</Text>
            <Text style={styles.choiceNoSub}>어떤 동물이 맞는지 알아볼게요</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            activeOpacity={0.7}
            onPress={() => { markOnboardingSeen(); router.replace('/(tabs)'); }}
          >
            <Text style={styles.skipText}>나중에 할게요</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.loginLinkText}>
            이미 계정이 있으신가요? <Text style={styles.loginLinkBold}>로그인</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: 28, justifyContent: 'center', gap: 48 },

  top: { alignItems: 'center', gap: 12 },
  emoji: { fontSize: 64 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center', lineHeight: 36 },
  sub: { fontSize: 15, color: Colors.sub, textAlign: 'center' },

  choices: { gap: 14 },

  choiceYes: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.card + 4,
    paddingVertical: 24, paddingHorizontal: 20,
    alignItems: 'center', gap: 6,
    ...Shadow.card,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
  },
  choiceEmoji: { fontSize: 36 },
  choiceYesLabel: { fontSize: 18, fontWeight: '800', color: Colors.white },
  choiceYesSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  choiceNo: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card + 4,
    paddingVertical: 24, paddingHorizontal: 20,
    alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadow.sm,
  },
  choiceNoLabel: { fontSize: 18, fontWeight: '800', color: Colors.text },
  choiceNoSub: { fontSize: 13, color: Colors.sub },

  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { fontSize: 14, color: Colors.light },

  loginLink: { alignItems: 'center', paddingVertical: 8 },
  loginLinkText: { fontSize: 14, color: Colors.sub },
  loginLinkBold: { color: Colors.primary, fontWeight: '700' },
});
