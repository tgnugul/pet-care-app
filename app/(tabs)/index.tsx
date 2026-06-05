import { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore, SPECIES_EMOJI, formatDPlus } from '@/stores/pet.store';
import { useCareStore, CARE_TYPE_META, CARE_TYPE_IMAGES, isDoneToday, localDateStr, CareSchedule, Frequency } from '@/stores/schedule.store';
import { useWalkStore } from '@/stores/walk.store';

function getNow() {
  return new Date();
}

function isTodaySchedule(s: CareSchedule) {
  const todayStr = localDateStr();
  return s.frequency === 'daily' || localDateStr(new Date(s.next_due_at)) <= todayStr;
}

function isUpcoming(s: CareSchedule) {
  if (s.frequency === 'daily') return false;
  const due = new Date(s.next_due_at);
  const dayDiff = Math.ceil((due.getTime() - getNow().getTime()) / 86400000);
  return dayDiff > 0 && dayDiff <= 30;
}

function formatDaysUntil(iso: string): string {
  const diff = Math.ceil((new Date(iso).getTime() - getNow().getTime()) / 86400000);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '내일';
  return `${diff}일 후`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return '오늘 중';
  const mm = m.toString().padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  return `${ampm} ${h % 12 || 12}${mm !== '00' ? `:${mm}` : ''}`;
}

function CheckCircle({ done }: { done: boolean }) {
  return (
    <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
      {done && <Text style={styles.checkMark}>✓</Text>}
    </View>
  );
}

