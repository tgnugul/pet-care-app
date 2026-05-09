import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getBreedRecommendations } from '@/lib/recommendation';
import { SurveyAnswers, BreedRecommendation } from '@/types/breed';

const SIZE_LABEL = { 1: '소형견', 2: '중형견', 3: '대형견' } as const;

function ScoreBar({ score }: { score: number }) {
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreBarBg}>
        <View style={[styles.scoreBarFill, { width: `${score}%` }]} />
      </View>
      <Text style={styles.scoreText}>{score}점</Text>
    </View>
  );
}

function BreedCard({ item, rank }: { item: BreedRecommendation; rank: number }) {
  const { breed, score, reasons, warnings } = item;
  const rankColors = ['#F5A623', '#9B9B9B', '#CD7F32'];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.rankBadge, { backgroundColor: rankColors[rank] }]}>
          <Text style={styles.rankText}>{rank + 1}위</Text>
        </View>
        <View style={styles.breedInfo}>
          <Text style={styles.breedName}>{breed.name}</Text>
          <Text style={styles.breedMeta}>{breed.nameEn} · {SIZE_LABEL[breed.size]}</Text>
        </View>
        <Text style={styles.costText}>월 {breed.monthlyCostMin}~{breed.monthlyCostMax}만원</Text>
      </View>

      <ScoreBar score={score} />

      <Text style={styles.description}>{breed.description}</Text>

      {reasons.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>추천 이유</Text>
          {reasons.map((r, i) => (
            <Text key={i} style={styles.reasonItem}>✓ {r}</Text>
          ))}
        </View>
      )}

      {warnings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>참고 사항</Text>
          {warnings.map((w, i) => (
            <Text key={i} style={styles.warningItem}>⚠ {w}</Text>
          ))}
        </View>
      )}

      {breed.adoptable && (
        <View style={styles.adoptBadge}>
          <Text style={styles.adoptText}>🏠 유기견 보호소 입양 가능</Text>
        </View>
      )}
    </View>
  );
}

export default function ResultScreen() {
  const { answers: answersParam } = useLocalSearchParams<{ answers: string }>();

  let recommendations: BreedRecommendation[] = [];
  try {
    const answers = JSON.parse(answersParam) as SurveyAnswers;
    recommendations = getBreedRecommendations(answers);
  } catch {
    // 파라미터 파싱 실패 시 빈 결과
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>나에게 맞는 반려견</Text>
        <Text style={styles.subtitle}>설문 결과를 바탕으로 추천드려요</Text>

        {recommendations.map((item, i) => (
          <BreedCard key={item.breed.id} item={item} rank={i} />
        ))}

        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>다시 설문하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.continueText}>반려동물 등록하러 가기 →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f8fa' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#888', marginBottom: 24 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  rankBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  breedInfo: { flex: 1 },
  breedName: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  breedMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  costText: { fontSize: 13, color: '#555', fontWeight: '500' },

  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  scoreBarBg: { flex: 1, height: 8, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: '100%', backgroundColor: '#4A90E2', borderRadius: 4 },
  scoreText: { fontSize: 14, fontWeight: '700', color: '#4A90E2', width: 40, textAlign: 'right' },

  description: { fontSize: 14, color: '#555', lineHeight: 21, marginBottom: 14 },

  section: { marginTop: 4, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  reasonItem: { fontSize: 14, color: '#2E7D32', lineHeight: 22 },
  warningItem: { fontSize: 14, color: '#E65100', lineHeight: 22 },

  adoptBadge: { marginTop: 10, backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, alignItems: 'center' },
  adoptText: { fontSize: 13, color: '#F57F17', fontWeight: '600' },

  retryButton: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 12 },
  retryText: { fontSize: 16, color: '#666', fontWeight: '500' },

  continueButton: { backgroundColor: '#4A90E2', borderRadius: 14, padding: 18, alignItems: 'center' },
  continueText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
