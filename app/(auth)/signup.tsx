import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { GoogleIcon } from '@/components/social-login-icons';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';

WebBrowser.maybeCompleteAuthSession();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIGHT = {
  brand: '#FF8A47',
  brandPress: '#F2742E',
  brandTint: '#FFF4EC',
  bg: '#FFFFFF',
  ink: '#2C2622',
  ink2: '#7A7068',
  ink3: '#ACA298',
  line: '#EFE7DE',
  field: '#F7F0E8',
  fieldLine: '#E7DCD0',
  danger: '#EF4444',
};

const DARK = {
  brand: '#FF8A47',
  brandPress: '#F2742E',
  brandTint: '#2D1A0A',
  bg: '#1C1714',
  ink: '#F0E8E0',
  ink2: '#A89B8E',
  ink3: '#5E524A',
  line: '#2E2822',
  field: '#252019',
  fieldLine: '#3A3028',
  danger: '#FF6B6B',
};

function makeStyles(C: typeof LIGHT) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },

    topBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      height: 52, paddingHorizontal: 8,
      borderBottomWidth: 1, borderBottomColor: C.line,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 8 },
    backText: { fontSize: 15, fontWeight: '600', color: C.ink2 },
    topTitle: { fontSize: 16, fontWeight: '700', color: C.ink },

    content: { paddingHorizontal: 26, paddingBottom: 48 },
    titleSection: { marginTop: 18, marginBottom: 24, marginHorizontal: 2 },
    title: { fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
    titleSub: { fontSize: 13, color: C.ink2, fontWeight: '500', marginTop: 8, lineHeight: 20 },

    fields: { gap: 12 },
    field: {
      height: 54, backgroundColor: C.field, borderRadius: 16,
      paddingHorizontal: 16, fontSize: 15, fontWeight: '500', color: C.ink,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    fieldFocus: { backgroundColor: C.bg, borderColor: C.brand },
    fieldErr: { borderColor: C.danger },
    errText: { fontSize: 12, color: C.danger, marginTop: 5, marginLeft: 4 },
    pwWrap: { position: 'relative' },
    pwInput: { paddingRight: 48 },
    eyeBtn: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },

    agreeRow: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 9,
      marginTop: 18, marginBottom: 22, marginHorizontal: 2,
    },
    chk: {
      width: 20, height: 20, borderRadius: 7, marginTop: 1,
      backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center',
    },
    chkOff: { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.fieldLine },
    agreeText: { flex: 1, fontSize: 13.5, color: C.ink2, fontWeight: '500', lineHeight: 22 },
    required: { color: C.brandPress, fontWeight: '700' },

    btnPrimary: {
      height: 54, borderRadius: 16, backgroundColor: C.brand,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: C.brandPress, shadowOpacity: 0.65, shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 }, elevation: 8,
    },
    btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
    linkLabel: { fontSize: 14, color: C.ink2 },
    link: { fontSize: 14, fontWeight: '700', color: C.brandPress },

    divider: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginTop: 26, marginBottom: 18, marginHorizontal: 4,
    },
    divLine: { flex: 1, height: 1, backgroundColor: C.line },
    divText: { fontSize: 13, color: C.ink3, fontWeight: '500' },

    socials: { gap: 12 },
    googleBtn: {
      height: 48, borderRadius: 4,
      flexDirection: 'row', alignItems: 'center',
      paddingLeft: 12, paddingRight: 12, gap: 10,
      backgroundColor: '#FFFFFF',
      borderWidth: 1, borderColor: '#747775',
    },
    googleIconWrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
    googleBtnText: {
      flex: 1, textAlign: 'center',
      fontSize: 14, fontWeight: '500', color: '#1F1F1F',
    },
    kakaoBtn: {
      height: 48, borderRadius: 12,
      overflow: 'hidden', backgroundColor: '#FEE500',
      alignItems: 'center', justifyContent: 'center',
    },
    kakaoBtnImage: { width: '100%', height: '100%' },
  });
}

const sLight = makeStyles(LIGHT);
const sDark = makeStyles(DARK);

