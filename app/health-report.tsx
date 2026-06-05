import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore } from '@/stores/pet.store';
import { useHealthReportStore } from '@/stores/health-report.store';

function getLastMonths(count: number): { label: string; value: string }[] {
  const months: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.push({
      label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
      value: `${d.getFullYear()}-${mm}-01`,
    });
  }
  return months;
}

function formatDistance(km: number | null): string {
  if (km == null) return '-';
  return km >= 1 ? `${km.toFixed(1)}km` : `${Math.round(km * 1000)}m`;
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '-';
  if (minutes < 60) return `${minutes}분`;
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

export default function HealthReportScreen() {
  const months = getLastMonths(6);
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);

  const { pets } = usePetStore();
  const pet = pets[0] ?? null;
  const { reports, loading, generating, fetchReport, generateReport } = useHealthReportStore();
  const report = reports[selectedMonth];

  useEffect(() => {
    if (pet) fetchReport(pet.id, selectedMonth);
  }, [pet?.id, selectedMonth]);

  const completionRate = report?.completion_rate;
  const hasData = report != null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>월간 건강 리포트</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* 월 선택 */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthRow}
        >
          {months.map(m => (
            <TouchableOpacity
              key={m.value}
              style={[styles.monthChip, selectedMonth === m.value && styles.monthChipActive]}
              onPress={() => setSelectedMonth(m.value)}
            >
              <Text style={[styles.monthChipText, selectedMonth === m.value && styles.monthChipTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : !hasData ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>리포트가 없어요</Text>
            <Text style={styles.emptySub}>
              {`${months.find(m => m.value === selectedMonth)?.label ?? ''} 데이터로\n리포트를 생성할 수 있어요`}
            </Text>
            <TouchableOpacity
              style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
              onPress={() => pet && generateReport(pet.id, selectedMonth)}
              disabled={generating || !pet}
            >
              {generating
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.generateBtnText}>리포트 생성하기</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* 케어 완료율 카드 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏆 케어 완료율</Text>
              <View style={styles.rateRow}>
                <Text style={styles.rateNumber}>
                  {completionRate != null ? `${completionRate}%` : '-'}
                </Text>
                {report.avg_delay_days != null && (
                  <View style={styles.delayStat}>
                    <Text style={styles.delayLabel}>평균 지연</Text>
                    <Text style={styles.delayValue}>{report.avg_delay_days.toFixed(1)}일</Text>
                  </View>
                )}
              </View>
              {completionRate != null && (
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, completionRate)}%` as any }]} />
                </View>
              )}
            </View>

            {/* 산책 통계 카드 */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🐾 산책 기록</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{report.total_walks ?? 0}회</Text>
                  <Text style={styles.statLabel}>산책 횟수</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatDistance(report.total_distance)}</Text>
                  <Text style={styles.statLabel}>총 거리</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatDuration(report.total_duration)}</Text>
                  <Text style={styles.statLabel}>총 시간</Text>
                </View>
              </View>
            </View>

            {/* AI 요약 */}
            {report.ai_summary && (
              <View style={styles.aiCard}>
                <Text style={styles.aiLabel}>AI 종합 평가</Text>
                <Text style={styles.aiText}>{report.ai_summary}</Text>
              </View>
            )}
          </>
        )}

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
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  backIcon: { fontSize: 28, color: Colors.text, lineHeight: 32 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },

  scroll: { paddingBottom: 40 },

  monthRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  monthChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  monthChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthChipText: { fontSize: 13, fontWeight: '600', color: Colors.sub },
  monthChipTextActive: { color: Colors.white },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 14, color: Colors.sub, textAlign: 'center', lineHeight: 22 },
  generateBtn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: Radius.button,
    paddingHorizontal: 28, paddingVertical: 14,
    ...Shadow.card,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
  },
  generateBtnDisabled: { backgroundColor: Colors.light, shadowOpacity: 0 },
  generateBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },

  card: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 18,
    ...Shadow.sm,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 14 },

  rateRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  rateNumber: { fontSize: 42, fontWeight: '800', color: Colors.primary, lineHeight: 48 },
  delayStat: { alignItems: 'flex-end', paddingBottom: 4 },
  delayLabel: { fontSize: 12, color: Colors.sub },
  delayValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  progressBg: {
    height: 10, borderRadius: 5,
    backgroundColor: Colors.primaryLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10, borderRadius: 5,
    backgroundColor: Colors.primary,
  },

  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.sub },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  aiCard: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: '#F0F4FF',
    borderRadius: Radius.card,
    padding: 18,
    borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  aiLabel: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginBottom: 8 },
  aiText: { fontSize: 14, color: Colors.text, lineHeight: 22 },
});