export default function HomeScreen() {
  const { pets, loading: petLoading, fetchPets } = usePetStore();
  const { schedules, fetchSchedules, markDone, markUndone, careStreak } = useCareStore();
  const { logs, fetchLogs } = useWalkStore();

  const pet = pets[0] ?? null;

  useEffect(() => { fetchPets(); }, []);
  useEffect(() => { if (pet) fetchSchedules(pet.id); }, [pet?.id]);
  useEffect(() => { fetchLogs(); }, []);

  const todayItems = schedules.filter(isTodaySchedule);
  const upcomingItems = schedules.filter(isUpcoming).slice(0, 3);
  const doneCount = todayItems.filter(isDoneToday).length;

  // 완료 배너
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const prevAllDone = useRef(true);
  const todayStr = localDateStr();
  const allTodayDoneItems = schedules.filter(s =>
    s.frequency === 'daily' ||
    localDateStr(new Date(s.next_due_at)) <= todayStr ||
    (s.last_done_at !== null && localDateStr(new Date(s.last_done_at)) === todayStr),
  );
  const allTodayDone = allTodayDoneItems.length > 0 && allTodayDoneItems.every(isDoneToday);

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
  const dPlus = formatDPlus(pet?.birthday ?? null);

  const weekWalkKm = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekLogs = logs.filter(l => new Date(l.started_at) >= weekStart);
    return weekLogs.length > 0
      ? weekLogs.reduce((sum, l) => sum + l.distance_km, 0)
      : null;
  }, [logs]);

  // 생일 D-7 배너용
  const birthdayDaysLeft = useMemo(() => {
    if (!pet?.birthday) return null;
    const bday = new Date(pet.birthday);
    const now = new Date();
    const thisYear = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
    if (thisYear < now) thisYear.setFullYear(now.getFullYear() + 1);
    const days = Math.ceil((thisYear.getTime() - now.getTime()) / 86400000);
    return days <= 7 ? days : null;
  }, [pet?.birthday]);

  // 가장 가까운 비반복 미완료 일정 (D-X 배너용)
  const nextCare = useMemo(() => {
    return schedules
      .filter(s => s.frequency !== 'daily' && !isDoneToday(s))
      .sort((a, b) => new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime())[0] ?? null;
  }, [schedules]);

  const nextCareDays = useMemo(() => {
    if (!nextCare) return null;
    return Math.ceil((new Date(nextCare.next_due_at).getTime() - getNow().getTime()) / 86400000);
  }, [nextCare]);

  async function toggle(s: CareSchedule) {
    if (isDoneToday(s)) await markUndone(s.id);
    else await markDone(s.id, s.frequency as Frequency);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 헤더 */}
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>

        {/* 반려동물 카드 */}
        {petLoading ? (
          <View style={[styles.petCard, { justifyContent: 'center' }]}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : pet ? (
          <View style={styles.petCard}>
            <View style={styles.petCardCircleBg} />
            <View style={styles.petAvatar}>
              {pet.profile_photo_url
                ? <Image source={{ uri: pet.profile_photo_url }} style={styles.petAvatarPhoto} />
                : <Text style={styles.petAvatarEmoji}>{SPECIES_EMOJI[pet.species]}</Text>
              }
            </View>
            <View>
              <Text style={styles.petCardSub}>나의 반려동물</Text>
              <Text style={styles.petCardName}>{pet.name}</Text>
              <View style={styles.petTagRow}>
                {pet.breed && <View style={styles.petTag}><Text style={styles.petTagText}>{pet.breed}</Text></View>}
                {dPlus && <View style={styles.petTag}><Text style={styles.petTagText}>{dPlus}</Text></View>}
                {careStreak > 0 && (
                  <View style={styles.petTagStreak}>
                    <Text style={styles.petTagStreakText}>🔥 {careStreak}일 연속</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.petCard, { justifyContent: 'center' }]}
            onPress={() => router.push('/(onboarding)/register-pet')}
            activeOpacity={0.85}
          >
            <Text style={{ color: Colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
              반려동물을 등록해주세요 🐾
            </Text>
          </TouchableOpacity>
        )}

        {/* 다음 일정 D-X 배너 */}
        {(() => {
          if (nextCare && nextCareDays !== null && nextCareDays <= 30) {
            return (
              <TouchableOpacity style={styles.nextCareBanner} activeOpacity={0.85} onPress={() => router.push('/(tabs)/care')}>
                <View style={styles.nextCareIcon}>
                  <Image source={CARE_TYPE_IMAGES[nextCare.type]} style={styles.careIconImg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextCareTitle}>
                    다음 {CARE_TYPE_META[nextCare.type].label}
                    {nextCareDays <= 0 ? ' 오늘!' : ` D-${nextCareDays}`}
                  </Text>
                  <Text style={styles.nextCareLabel}>{nextCare.label}</Text>
                </View>
                <Text style={styles.nextCareChevron}>›</Text>
              </TouchableOpacity>
            );
          }
          const remainingToday = todayItems.filter(s => !isDoneToday(s)).length;
          if (remainingToday > 0) {
            return (
              <TouchableOpacity style={styles.nextCareBanner} activeOpacity={0.85} onPress={() => router.push('/(tabs)/care')}>
                <View style={styles.nextCareIcon}>
                  <Text style={{ fontSize: 18 }}>📋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextCareTitle}>오늘 케어 {remainingToday}개 남았어요</Text>
                  <Text style={styles.nextCareLabel}>완료하고 뽀시래기를 건강하게 지켜주세요</Text>
                </View>
                <Text style={styles.nextCareChevron}>›</Text>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity style={styles.nextCareBanner} activeOpacity={0.85} onPress={() => router.push('/(tabs)/care')}>
              <View style={styles.nextCareIcon}>
                <Text style={{ fontSize: 18 }}>✅</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextCareTitle}>
                  {todayItems.length > 0 ? '오늘 케어를 모두 완료했어요!' : '케어 일정을 추가해보세요'}
                </Text>
                <Text style={styles.nextCareLabel}>
                  {todayItems.length > 0 ? '잘 하셨어요 🎉' : '관리 탭에서 일정을 등록할 수 있어요'}
                </Text>
              </View>
              <Text style={styles.nextCareChevron}>›</Text>
            </TouchableOpacity>
          );
        })()}

        {/* 오늘의 케어 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>오늘의 케어</Text>
            <Text style={styles.sectionSub}>{doneCount}/{todayItems.length} 완료</Text>
          </View>
          {todayItems.length === 0 ? (
            <View style={[styles.card, { padding: 20, alignItems: 'center' }]}>
              <Text style={{ color: Colors.light, fontSize: 14 }}>
                {pet ? '케어 스케줄을 추가해보세요' : '반려동물을 먼저 등록해주세요'}
              </Text>
            </View>
          ) : (
            <View style={[styles.card, { overflow: 'hidden' }]}>
              {todayItems.map((item, i) => {
                const done = isDoneToday(item);
                const meta = CARE_TYPE_META[item.type];
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.careRow, i < todayItems.length - 1 && styles.careRowBorder]}
                    onPress={() => toggle(item)}
                    activeOpacity={0.7}
                  >
                    <Image source={CARE_TYPE_IMAGES[item.type]} style={styles.careIconImg} />
                    <View style={styles.careInfo}>
                      <Text style={[styles.careLabel, done && styles.careLabelDone]}>{item.label}</Text>
                      <Text style={styles.careTime}>{formatTime(item.next_due_at)}</Text>
                    </View>
                    <CheckCircle done={done} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* 이번 주 산책 요약 */}
        {weekWalkKm !== null && (
          <TouchableOpacity
            style={styles.walkSummary}
            onPress={() => router.push('/(tabs)/walk')}
            activeOpacity={0.85}
          >
            <Text style={styles.walkSummaryText}>
              🐾 이번 주 {pet?.name ?? '반려동물'}와 {weekWalkKm.toFixed(1)}km
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* 스마트 추천 배너 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>스마트 추천</Text>
          </View>
          <TouchableOpacity
            style={styles.recommendBanner}
            onPress={() => router.push('/recommend')}
            activeOpacity={0.85}
          >
            <View style={styles.recommendLeft}>
              <Text style={styles.recommendEmoji}>
                {birthdayDaysLeft !== null ? '🎂' : '🛒'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              {birthdayDaysLeft !== null ? (
                <>
                  <View style={styles.recommendBadge}>
                    <Text style={styles.recommendBadgeText}>D-{birthdayDaysLeft}</Text>
                  </View>
                  <Text style={styles.recommendTitle}>{pet?.name} 생일 선물 추천</Text>
                </>
              ) : (
                <Text style={styles.recommendTitle}>{pet?.name ?? '반려동물'} 맞춤 추천 보기</Text>
              )}
              <Text style={styles.recommendSub}>사료·용품·입양 정보를 한눈에</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 다가오는 일정 */}
        {upcomingItems.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>다가오는 일정</Text>
            {upcomingItems.map(item => {
              const meta = CARE_TYPE_META[item.type];
              const daysUntil = formatDaysUntil(item.next_due_at);
              const isUrgent = daysUntil === '오늘' || daysUntil === '내일' ||
                (daysUntil.includes('일 후') && parseInt(daysUntil) <= 3);
              return (
                <View key={item.id} style={[styles.card, styles.upcomingRow, { marginBottom: 10 }]}>
                  <View style={[styles.upcomingIcon, { backgroundColor: isUrgent ? '#FFF0F0' : Colors.accentLight }]}>
                    <Image source={CARE_TYPE_IMAGES[item.type]} style={styles.careIconImg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingLabel}>{item.label}</Text>
                    <Text style={[styles.upcomingWhen, { color: isUrgent ? Colors.danger : Colors.accent }]}>
                      {daysUntil}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },

  header: {
    alignItems: 'center',
    paddingTop: 16, paddingBottom: 16,
    backgroundColor: Colors.bg,
  },
  headerLogo: { height: 44, aspectRatio: 1078 / 451 },

  petCard: {
    margin: 20,
    borderRadius: Radius.card + 4,
    padding: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#F5D9B0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
    position: 'relative',
    ...Shadow.card,
  },
  petCardCircleBg: {
    position: 'absolute', right: -20, top: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#FFF0D6',
  },
  petAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  petAvatarEmoji: { fontSize: 32 },
  petAvatarPhoto: { width: 64, height: 64, borderRadius: 32 },
  petCardSub: { fontSize: 12, color: Colors.sub, fontWeight: '600', marginBottom: 2 },
  petCardName: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  petTagRow: { flexDirection: 'row', gap: 8 },
  petTag: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2,
  },
  petTagText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  petTagStreak: {
    backgroundColor: '#FFF0E0',
    borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: '#F5C070',
  },
  petTagStreakText: { fontSize: 11, color: '#C47000', fontWeight: '700' },

  nextCareBanner: {
    marginHorizontal: 20, marginBottom: 4,
    borderRadius: Radius.card,
    padding: 14,
    backgroundColor: '#FFFBF0',
    borderWidth: 1,
    borderColor: '#F5D9B0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadow.sm,
  },
  nextCareIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  nextCareTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  nextCareLabel: { fontSize: 12, color: Colors.sub, marginTop: 2 },
  nextCareChevron: { fontSize: 20, color: Colors.light },

  section: { paddingHorizontal: 20, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  sectionSub: { fontSize: 12, color: Colors.sub },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    ...Shadow.card,
    marginBottom: 16,
  },

  careRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  careRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  careIconImg: { width: 28, height: 28 },
  careInfo: { flex: 1 },
  careLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  careLabelDone: { color: Colors.light, textDecorationLine: 'line-through' },
  careTime: { fontSize: 11, color: Colors.light, marginTop: 2 },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkMark: { color: Colors.white, fontSize: 12, fontWeight: '700' },

  recommendBanner: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    ...Shadow.card,
    marginBottom: 16,
  },
  recommendLeft: {
    width: 44, height: 44, borderRadius: Radius.icon,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  recommendEmoji: { fontSize: 22 },
  recommendBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.danger,
    borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
    marginBottom: 4,
  },
  recommendBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  recommendTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  recommendSub: { fontSize: 12, color: Colors.sub, marginTop: 2 },

  upcomingRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  upcomingIcon: {
    width: 44, height: 44, borderRadius: Radius.icon,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  upcomingLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  upcomingWhen: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  walkSummary: {
    marginHorizontal: 20, marginBottom: 4,
    borderRadius: Radius.card,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.accentLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walkSummaryText: { fontSize: 14, fontWeight: '700', color: Colors.accent },

  chevron: { fontSize: 20, color: Colors.light },

  completionBanner: {
    position: 'absolute', bottom: 100,
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
