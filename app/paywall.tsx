import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/design';
import { useSubscriptionStore } from '@/stores/subscription.store';

const FEATURES = [
  { emoji: '🐾', title: '반려동물 무제한 등록', desc: '무료 플랜은 1마리까지' },
  { emoji: '📸', title: '사진 다이어리 무제한', desc: '무료 플랜은 500MB' },
  { emoji: '📊', title: '월간 건강 리포트', desc: 'PDF로 저장·공유 가능' },
  { emoji: '🏠', title: '가족과 리포트 공유', desc: '패밀리 멤버도 열람 가능' },
];

export default function PaywallScreen() {
  const { purchase, restore } = useSubscriptionStore();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function handlePurchase() {
    setPurchasing(true);
    try {
      const success = await purchase();
      if (success) {
        Alert.alert('구독 완료 🎉', '뽀시래기 프리미엄을 시작합니다!', [
          { text: '확인', onPress: () => router.back() },
        ]);
      }
    } catch {
      Alert.alert('구독 실패', '결제 중 오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const success = await restore();
      Alert.alert(
        success ? '복원 완료' : '복원 실패',
        success ? '프리미엄 구독이 복원됐어요.' : '기존 구독 내역을 찾을 수 없어요.',
        success ? [{ text: '확인', onPress: () => router.back() }] : [{ text: '확인' }],
      );
    } catch {
      Alert.alert('오류', '다시 시도해주세요.');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.badge}>PREMIUM</Text>
        <Text style={styles.title}>반려동물을 더 잘{'\n'}돌볼 수 있어요</Text>
        <Text style={styles.subtitle}>모든 기능을 제한 없이 사용하세요</Text>

        <View style={[styles.featuresCard, Shadow.card]}>
          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureDivider]}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          ))}
        </View>

        <View style={[styles.priceBox, Shadow.sm]}>
          <Text style={styles.priceLabel}>월간 구독</Text>
          <Text style={styles.price}>
            ₩2,900<Text style={styles.priceUnit}> / 월</Text>
          </Text>
          <Text style={styles.priceSub}>7일 무료 체험 · 언제든 취소 가능</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.purchaseBtn, (purchasing || restoring) && { opacity: 0.6 }]}
          onPress={handlePurchase}
          disabled={purchasing || restoring}
        >
          {purchasing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.purchaseTxt}>7일 무료로 시작하기</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={purchasing || restoring}
        >
          {restoring
            ? <ActivityIndicator color={Colors.sub} size="small" />
            : <Text style={styles.restoreTxt}>구매 내역 복원</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, alignItems: 'flex-end' },
  closeBtn: { fontSize: 20, color: Colors.sub, padding: 4 },

  content: { paddingHorizontal: 24, paddingBottom: 24 },
  badge: {
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.sub,
    textAlign: 'center',
    marginBottom: 28,
  },

  featuresCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  featureDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  featureEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  featureTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  featureDesc: { fontSize: 12, color: Colors.sub },
  checkmark: { fontSize: 16, color: Colors.accent, fontWeight: '700' },

  priceBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.card,
    padding: 20,
    alignItems: 'center',
  },
  priceLabel: { fontSize: 13, color: Colors.sub, marginBottom: 4 },
  price: { fontSize: 32, fontWeight: '800', color: Colors.text },
  priceUnit: { fontSize: 16, fontWeight: '400', color: Colors.sub },
  priceSub: { fontSize: 12, color: Colors.sub, marginTop: 6 },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  purchaseBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.button,
    paddingVertical: 16,
    alignItems: 'center',
  },
  purchaseTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  restoreBtn: { alignItems: 'center', paddingVertical: 10 },
  restoreTxt: { fontSize: 14, color: Colors.sub },
});
