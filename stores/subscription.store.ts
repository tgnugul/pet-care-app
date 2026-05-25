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
  isPremium: false,
  loading: false,

  fetchStatus: async () => {
    if (!isRevenueCatReady()) return;
    set({ loading: true });
    try {
      const info = await Purchases.getCustomerInfo();
      set({ isPremium: info.entitlements.active[ENTITLEMENT_ID] !== undefined });
    } catch {
      // 무시 — 기본값 false 유지
    } finally {
      set({ loading: false });
    }
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
