"use no memo";
import React from 'react';
import { Appearance } from 'react-native';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { HexColor } from 'react-native-android-widget';
import type { WidgetData } from '@/lib/widget-storage';

const dark = Appearance.getColorScheme() === 'dark';

const C = {
  accent:      '#F2A23C' as HexColor,
  green:       (dark ? '#52BD5A' : '#4AAD52') as HexColor,
  widget:      (dark ? '#2A2520' : '#FEFBF4') as HexColor,
  text:        (dark ? '#E8E0D0' : '#2D2520') as HexColor,
  muted:       (dark ? '#7A7060' : '#9A9080') as HexColor,
  line:        (dark ? '#3A3530' : '#E8E2D8') as HexColor,
  white:       '#FFFFFF' as HexColor,
  transparent: '#00000000' as HexColor,
};

const CHIP: Record<string, { bg: HexColor; fg: HexColor }> = dark ? {
  meal:         { bg: '#5A3A20' as HexColor, fg: '#D49060' as HexColor },
  medicine:     { bg: '#5A2A25' as HexColor, fg: '#D46A5A' as HexColor },
  hospital:     { bg: '#5A2A25' as HexColor, fg: '#D46A5A' as HexColor },
  ear_cleaning: { bg: '#1A3A20' as HexColor, fg: '#5AAA65' as HexColor },
  bath:         { bg: '#1A2A4A' as HexColor, fg: '#5A8ACC' as HexColor },
  nail:         { bg: '#3A2858' as HexColor, fg: '#9A7ACC' as HexColor },
  other:        { bg: '#3A3530' as HexColor, fg: '#A09080' as HexColor },
} : {
  meal:         { bg: '#FDE8D8' as HexColor, fg: '#C86A2E' as HexColor },
  medicine:     { bg: '#FDDDD8' as HexColor, fg: '#BE4B3E' as HexColor },
  hospital:     { bg: '#FDDDD8' as HexColor, fg: '#BE4B3E' as HexColor },
  ear_cleaning: { bg: '#E0F0E0' as HexColor, fg: '#4A8A4A' as HexColor },
  bath:         { bg: '#DCE8FC' as HexColor, fg: '#3A60A8' as HexColor },
  nail:         { bg: '#EAE0F8' as HexColor, fg: '#6B4E9A' as HexColor },
  other:        { bg: '#EDEBE6' as HexColor, fg: '#6B6560' as HexColor },
};

function getChip(type?: string) {
  return CHIP[type ?? 'other'] ?? CHIP.other;
}

interface Props {
  data: WidgetData;
}

export function CareWidget({ data }: Props) {
  const items = data.items;
  const doneCount = items.filter(i => i.done).length;
  const total = items.length;
  const nextIdx = items.findIndex(i => !i.done);

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
        <TextWidget text="🐾" style={{ fontSize: 14, marginRight: 5 }} />
        <TextWidget
          text={data.petName}
          style={{ fontSize: 14, fontWeight: 'bold', color: C.text }}
        />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget
          text={`${doneCount}/${total}`}
          style={{ fontSize: 13, color: C.muted }}
        />
      </FlexWidget>

      {/* 진행 바 */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          height: 3,
          borderRadius: 2,
          marginBottom: 8,
        }}
      >
        {doneCount > 0 && (
          <FlexWidget
            style={{
              flex: doneCount,
              height: 3,
              backgroundColor: C.accent,
              borderRadius: 2,
            }}
          />
        )}
        <FlexWidget
          style={{
            flex: Math.max(total - doneCount, 0) || 1,
            height: 3,
            backgroundColor: doneCount < total ? C.line : C.transparent,
            borderRadius: 2,
          }}
        />
      </FlexWidget>

      {/* 아이템 없음 */}
      {total === 0 ? (
        <FlexWidget style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget text="오늘 케어 일정이 없어요" style={{ fontSize: 12, color: C.muted }} />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: 'column', flex: 1, width: 'match_parent' }}>
          {items.map((item, idx) => {
            const isNext = idx === nextIdx;
            const chip = getChip(item.type);

            return (
              <FlexWidget
                key={item.id}
                clickAction="TOGGLE_DONE"
                clickActionData={{ id: item.id, done: item.done }}
                style={{
                  flexDirection: 'row',
                  flex: 1,
                  width: 'match_parent',
                  alignItems: 'center',
                }}
              >
                {/* 체크 서클 */}
                <FlexWidget
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: item.done ? C.green : C.transparent,
                    borderWidth: item.done ? 0 : 1.5,
                    borderColor: isNext ? C.accent : C.line,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 7,
                  }}
                >
                  {item.done && (
                    <TextWidget text="✓" style={{ fontSize: 11, fontWeight: 'bold', color: C.white }} />
                  )}
                </FlexWidget>

                {/* 컬러 칩 */}
                <FlexWidget
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    backgroundColor: chip.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 7,
                  }}
                >
                  <TextWidget text={item.emoji} style={{ fontSize: 12 }} />
                </FlexWidget>

                {/* 레이블 */}
                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget
                    text={item.label}
                    style={{
                      fontSize: 12,
                      color: item.done ? C.muted : C.text,
                      fontWeight: item.done ? 'normal' : isNext ? 'bold' : '500',
                    }}
                    truncate="END"
                    maxLines={1}
                  />
                </FlexWidget>

                {/* 다음 라벨 */}
                {isNext && (
                  <TextWidget
                    text="다음"
                    style={{ fontSize: 11, color: C.accent, fontWeight: 'bold' }}
                  />
                )}
              </FlexWidget>
            );
          })}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
