import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Colors, Radius, Shadow } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { useSettingsStore, formatHour } from '@/stores/settings.store';
import { useCareStore, isDoneToday } from '@/stores/schedule.store';
import { usePetStore } from '@/stores/pet.store';
import { scheduleDailySummary, cancelDailySummary, scheduleWalkReminder, cancelWalkReminder } from '@/lib/notifications';

export default function SettingsScreen() {
  const {
    summaryHour, setSummaryHour,
    familyNotifEnabled, setFamilyNotifEnabled,
    careNotifPaused, setCareNotifPaused,
    walkReminderTime, setWalkReminderTime,
    loadSettings,
  } = useSettingsStore();
  const { schedules } = useCareStore();
  const { pets } = usePetStore();
  const [pickerTime, setPickerTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(20, 0, 0, 0); return d;
  });
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [walkPickerTime, setWalkPickerTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(18, 0, 0, 0); return d;
  });
  const [showWalkPicker, setShowWalkPicker] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    const d = new Date(); d.setHours(summaryHour, 0, 0, 0);
    setPickerTime(d);
  }, [summaryHour]);

  useEffect(() => {
    if (walkReminderTime) {
      const [h, m] = walkReminderTime.split(':').map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0);
      setWalkPickerTime(d);
    }
  }, [walkReminderTime]);

  async function handleSaveSummaryHour(hour: number) {
    await setSummaryHour(hour);
    await cancelDailySummary();
    const hasIncomplete = schedules.some(sc => !isDoneToday(sc));
    if (hasIncomplete) {
      await scheduleDailySummary(pets[0]?.name ?? '반려동물', hour);
    }
  }

  async function handleWalkReminderChange(date: Date | undefined) {
    if (!date) return;
    setWalkPickerTime(date);
    const h = date.getHours();
    const m = date.getMinutes();
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    await setWalkReminderTime(timeStr);
    await scheduleWalkReminder(pets[0]?.name ?? '반려동물', h, m);
  }

  async function handleCancelWalkReminder() {
    await setWalkReminderTime(null);
    await cancelWalkReminder();
  }

  function formatWalkReminderTime(): string {
    if (!walkReminderTime) return '설정 안 함';
    const [h, m] = walkReminderTime.split(':').map(Number);
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h % 12 || 12;
    return `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
  }

  function handleDeleteAccount() {
    Alert.alert(
      '회원 탈퇴',
      '탈퇴하면 모든 데이터(반려동물, 케어 일정, 사진)가 영구 삭제돼요. 정말 탈퇴할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            const { error } = await supabase.functions.invoke('delete-account');
            setDeleteLoading(false);
            if (error) {
              Alert.alert('오류', '탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
            } else {
              await supabase.auth.signOut();
            }
          },
        },
      ],
    );
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>앱 설정</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 알림 */}
        <Text style={styles.sectionTitle}>알림</Text>
        <View style={styles.card}>
          {/* iOS: compact 인라인 time picker */}
          {Platform.OS === 'ios' ? (
            <View style={[styles.row, styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>일일 케어 요약 알림</Text>
                <Text style={styles.rowSub}>미완료 일정이 있을 때 알림을 보내드려요</Text>
              </View>
              <DateTimePicker
                value={pickerTime}
                mode="time"
                display="compact"
                minuteInterval={30}
                onChange={(_: DateTimePickerEvent, d?: Date) => {
                  if (d) { setPickerTime(d); handleSaveSummaryHour(d.getHours()); }
                }}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.row, styles.divider]}
              onPress={() => setShowAndroidPicker(true)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>일일 케어 요약 알림</Text>
                <Text style={styles.rowSub}>미완료 일정이 있을 때 알림을 보내드려요</Text>
              </View>
              <Text style={styles.timeValue}>{formatHour(pickerTime.getHours())}</Text>
              {showAndroidPicker && (
                <DateTimePicker
                  value={pickerTime}
                  mode="time"
                  minuteInterval={30}
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    setShowAndroidPicker(false);
                    if (d) { setPickerTime(d); handleSaveSummaryHour(d.getHours()); }
                  }}
                />
              )}
            </TouchableOpacity>
          )}

          {/* 산책 알림 */}
          {Platform.OS === 'ios' ? (
            <View style={[styles.row, styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>산책 알림</Text>
                <Text style={styles.rowSub}>매일 설정한 시간에 산책을 알려드려요</Text>
              </View>
              {walkReminderTime ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <DateTimePicker
                    value={walkPickerTime}
                    mode="time"
                    display="compact"
                    minuteInterval={5}
                    onChange={(_: DateTimePickerEvent, d?: Date) => { if (d) handleWalkReminderChange(d); }}
                  />
                  <TouchableOpacity onPress={handleCancelWalkReminder}>
                    <Text style={{ fontSize: 13, color: Colors.danger, fontWeight: '600' }}>끄기</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => handleWalkReminderChange(walkPickerTime)}>
                  <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '700' }}>설정</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.row, styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>산책 알림</Text>
                <Text style={styles.rowSub}>매일 설정한 시간에 산책을 알려드려요</Text>
              </View>
              <TouchableOpacity
                onPress={() => walkReminderTime ? handleCancelWalkReminder() : setShowWalkPicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={[styles.timeValue, !walkReminderTime && { color: Colors.sub }]}>
                  {formatWalkReminderTime()}
                </Text>
                {walkReminderTime && (
                  <Text style={{ fontSize: 12, color: Colors.danger, fontWeight: '600' }}>끄기</Text>
                )}
              </TouchableOpacity>
              {showWalkPicker && (
                <DateTimePicker
                  value={walkPickerTime}
                  mode="time"
                  minuteInterval={5}
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    setShowWalkPicker(false);
                    if (d) handleWalkReminderChange(d);
                  }}
                />
              )}
            </View>
          )}

          {/* 가족 케어 등록 알림 */}
          <View style={[styles.row, styles.divider]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>가족 케어 등록 알림</Text>
              <Text style={styles.rowSub}>가족이 새 케어를 등록할 때 알림을 받아요</Text>
            </View>
            <Switch
              value={familyNotifEnabled}
              onValueChange={setFamilyNotifEnabled}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          {/* 여행 모드 */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>케어 알림 일시정지</Text>
              <Text style={styles.rowSub}>여행 중엔 새 알림 예약을 잠시 멈춰요</Text>
            </View>
            <Switch
              value={careNotifPaused}
              onValueChange={setCareNotifPaused}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* 앱 정보 */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>앱 정보</Text>
        <View style={styles.card}>
          <View style={[styles.row, styles.divider]}>
            <Text style={styles.rowLabel}>버전</Text>
            <Text style={styles.rowValue}>{appVersion}</Text>
          </View>
          <TouchableOpacity
            style={[styles.row, styles.divider]}
            onPress={() => Alert.alert('준비 중', '곧 제공될 예정이에요.')}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>개인정보처리방침</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Alert.alert('준비 중', '곧 제공될 예정이에요.')}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>이용약관</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 계정 */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>계정</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
            activeOpacity={0.7}
          >
            {deleteLoading
              ? <ActivityIndicator color={Colors.danger} />
              : <Text style={[styles.rowLabel, { color: Colors.danger }]}>회원 탈퇴</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40 },
  backArrow: { fontSize: 22, color: Colors.text },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },

  content: { padding: 20, gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.sub, marginBottom: 4 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 12, minHeight: 52,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: 12, color: Colors.sub, marginTop: 2 },
  rowValue: { fontSize: 14, color: Colors.sub },
  timeValue: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  chevron: { fontSize: 22, color: Colors.light },
});
