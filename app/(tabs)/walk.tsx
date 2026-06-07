import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore } from '@/stores/pet.store';
import { useWalkStore, calcMonthStats, walkEmoji, formatWalkDate } from '@/stores/walk.store';
import { formatDuration } from '@/lib/gps';
import { getWalkState, type WalkWidgetState } from '@/lib/widget-storage';
import { syncWalkWidgetData } from '@/lib/widget-sync';

function formatTimeRange(startIso: string, endIso: string): string {
  function fmt(iso: string) {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h < 12 ? '오전' : '오후';
    const h12 = h % 12 || 12;
    return m === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}:${String(m).padStart(2, '0')}`;
  }
  return `${fmt(startIso)} ~ ${fmt(endIso)}`;
}

export default function WalkScreen() {
  const { pets, fetchPets } = usePetStore();
  const { logs, loading, fetchLogs, deleteLog } = useWalkStore();
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeWalk, setActiveWalk] = useState<WalkWidgetState | null>(null);
  const [activeElapsed, setActiveElapsed] = useState(0);
  // 펫 로딩이 완료됐는지 추적 — 스토어에 이미 있으면 true로 시작 (홈 탭이 먼저 로드된 경우)
  const [petsReady, setPetsReady] = useState(pets.length > 0);

  useEffect(() => {
    fetchLogs();
    if (pets.length === 0) {
      fetchPets().then(() => setPetsReady(true));
    }
  }, []);


  useFocusEffect(useCallback(() => {
    let elapsedTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function checkWalkState() {
      const state = await getWalkState();
      if (state?.isWalking && state.startedAt) {
        setActiveWalk(state);
        const start = new Date(state.startedAt).getTime();
        setActiveElapsed(Math.floor((Date.now() - start) / 1000));

        elapsedTimer = setInterval(() => {
          setActiveElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);

        pollTimer = setInterval(async () => {
          const updated = await getWalkState();
          if (updated?.isWalking) {
            setActiveWalk(updated);
          } else {
            setActiveWalk(null);
            if (elapsedTimer) clearInterval(elapsedTimer);
            if (pollTimer) clearInterval(pollTimer);
          }
        }, 5000);
      } else {
        setActiveWalk(null);
      }
    }

    checkWalkState();

    return () => {
      if (elapsedTimer) clearInterval(elapsedTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []));

  const pet = pets[0] ?? null;
  const petName = pet?.name ?? '반려동물';
  const stats = calcMonthStats(logs);

  // WalkWidget 동기화 (로그·펫 변경 시)
  useEffect(() => {
    if (Platform.OS !== 'android' || !pet) return;
    (async () => {
      const loc = await Location.getLastKnownPositionAsync({}).catch(() => null);
      syncWalkWidgetData(pet.name, logs, loc?.coords ?? null);
    })();
  }, [logs.length, pet?.id]);
  const recentLogs = logs.slice(0, 10);
  const allSelected = recentLogs.length > 0 && recentLogs.every(l => selectedIds.has(l.id));

  const STATS_DATA = [
    { label: '이번 달 총 거리', value: `${stats.totalDistanceKm.toFixed(1)}km` },
    { label: '이번 달 산책 횟수', value: `${stats.count}회` },
    { label: '하루 평균 산책 시간', value: stats.avgMinutes > 0 ? formatDuration(Math.round(stats.avgMinutes * 60)) : '-' },
  ];

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recentLogs.map(l => l.id)));
    }
  }

  function exitEditMode() {
    setEditMode(false);
    setSelectedIds(new Set());
  }

  function handleDeleteSelected() {
    Alert.alert(
      `산책 기록 ${selectedIds.size}개 삭제`,
      '선택한 기록을 모두 삭제할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await Promise.all([...selectedIds].map(id => deleteLog(id)));
            exitEditMode();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>산책</Text>
      </View>

      {!petsReady ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : !pet ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🐾</Text>
          <Text style={{ fontSize: 15, color: Colors.sub, fontWeight: '600' }}>반려동물을 먼저 등록해주세요</Text>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 산책 시작 / 진행 중 카드 */}
        {activeWalk?.isWalking ? (
          <TouchableOpacity style={styles.activeWalkCard} activeOpacity={0.85} onPress={() => router.push('/walk-active')}>
            <View style={styles.activeWalkHeader}>
              <Text style={styles.activeWalkIndicator}>● 산책 중</Text>
              <Text style={{ fontSize: 30 }}>🐕</Text>
            </View>
            <View style={styles.activeWalkStats}>
              <View style={styles.activeWalkStat}>
                <Text style={styles.activeWalkValue}>{formatDuration(activeElapsed)}</Text>
                <Text style={styles.activeWalkUnit}>시간</Text>
              </View>
              <View style={styles.activeWalkDivider} />
              <View style={styles.activeWalkStat}>
                <Text style={styles.activeWalkValue}>{activeWalk.distanceKm.toFixed(2)}km</Text>
                <Text style={styles.activeWalkUnit}>거리</Text>
              </View>
            </View>
            <Text style={styles.activeWalkHint}>탭해서 산책 화면으로 돌아가기</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.startBtn} activeOpacity={0.85} onPress={() => router.push('/walk-active')}>
            <Text style={styles.startEmoji}>🐕</Text>
            <Text style={styles.startLabel}>산책 시작하기</Text>
            <Text style={styles.startSub}>탭하면 시간과 거리가 자동으로 기록돼요</Text>
          </TouchableOpacity>
        )}

        {/* 이달 통계 */}
        <View style={styles.statsCard}>
          {STATS_DATA.map((s, i) => (
            <View key={i} style={[styles.statItem, i < STATS_DATA.length - 1 && styles.statDivider]}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* 최근 산책 헤더 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>최근 산책</Text>
          {!loading && recentLogs.length > 0 && (
            editMode ? (
              <TouchableOpacity onPress={exitEditMode}>
                <Text style={styles.sectionAction}>취소</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setEditMode(true)}>
                <Text style={styles.sectionAction}>편집</Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {/* 편집 모드 액션 바 */}
        {editMode && recentLogs.length > 0 && (
          <View style={styles.editBar}>
            <TouchableOpacity style={styles.editBarLeft} onPress={toggleSelectAll}>
              <View style={[styles.checkbox, allSelected && styles.checkboxOn]}>
                {allSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.editBarText}>전체 선택</Text>
            </TouchableOpacity>
            {selectedIds.size > 0 && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteSelected}>
                <Text style={styles.deleteBtnText}>{selectedIds.size}개 삭제</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
        ) : recentLogs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>아직 산책 기록이 없어요{'\n'}첫 산책을 시작해볼까요? 🐾</Text>
          </View>
        ) : (
          recentLogs.map((log) => (
            <TouchableOpacity
              key={log.id}
              style={styles.walkCard}
              activeOpacity={0.7}
              onPress={() => {
                if (editMode) toggleSelect(log.id);
                else router.push({ pathname: '/walk-detail', params: { id: log.id } });
              }}
            >
              {editMode && (
                <View style={[styles.checkbox, selectedIds.has(log.id) && styles.checkboxOn]}>
                  {selectedIds.has(log.id) && <Text style={styles.checkmark}>✓</Text>}
                </View>
              )}
              <View style={styles.walkIcon}>
                <Text style={{ fontSize: 22 }}>{walkEmoji(log)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walkDate}>{formatWalkDate(log.started_at)}</Text>
                <Text style={styles.walkTime}>{formatTimeRange(log.started_at, log.ended_at)}</Text>
                <View style={styles.walkMetaRow}>
                  <Text style={styles.walkMeta}>⏱ {formatDuration(Math.round(log.duration_minutes * 60))}</Text>
                  <Text style={styles.walkMeta}>📍 {log.distance_km.toFixed(2)}km</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },

  content: { padding: 20, gap: 16 },

  startBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.card + 4,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
    ...Shadow.card,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
  },
  activeWalkCard: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.card + 4,
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 12,
    ...Shadow.card,
    shadowColor: Colors.accent,
    shadowOpacity: 0.35,
  },
  activeWalkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeWalkIndicator: { fontSize: 13, fontWeight: '700', color: Colors.white },
  activeWalkStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeWalkStat: { flex: 1, alignItems: 'center', gap: 4 },
  activeWalkValue: { fontSize: 28, fontWeight: '800', color: Colors.white },
  activeWalkUnit: { fontSize: 11, color: 'rgba(255,255,255,0.75)' as any },
  activeWalkDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)' as any },
  activeWalkHint: { fontSize: 12, color: 'rgba(255,255,255,0.75)' as any, textAlign: 'center' },

  startEmoji: { fontSize: 40 },
  startLabel: { fontSize: 18, fontWeight: '800', color: Colors.white },
  startSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  statsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    flexDirection: 'row',
    ...Shadow.sm,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statDivider: { borderRightWidth: 1, borderRightColor: Colors.border },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  statLabel: { fontSize: 11, color: Colors.sub, textAlign: 'center' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  sectionAction: { fontSize: 14, fontWeight: '600', color: Colors.primary },

  editBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...Shadow.sm,
  },
  editBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editBarText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  deleteBtn: {
    backgroundColor: Colors.danger,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { fontSize: 12, color: Colors.white, fontWeight: '800' },

  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 24,
    alignItems: 'center',
    ...Shadow.sm,
  },
  emptyText: { fontSize: 14, color: Colors.sub, textAlign: 'center', lineHeight: 22 },

  walkCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...Shadow.sm,
  },
  walkIcon: {
    width: 44, height: 44, borderRadius: Radius.icon,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  walkDate: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  walkTime: { fontSize: 12, color: Colors.sub, marginBottom: 4 },
  walkMetaRow: { flexDirection: 'row', gap: 12 },
  walkMeta: { fontSize: 12, color: Colors.sub },
});
