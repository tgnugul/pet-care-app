import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calcDistance } from './gps';
import { supabase } from './supabase';

export const WALK_LOCATION_TASK = 'WALK_LOCATION_TASK';
export const WALK_ROUTE_KEY = '@walk_route';
export const WALK_META_KEY = '@pawmate/walk_meta';
export const WALK_LAST_PUSHED_KEY = '@pawmate/walk_last_pushed';

const WALK_STATE_KEY = '@pawmate/walk_state';
const PUSH_INTERVAL_MS = 30_000;

export interface WalkMeta {
  familyId: string;
  walkerId: string;
  walkerName: string;
  petName: string;
}

TaskManager.defineTask(WALK_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const loc = locations[locations.length - 1];
  if (!loc || (loc.coords.accuracy !== null && loc.coords.accuracy > 25)) return;

  try {
    const stored = await AsyncStorage.getItem(WALK_ROUTE_KEY);
    const route: Array<{ latitude: number; longitude: number }> = stored ? JSON.parse(stored) : [];
    route.push({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    await AsyncStorage.setItem(WALK_ROUTE_KEY, JSON.stringify(route));

    const walkStateRaw = await AsyncStorage.getItem(WALK_STATE_KEY);
    if (!walkStateRaw) return;
    const walkState = JSON.parse(walkStateRaw);
    if (!walkState?.isWalking || !walkState.startedAt) return;

    let totalDist = 0;
    for (let i = 1; i < route.length; i++) {
      totalDist += calcDistance(
        route[i - 1].latitude, route[i - 1].longitude,
        route[i].latitude, route[i].longitude,
      );
    }
    const durationSec = Math.floor((Date.now() - new Date(walkState.startedAt).getTime()) / 1000);
    const newState = { ...walkState, distanceKm: totalDist, durationSec };
    await AsyncStorage.setItem(WALK_STATE_KEY, JSON.stringify(newState));

    try {
      const { requestWidgetUpdate } = await import('react-native-android-widget');
      const { WalkWidget } = await import('@/widgets/WalkWidget');
      await requestWidgetUpdate({
        widgetName: 'WalkWidget',
        renderWidget: () => WalkWidget({ state: newState }),
        widgetNotFound: () => {},
      });
    } catch {}

    // 가족 실시간 산책 공유 — 30초 공유 스로틀
    const lastPushedRaw = await AsyncStorage.getItem(WALK_LAST_PUSHED_KEY);
    const lastPushed = lastPushedRaw ? parseInt(lastPushedRaw, 10) : 0;
    if (Date.now() - lastPushed < PUSH_INTERVAL_MS) return;

    const metaRaw = await AsyncStorage.getItem(WALK_META_KEY);
    if (!metaRaw) return;
    const meta: WalkMeta = JSON.parse(metaRaw);
    if (!meta.familyId) return;

    await supabase.from('live_walks').upsert({
      user_id: meta.walkerId,
      family_id: meta.familyId,
      walker_name: meta.walkerName,
      pet_name: meta.petName,
      started_at: walkState.startedAt,
      distance_km: Math.round(totalDist * 1000) / 1000,
      duration_sec: durationSec,
      route_coordinates: route,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    await AsyncStorage.setItem(WALK_LAST_PUSHED_KEY, String(Date.now()));
  } catch {}
});
