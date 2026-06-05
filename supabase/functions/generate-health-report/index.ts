// Supabase Edge Function: 월간 건강 리포트 생성
// pg_cron: "0 0 1 * *" (매월 1일 자정 UTC = 오전 9시 KST)
// 배포: supabase functions deploy generate-health-report
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

  // 지난달 범위 계산
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const targetPetId: string | null = body.petId ?? null;

  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mm = String(firstOfLastMonth.getMonth() + 1).padStart(2, '0');
  const reportMonth = `${firstOfLastMonth.getFullYear()}-${mm}-01`; // YYYY-MM-01

  // 처리할 펫 목록
  let pets: { id: string; name: string; user_id: string }[];
  if (targetPetId) {
    const { data } = await supabase
      .from('pets')
      .select('id, name, user_id')
      .eq('id', targetPetId)
      .single();
    pets = data ? [data] : [];
  } else {
    const { data } = await supabase.from('pets').select('id, name, user_id');
    pets = (data ?? []) as { id: string; name: string; user_id: string }[];
  }

  const results: string[] = [];

  for (const pet of pets) {
    // 이미 생성된 리포트 확인
    const { data: existing } = await supabase
      .from('health_reports')
      .select('id')
      .eq('pet_id', pet.id)
      .eq('report_month', reportMonth)
      .single();
    if (existing) { results.push(`${pet.name}: cached`); continue; }

    // 케어 완료 데이터 집계
    const { data: completions } = await supabase
      .from('care_completions')
      .select('scheduled_at, done_at, delay_days, care_type, care_label')
      .eq('pet_id', pet.id)
      .gte('done_at', firstOfLastMonth.toISOString())
      .lt('done_at', firstOfThisMonth.toISOString());

    // 예정된 케어 수 (지난 달에 next_due_at이 있었던 것)
    const { data: scheduled } = await supabase
      .from('care_schedules')
      .select('id')
      .eq('pet_id', pet.id);
    const scheduledCount = scheduled?.length ?? 0;

    // 실제 완료 수, 완료율
    const doneCount = completions?.length ?? 0;
    // 지난달 실제 일수 (daily 스케줄 기준 예상 완료 횟수 계산용)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const expectedCount = scheduledCount * daysInMonth;
    const completionRate = expectedCount > 0
      ? Math.min(100, Math.round((doneCount / expectedCount) * 1000) / 10)
      : null;
    const avgDelayDays = doneCount > 0
      ? (completions!.reduce((sum, c) => sum + (c.delay_days ?? 0), 0) / doneCount)
      : null;

    // 산책 데이터 집계 (walk_logs는 pet_id 없이 user_id로만 조회)
    const { data: walks } = await supabase
      .from('walk_logs')
      .select('duration_minutes, distance_km')
      .eq('user_id', pet.user_id)
      .gte('started_at', firstOfLastMonth.toISOString())
      .lt('started_at', firstOfThisMonth.toISOString());

    const totalWalks = walks?.length ?? 0;
    const totalDistance = walks?.reduce((s, w) => s + (w.distance_km ?? 0), 0) ?? 0;
    const totalDuration = walks?.reduce((s, w) => s + (w.duration_minutes ?? 0), 0) ?? 0;

    // Gemini AI 요약 생성
    const monthLabel = `${firstOfLastMonth.getFullYear()}년 ${firstOfLastMonth.getMonth() + 1}월`;
    const careBreakdown = completions
      ? Object.entries(
          completions.reduce((acc: Record<string, number>, c) => {
            acc[c.care_label] = (acc[c.care_label] ?? 0) + 1;
            return acc;
          }, {}),
        ).map(([label, cnt]) => `${label} ${cnt}회`).join(', ')
      : '없음';

    const prompt = `아래 데이터만 참고하여 반려동물 ${pet.name}의 ${monthLabel} 건강 관리 요약을 작성해줘.

[이달의 데이터]
- 케어 완료율: ${completionRate != null ? `${completionRate}%` : '기록 없음'}
- 평균 지연일수: ${avgDelayDays != null ? `${avgDelayDays.toFixed(1)}일` : '없음'}
- 케어 항목별 완료: ${careBreakdown}
- 산책 횟수: ${totalWalks}회 / 총 거리: ${totalDistance.toFixed(1)}km / 총 시간: ${totalDuration}분

[작성 규칙]
1. 위 데이터에 없는 내용은 절대 언급하지 않는다.
2. 정확히 3문장으로 작성한다. 문장을 중간에 끊지 않고 반드시 완성한다.
3. 마크다운 기호(*, #, - 등)를 사용하지 않고 순수 텍스트로만 작성한다.
4. 따뜻하고 친근한 한국어로, 보호자를 격려하는 톤으로 작성한다.
5. 잘한 점 1가지와 개선할 점 1가지를 반드시 포함한다.`;

    let aiSummary: string | null = null;
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
          }),
        },
      );
      const geminiData = await geminiRes.json();
      aiSummary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    } catch {
      aiSummary = null;
    }

    // 리포트 저장
    await supabase.from('health_reports').upsert({
      pet_id: pet.id,
      user_id: pet.user_id,
      report_month: reportMonth,
      completion_rate: completionRate,
      avg_delay_days: avgDelayDays != null ? Math.round(avgDelayDays * 10) / 10 : null,
      total_walks: totalWalks,
      total_distance: Math.round(totalDistance * 100) / 100,
      total_duration: totalDuration,
      ai_summary: aiSummary,
    }, { onConflict: 'pet_id,report_month' });

    results.push(`${pet.name}: generated`);
  }

  return new Response(JSON.stringify({ month: reportMonth, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
