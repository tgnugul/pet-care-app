"use no memo";
import React from 'react';
import { Appearance } from 'react-native';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { HexColor } from 'react-native-android-widget';
import type { WalkWidgetState, WalkWidgetCache } from '@/lib/widget-storage';

const dark = Appearance.getColorScheme() === 'dark';

const C = {
  accent:      '#F2A23C' as HexColor,
  danger:      '#E53935' as HexColor,
  green:       (dark ? '#52BD5A' : '#4AAD52') as HexColor,
  widget:      (dark ? '#2A2520' : '#FEFBF4') as HexColor,
  text:        (dark ? '#E8E0D0' : '#2D2520') as HexColor,
  muted:       (dark ? '#7A7060' : '#9A9080') as HexColor,
  line:        (dark ? '#3A3530' : '#E8E2D8') as HexColor,
  white:       '#FFFFFF' as HexColor,
  weatherBg:   (dark ? '#3A3020' : '#F5EFE4') as HexColor,
  weatherFg:   (dark ? '#A09070' : '#7B6A50') as HexColor,
  transparent: '#00000000' as HexColor,
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMinutes(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}시간 ${rm}분` : `${h}시간`;
}

interface Props {
  state: WalkWidgetState | null;
  cache?: WalkWidgetCache | null;
  loggedOut?: boolean;
}

export function WalkWidget({ state, cache, loggedOut }: Props) {
  if (loggedOut) {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pawmate://' }}
        style={{
          flexDirection: 'column',
          width: 'match_parent',
          height: 'match_parent',
          backgroundColor: C.widget,
          borderRadius: 24,
          padding: 14,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TextWidget text="🐾" style={{ fontSize: 28, marginBottom: 8 }} />
        <TextWidget text="로그인이 필요해요" style={{ fontSize: 14, fontWeight: 'bold', color: C.text, marginBottom: 6 }} />
        <TextWidget text="탭해서 시작하기 →" style={{ fontSize: 12, color: C.muted }} />
      </FlexWidget>
    );
  }

  const isWalking = state?.isWalking ?? false;

  // ── 산책 중 ──────────────────────────────────────────────
  if (isWalking) {
    const durationSec = state?.startedAt
      ? Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000)
      : (state?.durationSec ?? 0);
    const distanceKm = state?.distanceKm ?? 0;

    return (
      <FlexWidget
        style={{
          flexDirection: 'column',
          width: 'match_parent',
          height: 'match_parent',
          backgroundColor: C.widget,
          borderRadius: 24,
          padding: 14,
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'row',
            width: 'match_parent',
            height: 'wrap_content',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <TextWidget text="🐕" style={{ fontSize: 13, marginRight: 4 }} />
          <TextWidget text="산책 중" style={{ fontSize: 13, fontWeight: 'bold', color: C.green }} />
        </FlexWidget>

        <FlexWidget
          style={{
            flexDirection: 'row',
            flex: 1,
            width: 'match_parent',
            alignItems: 'center',
            justifyContent: 'space-evenly',
          }}
        >
          <FlexWidget style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <TextWidget text={formatTime(durationSec)} style={{ fontSize: 20, fontWeight: 'bold', color: C.text }} />
            <TextWidget text="시간" style={{ fontSize: 11, color: C.muted, marginTop: 2 }} />
          </FlexWidget>
          <FlexWidget style={{ width: 1, height: 32, backgroundColor: C.line }} />
          <FlexWidget style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <TextWidget text={`${distanceKm.toFixed(2)}km`} style={{ fontSize: 20, fontWeight: 'bold', color: C.text }} />
            <TextWidget text="거리" style={{ fontSize: 11, color: C.muted, marginTop: 2 }} />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget
          clickAction="STOP_WALK"
          style={{
            width: 'match_parent',
            height: 'wrap_content',
            backgroundColor: C.danger,
            borderRadius: 14,
            paddingVertical: 9,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 6,
          }}
        >
          <TextWidget text="■  산책 종료" style={{ fontSize: 13, fontWeight: 'bold', color: C.white }} />
        </FlexWidget>
      </FlexWidget>
    );
  }

  // ── 비산책 ───────────────────────────────────────────────
  const petName = cache?.petName ?? '뽀시래기';
  const weatherMsg = cache?.weatherMessage ?? '오늘도 산책\n나가볼까요? 🐾';
  const weatherChip = cache?.weatherChip;
  const walkedToday = cache?.walkedToday ?? false;
  const todayDurationSec = cache?.todayDurationSec ?? 0;
  const todayDistanceKm = cache?.todayDistanceKm ?? 0;

  return (
    <FlexWidget
      style={{
        flexDirection: 'column',
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: C.widget,
        borderRadius: 24,
        padding: 14,
      }}
    >
      {/* 헤더: 펫 이름 + 날씨 칩 */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          height: 'wrap_content',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <TextWidget text="🐾" style={{ fontSize: 13, marginRight: 5 }} />
        <TextWidget text={petName} style={{ fontSize: 13, fontWeight: 'bold', color: C.text }} />
        <FlexWidget style={{ flex: 1 }} />
        {weatherChip ? (
          <FlexWidget
            style={{
              height: 'wrap_content',
              backgroundColor: C.weatherBg,
              borderRadius: 20,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <TextWidget
              text={weatherChip}
              style={{ fontSize: 11, color: C.weatherFg, fontWeight: '500' }}
            />
          </FlexWidget>
        ) : null}
      </FlexWidget>

      {/* 동기부여 메시지 */}
      <FlexWidget style={{ flex: 1, width: 'match_parent', justifyContent: 'center' }}>
        <TextWidget
          text={weatherMsg}
          style={{ fontSize: 15, fontWeight: 'bold', color: C.text }}
          maxLines={3}
        />
        <TextWidget
          text={walkedToday
            ? `오늘 ${formatMinutes(todayDurationSec)} · ${todayDistanceKm.toFixed(2)}km ✅`
            : '아직 산책을 하지 않았어요'}
          style={{ fontSize: 11, color: C.muted, marginTop: 5 }}
        />
      </FlexWidget>

      {/* 산책 시작 버튼 */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pawmate://walk' }}
        style={{
          width: 'match_parent',
          height: 'wrap_content',
          backgroundColor: C.accent,
          borderRadius: 14,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TextWidget
          text={walkedToday ? '🐾  다시 산책하기' : '🐾  산책 시작'}
          style={{ fontSize: 14, fontWeight: 'bold', color: C.white }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
