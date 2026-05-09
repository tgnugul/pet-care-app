import { BREEDS } from '../data/breeds';
import {
  Breed,
  BreedRecommendation,
  SurveyAnswers,
} from '../types/breed';

// ─── 설문 → 요구 수치 변환 ──────────────────────────────────

function getRequirements(answers: SurveyAnswers) {
  return {
    apartmentFit: getApartmentRequirement(answers.q1_housing),
    aloneTolerance: getAloneRequirement(answers.q2_home_time),
    activityMatch: getActivityRequirement(answers.q3_activity),
    beginnerFriendly: getBeginnerRequirement(answers.q4_experience),
    budgetMax: getBudgetMax(answers.q5_budget),
    needsChildFriendly: answers.q6_family.includes('infant_child'),
    needsAllergyFriendly: answers.q6_family.includes('allergy'),
    sheddingMax: getSheddingMax(answers.q7_shedding),
    hasElderlyMember: answers.q6_family.includes('elderly'),
  };
}

function getApartmentRequirement(housing: SurveyAnswers['q1_housing']): number {
  switch (housing) {
    case 'small_apt':    return 4; // 소형 아파트 → 아파트 적합도 4 이상 필요
    case 'large_apt':    return 3;
    case 'house_no_yard': return 2;
    case 'house_with_yard': return 1;
  }
}

function getAloneRequirement(homeTime: SurveyAnswers['q2_home_time']): number {
  switch (homeTime) {
    case 'always':         return 1; // 항상 집 → 혼자 견디는 능력 덜 중요
    case '4_6_hours':      return 2;
    case 'evening_only':   return 4; // 저녁에만 → 혼자 잘 지내야 함
    case 'frequent_travel': return 5;
  }
}

function getActivityRequirement(activity: SurveyAnswers['q3_activity']): number {
  switch (activity) {
    case 'couch':      return 2; // 원하는 견종 활동량
    case 'occasional': return 3;
    case 'active':     return 4;
  }
}

function getBeginnerRequirement(experience: SurveyAnswers['q4_experience']): number {
  switch (experience) {
    case 'never':      return 4; // 초보자 → 초보친화도 4 이상 필요
    case 'long_ago':   return 3;
    case 'some':       return 2;
    case 'experienced': return 1;
  }
}

function getBudgetMax(budget: SurveyAnswers['q5_budget']): number {
  switch (budget) {
    case 'under_5':  return 5;
    case '5_to_15':  return 15;
    case '15_to_30': return 30;
    case 'over_30':  return 999;
  }
}

function getSheddingMax(shedding: SurveyAnswers['q7_shedding']): number {
  switch (shedding) {
    case 'ok':       return 5;
    case 'moderate': return 3;
    case 'minimal':  return 2;
    case 'none':     return 1;
  }
}

// ─── 견종별 점수 계산 ────────────────────────────────────────

function scoreBreed(breed: Breed, answers: SurveyAnswers): number {
  const req = getRequirements(answers);
  let score = 100;

  // 아파트 적합도 (가중치 높음)
  if (breed.apartmentFit < req.apartmentFit) {
    score -= (req.apartmentFit - breed.apartmentFit) * 15;
  }

  // 혼자 견디는 능력
  if (breed.aloneTolerance < req.aloneTolerance) {
    score -= (req.aloneTolerance - breed.aloneTolerance) * 12;
  }

  // 활동량 매칭 (너무 낮거나 너무 높으면 감점)
  const activityDiff = Math.abs(breed.activityLevel - req.activityMatch);
  score -= activityDiff * 8;

  // 초보자 친화도
  if (breed.beginnerFriendly < req.beginnerFriendly) {
    score -= (req.beginnerFriendly - breed.beginnerFriendly) * 10;
  }

  // 예산 초과 시 감점
  if (breed.monthlyCostMin > req.budgetMax) {
    score -= 30; // 예산 범위 완전 초과
  } else if (breed.monthlyCostMax > req.budgetMax) {
    score -= 10; // 최대 비용이 예산 초과
  }

  // 어린이 친화도 (필수 조건)
  if (req.needsChildFriendly && breed.childFriendly < 3) {
    score -= (3 - breed.childFriendly) * 15;
  }

  // 알레르기 (필수 조건)
  if (req.needsAllergyFriendly && !breed.allergyFriendly) {
    score -= 40;
  }

  // 털 빠짐
  if (breed.shedding > req.sheddingMax) {
    score -= (breed.shedding - req.sheddingMax) * 10;
  }

  // 노인 가족 → 온순하고 활동량 낮은 견종 선호
  if (req.hasElderlyMember && breed.activityLevel >= 4) {
    score -= 10;
  }

  return Math.max(0, Math.round(score));
}

// ─── 추천 이유 & 주의사항 생성 ──────────────────────────────

function buildReasons(breed: Breed, answers: SurveyAnswers): string[] {
  const reasons: string[] = [];

  if (breed.apartmentFit >= 4) reasons.push('실내 생활에 잘 적응해요');
  if (breed.shedding <= 2) reasons.push('털 빠짐이 거의 없어요');
  if (breed.allergyFriendly) reasons.push('알레르기가 있는 가족도 함께 지낼 수 있어요');
  if (breed.childFriendly >= 4) reasons.push('어린이와 잘 어울려요');
  if (breed.beginnerFriendly >= 4) reasons.push('처음 반려견을 키우는 분께 적합해요');
  if (breed.aloneTolerance >= 4) reasons.push('혼자 있는 시간도 잘 견뎌요');

  const activityTarget = getActivityRequirement(answers.q3_activity);
  if (Math.abs(breed.activityLevel - activityTarget) <= 1) {
    reasons.push('보호자의 활동량과 잘 맞아요');
  }

  if (breed.adoptable) reasons.push('유기견 보호소에서 입양할 수 있어요');

  return reasons;
}

function buildWarnings(breed: Breed, answers: SurveyAnswers): string[] {
  const warnings: string[] = [];
  const req = getRequirements(answers);

  if (breed.groomingNeeds >= 4) warnings.push('정기적인 미용(4~6주마다)이 필요해요');
  if (breed.shedding >= 4) warnings.push('털 빠짐이 많아 청소가 자주 필요해요');
  if (breed.aloneTolerance <= 2 && req.aloneTolerance >= 3) {
    warnings.push('혼자 오래 두면 분리불안이 생길 수 있어요');
  }
  if (breed.activityLevel >= 4 && answers.q3_activity === 'couch') {
    warnings.push('충분한 운동을 시켜주지 않으면 스트레스를 받아요');
  }
  if (breed.monthlyCostMax > req.budgetMax) {
    warnings.push(`월 최대 ${breed.monthlyCostMax}만원까지 비용이 발생할 수 있어요`);
  }
  if (breed.beginnerFriendly <= 2 && answers.q4_experience === 'never') {
    warnings.push('초보자에게는 훈육이 다소 어려울 수 있어요');
  }

  return warnings;
}

// ─── 공개 API ────────────────────────────────────────────────

/**
 * 설문 결과를 바탕으로 견종 추천 상위 3개를 반환.
 * API 호출 없이 사전 정의된 데이터 기반으로 즉시 계산.
 */
export function getBreedRecommendations(answers: SurveyAnswers): BreedRecommendation[] {
  const scored = BREEDS.map((breed) => ({
    breed,
    score: scoreBreed(breed, answers),
    reasons: buildReasons(breed, answers),
    warnings: buildWarnings(breed, answers),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
