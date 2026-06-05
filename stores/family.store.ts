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

export interface JoinRequest {
  id: string;
  family_id: string;
  user_id: string;
  display_name: string;
  email: string;
  created_at: string;
}

export type JoinResult = 'pending' | 'not_found' | 'already_member' | 'error';

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
  pendingRequests: JoinRequest[];
  myPendingRequest: JoinRequest | null;
  myUserId: string | null;
  loading: boolean;
  fetchFamily: () => Promise<void>;
  createFamily: (name: string) => Promise<boolean>;
  requestJoin: (code: string) => Promise<JoinResult>;
  cancelMyRequest: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  approveRequest: (request: JoinRequest) => Promise<'ok' | 'full'>;
  rejectRequest: (requestId: string) => Promise<void>;
  leaveFamily: () => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  dissolveFamily: () => Promise<void>;
  regenerateCode: () => Promise<void>;
}

export const useFamilyStore = create<FamilyStore>((set, get) => ({
  family: null,
  members: [],
  pendingRequests: [],
  myPendingRequest: null,
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
      const { data: pending } = await supabase
        .from('family_join_requests')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      set({ family: null, members: [], myPendingRequest: (pending as JoinRequest) ?? null, loading: false });
      return;
    }

    const [{ data: family }, { data: members }] = await Promise.all([
      supabase.from('families').select('*').eq('id', membership.family_id).single(),
      supabase.from('family_members').select('*').eq('family_id', membership.family_id).order('joined_at'),
    ]);

    set({ family: family ?? null, members: (members as FamilyMember[]) ?? [], myPendingRequest: null, loading: false });

    if (family?.owner_id === session.user.id) {
      get().fetchPendingRequests();
    }
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

      if (error?.code === '23505') continue;
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

  requestJoin: async (code) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 'error';

    const { data: existing } = await supabase
      .from('family_members').select('id').eq('user_id', session.user.id).maybeSingle();
    if (existing) return 'already_member';

    const { data: family } = await supabase
      .from('families').select('id').eq('invite_code', code.trim().toUpperCase()).maybeSingle();
    if (!family) return 'not_found';

    const { data: inserted, error } = await supabase
      .from('family_join_requests')
      .insert({
        family_id: family.id,
        user_id: session.user.id,
        display_name: session.user.user_metadata?.display_name ?? session.user.email ?? '',
        email: session.user.email ?? '',
      })
      .select()
      .single();

    // 23505 = already has a pending request for this family → treat as already pending
    if (error?.code === '23505') return 'pending';
    if (error) return 'error';

    set({ myPendingRequest: inserted as JoinRequest });
    return 'pending';
  },

  cancelMyRequest: async () => {
    const { myPendingRequest } = get();
    if (!myPendingRequest) return;
    await supabase.from('family_join_requests').delete().eq('id', myPendingRequest.id);
    set({ myPendingRequest: null });
  },

  fetchPendingRequests: async () => {
    const { family } = get();
    if (!family) return;
    const { data } = await supabase
      .from('family_join_requests')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at');
    set({ pendingRequests: (data as JoinRequest[]) ?? [] });
  },

  approveRequest: async (request) => {
    const { family } = get();
    if (!family) return 'ok';

    const { count } = await supabase
      .from('family_members').select('*', { count: 'exact', head: true }).eq('family_id', family.id);
    if ((count ?? 0) >= MAX_MEMBERS) {
      await supabase.from('family_join_requests').delete().eq('id', request.id);
      set(s => ({ pendingRequests: s.pendingRequests.filter(r => r.id !== request.id) }));
      return 'full';
    }

    await supabase.from('family_members').insert({
      family_id: family.id,
      user_id: request.user_id,
      role: 'member',
      email: request.email,
      display_name: request.display_name,
    });
    await supabase.from('family_join_requests').delete().eq('id', request.id);

    set(s => ({ pendingRequests: s.pendingRequests.filter(r => r.id !== request.id) }));
    await get().fetchFamily();
    return 'ok';
  },

  rejectRequest: async (requestId) => {
    await supabase.from('family_join_requests').delete().eq('id', requestId);
    set(s => ({ pendingRequests: s.pendingRequests.filter(r => r.id !== requestId) }));
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
    await supabase.from('families').delete().eq('id', family.id);
    set({ family: null, members: [], pendingRequests: [] });
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
