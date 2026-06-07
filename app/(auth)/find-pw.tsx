import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

    topBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      height: 52, paddingHorizontal: 8,
      borderBottomWidth: 1, borderBottomColor: C.line,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 8 },
    backText: { fontSize: 15, fontWeight: '600', color: C.ink2 },
    topTitle: { fontSize: 16, fontWeight: '700', color: C.ink },

    content: { paddingHorizontal: 26, paddingBottom: 48 },
    titleSection: { marginTop: 24, marginBottom: 26, marginHorizontal: 2 },
    title: { fontSize: 21, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
    titleSub: { fontSize: 14, color: C.ink2, fontWeight: '500', marginTop: 10, lineHeight: 22 },

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
    btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    infoBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: C.brandTint, borderRadius: 16,
      padding: 14, marginTop: 18,
    },
    infoEmoji: { fontSize: 16, lineHeight: 21 },
    infoText: { flex: 1, fontSize: 13, color: C.brandDeep, fontWeight: '500', lineHeight: 20 },

    linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    linkLabel: { fontSize: 14, color: C.ink2 },
    link: { fontSize: 14, fontWeight: '700', color: C.brandPress },
  });
}

const sLight = makeStyles(LIGHT);
const sDark = makeStyles(DARK);

export default function FindPwScreen() {
  const isDark = useColorScheme() === 'dark';
  const C = isDark ? DARK : LIGHT;
  const s = isDark ? sDark : sLight;

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  async function handleSend() {
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) {
      Alert.alert('오류', '이메일을 확인하고 다시 시도해주세요.');
    } else {
      setSent(true);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.ink2} />
          <Text style={s.backText}>뒤로</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>비밀번호 찾기</Text>
        <View style={{ width: 64 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.titleSection}>
            <Text style={s.title}>비밀번호를 재설정해요</Text>
            <Text style={s.titleSub}>
              {'가입한 이메일로 재설정 링크를\n보내드릴게요.'}
            </Text>
          </View>

          <View style={[s.field, focused && s.fieldFocus]}>
            <Ionicons name="mail-outline" size={18} color={focused ? C.brand : C.ink3} style={s.leadIcon} />
            <TextInput
              style={s.fieldInput}
              placeholder="가입한 이메일"
              placeholderTextColor={C.ink3}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>

          <TouchableOpacity
            style={[s.btnPrimary, { marginTop: 14 }]}
            onPress={handleSend}
            disabled={loading || !email.trim()}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{sent ? '다시 보내기' : '재설정 링크 보내기'}</Text>
            }
          </TouchableOpacity>

          <View style={s.infoBox}>
            <Text style={s.infoEmoji}>💡</Text>
            <Text style={s.infoText}>
              메일이 오지 않으면 스팸함을 확인하거나 잠시 후 다시 시도해 주세요.
            </Text>
          </View>

          <View style={s.linkRow}>
            <Text style={s.linkLabel}>아이디가 기억나지 않나요? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/find-id')}>
              <Text style={s.link}>아이디 찾기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
