// Supabase Edge Function: 내일 케어 일정 사전 알림
// 배포: supabase functions deploy send-care-reminders
// 크론: supabase functions schedule --name send-care-reminders --cron "0 20 * * *"
//       → 매일 오후 8시(UTC 기준, 한국은 UTC+9이므로 "0 11 * * *")
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 내일 하루 범위
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  // 내일 예정된 케어 + 아직 완료 안 된 것
  const { data: schedules, error } = await supabase
    .from('care_schedules')
    .select('id, label, next_due_at, last_done_at, pet_id, pets!inner(name, user_id)')
    .gte('next_due_at', tomorrow.toISOString())
    .lt('next_due_at', dayAfter.toISOString());

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!schedules?.length) return new Response('no schedules', { status: 200 });

  // 유저별 그룹
  const byUser = new Map<string, { label: string; petName: string }[]>();
  for (const sc of schedules as any[]) {
    const userId = sc.pets.user_id as string;
    if (!byUser.has(userId)) byUser.set(userId, []);
    byUser.get(userId)!.push({ label: sc.label, petName: sc.pets.name });
  }

  // 푸시 토큰 조회
  const userIds = [...byUser.keys()];
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds);

  if (!tokens?.length) return new Response('no push tokens', { status: 200 });

  const messages = tokens.map(({ user_id, token }: { user_id: string; token: string }) => {
    const items = byUser.get(user_id) ?? [];
    const petName = items[0]?.petName ?? '반려동물';
    const body = items.length === 1
      ? `${petName}의 ${items[0].label} 일정이 내일 있어요`
      : `${petName}의 케어 일정 ${items.length}개가 내일 있어요`;
    return { to: token, title: '내일 케어 일정 미리 알림 🐾', body, sound: 'default' };
  });

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  const result = await res.json();
  return new Response(JSON.stringify({ sent: messages.length, result }), { status: 200 });
});
