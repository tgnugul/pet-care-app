export type BreedSize = 1 | 2 | 3; // 1=소형 / 2=중형 / 3=대형

export interface Breed {
  id: string;
  name: string;           // 한국어 견종명
  nameEn: string;         // 영어 견종명
  size: BreedSize;
  /** 활동량: 1(낮음) ~ 5(높음) */
  activityLevel: number;
  /** 털 빠짐: 1(거의 없음) ~ 5(매우 많음) */
  shedding: number;
  /** 그루밍 필요도: 1(거의 없음) ~ 5(매우 높음) */
  groomingNeeds: number;
  /** 어린이 친화도: 1(비추) ~ 5(매우 좋음) */
  childFriendly: number;
  /** 혼자 견디는 능력: 1(분리불안 심함) ~ 5(혼자 잘 지냄) */
  aloneTolerance: number;
  /** 아파트 적합도: 1(부적합) ~ 5(매우 적합) */
  apartmentFit: number;
  /** 초보자 친화도: 1(경험자 필요) ~ 5(초보에게 매우 적합) */
  beginnerFriendly: number;
  /** 월 예상 비용 (단위: 만원) */
  monthlyCostMin: number;
  monthlyCostMax: number;
  /** 저알레르기 여부 */
  allergyFriendly: boolean;
  /** 한 줄 특징 설명 */
  description: string;
  /** 유기견 입양 가능 여부 (보호소에 자주 있는 견종) */
  adoptable: boolean;
}

export type HousingType = 'small_apt' | 'large_apt' | 'house_no_yard' | 'house_with_yard';
export type HomeTime = 'always' | '4_6_hours' | 'evening_only' | 'frequent_travel';
export type ActivityLevel = 'couch' | 'occasional' | 'active';
export type ExperienceLevel = 'never' | 'long_ago' | 'some' | 'experienced';
export type BudgetLevel = 'under_5' | '5_to_15' | '15_to_30' | 'over_30';
export type FamilyType = 'infant_child' | 'elderly' | 'adult_only' | 'allergy';
export type SheddingPreference = 'ok' | 'moderate' | 'minimal' | 'none';

export interface SurveyAnswers {
  q1_housing: HousingType;
  q2_home_time: HomeTime;
  q3_activity: ActivityLevel;
  q4_experience: ExperienceLevel;
  q5_budget: BudgetLevel;
  q6_family: FamilyType[];  // 복수 선택
  q7_shedding: SheddingPreference;
}

export interface BreedRecommendation {
  breed: Breed;
  score: number;        // 0~100
  reasons: string[];    // 추천 이유 목록
  warnings: string[];   // 주의사항
}
