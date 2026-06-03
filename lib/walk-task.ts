import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calcDistance } from './gps';

export const WALK_LOCATION_TASK = 'WALK_LOCATION_TASK';
export const WALK_ROUTE_KEY = '@walk_route';
const WALK_STATE_KEY = '@pawmate/walk_state';

TaskManager.defineTask(WALK_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const loc = locations[locations.length - 1];
  if (!loc || (loc.coords.accuracy !== null && loc.coords.accuracy > 25)) return;

  try {
    // 경로 업데이트
    const stored = await AsyncStorage.getItem(WALK_ROUTE_KEY);
    const route: Array<{ latitude: number; longitude: number }> = stored ? JSON.parse(stored) : [];
    route.push({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    await AsyncStorage.setItem(WALK_ROUTE_KEY, JSON.stringify(route));

    // 위젯 상태 업데이트
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

    // WalkWidget 갱신 (홈 화면에 위젯이 있을 때만 동작)
    try {
      const { requestWidgetUpdate } = await import('react-native-android-widget');
      const { WalkWidget } = await import('@/widgets/WalkWidget');
      await requestWidgetUpdate({
        widgetName: 'WalkWidget',
        renderWidget: () => WalkWidget({ state: newState }),
        widgetNotFound: () => {},
      });
    } catch {}
  } catch {}
});
