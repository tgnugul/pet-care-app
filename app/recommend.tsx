import { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/design';
import { usePetStore, Pet } from '@/stores/pet.store';
import { useCareStore, isDoneToday, CareSchedule } from '@/stores/schedule.store';

interface RecommendCard {
  id: string;
  emoji: string;
  badge?: string;
  title: string;
  desc: string;
  cta: string;
  url?: string;
  route?: string;
  badgeColor?: string;
}

function buildCards(
  pet: Pet | null,
  schedules: CareSchedule[],
): RecommendCard[] {
  const cards: RecommendCard[] = [];

  // 1. 생일 D-7 선물 추천
  if (pet?.birthday) {
    const bday = new Date(pet.birthday);
    const now = new Date();
    const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
    if (thisYearBday < now) thisYearBday.setFullYear(now.getFullYear() + 1);
    const daysLeft = Math.ceil((thisYearBday.getTime() - now.getTime()) / 86400000);

    if (daysLeft <= 7) {
      cards.push({
        id: 'birthday',
        emoji: '🎂',
        badge: `D-${daysLeft}`,
        badgeColor: Colors.danger,
        title: `${pet.name}의 생일이 ${daysLeft}일 남았어요!`,
        desc: '특별한 날을 위한 선물 세트를 미리 준비해보세요',
        cta: '선물 보러 가기',
        url: 'https://www.petfriends.co.kr/display/search?keyword=생일선물',
      });
    }
  }

  // 2. 심장사상충 / 기생충 예방약 알림
  const medicineSchedules = schedules.filter(s => s.type === 'medicine' && !isDoneToday(s));
  if (medicineSchedules.length > 0) {
    const next = medicineSchedules[0];
    const daysUntil = Math.ceil((new Date(next.next_due_at).getTime() - Date.now()) / 86400000);
    if (daysUntil <= 7) {
      cards.push({
        id: 'medicine',
        emoji: '💊',
        badge: daysUntil <= 0 ? '오늘' : `${daysUntil}일 후`,
        badgeColor: daysUntil <= 1 ? Colors.danger : Colors.primary,
        title: `${next.label} 시기가 다가왔어요`,
        desc: '펫프렌즈에서 처방전 없이 구매 가능한 구충제를 확인해보세요',
        cta: '약 구경하기',
        url: 'https://www.petfriends.co.kr/display/search?keyword=심장사상충',
      });
    }
  }

  // 3. 사료 정기구독 추천 (상시)
  if (pet) {
    const isSmall = pet.weight !== null && pet.weight < 10;
    cards.push({
      id: 'food',
      emoji: '🍚',
      title: '사료 정기구독으로 10% 절약',
      desc: `${pet.name}의 체형에 맞는 사료를 정기배송으로 받아보세요`,
      cta: '정기구독 알아보기',
      url: `https://www.coupang.com/np/search?q=${encodeURIComponent((isSmall ? '소형견' : '중대형견') + ' 사료')}`,
    });
  }

  // 4. 목욕 / 그루밍 용품 추천
  const bathSchedules = schedules.filter(s => (s.type === 'bath' || s.type === 'nail') && !isDoneToday(s));
  if (bathSchedules.length > 0) {
    cards.push({
      id: 'grooming',
      emoji: '✂️',
      title: '그루밍 용품 특가',
      desc: '집에서도 쉽게 할 수 있는 목욕·발톱 관리 세트를 소개해요',
      cta: '용품 보기',
      url: 'https://www.petfriends.co.kr/display/search?keyword=그루밍',
    });
  }

  // 5. 유기동물 입양 안내
  cards.push({
    id: 'shelter',
    emoji: '🏠',
    title: '입양 기다리는 동물들',
    desc: '전국 보호소에서 가족을 기다리는 아이들을 만나보세요',
    cta: '국가동물보호정보시스템 바로가기',
    url: 'https://www.animal.go.kr/front/awtis/public/publicList.do',
  });

  // 6. 동물병원 방문 추천 (병원 일정 없거나 오래된 경우)
  const hospitalSchedules = schedules.filter(s => s.type === 'hospital');
  if (hospitalSchedules.length === 0) {
    cards.push({
      id: 'hospital',
      emoji: '🏥',
      title: '정기 건강검진 받아보셨나요?',
      desc: '1년에 한 번 건강검진으로 조기 예방이 중요해요',
      cta: '근처 병원 찾기',
      url: 'https://map.naver.com/p/search/동물병원',
    });
  }

  return cards;
}

export default function RecommendScreen() {
  const { pets } = usePetStore();
  const { schedules } = useCareStore();
  const pet = pets[0] ?? null;

  const cards = useMemo(() => buildCards(pet, schedules), [pet, schedules]);

  function handleCta(card: RecommendCard) {
    if (card.route) { router.push(card.route as any); return; }
    if (card.url) { Linking.openURL(card.url); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>맞춤 추천</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          {pet ? `${pet.name}을(를) 위한 추천이에요` : '반려동물 등록 후 맞춤 추천을 받아보세요'}
        </Text>

        {cards.map((card, i) => (
          <TouchableOpacity
            key={card.id}
            style={[styles.card, i === 0 && card.badge && styles.cardHighlight]}
            onPress={() => handleCta(card)}
            activeOpacity={0.8}
          >
            <View style={styles.cardLeft}>
              <View style={[styles.iconBox, i === 0 && card.badge && styles.iconBoxHighlight]}>
                <Text style={styles.emoji}>{card.emoji}</Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              {card.badge && (
                <View style={[styles.badge, { backgroundColor: card.badgeColor ?? Colors.primary }]}>
                  <Text style={styles.badgeText}>{card.badge}</Text>
                </View>
              )}
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.desc}</Text>
              <View style={styles.ctaRow}>
                <Text style={styles.ctaText}>{card.cta}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            * 상품 링크는 제휴 파트너사 연결입니다. 구매 시 뽀시래기 운영에 도움이 돼요 🐾
          </Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  backArrow: { fontSize: 28, color: Colors.text, lineHeight: 30 },
  title: { fontSize: 17, fontWeight: '800', color: Colors.text },

  content: { padding: 20, gap: 14 },
  subtitle: { fontSize: 14, color: Colors.sub, fontWeight: '500', marginBottom: 6 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    ...Shadow.card,
  },
  cardHighlight: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: '#FFFBF4',
  },
  cardLeft: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  iconBox: {
    width: 48, height: 48, borderRadius: Radius.icon,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBoxHighlight: { backgroundColor: '#FFF0CC' },
  emoji: { fontSize: 24 },

  cardBody: { flex: 1 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
    marginBottom: 6,
  },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, lineHeight: 20 },
  cardDesc: { fontSize: 12, color: Colors.sub, marginTop: 4, lineHeight: 17 },
  ctaRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, gap: 4,
  },
  ctaText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  chevron: { fontSize: 16, color: Colors.primary },

  disclaimer: {
    marginTop: 8,
    padding: 14,
    backgroundColor: Colors.bg,
    borderRadius: Radius.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  disclaimerText: { fontSize: 11, color: Colors.light, lineHeight: 16 },
});
