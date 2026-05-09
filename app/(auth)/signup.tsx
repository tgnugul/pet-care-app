import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Shadow } from '@/constants/design';

export default function SignupScreen() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!nickname.trim() || !email.trim() || !password || !confirmPassword) return;
    if (password !== confirmPassword) {
      Alert.alert('비밀번호 불일치', '비밀번호를 다시 확인해주세요.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('비밀번호 오류', '비밀번호는 6자 이상이어야 해요.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: nickname.trim() } },
    });
    setLoading(false);

    if (error) {
      Alert.alert('회원가입 실패', error.message);
    } else if (!data.session) {
      // 이메일 인증이 켜져 있는 경우
      Alert.alert(
        '이메일 인증 필요',
        '가입 확인 이메일을 보냈어요.\n인증 후 로그인해주세요.',
        [{ text: '확인', onPress: () => router.replace('/(auth)/login') }],
      );
    } else {
      router.replace('/(onboarding)/welcome');
    }
  }

  const ready = nickname.trim() && email.trim() && password && confirmPassword && !loading;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>‹ 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.logo}>🐾 뽀시래기</Text>
          <Text style={styles.tagline}>반려동물과 함께하는 모든 순간</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>회원가입</Text>

          <TextInput
            style={styles.input}
            placeholder="닉네임"
            placeholderTextColor={Colors.light}
            value={nickname}
            onChangeText={setNickname}
            autoCorrect={false}
            maxLength={20}
          />
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor={Colors.light}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호 (6자 이상)"
            placeholderTextColor={Colors.light}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호 확인"
            placeholderTextColor={Colors.light}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.signupBtn, !ready && styles.btnDisabled]}
            onPress={handleSignup}
            disabled={!ready}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.signupBtnText}>가입하기</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
            <Text style={styles.loginLinkText}>
              이미 계정이 있으신가요? <Text style={styles.loginLinkBold}>로그인</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  kav: { flex: 1 },

  header: {
    backgroundColor: Colors.primary,
    paddingTop: 60, paddingBottom: 48,
    alignItems: 'center', gap: 8,
  },
  backBtn: { position: 'absolute', left: 20, top: 60 },
  backTxt: { fontSize: 16, color: Colors.white, fontWeight: '600' },
  logo: { fontSize: 28, fontWeight: '800', color: Colors.white },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  form: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -20,
    padding: 28, gap: 14,
  },
  formTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 6 },

  input: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.text,
    backgroundColor: Colors.bg,
  },

  signupBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.button,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    ...Shadow.card,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
  },
  btnDisabled: { backgroundColor: Colors.light, shadowOpacity: 0 },
  signupBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },

  loginLink: { alignItems: 'center', paddingVertical: 4 },
  loginLinkText: { fontSize: 14, color: Colors.sub },
  loginLinkBold: { color: Colors.primary, fontWeight: '700' },
});
