import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  SurveyAnswers,
  HousingType,
  HomeTime,
  ActivityLevel,
  ExperienceLevel,
  BudgetLevel,
  FamilyType,
  SheddingPreference,
} from '@/types/breed';

// ─── 설문 데이터 ────────────────────────────────────────────

type Question =
  | { key: 'q1_housing'; title: string; options: { label: string; value: HousingType }[] }
  | { key: 'q2_home_time'; title: string; options: { label: string; value: HomeTime }[] }
  | { key: 'q3_activity'; title: string; options: { label: string; value: ActivityLevel }[] }
  | { key: 'q4_experience'; title: string; options: { label: string; value: ExperienceLevel }[] }
  | { key: 'q5_budget'; title: string; options: { label: string; value: BudgetLevel }[] }
  | { key: 'q6_family'; title: string; multi: true; options: { label: string; value: FamilyType }[] }
  | { key: 'q7_shedding'; title: string; options: { label: string; value: SheddingPreference }[] };

const QUESTIONS: Question[] = [
  {
    key: 'q1_housing',
    title: '어디서 생활하고 계세요?',
    options: [
      { label: '소형 아파트', value: 'small_apt' },
      { label: '대형 아파트', value: 'large_apt' },
      { label: '마당 없는 주택', value: 'house_no_yard' },
      { label: '마당 있는 주택', value: 'house_with_yard' },
    ],
  },
  {
    key: 'q2_home_time',
    title: '하루 중 집에 있는 시간이 얼마나 되나요?',
    options: [
      { label: '거의 항상 집에 있어요', value: 'always' },
      { label: '하루 4~6시간', value: '4_6_hours' },
      { label: '저녁에만 돌아와요', value: 'evening_only' },
      { label: '출장이나 외출이 잦아요', value: 'frequent_travel' },
    ],
  },
  {
    key: 'q3_activity',
    title: '평소 활동량이 어느 정도예요?',
    options: [
      { label: '집에서 쉬는 걸 좋아해요', value: 'couch' },
      { label: '가끔 산책·운동해요', value: 'occasional' },
      { label: '매일 운동하는 편이에요', value: 'active' },
    ],
  },
  {
    key: 'q4_experience',
    title: '반려동물을 키워본 적 있나요?',
    options: [
      { label: '처음이에요', value: 'never' },
      { label: '오래전에 키워봤어요', value: 'long_ago' },
      { label: '키워본 적 있어요', value: 'some' },
      { label: '경험이 많아요', value: 'experienced' },
    ],
  },
  {
    key: 'q5_budget',
    title: '한 달 반려동물 관련 예산은요?',
    options: [
      { label: '5만원 이하', value: 'under_5' },
      { label: '5만~15만원', value: '5_to_15' },
      { label: '15만~30만원', value: '15_to_30' },
      { label: '30만원 이상', value: 'over_30' },
    ],
  },
  {
    key: 'q6_family',
    title: '함께 사는 가족 구성을 알려주세요',
    multi: true,
    options: [
      { label: '영유아·어린이가 있어요', value: 'infant_child' },
      { label: '어르신이 계세요', value: 'elderly' },
      { label: '성인만 있어요', value: 'adult_only' },
      { label: '알레르기가 있는 가족이 있어요', value: 'allergy' },
    ],
  },
  {
    key: 'q7_shedding',
    title: '털 빠짐에 대한 생각은요?',
    options: [
      { label: '상관없어요', value: 'ok' },
      { label: '적당히 빠지는 건 괜찮아요', value: 'moderate' },
      { label: '최소화했으면 해요', value: 'minimal' },
      { label: '거의 없는 견종이면 좋겠어요', value: 'none' },
    ],
  },
];

// ─── 컴포넌트 ────────────────────────────────────────────────

type PartialAnswers = {
  q1_housing?: HousingType;
  q2_home_time?: HomeTime;
  q3_activity?: ActivityLevel;
  q4_experience?: ExperienceLevel;
  q5_budget?: BudgetLevel;
  q6_family?: FamilyType[];
  q7_shedding?: SheddingPreference;
};

export default function SurveyScreen() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<PartialAnswers>({});

  const question = QUESTIONS[step];
  const isMulti = 'multi' in question && question.multi;
  const currentMulti = (answers.q6_family ?? []) as FamilyType[];

  function handleSingleSelect(value: string) {
    const updated = { ...answers, [question.key]: value };
    setAnswers(updated);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      navigate(updated);
    }
  }

  function toggleMulti(value: FamilyType) {
    const next = currentMulti.includes(value)
      ? currentMulti.filter((v) => v !== value)
      : [...currentMulti, value];
    setAnswers({ ...answers, q6_family: next });
  }

  function confirmMulti() {
    const selected = currentMulti.length > 0 ? currentMulti : ['adult_only' as FamilyType];
    const updated = { ...answers, q6_family: selected };
    setAnswers(updated);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      navigate(updated);
    }
  }

  function navigate(finalAnswers: PartialAnswers) {
    const complete = finalAnswers as SurveyAnswers;
    router.push({
      pathname: '/(onboarding)/result',
      params: { answers: JSON.stringify(complete) },
    });
  }

  function goBack() {
    if (step === 0) {
      router.back();
    } else {
      setStep(step - 1);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* 상단 바 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / QUESTIONS.length) * 100}%` }]} />
        </View>
        <Text style={styles.stepText}>{step + 1} / {QUESTIONS.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.question}>{question.title}</Text>

        {isMulti ? (
          <>
            {(question as Extract<Question, { multi: true }>).options.map((opt) => {
              const selected = currentMulti.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => toggleMulti(opt.value)}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {opt.label}
                  </Text>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.confirmButton} onPress={confirmMulti}>
              <Text style={styles.confirmButtonText}>다음</Text>
            </TouchableOpacity>
          </>
        ) : (
          (question as Exclude<Question, { multi: true }>).options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.option}
              onPress={() => handleSingleSelect(opt.value)}
            >
              <Text style={styles.optionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 },
  backButton: { width: 36, alignItems: 'center' },
  backText: { fontSize: 28, color: '#333', lineHeight: 32 },
  progressBar: { flex: 1, height: 6, backgroundColor: '#eee', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4A90E2', borderRadius: 3 },
  stepText: { fontSize: 13, color: '#888', width: 36, textAlign: 'right' },
  content: { padding: 24, paddingTop: 32 },
  question: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 32, lineHeight: 32 },
  option: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionSelected: { borderColor: '#4A90E2', backgroundColor: '#EBF4FF' },
  optionText: { fontSize: 16, color: '#333', fontWeight: '500' },
  optionTextSelected: { color: '#4A90E2', fontWeight: '600' },
  checkmark: { fontSize: 18, color: '#4A90E2' },
  confirmButton: {
    backgroundColor: '#4A90E2',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
