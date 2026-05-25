import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// SecureStore의 2KB 제한 우회: 큰 값을 청크로 나눠 저장
const CHUNK_SIZE = 1800;

const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const countStr = await SecureStore.getItemAsync(`${key}.n`);
    if (!countStr) return SecureStore.getItemAsync(key);
    const count = parseInt(countStr, 10);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(`${key}.n`);
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}.n`, String(chunks.length));
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    const countStr = await SecureStore.getItemAsync(`${key}.n`);
    await SecureStore.deleteItemAsync(key);
    await SecureStore.deleteItemAsync(`${key}.n`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}.${i}`);
      }
    }
  },
};

const storage = Platform.OS === 'web' ? undefined : secureStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
