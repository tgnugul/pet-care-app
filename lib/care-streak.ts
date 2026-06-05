import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pawmate/care_streak';

interface StreakData {
  count: number;
  lastDate: string;
}

function dateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getStreak(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return 0;
  try {
    return (JSON.parse(raw) as StreakData).count;
  } catch {
    return 0;
  }
}

export async function markStreakComplete(): Promise<number> {
  const todayStr = dateStr();
  const yd = new Date();
  yd.setDate(yd.getDate() - 1);
  const yesterdayStr = dateStr(yd);

  let data: StreakData = { count: 0, lastDate: '' };
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch {}

  if (data.lastDate === todayStr) return data.count;

  const newCount = data.lastDate === yesterdayStr ? data.count + 1 : 1;
  await AsyncStorage.setItem(KEY, JSON.stringify({ count: newCount, lastDate: todayStr }));
  return newCount;
}
