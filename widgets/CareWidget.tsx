"use no memo";
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { HexColor } from 'react-native-android-widget';
import type { WidgetData } from '@/lib/widget-storage';

const C: Record<string, HexColor> = {
  primary: '#F5A623',
  accent: '#6DB56D',
  bg: '#FFF8EF',
  white: '#FFFDF9',
  text: '#2D2D2D',
  sub: '#888888',
  border: '#F0E8DC',
  transparent: '#00000000',
};

interface Props {
  data: WidgetData;
}

export function CareWidget({ data }: Props) {
  const doneCount = data.items.filter(i => i.done).length;

  return (
    <FlexWidget
      style={{
        flexDirection: 'column',
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: C.bg,
        borderRadius: 20,
        padding: 12,
      }}
    >
      {/* 헤더 */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          height: 'wrap_content',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <FlexWidget
          style={{ flexDirection: 'row', height: 'wrap_content', alignItems: 'center' }}
        >
          <TextWidget text="🐾" style={{ fontSize: 13, marginRight: 4 }} />
          <TextWidget
            text={data.petName}
            style={{ fontSize: 13, fontWeight: 'bold', color: C.text }}
          />
        </FlexWidget>
        <FlexWidget
          style={{
            height: 'wrap_content',
            backgroundColor: doneCount === data.items.length && data.items.length > 0 ? C.accent : C.primary,
            borderRadius: 10,
            paddingHorizontal: 7,
            paddingVertical: 3,
          }}
        >
          <TextWidget
            text={`${doneCount}/${data.items.length}`}
            style={{ fontSize: 11, fontWeight: 'bold', color: C.white }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* 구분선 */}
      <FlexWidget style={{ width: 'match_parent', height: 1, backgroundColor: C.border, marginBottom: 4 }} />

      {/* 케어 항목 목록 */}
      {data.items.length === 0 ? (
        <FlexWidget
          style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget
            text="오늘 케어 일정이 없어요"
            style={{ fontSize: 12, color: C.sub }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{ flexDirection: 'column', flex: 1, width: 'match_parent' }}
        >
          {data.items.map(item => (
            <FlexWidget
              key={item.id}
              clickAction="TOGGLE_DONE"
              clickActionData={{ id: item.id, done: item.done }}
              style={{
                flexDirection: 'row',
                flex: 1,
                width: 'match_parent',
                alignItems: 'center',
                paddingHorizontal: 2,
              }}
            >
              {/* 완료 원형 인디케이터 */}
              <FlexWidget
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: item.done ? C.accent : C.transparent,
                  borderWidth: item.done ? 0 : 1.5,
                  borderColor: C.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 7,
                }}
              >
                {item.done && (
                  <TextWidget text="✓" style={{ fontSize: 10, fontWeight: 'bold', color: C.white }} />
                )}
              </FlexWidget>

              {/* 이모지 */}
              <TextWidget text={item.emoji} style={{ fontSize: 14, marginRight: 5 }} />

              {/* 레이블 */}
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text={item.label}
                  style={{
                    fontSize: 12,
                    color: item.done ? C.sub : C.text,
                    fontWeight: item.done ? 'normal' : '600',
                  }}
                  truncate="END"
                  maxLines={1}
                />
              </FlexWidget>
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
