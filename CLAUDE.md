# 뽀시래기 (PawMate) — 반려동물 관리 앱

## 프로젝트 개요

반려동물 입양 전 추천부터 평생 건강 관리까지 커버하는 한국 타겟 모바일 앱.
설문 기반 AI 추천 → 프로필 등록 → 일상 관리 리마인더 → 스마트 커머스 추천의 단계적 흐름.

**타겟 유저**: 반려동물을 처음 키우거나, 체계적인 관리가 필요한 20~40대 한국인
**마켓**: 한국 우선 (공공 API: animal.go.kr, 지역 동물병원 연동)

---

## 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 모바일 | React Native + Expo | iOS/Android 단일 코드베이스, 빠른 MVP |
| 언어 | TypeScript | 타입 안전성, 팀 협업 |
| 상태 관리 | Zustand | 경량, 보일러플레이트 최소 |
| 백엔드 | Supabase (PostgreSQL + Auth + Storage) | BaaS로 MVP 속도 확보 |
| AI 추천 | Claude API (claude-sonnet-4-6) | 설문 분석, 견종 추천, 관리 조언 |
| 알림 | Expo Notifications + Firebase FCM | 리마인더 기능 핵심 |
| 이미지 저장 | Supabase Storage | 반려동물 사진 다이어리 |
| 외부 API | 동물보호관리시스템 API (animal.go.kr) | 유기견보호소 분양 정보 |

---

## 도메인 모델

```
User
├── id, email, created_at
├── lifestyle_profile (설문 결과 JSON)
└── Pets[]

Pet
├── id, user_id
├── name (이름)
├── birthday (생일)
├── species (종: dog | cat | rabbit | fish | bird | other)
├── breed (견종/묘종)
├── gender, weight, neutered
├── profile_photo_url
├── Photos[] (사진 다이어리)
├── CareSchedules[]
└── WalkLogs[]

CareSchedule
├── id, pet_id
├── type (meal | medicine | hospital | ear_cleaning | bath | nail | etc.)
├── frequency (daily | weekly | monthly | custom)
├── next_due_at
├── last_done_at
└── notes

WalkLog (산책 기록)
├── id, pet_id, user_id
├── started_at, ended_at
├── duration_minutes
├── distance_km
├── photos[]
├── route_coordinates (GPS 경로 JSON, 선택)
└── notes

Place (여행지·나들이 장소 — v2.5)
├── id, created_by (user_id)
├── name, category (카페 | 공원 | 숙박 | 식당 | 기타)
├── address, latitude, longitude
├── allowed_pet_size (소형 | 중형 | 대형 | 전체)
├── description
├── photos[]
└── PlaceVisits[]

PlaceVisit (방문 기록 — v2.5)
├── id, user_id, place_id, pet_id
├── visited_at
├── rating (1~5)
├── review
└── photos[]

Recommendation
├── id, pet_id
├── type (food_subscription | gift | hospital_visit | product)
├── title, description, url
├── trigger (birthday | schedule | ai_suggestion | feeding_insight)
└── created_at
```

---

## 서비스 흐름 (구현 순서)

### Phase 1 — 설문 & 추천 (MVP 핵심)
- 라이프스타일 설문 7문항 (한 화면에 한 문항씩)
  - Q1. 거주 형태 (소형 아파트 / 대형 아파트 / 마당 없는 주택 / 마당 있는 주택)
  - Q2. 하루 집에 있는 시간 (항상 / 4~6시간 / 저녁에만 / 출장 잦음)
  - Q3. 보호자 활동량 (집순이·집돌이 / 가끔 산책 / 매일 운동)
  - Q4. 반려동물 경험 (처음 / 오래됨 / 있음 / 많음)
  - Q5. 월 예산 (5만원 이하 / 5~15 / 15~30 / 30만원 이상)
  - Q6. 가족 구성 (영유아·어린이 / 노인 / 성인만 / 알레르기) — 복수 선택
  - Q7. 털 빠짐 허용 범위 (상관없음 / 적당히 / 최소화 / 거의 없는 견종)
