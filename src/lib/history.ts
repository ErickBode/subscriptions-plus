import { addDays, diffDays } from './dates';
import { pastCharges } from './schedule';
import type { Currency, Period, Schedule, Subscription } from './types';

export interface PlanSegment {
  kind: 'plan';
  /** Index into `sub.periods`, or null for the current plan. */
  index: number | null;
  start: string;
  /** Last day of the plan; null while it is still running. */
  end: string | null;
  schedule: Schedule;
  currency: Currency;
  /** Prices in chronological order (consecutive duplicates removed). */
  prices: number[];
  paymentMethodId?: string;
  charges: number;
  total: number;
  note?: string;
}

export interface PauseSegment { kind: 'pause'; from: string; to: string; days: number }

export type Segment = PlanSegment | PauseSegment;

function prices(amount: number, history?: { until: string; amount: number }[]): number[] {
  const list = [...(history ?? [])].sort((a, b) => a.until.localeCompare(b.until)).map((h) => h.amount);
  list.push(amount);
  return list.filter((p, i) => i === 0 || p !== list[i - 1]);
}

/** End of the current plan: cancellation or end date, whichever comes first. */
export function currentEnd(sub: Subscription): string | null {
  const ends = [sub.endDate, sub.status !== 'active' ? sub.statusDate : undefined].filter(Boolean) as string[];
  return ends.length ? ends.sort()[0] : null;
}

/** Plans and pauses of a subscription, newest first, with what each plan charged up to today. */
export function planTimeline(sub: Subscription, today: string): Segment[] {
  const charges = pastCharges(sub, today);
  const plans: PlanSegment[] = (sub.periods ?? []).map((p: Period, i) => ({
    kind: 'plan', index: i, start: p.start, end: p.end, schedule: p.schedule, currency: p.currency,
    prices: prices(p.amount, p.priceHistory), paymentMethodId: p.paymentMethodId, note: p.note,
    charges: 0, total: 0,
  }));
  plans.push({
    kind: 'plan', index: null, start: sub.startDate, end: currentEnd(sub), schedule: sub.schedule, currency: sub.currency,
    prices: prices(sub.amount, sub.priceHistory), paymentMethodId: sub.paymentMethodId, charges: 0, total: 0,
  });
  for (const o of charges) {
    const seg = plans.find((p) => p.index === (o.period ?? null))!;
    seg.charges += 1;
    seg.total += o.amount;
  }
  plans.sort((a, b) => a.start.localeCompare(b.start));
  const out: Segment[] = [];
  plans.forEach((p, i) => {
    const prev = plans[i - 1];
    if (prev?.end && p.start > addDays(prev.end, 1)) {
      const from = addDays(prev.end, 1);
      const to = addDays(p.start, -1);
      out.push({ kind: 'pause', from, to, days: diffDays(from, to) + 1 });
    }
    out.push(p);
  });
  return out.reverse();
}

/** Moves the current plan into the history and starts a new one on `start` (used for resume and plan changes). */
export function startNewPlan(sub: Subscription, start: string, next: Partial<Subscription> = {}): Subscription {
  const end = currentEnd(sub);
  const old: Period = {
    start: sub.startDate,
    end: end && end < start ? end : addDays(start, -1),
    schedule: sub.schedule,
    amount: sub.amount,
    currency: sub.currency,
    priceHistory: sub.priceHistory,
    paymentMethodId: sub.paymentMethodId,
  };
  return {
    ...sub,
    ...next,
    periods: [...(sub.periods ?? []), old],
    startDate: start,
    priceHistory: next.priceHistory,
    endDate: next.endDate,
    status: 'active',
    statusDate: undefined,
  };
}
