# 뽀시래기 (PawMate) — 반려동물 관리 앱

반려동물 입양 전 추천부터 평생 건강 관리까지. 설문 → 프로필 등록 → 리마인더 → 커머스 추천 흐름.

**타겟**: 20~40대 한국인 / **마켓**: 한국 (animal.go.kr, 지역 동물병원 연동)

---

## 기술 스택

| 영역 | 선택 |
|------|------|
| 모바일 | React Native + Expo (Expo Router) |
| 언어 | TypeScript |
| 상태 관리 | Zustand |
| 백엔드 | Supabase (PostgreSQL + Auth + Storage) |
| AI 추천 | Claude API (claude-sonnet-4-6) — Supabase Edge Function에서만 |
| 알림 | Expo Notifications + Firebase FCM |
| 외부 API | 동물보호관리시스템 (animal.go.kr) |

---

## 도메인 모델

```
User        id, email, created_at, lifestyle_profile(JSON)

Pet         id, user_id, name, birthday, species(dog|cat|rabbit|fish|bird|other),
            breed, gender, weight, neutered, profile_photo_url

CareSchedule  id, pet_id, type(meal|medicine|hospital|ear_cleaning|bath|nail|other),
              frequency(daily|weekly|monthly|custom), days_of_week,
              next_due_at, last_done_at, notes

WalkLog     id, pet_id, user_id, started_at, ended_at,
            duration_minutes, distance_km, route_coordinates(JSON), notes

Place       id, created_by, name, category(카페|공원|숙박|식당|기타),
            address, lat, lng, allowed_pet_size(소형|중형|대형|전체)  [v2.5]

Recommendation  id, pet_id, type(food_subscription|gift|hospital_visit|product),
                title, description, url, trigger(birthday|schedule|ai_suggestion)
```

---

## 디렉토리 구조

```
app/
  (auth)/         로그인/회원가입
  (onboarding)/   설문 & 추천 플로우
  (tabs)/         메인 탭
  pet/[id]/       반려동물 상세
components/       재사용 UI
data/breeds.ts    견종 20종 특성 (런타임 API 미사용, 사전 정의)
lib/
  supabase.ts
  claude.ts       Claude API — 개발 시 데이터 생성 전용
  recommendation.ts
  animal-api.ts
  gps.ts
stores/           Zustand stores
types/
```

---

## 개발 원칙

- 화면 컴포넌트는 `/app` 아래에만
- Supabase RLS로 유저별 데이터 격리 필수
- Claude API 호출은 `/lib/claude.ts`에서만
- 알림 권한은 반드시 사용자 동의 후 요청 (iOS)
- 사진 업로드는 리사이징 후 저장 (Expo ImageManipulator)
- 환경변수는 `.env.local`에만, 절대 커밋 금지
- 모든 UI 텍스트는 한국어, 날짜 형식: YYYY년 MM월 DD일

---

## 환경변수

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=       # 서버사이드 전용 (Supabase Edge Function)
ANIMAL_GO_KR_API_KEY=
```

---

## 구현 단계 (현재 기준)

- **v1.0 MVP** (진행 중): 설문 추천 + 프로필 등록 + 리마인더 + 사진 다이어리
- **v1.5**: 분양처 연결 + 산책 기록 GPS
- **v2.0+**: 커머스 어필리에이트, B2B 제휴, 프리미엄 구독 (월 2,900원, 7일 무료 체험)