- 추천 로직: API 호출 없이 사전 정의 데이터 기반 스코어링 (`lib/recommendation.ts`)
  - 설문 응답 → 요구 수치 변환 → 견종별 점수 계산 → 상위 3개 반환
  - Claude API는 개발 시 견종 특성 수치화에만 1회 사용, 런타임 미사용
- 분양처 안내: 유기견보호소(animal.go.kr API) vs 펫샵

### Phase 2 — 반려동물 프로필 등록
- 다중 반려동물 지원 (최대 1마리 무료, 프리미엄 무제한)
- 이름, 생일, 견종, 성별, 몸무게, 중성화 여부, 프로필 사진

### Phase 3 — 일상 관리 (DAU 확보 핵심)
- 리마인더 설정: 밥, 약, 병원, 귀청소, 목욕, 발톱
- 알림 시간 커스텀, 완료 체크
- 사진 다이어리 (날짜별 사진 + 메모, 무료 500MB)
- 월간 건강 리포트 (프리미엄)

### Phase 3.5 — 산책 기록 (v1.5, DAU 강화)
- 산책 시작/종료 버튼으로 시간·거리 자동 측정 (GPS)
- 산책 중 사진 촬영 및 메모 첨부
- 월간 산책 통계 (총 거리, 횟수, 평균 시간)
- 산책량 기반 간식·용품 추천 연결 (커머스 어필리에이트)

### Phase 4 — 스마트 추천 (수익화 핵심)
- 생일 D-7 선물 추천
- 사료/간식 정기 구독 추천 (펫프렌즈/쿠팡 어필리에이트)
- 예방접종/심장사상충 시기 알림
- 근처 동물병원 추천

### Phase 5 — 여행지 커뮤니티 (v2.5, 네트워크 효과)
- 반려동물 동반 가능 장소 등록·공유 (UGC)
- 카테고리: 카페, 공원, 숙박, 식당, 기타
- 지도 뷰 + 리스트 뷰 (카카오맵 또는 네이버맵 API)
- 방문한 장소 기록 및 후기 작성
- 견종 크기별 필터 (소형견만 가능 장소 등)
- 어뷰징 방지: 신고 기능 + 누적 신고 시 자동 블라인드
- 제휴 장소(펫 카페, 펫 호텔) 우선 노출 → B2B 수익

---

## 디렉토리 구조

```
pet-care-app/
├── app/                    # Expo Router 기반 화면
│   ├── (auth)/             # 로그인/회원가입
│   ├── (onboarding)/       # 설문 & 추천 플로우
│   ├── (tabs)/             # 메인 탭 (홈, 반려동물, 관리, 추천)
│   └── pet/[id]/           # 개별 반려동물 상세
├── components/             # 재사용 UI 컴포넌트
├── data/
│   └── breeds.ts           # 견종 20종 특성 데이터 (사전 정의, 런타임 API 미사용)
├── lib/
│   ├── supabase.ts         # Supabase 클라이언트
│   ├── claude.ts           # Claude API 호출 (개발 시 데이터 생성 전용)
│   ├── recommendation.ts   # 설문 스코어링 알고리즘
│   ├── animal-api.ts       # 동물보호관리시스템 API
│   └── gps.ts              # 산책 GPS 거리 계산 유틸
├── stores/                 # Zustand 상태
│   ├── pet.store.ts
│   ├── user.store.ts
│   ├── schedule.store.ts
│   └── walk.store.ts       # 산책 진행 중 상태 관리
├── types/
│   ├── breed.ts            # Breed, SurveyAnswers, BreedRecommendation 타입
│   ├── walk.ts             # WalkLog 타입
│   ├── place.ts            # Place, PlaceVisit 타입 (v2.5)
│   └── index.ts
└── CLAUDE.md
```

---

## MVP 범위 및 출시 로드맵

| 버전 | 범위 | 목표 기간 |
|------|------|----------|
| v1.0 MVP | 설문 추천 + 프로필 등록 + 리마인더 + 사진 다이어리 | 8주 |
| v1.5 | 분양처 연결 + **산책 기록** | +4주 |
| v2.0 | 네이티브 커머스 추천 + 어필리에이트 본격화 | +6주 |
| v2.5 | B2B 병원·보험 제휴 + 선택적 프리미엄 구독 + **여행지 커뮤니티** | +6주 |

