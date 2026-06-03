import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Shadow } from '@/constants/design';

WebBrowser.maybeCompleteAuthSession();

const SAVED_EMAIL_KEY = 'pawmate_saved_email';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'kakao' | null>(null);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_EMAIL_KEY).then(saved => {
      if (saved) {
        setEmail(saved);
        setRememberEmail(true);
      }
    });
  }, []);

  async function handleSocialLogin(provider: 'google' | 'kakao') {
    setSocialLoading(provider);
    const redirectTo = Linking.createURL('');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        ...(provider === 'google' && { queryParams: { prompt: 'select_account' } }),
      },
    });

    if (error || !data.url) {
      setSocialLoading(null);
      Alert.alert('오류', '로그인을 시작할 수 없어요. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (provider === 'kakao') {
      setSocialLoading(null);
      await WebBrowser.openBrowserAsync(data.url);
      return;
    }

    // Google: WebBrowser 인앱 처리
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { preferEphemeralSession: true });
    setSocialLoading(null);

    if (result.type === 'success' && result.url) {
      const url = result.url;
      if (url.includes('code=')) {
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (!error) router.replace('/');
      } else if (url.includes('access_token=')) {
        const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
        const params = new URLSearchParams(fragment);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token') ?? '';
        if (access_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          router.replace('/');
        }
      }
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해주세요.');
    } else {
      if (rememberEmail) {
        await AsyncStorage.setItem(SAVED_EMAIL_KEY, email.trim());
      } else {
        await AsyncStorage.removeItem(SAVED_EMAIL_KEY);
      }
      router.replace('/(tabs)');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        <View style={styles.header}>
          <Text style={styles.logo}>🐾 뽀시래기</Text>
          <Text style={styles.tagline}>반려동물과 함께하는 모든 순간</Text>
        </View>

        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.formTitle}>로그인</Text>

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
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="비밀번호"
              placeholderTextColor={Colors.light}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
              <Text style={styles.eyeText}>{showPassword ? '숨김' : '표시'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.checkRow} onPress={() => setRememberEmail(v => !v)}>
            <View style={[styles.checkbox, rememberEmail && styles.checkboxOn]}>
              {rememberEmail && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>아이디 기억</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, (!email || !password || loading) && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={!email || !password || loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.loginBtnText}>로그인</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.signupLink} onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.signupLinkText}>
              아직 계정이 없으신가요? <Text style={styles.signupLinkBold}>회원가입</Text>
            </Text>
          </TouchableOpacity>

          {/* 소셜 로그인 구분선 */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 구글 로그인 */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={() => handleSocialLogin('google')}
            disabled={!!socialLoading}
            activeOpacity={0.8}
          >
            {socialLoading === 'google'
              ? <ActivityIndicator color={Colors.text} />
              : <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleBtnText}>Google로 계속하기</Text>
                </>
            }
          </TouchableOpacity>

          {/* 카카오 로그인 */}
          <TouchableOpacity
            style={styles.kakaoBtn}
            onPress={() => handleSocialLogin('kakao')}
            disabled={!!socialLoading}
            activeOpacity={0.8}
          >
            {socialLoading === 'kakao'
              ? <ActivityIndicator color="#3C1E1E" />
              : <>
                  <Text style={styles.kakaoIcon}>💬</Text>
                  <Text style={styles.kakaoBtnText}>카카오로 계속하기</Text>
                </>
            }
          </TouchableOpacity>

        </ScrollView>
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
  logo: { fontSize: 28, fontWeight: '800', color: Colors.white },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  formScroll: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -20,
  },
  form: {
    padding: 28,
    gap: 14,
    paddingBottom: 48,
  },
  formTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 6 },

  input: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.text,
    backgroundColor: Colors.bg,
  },

  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 64 },
  eyeBtn: {
    position: 'absolute', right: 14, top: 0, bottom: 0,
    justifyContent: 'center',
  },
  eyeText: { fontSize: 13, color: Colors.sub, fontWeight: '600' },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { fontSize: 12, color: Colors.white, fontWeight: '800' },
  checkLabel: { fontSize: 14, color: Colors.sub },

  loginBtn: {
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
  loginBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },

  signupLink: { alignItems: 'center', paddingVertical: 4 },
  signupLinkText: { fontSize: 14, color: Colors.sub },
  signupLinkBold: { color: Colors.primary, fontWeight: '700' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.light, fontWeight: '500' },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.button, paddingVertical: 14,
    backgroundColor: Colors.white,
  },
  googleIcon: { fontSize: 16, fontWeight: '800', color: '#4285F4' },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: Colors.text },

  kakaoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: Radius.button, paddingVertical: 14,
    backgroundColor: '#FEE500',
  },
  kakaoIcon: { fontSize: 16 },
  kakaoBtnText: { fontSize: 15, fontWeight: '700', color: '#3C1E1E' },
});
