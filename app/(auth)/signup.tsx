import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Shadow } from '@/constants/design';

WebBrowser.maybeCompleteAuthSession();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pw) return { level: 0, label: '', color: Colors.border };
  const hasNum = /\d/.test(pw);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
  if (pw.length >= 10 && hasNum && hasSpecial) return { level: 3, label: '강함', color: '#22c55e' };
  if (pw.length >= 8 && (hasNum || hasSpecial)) return { level: 2, label: '보통', color: '#f59e0b' };
  return { level: 1, label: '약함', color: '#ef4444' };
}

export default function SignupScreen() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'kakao' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const emailValid = email ? EMAIL_REGEX.test(email) : null;
  const strength = getPasswordStrength(password);
  const passwordMatch = confirmPassword ? password === confirmPassword : null;

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
      Alert.alert('오류', '가입을 시작할 수 없어요. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (provider === 'kakao') {
      setSocialLoading(null);
      await WebBrowser.openBrowserAsync(data.url);
      return;
    }

    await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { preferEphemeralSession: true });
    setSocialLoading(null);
  }

  async function handleSignup() {
    if (!nickname.trim()) return;
    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert('이메일 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }
    if (strength.level < 1) {
      Alert.alert('비밀번호 오류', '비밀번호를 입력해주세요.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('비밀번호 불일치', '비밀번호를 다시 확인해주세요.');
      return;
    }
    if (!agreedTerms) {
      Alert.alert('약관 동의 필요', '서비스 이용을 위해 약관에 동의해주세요.');
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
      Alert.alert(
        '이메일 인증 필요',
        '가입 확인 이메일을 보냈어요.\n인증 후 로그인해주세요.',
        [{ text: '확인', onPress: () => router.replace('/(auth)/login') }],
      );
    } else {
      router.replace('/(onboarding)/welcome');
    }
  }

  const ready = nickname.trim() && EMAIL_REGEX.test(email) && password && password === confirmPassword && agreedTerms && !loading;

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

        <ScrollView style={styles.scroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.formTitle}>회원가입</Text>

          {/* 닉네임 */}
          <TextInput
            style={styles.input}
            placeholder="닉네임"
            placeholderTextColor={Colors.light}
            value={nickname}
            onChangeText={setNickname}
            autoCorrect={false}
            maxLength={20}
          />

          {/* 이메일 */}
          <View>
            <TextInput
              style={[styles.input, emailValid === false && styles.inputError]}
              placeholder="이메일"
              placeholderTextColor={Colors.light}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailValid === false && (
              <Text style={styles.errorText}>올바른 이메일 형식을 입력해주세요.</Text>
            )}
          </View>

          {/* 비밀번호 */}
          <View style={styles.gap6}>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="비밀번호 (8자 이상 권장)"
                placeholderTextColor={Colors.light}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                <Text style={styles.eyeText}>{showPassword ? '숨김' : '표시'}</Text>
              </TouchableOpacity>
            </View>
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                <View style={styles.strengthBar}>
                  {[1, 2, 3].map(i => (
                    <View
                      key={i}
                      style={[styles.strengthSegment, { backgroundColor: i <= strength.level ? strength.color : Colors.border }]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              </View>
            )}
          </View>

          {/* 비밀번호 확인 */}
          <View>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput, passwordMatch === false && styles.inputError]}
                placeholder="비밀번호 확인"
                placeholderTextColor={Colors.light}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
                <Text style={styles.eyeText}>{showConfirm ? '숨김' : '표시'}</Text>
              </TouchableOpacity>
            </View>
            {passwordMatch === false && (
              <Text style={styles.errorText}>비밀번호가 일치하지 않아요.</Text>
            )}
          </View>

          {/* 약관 동의 */}
          <TouchableOpacity style={styles.checkRow} onPress={() => setAgreedTerms(v => !v)}>
            <View style={[styles.checkbox, agreedTerms && styles.checkboxOn]}>
              {agreedTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>
              <Text style={styles.checkLinkText}>서비스 이용약관</Text>
              {'  및  '}
              <Text style={styles.checkLinkText}>개인정보 처리방침</Text>
              {'에 동의합니다 (필수)'}
            </Text>
          </TouchableOpacity>

          {/* 가입 버튼 */}
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

          {/* 소셜 가입 */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

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
  backBtn: { position: 'absolute', left: 20, top: 60 },
  backTxt: { fontSize: 16, color: Colors.white, fontWeight: '600' },
  logo: { fontSize: 28, fontWeight: '800', color: Colors.white },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  scroll: { flex: 1, backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20 },
  form: { padding: 28, gap: 14, paddingBottom: 48 },
  formTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 6 },

  input: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.text,
    backgroundColor: Colors.bg,
  },
  inputError: { borderColor: '#ef4444' },
  errorText: { fontSize: 12, color: '#ef4444', marginTop: 4, marginLeft: 4 },

  gap6: { gap: 6 },

  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 64 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { fontSize: 13, color: Colors.sub, fontWeight: '600' },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strengthBar: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', width: 28 },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bg, marginTop: 1,
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { fontSize: 12, color: Colors.white, fontWeight: '800' },
  checkLabel: { flex: 1, fontSize: 13, color: Colors.sub, lineHeight: 20 },
  checkLinkText: { color: Colors.primary, fontWeight: '700' },

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