---

## 수익 모델

> **원칙: 무료 유저에게도 광고 없음. 구독은 강제가 아닌 선택.**
> 수익의 중심은 커머스 수수료와 B2B 제휴이며, 구독은 부가 수익.

### 1순위 — 네이티브 커머스 어필리에이트 (메인)

케어 플로우 안에 자연스럽게 녹인 상품 추천. 배너 광고가 아닌 "유용한 알림"으로 노출.

```
예시: "뽀미 심장사상충 약 먹을 시기가 됐어요!"
       → [지금 주문하기] → 펫프렌즈 / 쿠팡 어필리에이트 링크
```

- 사료/간식/용품/의약품 추천 (펫프렌즈, 쿠팡 파트너스)
- 생일 D-7 선물 추천 → 커머스 연결
- 리마인더 트리거 기반이므로 클릭률 높음

### 2순위 — B2B 제휴 (보조)

유저는 돈 안 냄. 파트너사가 비용 부담.

| 파트너 | 모델 | 수익 |
|--------|------|------|
| 동물병원 | 지역 병원 리스팅 + 예약 연동 | 예약 건당 수수료 또는 월 정액 |
| 펫보험사 (삼성화재 등) | 인앱 보험 추천 | 가입 건당 리워드 |
| 사료 브랜드 | 신제품 샘플링 캠페인 | 브랜드가 전액 부담 |
| 익명 데이터 B2B (장기) | 품종별 관리 패턴 | 펫푸드·수의사 협회 제공 |

### 3순위 — 선택적 프리미엄 구독 (부가)

구독 동기가 "광고 제거"가 아니라 "더 쓰고 싶어서"여야 함.
v2.5 이후 도입, 월 1,900원.

| 기능 | 무료 | 프리미엄 |
|------|------|---------|
| 반려동물 등록 | 1마리 | 무제한 |
| 사진 다이어리 | 500MB 저장 | 무제한 저장 |
| 건강 리포트 | 없음 | 월간 PDF |
| 광고 여부 | **없음** | **없음** |

### 수익화 타임라인

```
0~6개월   완전 무료. 유저 확보와 리마인더 습관 형성만 집중.
6~12개월  커머스 어필리에이트 조용히 시작 (리마인더 연동).
12~18개월 B2B 병원·보험 제휴 본격화.
18개월+   프리미엄 구독 추가 (강요 아닌 선택지로).
```

---

## 한국 로컬라이제이션

- 모든 UI/UX는 한국어 기본
- 날짜 형식: YYYY년 MM월 DD일
- 유기견보호소 데이터: [동물보호관리시스템](https://www.animal.go.kr) 공공 API 사용
- 예방접종 스케줄: 한국 수의사협회 권고 기준 적용
- 결제: 토스페이먼츠 또는 카카오페이 연동

---

## 개발 원칙

- 컴포넌트는 기능 단위로 분리, 화면 컴포넌트는 `/app` 아래에만
- Supabase Row Level Security(RLS)로 유저별 데이터 격리 필수
- Claude API 호출은 `/lib/claude.ts`에서만 — 프롬프트 중앙 관리
- 알림 권한은 반드시 사용자 동의 후 요청 (iOS 정책)
- 사진 업로드는 리사이징 후 저장 (Expo ImageManipulator)
- 환경변수는 `.env.local`에만, 절대 커밋 금지

---

## 환경변수 목록

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=          # 서버사이드 전용 (Supabase Edge Function)
ANIMAL_GO_KR_API_KEY=       # 동물보호관리시스템 API
```

---

## 경쟁사 차별점

| 경쟁사 | 우리가 없는 것 |
|--------|-------------|
| 펫닥 | 분양 전 추천 플로우 없음 |
| 마이펫닥터 | 일상 관리 리마인더 약함 |
| 펫프렌즈 | 앱 내 관리 기능 없음 |
| 동물보호관리시스템 | UX 열악, 관리 기능 없음 |

**핵심 포지션: "분양 결정 → 평생 관리"를 하나의 앱에서**
