import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore } from '@/stores/pet.store';
import { useCareStore, CARE_TYPE_IMAGES, isDoneToday, localDateStr, CareSchedule, Frequency } from '@/stores/schedule.store';

function formatUpcomingDate(iso: string): string {
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (dueDay.getTime() === tomorrow.getTime()) return '내일';

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  if (dueDay > today && dueDay <= endOfWeek) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `이번 주 ${days[due.getDay()]}요일`;
  }

  return `${due.getMonth() + 1}월 ${due.getDate()}일`;
}

function sortCareItems(items: CareSchedule[]): CareSchedule[] {
  return [...items].sort((a, b) => {
    const aDone = isDoneToday(a);
    const bDone = isDoneToday(b);
    if (aDone !== bDone) return aDone ? 1 : -1;
    return new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime();
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return '오늘 중';
  const mm = m.toString().padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 || 12;
  return mm === '00' ? `${ampm} ${h12}시` : `${ampm} ${h12}:${mm}`;
}

export default function CareScreen() {
  const [deleteMode, setDeleteMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { pets } = usePetStore();
  const { schedules, loading, fetchSchedules, markDone, markUndone, deleteSchedule, careStreak } = useCareStore();
  const pet = pets[0] ?? null;

  const bannerAnim = useRef(new Animated.Value(0)).current;
  const prevAllDone = useRef(true);

  const todayStr = localDateStr();

  const todayItems = schedules.filter(s =>
    s.frequency === 'daily' ||
    localDateStr(new Date(s.next_due_at)) <= todayStr ||
    (s.last_done_at !== null && localDateStr(new Date(s.last_done_at)) === todayStr),
  );
  const allTodayDone = todayItems.length > 0 && todayItems.every(isDoneToday);
  const doneCount = todayItems.filter(isDoneToday).length;
  const todaySorted = sortCareItems(todayItems);

  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const sevenDaysStr = localDateStr(sevenDaysLater);

  const upcomingItems = schedules
    .filter(s => {
      if (s.frequency === 'daily') return false;
      const due = localDateStr(new Date(s.next_due_at));
      return due > todayStr && due <= sevenDaysStr;
    })
    .sort((a, b) => new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime());

  useEffect(() => {
    if (!prevAllDone.current && allTodayDone) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      bannerAnim.setValue(0);
      Animated.sequence([
        Animated.timing(bannerAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
    prevAllDone.current = allTodayDone;
  }, [allTodayDone]);

  useEffect(() => {
    if (pet) fetchSchedules(pet.id);
  }, [pet?.id]);

  function enterDeleteMode() {
    setDeleteMode(true);
    setSelected(new Set());
  }

  function exitDeleteMode() {
    setDeleteMode(false);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) { exitDeleteMode(); return; }
    Alert.alert('삭제', `선택한 ${selected.size}개를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          for (const id of selected) await deleteSchedule(id);
          exitDeleteMode();
        },
      },
    ]);
  }

  async function toggle(s: CareSchedule) {
    if (isDoneToday(s)) await markUndone(s.id);
    else await markDone(s.id, s.frequency as Frequency);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>케어 관리</Text>
          {deleteMode ? (
            <TouchableOpacity onPress={exitDeleteMode} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>완료</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={enterDeleteMode} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>삭제</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 카운터 / 삭제 모드 안내 */}
      <View style={styles.counterRow}>
        {deleteMode ? (
          <Text style={styles.deleteModeHint}>
            {selected.size > 0 ? `${selected.size}개 선택됨` : '삭제할 항목을 선택하세요'}
          </Text>
        ) : (
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>✅ {doneCount}개 완료</Text>
            <Text style={styles.counterSub}> / 총 {todayItems.length}개</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* 섹션 1: 오늘 케어 */}
          <Text style={styles.sectionHeader}>오늘 케어</Text>

          {todaySorted.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🐾</Text>
              <Text style={styles.emptyText}>
                {pet ? '케어 일정을 추가해보세요' : '반려동물을 먼저 등록해주세요'}
              </Text>
            </View>
          ) : (
            todaySorted.map(item => {
              const done = isDoneToday(item);
              const isSelected = selected.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.itemCard,
                    done && !deleteMode && styles.itemCardDone,
                    isSelected && styles.itemCardSelected,
                  ]}
                  onPress={() => deleteMode ? toggleSelect(item.id) : toggle(item)}
                  onLongPress={() => !deleteMode && router.push({ pathname: '/care-add', params: { id: item.id } })}
                  delayLongPress={400}
                  activeOpacity={0.75}
                >
                  {deleteMode && (
                    <View style={[styles.deleteCheckbox, isSelected && styles.deleteCheckboxSelected]}>
                      {isSelected && <Text style={styles.deleteCheckMark}>✓</Text>}
                    </View>
                  )}
                  <View style={[styles.itemIcon, done && !deleteMode && styles.itemIconDone]}>
                    <Image source={CARE_TYPE_IMAGES[item.type]} style={{ width: 28, height: 28 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, done && !deleteMode && styles.itemLabelDone]}>
                      {item.label}
                    </Text>
                    <Text style={styles.itemTime}>{formatTime(item.next_due_at)}</Text>
                    {item.notes && !done && (
                      <Text style={styles.itemNotes} numberOfLines={1}>{item.notes}</Text>
                    )}
                  </View>
                  {!deleteMode && (
                    <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
                      {done && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}

          {/* 섹션 2: 다가오는 일정 */}
          {upcomingItems.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>다가오는 일정</Text>
              {upcomingItems.map(item => {
                const isSelected = selected.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemCard,
                      styles.itemCardUpcoming,
                      isSelected && styles.itemCardSelected,
                    ]}
                    onPress={() => { if (deleteMode) toggleSelect(item.id); }}
                    onLongPress={() => !deleteMode && router.push({ pathname: '/care-add', params: { id: item.id } })}
                    delayLongPress={400}
                    activeOpacity={deleteMode ? 0.75 : 1}
                  >
                    {deleteMode && (
                      <View style={[styles.deleteCheckbox, isSelected && styles.deleteCheckboxSelected]}>
                        {isSelected && <Text style={styles.deleteCheckMark}>✓</Text>}
                      </View>
                    )}
                    <View style={styles.itemIcon}>
                      <Image source={CARE_TYPE_IMAGES[item.type]} style={{ width: 28, height: 28 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                      <Text style={styles.itemTime}>{formatUpcomingDate(item.next_due_at)}</Text>
                      {item.notes && (
                        <Text style={styles.itemNotes} numberOfLines={1}>{item.notes}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <View style={{ height: deleteMode ? 120 : 100 }} />
        </ScrollView>
      )}

      {/* 삭제 모드: 하단 삭제 버튼 */}
      {deleteMode && (
        <View style={styles.deleteBar}>
          <TouchableOpacity
            style={[styles.deleteBarBtn, selected.size === 0 && styles.deleteBarBtnDisabled]}
            onPress={handleDeleteSelected}
            disabled={selected.size === 0}
          >
            <Text style={styles.deleteBarBtnText}>
              {selected.size > 0 ? `${selected.size}개 삭제` : '항목을 선택하세요'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 완료 배너 */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.completionBanner,
          {
            opacity: bannerAnim,
            transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          },
        ]}
      >
        <Text style={styles.completionBannerText}>
          오늘 {pet?.name ?? '반려동물'} 케어 완료! 🎉 연속 {careStreak}일째
        </Text>
      </Animated.View>

      {/* FAB */}
      {!deleteMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            if (!pet) { Alert.alert('반려동물 등록 필요', '케어를 추가하려면 반려동물을 먼저 등록해주세요.'); return; }
            router.push('/care-add');
          }}
        >
          <Text style={styles.fabPlus}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingTop: 16, paddingHorizontal: 20, paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  headerBtn: { padding: 4 },
  headerBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  deleteBtn: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  counterRow: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, minHeight: 38 },
  counterPill: {
    flexDirection: 'row', alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center',
  },
  counterText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  counterSub: { fontSize: 13, color: Colors.sub },
  deleteModeHint: { fontSize: 13, fontWeight: '700', color: Colors.danger, paddingVertical: 6 },

  content: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.sub,
    marginTop: 16,
    marginBottom: 4,
  },

  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 15, color: Colors.sub, fontWeight: '600' },

  itemCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5, borderColor: 'transparent',
    ...Shadow.sm,
  },
  itemCardDone: { opacity: 0.55, borderColor: Colors.border },
  itemCardUpcoming: { opacity: 0.6 },
  itemCardSelected: { borderColor: Colors.danger, backgroundColor: '#FFF5F5' },

  deleteCheckbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  deleteCheckboxSelected: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  deleteCheckMark: { color: Colors.white, fontSize: 12, fontWeight: '800' },

  itemIcon: {
    width: 42, height: 42, borderRadius: Radius.icon,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemIconDone: { backgroundColor: Colors.border },
  itemLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  itemLabelDone: { textDecorationLine: 'line-through', color: Colors.sub },
  itemTime: { fontSize: 12, color: Colors.light, marginTop: 2 },
  itemNotes: { fontSize: 12, color: Colors.sub, marginTop: 3 },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkMark: { color: Colors.white, fontSize: 13, fontWeight: '700' },

  deleteBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 16, paddingBottom: 32,
  },
  deleteBarBtn: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.button,
    paddingVertical: 15,
    alignItems: 'center',
    ...Shadow.card,
    shadowColor: Colors.danger,
    shadowOpacity: 0.3,
  },
  deleteBarBtnDisabled: { backgroundColor: Colors.light, shadowOpacity: 0 },
  deleteBarBtnText: { color: Colors.white, fontSize: 16, fontWeight: '800' },

  fab: {
    position: 'absolute', right: 20, bottom: 94,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.card,
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
  },
  fabPlus: { color: Colors.white, fontSize: 28, fontWeight: '300', lineHeight: 32 },

  completionBanner: {
    position: 'absolute', bottom: 160,
    alignSelf: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 20, paddingVertical: 12,
    ...Shadow.card,
    shadowColor: Colors.accent,
    shadowOpacity: 0.35,
  },
  completionBannerText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});
