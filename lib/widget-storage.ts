import AsyncStorage from '@react-native-async-storage/async-storage';

const CARE_KEY = '@pawmate/widget_data';
const WALK_STATE_KEY = '@pawmate/walk_state';

export interface WidgetCareItem {
  id: string;
  emoji: string;
  label: string;
  done: boolean;
  frequency: string;
  nextDueAt: string;  // original due date, used for undo toggle
}

export interface WidgetData {
  petName: string;
  items: WidgetCareItem[];
}

export interface WalkWidgetState {
  isWalking: boolean;
  startedAt: string | null;
  distanceKm: number;
  durationSec: number;
}

export async function setWidgetData(data: WidgetData): Promise<void> {
  await AsyncStorage.setItem(CARE_KEY, JSON.stringify(data));
}

export async function getWidgetData(): Promise<WidgetData | null> {
  const raw = await AsyncStorage.getItem(CARE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as WidgetData; } catch { return null; }
}

export async function setWalkState(state: WalkWidgetState): Promise<void> {
  await AsyncStorage.setItem(WALK_STATE_KEY, JSON.stringify(state));
}

export async function getWalkState(): Promise<WalkWidgetState | null> {
  const raw = await AsyncStorage.getItem(WALK_STATE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as WalkWidgetState; } catch { return null; }
}

export async function clearWalkState(): Promise<void> {
  await AsyncStorage.removeItem(WALK_STATE_KEY);
}
