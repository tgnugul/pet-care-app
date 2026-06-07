import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Radius } from '@/constants/design';

const { width: W } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🐾',
    bg: '#FFF5E6',
    title: '뽀시래기에\n오신 걸 환영해요',
    sub: '반려동물과 함께하는 모든 순간을\n기록하고 관리해요',
  },
  {
    emoji: '📋',
    bg: '#EAF4FF',
    title: '케어 일정을\n놓치지 마세요',
    sub: '밥, 약, 병원 방문까지\n알림으로 꼭 챙겨드려요',
  },
  {
    emoji: '📸',
    bg: '#EDF7EE',
    title: '소중한 추억을\n함께 남겨요',
    sub: '산책 기록부터 사진 다이어리까지\n가족과 함께 나눠요',
  },
];

function proceed() {
  AsyncStorage.setItem('splash_seen', 'true');
  router.replace('/(tabs)');
}

export default function SplashScreen() {
  const [idx, setIdx] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = idx === SLIDES.length - 1;

  function goNext() {
    if (isLast) { proceed(); return; }
    const next = idx + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIdx(next);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.skip} onPress={proceed}>
        <Text style={styles.skipText}>건너뛰기</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          setIdx(Math.round(e.nativeEvent.contentOffset.x / W));
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={[styles.illustBox, { backgroundColor: item.bg }]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{item.sub}</Text>
          </View>
        )}
      />

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
          <Text style={styles.nextBtnText}>{isLast ? '시작하기' : '다음'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },

  skip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  skipText: { fontSize: 14, color: Colors.light, fontWeight: '600' },

  slide: {
    width: W,
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 16,
    gap: 32,
  },
  illustBox: {
    width: W * 0.62,
    aspectRatio: 1,
    borderRadius: W * 0.31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 88 },
  title: {
    fontSize: 28, fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 40,
  },
  sub: {
    fontSize: 15, color: Colors.sub,
    textAlign: 'center',
    lineHeight: 24,
  },

  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 20,
    alignItems: 'center',
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },

  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.button,
    paddingVertical: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },
});
