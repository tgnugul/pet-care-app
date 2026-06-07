import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';

WebBrowser.maybeCompleteAuthSession();

const SAVED_EMAIL_KEY = 'pawmate_saved_email';

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
  kakao: '#FEE500',
  kakaoInk: '#3B1E1E',
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
  kakao: '#FEE500',
  kakaoInk: '#3B1E1E',
};

function makeStyles(C: typeof LIGHT) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    content: { paddingHorizontal: 26, paddingBottom: 48 },

    brand: { marginTop: 46, marginBottom: 34 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    paw: { fontSize: 22 },
    appName: { fontSize: 23, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
    slogan: { fontSize: 13, color: C.ink2, fontWeight: '500', marginTop: 9, lineHeight: 20 },

    fields: { gap: 12 },
    field: {
      height: 54,
      backgroundColor: C.field,
      borderRadius: 16,
      paddingHorizontal: 16,
      fontSize: 15,
      fontWeight: '500',
      color: C.ink,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    fieldFocus: { backgroundColor: C.bg, borderColor: C.brand },
    pwWrap: { position: 'relative' },
    pwInput: { paddingRight: 48 },
    eyeBtn: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },

    midRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 14, marginBottom: 22,
    },
    rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chk: {
      width: 20, height: 20, borderRadius: 7,
      backgroundColor: C.brand,
      alignItems: 'center', justifyContent: 'center',
    },
    chkOff: { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.fieldLine },
    rememberLabel: { fontSize: 13, color: C.ink2, fontWeight: '500' },
    findLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mutedLink: { fontSize: 13, color: C.ink2, fontWeight: '500' },
    dot: { color: C.fieldLine, fontSize: 14 },

    btnPrimary: {
      height: 54, borderRadius: 16,
      backgroundColor: C.brand,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: C.brandPress,
      shadowOpacity: 0.65,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
    linkLabel: { fontSize: 14, color: C.ink2 },
    link: { fontSize: 14, fontWeight: '700', color: C.brandPress },

    divider: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginTop: 30, marginBottom: 20, marginHorizontal: 4,
    },
    divLine: { flex: 1, height: 1, backgroundColor: C.line },
    divText: { fontSize: 13, color: C.ink3, fontWeight: '500' },

    socials: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
    socialCircle: {
      width: 54, height: 54, borderRadius: 27,
      backgroundColor: C.bg,
      borderWidth: 1.5, borderColor: C.line,
      alignItems: 'center', justifyContent: 'center',
    },
    kakaoCircle: { backgroundColor: C.kakao, borderColor: C.kakao },
    googleG: { fontSize: 20, fontWeight: '800', color: '#4285F4' },
    kakaoIcon: { fontSize: 22 },
  });
}

const sLight = makeStyles(LIGHT);
const sDark = makeStyles(DARK);

export default function LoginScreen() {
  const isDark = useColorScheme() === 'dark';
  const C = isDark ? DARK : LIGHT;
  const s = isDark ? sDark : sLight;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'kakao' | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_EMAIL_KEY).then(saved => { if (saved) setEmail(saved); });
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해주세요.');
    } else {
      if (remember) await AsyncStorage.setItem(SAVED_EMAIL_KEY, email.trim());
      else await AsyncStorage.removeItem(SAVED_EMAIL_KEY);
      router.replace('/(tabs)');
    }
  }

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
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { preferEphemeralSession: true });
    setSocialLoading(null);
    if (result.type === 'success' && result.url) {
      const url = result.url;
      if (url.includes('code=')) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(url);
        if (!e) router.replace('/');
      } else if (url.includes('access_token=')) {
        const frag = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
        const params = new URLSearchParams(frag);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token') ?? '';
        if (access_token) { await supabase.auth.setSession({ access_token, refresh_token }); router.replace('/'); }
      }
    }
  }

  const fieldStyle = (name: string) => [s.field, focused === name && s.fieldFocus];

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.brand}>
            <View style={s.brandRow}>
              <Text style={s.paw}>🐾</Text>
              <Text style={s.appName}>뽀시래기</Text>
            </View>
            <Text style={s.slogan}>반려동물과 함께하는 모든 순간</Text>
          </View>

          <View style={s.fields}>
            <TextInput
              style={fieldStyle('email')}
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
            <View style={s.pwWrap}>
              <TextInput
                style={[fieldStyle('pw'), s.pwInput]}
                placeholder="비밀번호"
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
          </View>

          <View style={s.midRow}>
            <TouchableOpacity style={s.rememberRow} onPress={() => setRemember(v => !v)}>
              <View style={[s.chk, !remember && s.chkOff]}>
                {remember && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={s.rememberLabel}>아이디 기억</Text>
            </TouchableOpacity>
            <View style={s.findLinks}>
              <TouchableOpacity onPress={() => router.push('/(auth)/find-id')}>
                <Text style={s.mutedLink}>아이디 찾기</Text>
              </TouchableOpacity>
              <Text style={s.dot}>·</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/find-pw')}>
                <Text style={s.mutedLink}>비밀번호 찾기</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={s.btnPrimary}
            onPress={handleLogin}
            disabled={loading || !!socialLoading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>로그인</Text>
            }
          </TouchableOpacity>

          <View style={s.linkRow}>
            <Text style={s.linkLabel}>아직 계정이 없으신가요? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={s.link}>회원가입</Text>
            </TouchableOpacity>
          </View>

          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>또는</Text>
            <View style={s.divLine} />
          </View>

          <View style={s.socials}>
            <TouchableOpacity
              style={s.socialCircle}
              onPress={() => handleSocialLogin('google')}
              disabled={!!socialLoading}
              activeOpacity={0.82}
            >
              {socialLoading === 'google'
                ? <ActivityIndicator color={C.ink} size="small" />
                : <Text style={s.googleG}>G</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.socialCircle, s.kakaoCircle]}
              onPress={() => handleSocialLogin('kakao')}
              disabled={!!socialLoading}
              activeOpacity={0.82}
            >
              {socialLoading === 'kakao'
                ? <ActivityIndicator color={C.kakaoInk} size="small" />
                : <Text style={s.kakaoIcon}>💬</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
