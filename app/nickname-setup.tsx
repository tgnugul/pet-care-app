import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Shadow } from '@/constants/design';

export default function NicknameSetupScreen() {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const trimmed = nickname.trim();
  const ready = trimmed.length >= 1 && !loading;

  async function handleConfirm() {
    if (!ready) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { display_name: trimmed },
    });
    setLoading(false);
    if (!error) {
      router.replace('/(onboarding)/welcome');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        <View style={styles.container}>
          <Text style={styles.emoji}>🐾</Text>
          <Text style={styles.title}>뽀시래기에 오신 걸 환영해요!</Text>
          <Text style={styles.sub}>앱에서 사용할 닉네임을 설정해주세요</Text>

          <TextInput
            style={styles.input}
            placeholder="닉네임 (최대 20자)"
            placeholderTextColor={Colors.light}
            value={nickname}
            onChangeText={setNickname}
            autoCorrect={false}
            autoFocus
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <Text style={styles.hint}>닉네임은 가족 그룹에서 나를 구분하는 데 사용돼요</Text>

          <TouchableOpacity
            style={[styles.btn, !ready && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!ready}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>시작하기</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  kav: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emoji: { fontSize: 52, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  sub: { fontSize: 14, color: Colors.sub, textAlign: 'center', marginBottom: 8 },
  input: {
    width: '100%',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: Colors.text,
    backgroundColor: Colors.white,
    textAlign: 'center',
  },
  hint: { fontSize: 12, color: Colors.light, textAlign: 'center' },
  btn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.button,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...Shadow.card,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
  },
  btnDisabled: { backgroundColor: Colors.light, shadowOpacity: 0 },
  btnText: { fontSize: 16, fontWeight: '800', color: Colors.white },
});
