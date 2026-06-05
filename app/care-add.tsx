import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch, Platform, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore } from '@/stores/pet.store';
import { useCareStore, CARE_TYPE_META, CARE_TYPE_IMAGES, CareType, Frequency } from '@/stores/schedule.store';
import { scheduleNotification, cancelNotification, notifyFamilyNewCare } from '@/lib/notifications';
import { useFamilyStore } from '@/stores/family.store';

const SCREEN_W = Dimensions.get('window').width;
const MONTH_DAY_BTN_SIZE = Math.floor((SCREEN_W - 40 - 6 * 5) / 7);

const TYPES: CareType[] = ['meal', 'medicine', 'hospital', 'ear_cleaning', 'bath', 'other'];
const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
  { value: 'custom', label: '직접 설정' },
];
// JS getDay() 기준: 0=일 ~ 6=토
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function defaultTime() {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return d;
}

function formatTimeDisplay(date: Date) {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`;
}

function formatDateDisplay(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function CareAddScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = !!editId;

  const { pets } = usePetStore();
  const { schedules, fetchSchedules } = useCareStore();
  const pet = pets[0];

  const [type, setType] = useState<CareType>('meal');
  const [label, setLabel] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(new Date().getDate());
  const [hasTime, setHasTime] = useState(true);
  const [selectedTime, setSelectedTime] = useState<Date>(defaultTime);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // 편집 모드: 기존 값 채우기
  useEffect(() => {
    if (!isEditMode) return;
    const s = schedules.find(sc => sc.id === editId);
    if (!s) return;
    setType(s.type);
    // 자동 생성 라벨이 아닌 경우만 채움
    setLabel(s.label !== CARE_TYPE_META[s.type].label ? s.label : '');
    setFrequency(s.frequency);
    if (s.days_of_week?.length) setDaysOfWeek(s.days_of_week);
    if (s.frequency === 'monthly') setDayOfMonth(new Date(s.next_due_at).getDate());
    const d = new Date(s.next_due_at);
    const noTime = d.getHours() === 0 && d.getMinutes() === 0;
    setHasTime(!noTime);
    if (!noTime) setSelectedTime(d);
    if (s.frequency === 'custom') setSelectedDate(d);
    setNotes(s.notes ?? '');
  }, [editId]);

  function onTimeChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) setSelectedTime(date);
  }

  function onDateChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setSelectedDate(date);
  }

  function buildNextDueAt(): string {
    let base: Date;
    if (frequency === 'custom') {
      base = new Date(selectedDate);
    } else if (frequency === 'weekly' && daysOfWeek.length > 0) {
      const today = new Date().getDay();
      const sorted = [...daysOfWeek].sort((a, b) => a - b);
      const nextDay = sorted.find(day => day >= today) ?? sorted[0];
      const daysUntil = nextDay >= today ? nextDay - today : 7 - today + nextDay;
      base = new Date();
      base.setDate(base.getDate() + daysUntil);
    } else if (frequency === 'monthly') {
      const now = new Date();
      let year = now.getFullYear();
      let month = now.getMonth();
      if (now.getDate() >= dayOfMonth) {
        month += 1;
        if (month > 11) { month = 0; year += 1; }
      }
      base = new Date(year, month, dayOfMonth);
    } else {
      base = new Date();
    }
    if (hasTime) {
      base.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    } else {
      base.setHours(0, 0, 0, 0);
    }
    return base.toISOString();
  }

  async function handleSave() {
    if (!pet) { Alert.alert('반려동물을 먼저 등록해주세요.'); return; }
    if (frequency === 'weekly' && daysOfWeek.length === 0) {
      Alert.alert('요일 선택', '매주 반복할 요일을 하나 이상 선택해주세요.');
      return;
    }
    const finalLabel = label.trim() || CARE_TYPE_META[type].label;
    const nextDueAt = buildNextDueAt();
    const days = frequency === 'weekly' && daysOfWeek.length > 0 ? daysOfWeek : null;
    const payload = { type, label: finalLabel, frequency, days_of_week: days, next_due_at: nextDueAt, notes: notes.trim() || null };

    setLoading(true);
    const { family, myUserId } = useFamilyStore.getState();

    if (isEditMode && editId) {
      const { data: updated, error } = await supabase
        .from('care_schedules').update(payload).eq('id', editId).select().single();
      setLoading(false);
      if (error || !updated) {
        Alert.alert('수정 실패', '잠시 후 다시 시도해주세요.');
      } else {
        await cancelNotification(editId);
        if (hasTime) await scheduleNotification(updated, pet.name);
        await fetchSchedules(pet.id);
        router.back();
      }
    } else {
      const { data: inserted, error } = await supabase
        .from('care_schedules').insert({ pet_id: pet.id, ...payload }).select().single();
      setLoading(false);
      if (error || !inserted) {
        Alert.alert('저장 실패', '잠시 후 다시 시도해주세요.');
      } else {
        if (hasTime) await scheduleNotification(inserted, pet.name);
        if (family && myUserId) notifyFamilyNewCare(family.id, myUserId, finalLabel, pet.name);
        await fetchSchedules(pet.id);
        router.back();
      }
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtn}>← 취소</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditMode ? '케어 수정' : '케어 추가'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 종류 */}
        <Text style={styles.sectionLabel}>케어 종류 *</Text>
        <View style={styles.typeGrid}>
          {TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, type === t && styles.typeBtnActive]}
              onPress={() => setType(t)}
            >
              <Image source={CARE_TYPE_IMAGES[t]} style={styles.typeImage} />
              <Text style={[styles.typeLabel, type === t && styles.typeLabelActive]}>
                {CARE_TYPE_META[t].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 이름 */}
        <Text style={styles.sectionLabel}>이름 <Text style={styles.optional}>(선택, 비우면 자동)</Text></Text>
        <TextInput
          style={styles.input}
          placeholder={`예) ${CARE_TYPE_META[type].label}`}
          placeholderTextColor={Colors.light}
          value={label}
          onChangeText={setLabel}
        />

        {/* 주기 */}
        <Text style={styles.sectionLabel}>주기 *</Text>
        <View style={styles.freqRow}>
          {FREQUENCIES.map(f => (
            <TouchableOpacity
              key={f.value}
              style={[styles.freqBtn, frequency === f.value && styles.freqBtnActive]}
              onPress={() => setFrequency(f.value)}
            >
              <Text style={[styles.freqLabel, frequency === f.value && styles.freqLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 매주: 요일 선택 */}
        {frequency === 'weekly' && (
          <>
            <Text style={styles.sectionLabel}>요일 선택 *</Text>
            <View style={styles.dayRow}>
              {DAY_LABELS.map((dayName, day) => {
                const active = daysOfWeek.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayBtn, active && styles.dayBtnActive]}
                    onPress={() =>
                      setDaysOfWeek(prev =>
                        active ? prev.filter(d => d !== day) : [...prev, day],
                      )
                    }
                  >
                    <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{dayName}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* 매월: 일(day) 선택 */}
        {frequency === 'monthly' && (
          <>
            <Text style={styles.sectionLabel}>날짜 선택 * <Text style={styles.optional}>(매달 {dayOfMonth}일)</Text></Text>
            <View style={styles.monthDayGrid}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                const active = dayOfMonth === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.monthDayBtn, active && styles.dayBtnActive]}
                    onPress={() => setDayOfMonth(day)}
                  >
                    <Text style={[styles.monthDayLabel, active && styles.dayLabelActive]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* 직접 설정: 날짜 선택 */}
        {frequency === 'custom' && (
          <>
            <Text style={styles.sectionLabel}>날짜 선택</Text>
            {/* Android: 버튼 탭 → 날짜 다이얼로그 */}
            {Platform.OS === 'android' && (
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.datePickerBtnText}>{formatDateDisplay(selectedDate)}</Text>
                <Text style={styles.pickerIcon}>📅</Text>
              </TouchableOpacity>
            )}
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={onDateChange}
              />
            )}
            {/* iOS: 인라인 캘린더 */}
            {Platform.OS === 'ios' && (
              <View style={styles.iosCalendarWrapper}>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={onDateChange}
                  accentColor={Colors.primary}
                  style={{ width: '100%' }}
                />
              </View>
            )}
          </>
        )}

        {/* 시간 */}
        <Text style={styles.sectionLabel}>시간</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeToggle}>
            <Text style={[styles.timeToggleLabel, !hasTime && styles.timeToggleLabelActive]}>오늘 중</Text>
            <Switch
              value={hasTime}
              onValueChange={setHasTime}
              trackColor={{ false: Colors.primary, true: Colors.border }}
              thumbColor={Colors.white}
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
            <Text style={[styles.timeToggleLabel, hasTime && styles.timeToggleLabelActive]}>시간 지정</Text>
          </View>

          {hasTime && Platform.OS === 'android' && (
            <TouchableOpacity style={styles.timePickerBtn} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.timePickerBtnText}>{formatTimeDisplay(selectedTime)}</Text>
              <Text style={styles.pickerIcon}>🕐</Text>
            </TouchableOpacity>
          )}
          {showTimePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display="default"
              onChange={onTimeChange}
              minuteInterval={5}
            />
          )}
          {hasTime && Platform.OS === 'ios' && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display="spinner"
              onChange={onTimeChange}
              minuteInterval={5}
              style={{ height: 120 }}
            />
          )}

          {!hasTime && (
            <View style={styles.noTimeBox}>
              <Text style={styles.noTimeText}>하루 중 언제든지 완료하면 돼요</Text>
            </View>
          )}
        </View>

        {/* 메모 */}
        <Text style={styles.sectionLabel}>메모 <Text style={styles.optional}>(선택)</Text></Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="추가 내용"
          placeholderTextColor={Colors.light}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveBtnText}>{isEditMode ? '수정하기' : '저장하기'}</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: { fontSize: 15, color: Colors.primary, fontWeight: '600', width: 60 },
  title: { fontSize: 17, fontWeight: '800', color: Colors.text },

  content: { padding: 20, gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.sub, marginTop: 8 },
  optional: { fontWeight: '400', color: Colors.light },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  typeBtn: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.button,
    paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', gap: 4, backgroundColor: Colors.white, minWidth: 72,
  },
  typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  typeImage: { width: 44, height: 44 },
  typeLabel: { fontSize: 11, fontWeight: '600', color: Colors.sub },
  typeLabelActive: { color: Colors.primary },

  freqRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  freqBtn: {
    flex: 1, paddingVertical: 11,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.button,
    alignItems: 'center', backgroundColor: Colors.white,
  },
  freqBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  freqLabel: { fontSize: 13, fontWeight: '600', color: Colors.sub },
  freqLabelActive: { color: Colors.primary },

  dayRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  dayBtn: {
    flex: 1, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.button,
    alignItems: 'center', backgroundColor: Colors.white,
  },
  dayBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  dayLabel: { fontSize: 13, fontWeight: '700', color: Colors.sub },
  dayLabelActive: { color: Colors.primary },

  monthDayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 4 },
  monthDayBtn: {
    width: MONTH_DAY_BTN_SIZE, height: MONTH_DAY_BTN_SIZE,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.button,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white,
  },
  monthDayLabel: { fontSize: 13, fontWeight: '700', color: Colors.sub },

  datePickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight, borderRadius: Radius.button,
    paddingHorizontal: 20, paddingVertical: 16,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  datePickerBtnText: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  iosCalendarWrapper: {
    backgroundColor: Colors.white, borderRadius: Radius.card,
    overflow: 'hidden', borderWidth: 1.5, borderColor: Colors.border,
  },

  pickerIcon: { fontSize: 20 },

  timeRow: { gap: 10, marginBottom: 4 },
  timeToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: Radius.button,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  timeToggleLabel: { fontSize: 13, fontWeight: '600', color: Colors.light },
  timeToggleLabelActive: { color: Colors.primary },

  timePickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight, borderRadius: Radius.button,
    paddingHorizontal: 20, paddingVertical: 16,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  timePickerBtnText: { fontSize: 22, fontWeight: '800', color: Colors.primary },

  noTimeBox: {
    backgroundColor: Colors.border, borderRadius: Radius.button,
    paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center',
  },
  noTimeText: { fontSize: 13, color: Colors.sub, fontWeight: '600' },

  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.button,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.white, marginBottom: 4,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.button,
    paddingVertical: 16, alignItems: 'center', marginTop: 16,
    ...Shadow.card, shadowColor: Colors.primary, shadowOpacity: 0.35,
  },
  saveBtnDisabled: { backgroundColor: Colors.light, shadowOpacity: 0 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },
});
