import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';

const LIGHT = {
  brand: '#FF8A47',
  brandPress: '#F2742E',
  brandDeep: '#D85F1E',
  brandTint: '#FFF4EC',
  bg: '#FFFFFF',
  ink: '#2C2622',
  ink2: '#7A7068',
  ink3: '#ACA298',
  line: '#EFE7DE',
  field: '#F7F0E8',
};

const DARK = {
  brand: '#FF8A47',
  brandPress: '#F2742E',
  brandDeep: '#FFB07A',
  brandTint: '#2D1A0A',
  bg: '#1C1714',
  ink: '#F0E8E0',
  ink2: '#A89B8E',
  ink3: '#5E524A',
  line: '#2E2822',
  field: '#252019',
};

function makeStyles(C: typeof LIGHT) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    centerText: { fontSize: 14, color: C.ink2, fontWeight: '500' },

    topBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      height: 52, paddingHorizontal: 8,
      borderBottomWidth: 1, borderBottomColor: C.line,
    },
    topTitle: { fontSize: 16, fontWeight: '700', color: C.ink },

    content: { paddingHorizontal: 26, paddingBottom: 48 },
    titleSection: { marginTop: 24, marginBottom: 26, marginHorizontal: 2 },
    title: { fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
    titleSub: { fontSize: 14, color: C.ink2, fontWeight: '500', marginTop: 10, lineHeight: 22 },

    fields: { gap: 12 },
    field: {
      height: 54, backgroundColor: C.field, borderRadius: 16,
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 14,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    fieldFocus: { backgroundColor: C.bg, borderColor: C.brand },
    leadIcon: { marginRight: 8 },
    fieldInput: { flex: 1, fontSize: 15, fontWeight: '500', color: C.ink },

    btnPrimary: {
      height: 54, borderRadius: 16, backgroundColor: C.brand,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: C.brandPress, shadowOpacity: 0.65, shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 }, elevation: 8,
    },
    btnDisabled: { opacity: 0.5, shadowOpacity: 0 },
    btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    errorBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: '#FFF0F0', borderRadius: 16,
      padding: 14, marginTop: 18,
    },
    errorText: { flex: 1, fontSize: 13, color: '#C0392B', fontWeight: '500', lineHeight: 20 },
  });
}

const sLight = makeStyles(LIGHT);
const sDark = makeStyles(DARK);

export default function ResetPasswordScreen() {
  const isDark = useColorScheme() === 'dark';
  const C = isDark ? DARK : LIGHT;
  const s = isDark ? sDark : sLight;

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function handleUrl(url: string) {
      const hash = url.split('#')[1];
      if (!hash) return;
      const params = Object.fromEntries(new URLSearchParams(hash));
      if (params.type === 'recovery' && params.access_token && params.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error) setSessionError(true);
        else setSessionReady(true);
      } else {
        setSessionError(true);
      }
    }

    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  async function handleUpdate() {
    if (password.length < 8) {
      Alert.alert('비밀번호는 8자 이상이어야 해요.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('비밀번호가 일치하지 않아요.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      Alert.alert('오류', '비밀번호 변경에 실패했어요. 링크가 만료됐을 수 있어요.');
    } else {
      Alert.alert('완료', '비밀번호가 변경되었어요.', [
        { text: '로그인하기', onPress: () => router.replace('/(auth)/login') },
      ]);
    }
  }

  if (sessionError) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.topBar}>
          <View style={{ width: 64 }} />
          <Text style={s.topTitle}>비밀번호 재설정</Text>
          <View style={{ width: 64 }} />
        </View>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={C.ink3} />
          <Text style={s.centerText}>링크가 만료됐거나 올바르지 않아요.</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/find-pw')}>
            <Text style={[s.centerText, { color: C.brandPress, fontWeight: '700' }]}>
              재설정 링크 다시 받기
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!sessionReady) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={C.brand} />
          <Text style={s.centerText}>링크를 확인하는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isValid = password.length >= 8 && confirm.length > 0;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <View style={{ width: 64 }} />
        <Text style={s.topTitle}>비밀번호 재설정</Text>
        <View style={{ width: 64 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.titleSection}>
            <Text style={s.title}>새 비밀번호를 입력해요</Text>
            <Text style={s.titleSub}>{'8자 이상의 새 비밀번호를\n설정해주세요.'}</Text>
          </View>

          <View style={s.fields}>
            <View style={[s.field, focused === 'pw' && s.fieldFocus]}>
              <Ionicons name="lock-closed-outline" size={18} color={focused === 'pw' ? C.brand : C.ink3} style={s.leadIcon} />
              <TextInput
                style={s.fieldInput}
                placeholder="새 비밀번호 (8자 이상)"
                placeholderTextColor={C.ink3}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                onFocus={() => setFocused('pw')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.ink3} />
              </TouchableOpacity>
            </View>

            <View style={[s.field, focused === 'confirm' && s.fieldFocus]}>
              <Ionicons name="lock-closed-outline" size={18} color={focused === 'confirm' ? C.brand : C.ink3} style={s.leadIcon} />
              <TextInput
                style={s.fieldInput}
                placeholder="비밀번호 확인"
                placeholderTextColor={C.ink3}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.ink3} />
              </TouchableOpacity>
            </View>
          </View>

          {confirm.length > 0 && password !== confirm && (
            <View style={[s.errorBox, { marginTop: 10 }]}>
              <Text style={s.errorText}>비밀번호가 일치하지 않아요.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.btnPrimary, { marginTop: 22 }, !isValid && s.btnDisabled]}
            onPress={handleUpdate}
            disabled={loading || !isValid}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>비밀번호 변경하기</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
