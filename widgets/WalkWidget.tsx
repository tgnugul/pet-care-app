"use no memo";
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { HexColor } from 'react-native-android-widget';
import type { WalkWidgetState } from '@/lib/widget-storage';

const C: Record<string, HexColor> = {
  primary: '#F5A623',
  accent: '#6DB56D',
  bg: '#FFF8EF',
  white: '#FFFDF9',
  text: '#2D2D2D',
  sub: '#888888',
  border: '#F0E8DC',
  danger: '#E53935',
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface Props {
  state: WalkWidgetState | null;
}

export function WalkWidget({ state }: Props) {
  const isWalking = state?.isWalking ?? false;

  if (!isWalking) {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pawmate://walk-active?autostart=true' }}
        style={{
          flexDirection: 'column',
          width: 'match_parent',
          height: 'match_parent',
          backgroundColor: C.primary,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <TextWidget text="🐕" style={{ fontSize: 36, marginBottom: 6 }} />
        <TextWidget
          text="산책 시작"
          style={{ fontSize: 16, fontWeight: 'bold', color: C.white }}
        />
        <TextWidget
          text="탭하면 바로 시작해요"
          style={{ fontSize: 11, color: '#FFF4E0' as HexColor, marginTop: 4 }}
        />
      </FlexWidget>
    );
  }

  const durationSec = state?.durationSec ?? 0;
  const distanceKm = state?.distanceKm ?? 0;

  return (
    <FlexWidget
      style={{
        flexDirection: 'column',
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: C.bg,
        borderRadius: 20,
        padding: 14,
      }}
    >
      {/* 헤더 */}
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
        <TextWidget
          text="산책 중"
          style={{ fontSize: 13, fontWeight: 'bold', color: C.accent }}
        />
      </FlexWidget>

      {/* 통계 */}
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
          <TextWidget
            text={formatTime(durationSec)}
            style={{ fontSize: 20, fontWeight: 'bold', color: C.text }}
          />
          <TextWidget text="시간" style={{ fontSize: 11, color: C.sub, marginTop: 2 }} />
        </FlexWidget>

        <FlexWidget style={{ width: 1, height: 32, backgroundColor: C.border }} />

        <FlexWidget style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget
            text={`${distanceKm.toFixed(2)}km`}
            style={{ fontSize: 20, fontWeight: 'bold', color: C.text }}
          />
          <TextWidget text="거리" style={{ fontSize: 11, color: C.sub, marginTop: 2 }} />
        </FlexWidget>
      </FlexWidget>

      {/* 종료 버튼 */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'pawmate://walk-active' }}
        style={{
          width: 'match_parent',
          height: 'wrap_content',
          backgroundColor: C.danger,
          borderRadius: 12,
          paddingVertical: 8,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 6,
        }}
      >
        <TextWidget
          text="■  산책 종료"
          style={{ fontSize: 13, fontWeight: 'bold', color: C.white }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
