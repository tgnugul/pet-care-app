import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { supabase } from '@/lib/supabase';
import { calcNextDue } from '@/stores/schedule.store';
import type { Frequency } from '@/stores/schedule.store';
import { getWidgetData, setWidgetData, getWalkState } from '@/lib/widget-storage';
import { CareWidget } from './CareWidget';
import { WalkWidget } from './WalkWidget';

export function registerWidgetTaskHandlers(): void {
  registerWidgetTaskHandler(async ({ widgetAction, widgetInfo, clickAction, clickActionData, renderWidget }) => {
    if (widgetAction === 'WIDGET_DELETED') return;

    const widgetName = widgetInfo?.widgetName ?? '';

    if (widgetName === 'WalkWidget') {
      const walkState = await getWalkState();
      renderWidget(WalkWidget({ state: walkState }));
      return;
    }

    // CareWidget (default)
    if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TOGGLE_DONE') {
      const { id, done } = (clickActionData ?? {}) as { id?: string; done?: boolean };
      if (id !== undefined && done !== undefined) {
        await toggleScheduleDone(id, done, renderWidget);
        return;
      }
    }

    const data = await getWidgetData() ?? { petName: '뽀시래기', items: [] };
    renderWidget(CareWidget({ data }));
  });
}

async function toggleScheduleDone(
  scheduleId: string,
  currentlyDone: boolean,
  renderWidget: (widget: React.ReactElement) => void,
): Promise<void> {
  // Optimistic update — render immediately so the widget feels responsive
  const cached = await getWidgetData();
  if (!cached) return;

  const item = cached.items.find(i => i.id === scheduleId);
  if (!item) return;

  cached.items = cached.items.map(i =>
    i.id === scheduleId ? { ...i, done: !currentlyDone } : i,
  );
  await setWidgetData(cached);
  renderWidget(CareWidget({ data: cached }));

  // DB work after render (failures don't affect the displayed state)
  if (currentlyDone) {
    // Undo: restore original next_due_at, clear last_done_at
    await supabase
      .from('care_schedules')
      .update({ last_done_at: null, next_due_at: item.nextDueAt })
      .eq('id', scheduleId);

    await supabase
      .from('care_completions')
      .delete()
      .eq('schedule_id', scheduleId)
      .eq('scheduled_at', item.nextDueAt);
  } else {
    // Mark done: fetch schedule for frequency, then advance next_due_at
    const { data: sc } = await supabase
      .from('care_schedules')
      .select('id, frequency, days_of_week, next_due_at, pet_id, type, label')
      .eq('id', scheduleId)
      .single();

    if (!sc) return;

    const now = new Date().toISOString();
    const nextDue = calcNextDue(sc.frequency as Frequency, sc.days_of_week, sc.next_due_at);

    await supabase
      .from('care_schedules')
      .update({ last_done_at: now, next_due_at: nextDue })
      .eq('id', scheduleId);

    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const scheduledDate = new Date(sc.next_due_at);
      const nowDate = new Date();
      const delayDays = Math.max(0, Math.floor(
        (Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()) -
         Date.UTC(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate())) / 86400000,
      ));
      await supabase.from('care_completions').insert({
        schedule_id: sc.id,
        pet_id: sc.pet_id,
        user_id: userData.user.id,
        care_type: sc.type,
        care_label: sc.label,
        scheduled_at: sc.next_due_at,
        done_at: now,
        delay_days: delayDays,
      });
    }
  }
}
