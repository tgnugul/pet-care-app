import { create } from 'zustand';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

export interface Photo {
  id: string;
  pet_id: string;
  user_id: string;
  photo_url: string;
  storage_path: string;
  taken_at: string; // 'YYYY-MM-DD'
  notes: string | null;
  storage_bytes: number;
}

export interface PickedPhoto {
  data: Uint8Array;
  bytes: number;
}

export const FREE_LIMIT_BYTES = 100 * 1024 * 1024; // 100MB (패밀리 공유 풀)

interface PhotoStore {
  photos: Photo[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: { done: number; total: number } | null;
  globalTotalBytes: number;
  fetchPhotos: (petId: string) => Promise<void>;
  fetchGlobalTotal: () => Promise<void>;
  savePhoto: (petId: string, picked: PickedPhoto, notes?: string) => Promise<'success' | 'error'>;
  savePhotos: (petId: string, picks: PickedPhoto[]) => Promise<void>;
  deletePhoto: (id: string, storagePath: string) => Promise<void>;
  totalBytes: () => number;
}

async function resizeAsset(asset: ImagePicker.ImagePickerAsset): Promise<PickedPhoto | null> {
  const resized = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!resized.base64) return null;
  const binary = atob(resized.base64);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
  return { data, bytes: asset.fileSize ?? data.byteLength };
}

export async function pickAndResize(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
  if (result.canceled || !result.assets[0]) return null;
  return resizeAsset(result.assets[0]);
}

export async function pickMultipleAndResize(): Promise<PickedPhoto[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 0.9,
    allowsMultipleSelection: true,
    selectionLimit: 20,
  });
  if (result.canceled) return [];

  const picks: PickedPhoto[] = [];
  for (const asset of result.assets) {
    const p = await resizeAsset(asset);
    if (p) picks.push(p);
  }
  return picks;
}

export const usePhotoStore = create<PhotoStore>((set, get) => ({
  photos: [],
  loading: false,
  uploading: false,
  uploadProgress: null,
  globalTotalBytes: 0,

  totalBytes: () => get().photos.reduce((s, p) => s + p.storage_bytes, 0),

  fetchGlobalTotal: async () => {
    const { data } = await supabase.from('photos').select('storage_bytes');
    const total = data?.reduce((s, p) => s + (p.storage_bytes ?? 0), 0) ?? 0;
    set({ globalTotalBytes: total });
  },

  fetchPhotos: async (petId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('pet_id', petId)
      .order('taken_at', { ascending: false });
    if (!error && data) set({ photos: data as Photo[] });
    set({ loading: false });
  },

  savePhotos: async (petId, picks) => {
    if (picks.length === 0) return;
    set({ uploading: true, uploadProgress: { done: 0, total: picks.length } });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      set({ uploading: false, uploadProgress: null });
      Alert.alert('로그인 필요', '사진을 업로드하려면 로그인이 필요해요.');
      return;
    }

    // 용량 사전 체크
    const { data: allPhotos } = await supabase.from('photos').select('storage_bytes');
    const usedBytes = allPhotos?.reduce((s, p) => s + (p.storage_bytes ?? 0), 0) ?? 0;
    const totalNew = picks.reduce((s, p) => s + p.bytes, 0);
    if (usedBytes + totalNew > FREE_LIMIT_BYTES) {
      set({ uploading: false, uploadProgress: null });
      Alert.alert(
        '저장 공간 부족',
        `저장공간(100MB)이 부족해요.\n현재 사용: ${(usedBytes / 1024 / 1024).toFixed(1)}MB`,
      );
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    let done = 0;

    for (const picked of picks) {
      const path = `${session.user.id}/${petId}/${Date.now()}_${done}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('pet-photos')
        .upload(path, picked.data, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) { done++; set({ uploadProgress: { done, total: picks.length } }); continue; }

      const { data: { publicUrl } } = supabase.storage.from('pet-photos').getPublicUrl(path);
      const { data: row } = await supabase
        .from('photos')
        .insert({
          pet_id: petId,
          user_id: session.user.id,
          photo_url: publicUrl,
          storage_path: path,
          taken_at: today,
          notes: null,
          storage_bytes: picked.bytes,
        })
        .select()
        .single();

      done++;
      set(s => ({
        photos: row ? [row as Photo, ...s.photos] : s.photos,
        globalTotalBytes: s.globalTotalBytes + picked.bytes,
        uploadProgress: { done, total: picks.length },
      }));
    }

    set({ uploading: false, uploadProgress: null });
  },

  deletePhoto: async (id, storagePath) => {
    const photo = get().photos.find(p => p.id === id);
    await supabase.storage.from('pet-photos').remove([storagePath]);
    await supabase.from('photos').delete().eq('id', id);
    set(s => ({
      photos: s.photos.filter(p => p.id !== id),
      globalTotalBytes: Math.max(0, s.globalTotalBytes - (photo?.storage_bytes ?? 0)),
    }));
  },

  savePhoto: async (petId, picked, notes) => {
    set({ uploading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ uploading: false });
        Alert.alert('로그인 필요', '사진을 업로드하려면 로그인이 필요해요.');
        return 'error';
      }

      // 패밀리 공유 저장공간 한도 체크
      const { data: allPhotos } = await supabase.from('photos').select('storage_bytes');
      const usedBytes = allPhotos?.reduce((s, p) => s + (p.storage_bytes ?? 0), 0) ?? 0;
      if (usedBytes + picked.bytes > FREE_LIMIT_BYTES) {
        set({ uploading: false });
        Alert.alert(
          '저장 공간 부족',
          `패밀리 공유 저장공간(100MB)이 가득 찼어요.\n현재 사용량: ${(usedBytes / 1024 / 1024).toFixed(1)}MB`,
        );
        return 'error';
      }

      const path = `${session.user.id}/${petId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('pet-photos')
        .upload(path, picked.data, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) {
        set({ uploading: false });
        Alert.alert('업로드 실패', `Storage 오류: ${uploadError.message}`);
        return 'error';
      }

      const { data: { publicUrl } } = supabase.storage
        .from('pet-photos')
        .getPublicUrl(path);

      const today = new Date().toISOString().slice(0, 10);
      const { data, error: dbError } = await supabase
        .from('photos')
        .insert({
          pet_id: petId,
          user_id: session.user.id,
          photo_url: publicUrl,
          storage_path: path,
          taken_at: today,
          notes: notes ?? null,
          storage_bytes: picked.bytes,
        })
        .select()
        .single();

      if (dbError) {
        set({ uploading: false });
        Alert.alert('저장 실패', `DB 오류: ${dbError.message}`);
        return 'error';
      }

      set(s => ({
        photos: [data as Photo, ...s.photos],
        globalTotalBytes: s.globalTotalBytes + picked.bytes,
      }));
      set({ uploading: false });
      return 'success';
    } catch (e: unknown) {
      set({ uploading: false });
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      Alert.alert('오류 발생', msg);
      return 'error';
    }
  },
}));

export function groupByDate(photos: Photo[]): Record<string, Photo[]> {
  return photos.reduce<Record<string, Photo[]>>((acc, p) => {
    (acc[p.taken_at] ??= []).push(p);
    return acc;
  }, {});
}

export function filterByMonth(photos: Photo[], year: number, month: number): Photo[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return photos.filter(p => p.taken_at.startsWith(prefix));
}
