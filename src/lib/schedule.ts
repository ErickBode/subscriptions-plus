import { addDays, addMonthsAnchored, daysInMonth, fmt } from './dates';
import type { Occurrence, Period, Schedule, Subscription } from './types';

/** Period length in months (fractional for day/week schedules); null for one-off charges. */
export function periodMonths(s: Schedule): number | null {
  switch (s.kind) {
    case 'monthly': return 1;
    case 'yearly': return 12;
    case 'custom':
      return s.unit === 'month' ? s.every : s.unit === 'year' ? s.every * 12
        : s.unit === 'week' ? (s.every * 7) / 30.4375 : s.every / 30.4375;
    default: return null;
  }
}

export function scheduleLabel(s: Schedule): string {
  switch (s.kind) {
    case 'monthly': return 'Monthly';
    case 'yearly': return 'Annual';
    case 'once': return 'One-Time';
    case 'trial': return 'Trial';
    case 'custom': {
      if (s.every === 1) return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Annual' }[s.unit];
      return `Every ${s.every} ${s.unit}s`;
    }
  }
}

/** Last day charges may happen (inclusive), or null when unbounded. */
function lastChargeDay(sub: Subscription): string | null {
  let end = sub.endDate ?? null;
  if (sub.status !== 'active' && sub.statusDate) {
    if (!end || sub.statusDate < end) end = sub.statusDate;
  }
  return end;
}

/** The n-th charge date (n = 0 is the start date). */
function nthDate(sub: Subscription, n: number): string {
  const s = sub.schedule;
  switch (s.kind) {
    case 'monthly': return addMonthsAnchored(sub.startDate, n);
    case 'yearly': return addMonthsAnchored(sub.startDate, 12 * n);
    case 'custom':
      if (s.unit === 'month') return addMonthsAnchored(sub.startDate, s.every * n);
      if (s.unit === 'year') return addMonthsAnchored(sub.startDate, 12 * s.every * n);
      return addDays(sub.startDate, (s.unit === 'week' ? 7 : 1) * s.every * n);
    case 'trial': return addDays(sub.startDate, s.days);
    case 'once': return sub.startDate;
  }
}

/** Price in effect on `date`: the earliest history entry still valid, else the current price. */
export function priceAt(sub: Subscription, date: string): number {
  const h = (sub.priceHistory ?? []).filter((p) => date <= p.until).sort((a, b) => a.until.localeCompare(b.until));
  return h.length ? h[0].amount : sub.amount;
}

/** Charges of the current plan with from <= date <= to. */
function currentOccurrences(sub: Subscription, from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  const last = lastChargeDay(sub);
  const limit = last && last < to ? last : to;
  const charge = (d: string) => out.push({
    sub, date: d, amount: priceAt(sub, d), currency: sub.currency, schedule: sub.schedule, paymentMethodId: sub.paymentMethodId,
  });
  const repeating = sub.schedule.kind !== 'once' && sub.schedule.kind !== 'trial';
  if (!repeating) {
    const d = nthDate(sub, 0);
    if (d >= from && d <= limit) charge(d);
    return out;
  }
  // Jump close to `from` instead of iterating from the start date.
  const pm = periodMonths(sub.schedule)!;
  let n = 0;
  if (from > sub.startDate) {
    const [fy, fm] = from.split('-').map(Number);
    const [sy, sm] = sub.startDate.split('-').map(Number);
    n = Math.max(0, Math.floor(((fy - sy) * 12 + (fm - sm)) / pm) - 2);
  }
  for (let guard = 0; guard < 5000; guard++, n++) {
    const d = nthDate(sub, n);
    if (d > limit) break;
    if (d >= from) charge(d);
  }
  return out;
}

/** The current plan of `sub` as if it were `period` (same engine, period-specific fields). */
function periodAsPlan(sub: Subscription, p: Period): Subscription {
  return {
    ...sub, schedule: p.schedule, startDate: p.start, endDate: p.end, amount: p.amount, currency: p.currency,
    priceHistory: p.priceHistory, paymentMethodId: p.paymentMethodId, status: 'active', statusDate: undefined, periods: undefined,
  };
}

/** All charges (earlier periods + current plan) with from <= date <= to. Archived subscriptions never charge. */
export function occurrences(sub: Subscription, from: string, to: string): Occurrence[] {
  if (sub.status === 'archived') return [];
  const out: Occurrence[] = [];
  (sub.periods ?? []).forEach((p, i) => {
    if (p.end < from || p.start > to) return;
    for (const o of currentOccurrences(periodAsPlan(sub, p), from, to)) out.push({ ...o, sub, period: i });
  });
  out.push(...currentOccurrences(sub, from, to));
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function occurrencesIn(subs: Subscription[], from: string, to: string): Occurrence[] {
  return subs.flatMap((s) => occurrences(s, from, to)).sort((a, b) => a.date.localeCompare(b.date));
}

export function monthRange(y: number, m: number): [string, string] {
  return [fmt({ y, m, d: 1 }), fmt({ y, m, d: daysInMonth(y, m) })];
}

/** Next charge on or after `today`, if any (looks up to 12 years ahead). */
export function nextCharge(sub: Subscription, today: string): string | null {
  const [y] = today.split('-').map(Number);
  return occurrences(sub, today, `${y + 12}-12-31`)[0]?.date ?? null;
}

/** Every charge up to and including today (for "total spent"), across all plans. */
export function pastCharges(sub: Subscription, today: string): Occurrence[] {
  return occurrences(sub, '1900-01-01', today);
}
