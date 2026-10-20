import { addDays, diffDays, MONTHS_SHORT, parse, shiftMonth } from './dates';
import { convert } from './money';
import { occurrencesIn, periodMonths } from './schedule';
import { monthSummary } from './stats';
import type { AppData, Currency, Occurrence, Subscription } from './types';

export function relativeDay(today: string, date: string): string {
  const d = diffDays(today, date);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d < 0) return `${-d} days ago`;
  if (d <= 30) return `In ${d} days`;
  const { d: day, m } = parse(date);
  return `${day} ${MONTHS_SHORT[m - 1]}`;
}

const mainValue = (data: AppData) => (o: Occurrence) =>
  convert(o.amount, o.currency, data.settings.mainCurrency, data.settings.rates);

/** Charges of active subscriptions from today on, within `days`. */
export function upcomingCharges(data: AppData, subs: Subscription[], today: string, days: number): Occurrence[] {
  return occurrencesIn(subs.filter((s) => s.status === 'active'), today, addDays(today, days));
}

export function sumMain(data: AppData, occ: Occurrence[]): number {
  const v = mainValue(data);
  return occ.reduce((a, o) => a + v(o), 0);
}

/** Annual and semiannual charges in the next year, beyond the short-term list. */
export function bigChargesAhead(data: AppData, subs: Subscription[], today: string, limit = 4): Occurrence[] {
  return upcomingCharges(data, subs, today, 365)
    .filter((o) => (periodMonths(o.schedule) ?? 0) >= 6)
    .slice(0, limit);
}

export interface TrialEnding { sub: Subscription; endDate: string; daysLeft: number }

/** Active trials ending within `days` (the trial charge date is the end of the trial). */
export function trialsEnding(subs: Subscription[], today: string, days = 14): TrialEnding[] {
  return subs
    .filter((s) => s.status === 'active' && s.schedule.kind === 'trial')
    .map((s) => {
      const endDate = addDays(s.startDate, (s.schedule as { days: number }).days);
      return { sub: s, endDate, daysLeft: diffDays(today, endDate) };
    })
    .filter((t) => t.daysLeft >= 0 && t.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface MonthBreakdown {
  total: number;
  paid: number;
  remaining: number;
  count: number;
  /** Percent vs the average of the previous 12 months that had charges; null without history. */
  vsAverage: number | null;
  /** Charges of the month grouped by category, biggest first; `items` sorted by date. */
  categories: { id: string; name: string; color: string; total: number; items: Occurrence[] }[];
  currencies: { currency: Currency; amount: number; main: number; items: Occurrence[] }[];
  /** By card; `id` is null for charges without a card. Totals in the main currency. */
  cards: { id: string | null; total: number; items: Occurrence[] }[];
}

export function monthBreakdown(data: AppData, subs: Subscription[], y: number, m: number, today: string): MonthBreakdown {
  const s = monthSummary(data, subs, y, m, today);
  const v = mainValue(data);
  const cats = new Map<string, { total: number; items: Occurrence[] }>();
  const curs = new Map<Currency, { amount: number; main: number; items: Occurrence[] }>();
  const cards = new Map<string | null, { total: number; items: Occurrence[] }>();
  for (const o of s.occurrences) {
    const c0 = cats.get(o.sub.categoryId) ?? { total: 0, items: [] };
    c0.total += v(o);
    c0.items.push(o);
    cats.set(o.sub.categoryId, c0);
    const c = curs.get(o.currency) ?? { amount: 0, main: 0, items: [] };
    c.amount += o.amount;
    c.main += v(o);
    c.items.push(o);
    curs.set(o.currency, c);
    const card = data.paymentMethods.some((p) => p.id === o.paymentMethodId) ? o.paymentMethodId! : null;
    const k = cards.get(card) ?? { total: 0, items: [] };
    k.total += v(o);
    k.items.push(o);
    cards.set(card, k);
  }
  const previous = Array.from({ length: 12 }, (_, i) => {
    const p = shiftMonth(y, m, -(i + 1));
    return monthSummary(data, subs, p.y, p.m, today).total;
  }).filter((t) => t > 0);
  const avg = previous.length ? previous.reduce((a, b) => a + b, 0) / previous.length : 0;
  return {
    total: s.total,
    paid: s.total - s.remaining,
    remaining: s.remaining,
    count: s.occurrences.length,
    vsAverage: avg > 0 ? ((s.total - avg) / avg) * 100 : null,
    categories: [...cats.entries()]
      .map(([id, { total, items }]) => {
        const c = data.categories.find((x) => x.id === id) ?? data.categories.find((x) => x.id === 'other')!;
        return { id: c.id, name: c.name, color: c.color, total, items };
      })
      .sort((a, b) => b.total - a.total),
    currencies: [...curs.entries()].map(([currency, x]) => ({ currency, ...x })).sort((a, b) => b.main - a.main),
    // Cards first by amount; charges without a card last.
    cards: [...cards.entries()].map(([id, x]) => ({ id, ...x }))
      .sort((a, b) => (a.id === null ? 1 : 0) - (b.id === null ? 1 : 0) || b.total - a.total),
  };
}
