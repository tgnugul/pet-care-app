import { create } from 'zustand';
import Purchases from 'react-native-purchases';
import { ENTITLEMENT_ID, isRevenueCatReady } from '@/lib/revenuecat';

interface SubscriptionStore {
  isPremium: boolean;
  loading: boolean;
  fetchStatus: () => Promise<void>;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  isPremium: true, // 전면 무료 개방 — 수익화 재도입 시 false로 변경 후 fetchStatus 복구
  loading: false,

  fetchStatus: async () => {
    // 전면 무료 개방 중 비활성화
  },

  purchase: async () => {
    if (!isRevenueCatReady()) throw new Error('결제 시스템이 준비되지 않았어요.');
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.monthly;
    if (!pkg) throw new Error('구독 상품을 불러올 수 없습니다.');
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    set({ isPremium });
    return isPremium;
  },

  restore: async () => {
    if (!isRevenueCatReady()) throw new Error('결제 시스템이 준비되지 않았어요.');
    const info = await Purchases.restorePurchases();
    const isPremium = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    set({ isPremium });
    return isPremium;
  },
}));
