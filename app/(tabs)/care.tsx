import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore } from '@/stores/pet.store';
import { useCareStore, CARE_TYPE_META, CARE_TYPE_IMAGES, isDoneToday, CareSchedule, Frequency } from '@/stores/schedule.store';

type Tab = 'today' | 'week' | 'all';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: '오늘' },
  { id: 'week', label: '이번 주' },
  { id: 'all', label: '전체' },
];

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + (6 - now.getDay()));
  weekEnd.setHours(23, 59, 59, 999);
  return d <= weekEnd;
}

function isToday(dateStr: string): boolean {
  return dateStr.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function filterByTab(schedules: CareSchedule[], tab: Tab): CareSchedule[] {
  if (tab === 'all') return schedules;
  if (tab === 'today') {
    return schedules.filter(s => s.frequency === 'daily' || isToday(s.next_due_at));
  }
  return schedules.filter(s =>
    s.frequency === 'daily' || s.frequency === 'weekly' || isThisWeek(s.next_due_at),
  );
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
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [deleteMode, setDeleteMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { pets } = usePetStore();
  const { schedules, loading, fetchSchedules, markDone, markUndone, deleteSchedule } = useCareStore();
  const pet = pets[0] ?? null;

  useEffect(() => {
    if (pet) fetchSchedules(pet.id);
  }, [pet?.id]);

  const filtered = filterByTab(schedules, activeTab);
  const doneCount = filtered.filter(isDoneToday).length;

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
    <SafeAreaView style={styles.safe}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>케어 관리</Text>
          {deleteMode ? (
            <TouchableOpacity onPress={exitDeleteMode} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>완료</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={enterDeleteMode} style={styles.headerBtn}>
              <Text style={styles.trashIcon}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.tabRow}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab.id} style={styles.tabBtn} onPress={() => setActiveTab(tab.id)}>
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              <View style={[styles.tabUnderline, activeTab === tab.id && styles.tabUnderlineActive]} />
            </TouchableOpacity>
          ))}
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
            <Text style={styles.counterSub}> / 총 {filtered.length}개</Text>
          </View>
        )}
      </View>

      {/* 목록 */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🐾</Text>
          <Text style={{ fontSize: 15, color: Colors.sub, fontWeight: '600' }}>
            {pet ? '케어 일정을 추가해보세요' : '반려동물을 먼저 등록해주세요'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {filtered.map(item => {
            const done = isDoneToday(item);
            const meta = CARE_TYPE_META[item.type];
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
                {/* 삭제 모드: 체크박스 */}
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

                {/* 일반 모드: 완료 체크서클 */}
                {!deleteMode && (
                  <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
                    {done && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
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

      {/* 일반 모드: FAB */}
      {!deleteMode && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/care-add')}>
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
    paddingTop: 16, paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  headerBtn: { padding: 4 },
  headerBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  trashIcon: { fontSize: 20 },

  tabRow: { flexDirection: 'row' },
  tabBtn: { flex: 1, alignItems: 'center' },
  tabLabel: { fontSize: 14, fontWeight: '700', color: Colors.sub, paddingVertical: 10 },
  tabLabelActive: { color: Colors.primary },
  tabUnderline: { height: 2.5, width: '100%', backgroundColor: 'transparent' },
  tabUnderlineActive: { backgroundColor: Colors.primary },

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

  content: { paddingHorizontal: 20, paddingTop: 6, gap: 10 },

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
});
