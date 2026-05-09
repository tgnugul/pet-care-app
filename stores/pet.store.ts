import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Pet {
  id: string;
  user_id: string;
  name: string;
  species: 'dog' | 'cat' | 'rabbit' | 'bird' | 'fish' | 'other';
  breed: string | null;
  birthday: string | null; // 'YYYY-MM-DD'
  gender: 'male' | 'female' | null;
  weight: number | null;
  neutered: boolean;
  profile_photo_url: string | null;
}

interface PetStore {
  pets: Pet[];
  loading: boolean;
  fetchPets: () => Promise<void>;
  deletePet: (id: string) => Promise<void>;
  updatePetPhoto: (id: string, url: string) => Promise<void>;
}

export const usePetStore = create<PetStore>((set) => ({
  pets: [],
  loading: false,

  fetchPets: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) {
      set({ pets: data as Pet[] });
    }
    set({ loading: false });
  },

  deletePet: async (id) => {
    await supabase.from('pets').delete().eq('id', id);
    set(s => ({ pets: s.pets.filter(p => p.id !== id) }));
  },

  updatePetPhoto: async (id, url) => {
    await supabase.from('pets').update({ profile_photo_url: url }).eq('id', id);
    set(s => ({ pets: s.pets.map(p => p.id === id ? { ...p, profile_photo_url: url } : p) }));
  },
}));

export const SPECIES_EMOJI: Record<Pet['species'], string> = {
  dog: '🐶',
  cat: '🐱',
  rabbit: '🐰',
  bird: '🐦',
  fish: '🐟',
  other: '🐾',
};

/** 생일(YYYY-MM-DD) → "2살 3개월" 형태 */
export function formatAge(birthday: string | null): string | null {
  if (!birthday) return null;
  const birth = new Date(birthday);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) { years -= 1; months += 12; }
  if (years === 0) return `${months}개월`;
  if (months === 0) return `${years}살`;
  return `${years}살 ${months}개월`;
}

/** 생일(YYYY-MM-DD) → 입양 D+ 일수 */
export function formatDPlus(birthday: string | null): string | null {
  if (!birthday) return null;
  const diff = Math.floor((Date.now() - new Date(birthday).getTime()) / 86400000);
  return `D+${diff}`;
}
