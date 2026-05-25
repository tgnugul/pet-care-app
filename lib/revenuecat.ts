import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

export const ENTITLEMENT_ID = 'premium';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

let _configured = false;

export function isRevenueCatReady(): boolean {
  return _configured;
}

export function initRevenueCat() {
  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
  if (!apiKey) return; // 키 미설정 시 건너뜀 (결제 시스템 비활성 상태)
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey });
    _configured = true;
  } catch {
    // 네이티브 모듈 없음 (Expo Go) — 무시
  }
}

export async function identifyRevenueCatUser(userId: string) {
  if (!_configured) return;
  try { await Purchases.logIn(userId); } catch { /* ignore */ }
}

export async function resetRevenueCatUser() {
  if (!_configured) return;
  try { await Purchases.logOut(); } catch { /* ignore */ }
}