export default function SignupScreen() {
  const isDark = useColorScheme() === 'dark';
  const C = isDark ? DARK : LIGHT;
  const s = isDark ? sDark : sLight;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'kakao' | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const emailValid = email ? EMAIL_REGEX.test(email) : null;
  const pwMatch = confirmPw ? password === confirmPw : null;
  const ready = EMAIL_REGEX.test(email) && password.length >= 8 && password === confirmPw && agree;

  async function handleSignup() {
    if (!ready) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
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
      router.replace('/nickname-setup');
    }
  }

  async function handleSocialLogin(provider: 'google' | 'kakao') {
    setSocialLoading(provider);
    const redirectTo = Linking.createURL('');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true,
        ...(provider === 'google' && { queryParams: { prompt: 'select_account' } }) },
    });
    if (error || !data.url) { setSocialLoading(null); Alert.alert('오류', '잠시 후 다시 시도해주세요.'); return; }
    if (provider === 'kakao') { setSocialLoading(null); await WebBrowser.openBrowserAsync(data.url); return; }
    await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { preferEphemeralSession: true });
    setSocialLoading(null);
  }

  const f = (name: string) => [
    s.field,
    focused === name && s.fieldFocus,
    focused !== name && name === 'email' && emailValid === false && s.fieldErr,
    name === 'confirm' && pwMatch === false && s.fieldErr,
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.ink2} />
          <Text style={s.backText}>뒤로</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>회원가입</Text>
        <View style={{ width: 64 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.titleSection}>
            <Text style={s.title}>계정 만들기</Text>
            <Text style={s.titleSub}>가입하고 우리 아이 순간을 기록해요</Text>
          </View>

          <View style={s.fields}>
            <View>
              <TextInput
                style={f('email')}
                placeholder="이메일"
                placeholderTextColor={C.ink3}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
              {emailValid === false && (
                <Text style={s.errText}>올바른 이메일 형식을 입력해주세요.</Text>
              )}
            </View>

            <View style={s.pwWrap}>
              <TextInput
                style={[f('pw'), s.pwInput]}
                placeholder="비밀번호 (8자 이상)"
                placeholderTextColor={C.ink3}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                onFocus={() => setFocused('pw')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw(v => !v)}>
                <Ionicons name={showPw ? 'eye' : 'eye-off'} size={20} color={showPw ? C.brand : C.ink3} />
              </TouchableOpacity>
            </View>

            <View>
              <View style={s.pwWrap}>
                <TextInput
                  style={[f('confirm'), s.pwInput]}
                  placeholder="비밀번호 확인"
                  placeholderTextColor={C.ink3}
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  secureTextEntry={!showConfirm}
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
                  <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={20} color={showConfirm ? C.brand : C.ink3} />
                </TouchableOpacity>
              </View>
              {pwMatch === false && (
                <Text style={s.errText}>비밀번호가 일치하지 않아요.</Text>
              )}
            </View>
          </View>

          <TouchableOpacity style={s.agreeRow} onPress={() => setAgree(v => !v)}>
            <View style={[s.chk, !agree && s.chkOff]}>
              {agree && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={s.agreeText}>
              <Text style={s.link}>서비스 이용약관</Text>
              {' 및 '}
              <Text style={s.link}>개인정보 처리방침</Text>
              {'에 동의합니다 '}
              <Text style={s.required}>(필수)</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.btnPrimary}
            onPress={handleSignup}
            disabled={loading || !!socialLoading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>가입하기</Text>
            }
          </TouchableOpacity>

          <View style={s.linkRow}>
            <Text style={s.linkLabel}>이미 계정이 있으신가요? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={s.link}>로그인</Text>
            </TouchableOpacity>
          </View>

          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>또는</Text>
            <View style={s.divLine} />
          </View>

          <View style={s.socials}>
            <TouchableOpacity
              style={s.googleBtn}
              onPress={() => handleSocialLogin('google')}
              disabled={!!socialLoading}
              activeOpacity={0.88}
            >
              {socialLoading === 'google'
                ? <ActivityIndicator color="#4285F4" size="small" />
                : <>
                    <View style={s.googleIconWrap}>
                      <GoogleIcon size={20} />
                    </View>
                    <Text style={s.googleBtnText}>Google 계정으로 로그인</Text>
                  </>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={s.kakaoBtn}
              onPress={() => handleSocialLogin('kakao')}
              disabled={!!socialLoading}
              activeOpacity={0.88}
            >
              {socialLoading === 'kakao'
                ? <ActivityIndicator color="#000000" size="small" />
                : <Image
                    source={require('@/assets/images/kakao_login_btn.png')}
                    style={s.kakaoBtnImage}
                    resizeMode="contain"
                  />
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
