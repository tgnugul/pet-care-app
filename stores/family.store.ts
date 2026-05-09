import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: 'owner' | 'member';
  email: string;
  display_name: string;
  joined_at: string;
}

export type JoinResult = 'success' | 'not_found' | 'full' | 'already_member' | 'error';

const MAX_MEMBERS = 4;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

interface FamilyStore {
  family: Family | null;
  members: FamilyMember[];
  myUserId: string | null;
  loading: boolean;
  fetchFamily: () => Promise<void>;
  createFamily: (name: string) => Promise<boolean>;
  joinFamily: (code: string) => Promise<JoinResult>;
  leaveFamily: () => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  dissolveFamily: () => Promise<void>;
  regenerateCode: () => Promise<void>;
}

export const useFamilyStore = create<FamilyStore>((set, get) => ({
  family: null,
  members: [],
  myUserId: null,
  loading: false,

  fetchFamily: async () => {
    set({ loading: true });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { set({ loading: false }); return; }

    set({ myUserId: session.user.id });

    const { data: membership } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!membership) {
      set({ family: null, members: [], loading: false });
      return;
    }

    const [{ data: family }, { data: members }] = await Promise.all([
      supabase.from('families').select('*').eq('id', membership.family_id).single(),
      supabase.from('family_members').select('*').eq('family_id', membership.family_id).order('joined_at'),
    ]);

    set({ family: family ?? null, members: (members as FamilyMember[]) ?? [], loading: false });
  },

  createFamily: async (name) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data: existing } = await supabase
      .from('family_members').select('id').eq('user_id', session.user.id).maybeSingle();
    if (existing) return false;

    for (let i = 0; i < 5; i++) {
      const familyId = generateUUID();
      const code = generateCode();
      const { error } = await supabase
        .from('families')
        .insert({ id: familyId, name: name.trim(), invite_code: code, owner_id: session.user.id });

      if (error?.code === '23505') continue; // 코드 중복, 재시도
      if (error) return false;

      await supabase.from('family_members').insert({
        family_id: familyId,
        user_id: session.user.id,
        role: 'owner',
        email: session.user.email ?? '',
        display_name: session.user.user_metadata?.display_name ?? session.user.email ?? '',
      });
      await get().fetchFamily();
      return true;
    }
    return false;
  },

  joinFamily: async (code) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 'error';

    const { data: existing } = await supabase
      .from('family_members').select('id').eq('user_id', session.user.id).maybeSingle();
    if (existing) return 'already_member';

    const { data: family } = await supabase
      .from('families').select('id').eq('invite_code', code.trim().toUpperCase()).maybeSingle();
    if (!family) return 'not_found';

    const { count } = await supabase
      .from('family_members').select('*', { count: 'exact', head: true }).eq('family_id', family.id);
    if ((count ?? 0) >= MAX_MEMBERS) return 'full';

    const { error } = await supabase.from('family_members').insert({
      family_id: family.id,
      user_id: session.user.id,
      role: 'member',
      email: session.user.email ?? '',
      display_name: session.user.user_metadata?.display_name ?? session.user.email ?? '',
    });
    if (error) return 'error';

    await get().fetchFamily();
    return 'success';
  },

  leaveFamily: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { family } = get();
    if (!family) return;

    await supabase.from('family_members')
      .delete().eq('user_id', session.user.id).eq('family_id', family.id);
    set({ family: null, members: [] });
  },

  removeMember: async (userId) => {
    const { family } = get();
    if (!family) return;
    await supabase.from('family_members')
      .delete().eq('user_id', userId).eq('family_id', family.id);
    set(s => ({ members: s.members.filter(m => m.user_id !== userId) }));
  },

  dissolveFamily: async () => {
    const { family } = get();
    if (!family) return;
    // families 삭제 시 family_members는 CASCADE로 자동 삭제
    await supabase.from('families').delete().eq('id', family.id);
    set({ family: null, members: [] });
  },

  regenerateCode: async () => {
    const { family } = get();
    if (!family) return;
    const code = generateCode();
    const { error } = await supabase
      .from('families').update({ invite_code: code }).eq('id', family.id);
    if (!error) set(s => ({ family: s.family ? { ...s.family, invite_code: code } : null }));
  },
}));
