import { useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore, SPECIES_EMOJI, formatAge, formatDPlus, Pet } from '@/stores/pet.store';
import { useCareStore, CARE_TYPE_META, CARE_TYPE_IMAGES, isDoneToday, localDateStr } from '@/stores/schedule.store';
import { useWalkStore } from '@/stores/walk.store';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pets, deletePet } = usePetStore();
  const { schedules, fetchSchedules } = useCareStore();
  const { logs, fetchLogs } = useWalkStore();

  const pet = pets.find(p => p.id === id) ?? null;

  useEffect(() => {
    if (pet) {
      fetchSchedules(pet.id);
      fetchLogs();
    }
  }, [pet?.id]);

  const todayStr = localDateStr();
  const todayItems = schedules.filter(s =>
    s.frequency === 'daily' ||
    localDateStr(new Date(s.next_due_at)) <= todayStr ||
    (s.last_done_at !== null && localDateStr(new Date(s.last_done_at)) === todayStr),
  );
  const todayDone = todayItems.filter(isDoneToday).length;
  const todayTotal = todayItems.length;

  const thisMonthWalks = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return logs.filter(l => l.started_at >= monthStart);
  }, [logs]);

  const totalDistKm = thisMonthWalks.reduce((s, l) => s + l.distance_km, 0);

  function handleDelete() {
    Alert.alert(
      `${pet?.name} 삭제`,
      '삭제하면 모든 케어 일정과 데이터가 함께 삭제됩니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제', style: 'destructive',
          onPress: async () => {
            if (!pet) return;
            await deletePet(pet.id);
            router.back();
          },
        },
      ],
    );
  }

  if (!pet) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={{ color: Colors.sub }}>반려동물을 찾을 수 없어요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const age = formatAge(pet.birthday);
  const dPlus = formatDPlus(pet.birthday);

  return (
    <SafeAreaView style={styles.safe}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet.name}</Text>
        <TouchableOpacity
          onPress={() => router.push(`/pet-edit?id=${pet.id}` as any)}
          style={styles.headerBtn}
        >
          <Text style={styles.headerEditText}>수정</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            {pet.profile_photo_url
              ? <Image source={{ uri: pet.profile_photo_url }} style={styles.avatar} />
              : <Text style={styles.avatarEmoji}>{SPECIES_EMOJI[pet.species]}</Text>
            }
          </View>
          <Text style={styles.petName}>{pet.name}</Text>
          {pet.breed && <Text style={styles.petBreed}>{pet.breed}</Text>}
          <View style={styles.badgeRow}>
            {age && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{age}</Text>
              </View>
            )}
            {dPlus && (
              <View style={[styles.badge, { backgroundColor: Colors.primaryLight }]}>
                <Text style={[styles.badgeText, { color: Colors.primary }]}>{dPlus}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 이번 달 요약 */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{todayDone}/{todayTotal}</Text>
            <Text style={styles.statLabel}>오늘 케어</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{thisMonthWalks.length}회</Text>
            <Text style={styles.statLabel}>이번 달 산책</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{totalDistKm.toFixed(1)}km</Text>
            <Text style={styles.statLabel}>이번 달 거리</Text>
          </View>
        </View>

        {/* 기본 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기본 정보</Text>
          <View style={styles.card}>
            <InfoRow label="종류" value={SPECIES_EMOJI[pet.species] + ' ' + SPECIES_LABEL[pet.species]} />
            {pet.breed && <InfoRow label="품종" value={pet.breed} />}
            {pet.birthday && (
              <>
                <InfoRow label="생일" value={formatBirthday(pet.birthday)} />
                {age && <InfoRow label="나이" value={age} />}
              </>
            )}
            {pet.gender !== null && (
              <InfoRow label="성별" value={pet.gender === 'male' ? '수컷' : '암컷'} />
            )}
            {pet.weight !== null && (
              <InfoRow label="체중" value={`${pet.weight}kg`} />
            )}
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>중성화</Text>
              <Text style={styles.infoValue}>{pet.neutered ? '완료' : '미완료'}</Text>
            </View>
          </View>
        </View>

        {/* 케어 일정 */}
        {schedules.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>케어 일정 ({schedules.length}개)</Text>
            <View style={styles.card}>
              {schedules.slice(0, 5).map((s, i) => (
                <View
                  key={s.id}
                  style={[styles.careRow, i < Math.min(schedules.length, 5) - 1 && styles.rowBorder]}
                >
                  <Image source={CARE_TYPE_IMAGES[s.type]} style={styles.careIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.careLabel}>{s.label}</Text>
                    <Text style={styles.careSub}>{FREQ_LABEL[s.frequency]}</Text>
                  </View>
                  {isDoneToday(s) && (
                    <View style={styles.doneBadge}>
                      <Text style={styles.doneBadgeText}>완료</Text>
                    </View>
                  )}
                </View>
              ))}
              {schedules.length > 5 && (
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={() => router.push('/(tabs)/care')}
                >
                  <Text style={styles.moreBtnText}>+{schedules.length - 5}개 더 보기</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 삭제 */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>반려동물 삭제</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const SPECIES_LABEL: Record<Pet['species'], string> = {
  dog: '강아지', cat: '고양이', rabbit: '토끼', bird: '새', fish: '물고기', other: '기타',
};

const FREQ_LABEL: Record<string, string> = {
  daily: '매일', weekly: '매주', monthly: '매월', custom: '직접 설정',
};

function formatBirthday(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerBtn: { width: 48, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontSize: 28, color: Colors.text, lineHeight: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  headerEditText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },

  profileCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
    margin: 16,
    borderRadius: Radius.card,
    ...Shadow.card,
  },
  avatarWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarEmoji: { fontSize: 48 },
  petName: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  petBreed: { fontSize: 14, color: Colors.sub, marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: Colors.accent },

  statsRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, marginBottom: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadow.sm,
  },
  statNum: { fontSize: 18, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.sub, marginTop: 2 },

  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 10 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...Shadow.card,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: 14, color: Colors.sub },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text },

  careRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  careIcon: { width: 28, height: 28 },
  careLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  careSub: { fontSize: 12, color: Colors.sub, marginTop: 2 },
  doneBadge: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  doneBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.accent },

  moreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  moreBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  deleteBtn: {
    borderWidth: 1.5, borderColor: Colors.danger,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 15, color: Colors.danger, fontWeight: '600' },
});
