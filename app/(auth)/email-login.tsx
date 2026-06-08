import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Shadow } from '@/constants/design';

const SAVED_EMAIL_KEY = 'pawmate_saved_email';

export default function EmailLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_EMAIL_KEY).then(saved => {
      if (saved) { setEmail(saved); setRememberEmail(true); }
    });
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해주세요.');
    } else {
      if (rememberEmail) await AsyncStorage.setItem(SAVED_EMAIL_KEY, email.trim());
      else await AsyncStorage.removeItem(SAVED_EMAIL_KEY);
      router.replace('/(tabs)');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>이메일로 로그인</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backText: { fontSize: 30, color: Colors.text, lineHeight: 34 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },

  form: { padding: 24, gap: 12, paddingBottom: 48 },

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
});
