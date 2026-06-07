import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  fieldLine: '#E7DCD0',
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
  fieldLine: '#3A3028',
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

    fields: { gap: 12 },
    field: {
      height: 54, backgroundColor: C.field, borderRadius: 16,
      paddingHorizontal: 16, fontSize: 15, fontWeight: '500', color: C.ink,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    fieldFocus: { backgroundColor: C.bg, borderColor: C.brand },
    phoneRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 6, paddingRight: 6, gap: 0,
    },
    phoneInput: {
      flex: 1, height: 54, fontSize: 15, fontWeight: '500', color: C.ink,
      paddingLeft: 10,
    },
    codeChip: {
      height: 40, paddingHorizontal: 14, borderRadius: 12,
      backgroundColor: C.brandTint,
      alignItems: 'center', justifyContent: 'center',
    },
    codeChipText: { fontSize: 13, fontWeight: '700', color: C.brandDeep },

    btnPrimary: {
      height: 54, borderRadius: 16, backgroundColor: C.brand,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: C.brandPress, shadowOpacity: 0.65, shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 }, elevation: 8,
    },
    btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
    linkLabel: { fontSize: 14, color: C.ink2 },
    link: { fontSize: 14, fontWeight: '700', color: C.brandPress },
  });
}

const sLight = makeStyles(LIGHT);
const sDark = makeStyles(DARK);

export default function FindIdScreen() {
  const isDark = useColorScheme() === 'dark';
  const C = isDark ? DARK : LIGHT;
  const s = isDark ? sDark : sLight;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const f = (n: string) => [s.field, focused === n && s.fieldFocus];

  function handleRequestCode() {
    if (!phone.trim()) { Alert.alert('휴대폰 번호를 입력해주세요.'); return; }
    // TODO: SMS 인증 로직 연결
    setCodeSent(true);
    Alert.alert('인증번호 발송', '입력하신 번호로 인증번호를 발송했어요.');
  }

  function handleFind() {
    if (!name.trim() || !phone.trim() || !code.trim()) return;
    setLoading(true);
    // TODO: 아이디 찾기 로직 연결
    setTimeout(() => { setLoading(false); Alert.alert('안내', '해당 정보로 가입된 계정을 확인해주세요.'); }, 1000);
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.ink2} />
          <Text style={s.backText}>뒤로</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>아이디 찾기</Text>
        <View style={{ width: 64 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.titleSection}>
            <Text style={s.title}>가입한 아이디를 찾아요</Text>
            <Text style={s.titleSub}>
              {'가입 시 등록한 이름과 휴대폰 번호로\n이메일 주소를 알려드릴게요.'}
            </Text>
          </View>

          <View style={s.fields}>
            <TextInput
              style={f('name')}
              placeholder="이름"
              placeholderTextColor={C.ink3}
              value={name}
              onChangeText={setName}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
            />

            <View style={[s.field, focused === 'phone' && s.fieldFocus, s.phoneRow]}>
              <TextInput
                style={s.phoneInput}
                placeholder="휴대폰 번호"
                placeholderTextColor={C.ink3}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                onFocus={() => setFocused('phone')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity style={s.codeChip} onPress={handleRequestCode}>
                <Text style={s.codeChipText}>{codeSent ? '재요청' : '인증요청'}</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={f('code')}
              placeholder="인증번호 6자리"
              placeholderTextColor={C.ink3}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              onFocus={() => setFocused('code')}
              onBlur={() => setFocused(null)}
            />
          </View>

          <TouchableOpacity
            style={[s.btnPrimary, { marginTop: 22 }]}
            onPress={handleFind}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>아이디 찾기</Text>
            }
          </TouchableOpacity>

          <View style={s.linkRow}>
            <Text style={s.linkLabel}>비밀번호를 잊으셨나요? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/find-pw')}>
              <Text style={s.link}>비밀번호 찾기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
