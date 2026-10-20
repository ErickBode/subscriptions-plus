import { addDays, todayISO } from './dates';
import { formatMoney, settingsFormat } from './money';
import { occurrencesIn } from './schedule';
import type { AppData, Reminder } from './types';
import type { ToastItem } from './backend';

const HORIZON_DAYS = 120;

function whenText(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** Windows toasts for upcoming charges, honouring the two global reminders and per-subscription opt-out. */
export function buildReminders(data: AppData, now = new Date()): ToastItem[] {
  const today = todayISO(now);
  const reminders = [data.settings.firstReminder, data.settings.secondReminder]
    .filter((r): r is Reminder & { days: number } => r.days !== null);
  if (!reminders.length) return [];
  const subs = data.subscriptions.filter((s) => s.status === 'active' && s.notifications === 'default');
  const occ = occurrencesIn(subs, today, addDays(today, HORIZON_DAYS + 30));
  const items: ToastItem[] = [];
  for (const o of occ) {
    reminders.forEach((r, i) => {
      const day = addDays(o.date, -r.days);
      const [hh, mm] = r.time.split(':').map(Number);
      const [y, m, d] = day.split('-').map(Number);
      const at = new Date(y, m - 1, d, hh, mm).getTime();
      if (at <= now.getTime() + 5000 || at > now.getTime() + HORIZON_DAYS * 86400000) return;
      const price = formatMoney(o.amount, o.currency, settingsFormat(data.settings));
      items.push({
        id: `${o.sub.id.slice(0, 8)}${o.date.replace(/-/g, '').slice(2)}${i}`,
        title: o.sub.name,
        body: `${price} will be charged ${whenText(r.days)}.`,
        at,
      });
    });
  }
  return items;
}
