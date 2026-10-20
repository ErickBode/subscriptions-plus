import { convert } from './money';
import { monthRange, occurrencesIn, periodMonths } from './schedule';
import type { AppData, Occurrence, Subscription } from './types';

const toMain = (data: AppData) => (o: Occurrence) =>
  convert(o.amount, o.currency, data.settings.mainCurrency, data.settings.rates);

export interface MonthSummary {
  occurrences: Occurrence[];
  total: number;
  /** Still to be paid in this month (from today on); equals total for future months. */
  remaining: number;
  /** Largest charge of an annual-or-longer subscription in the month, shown instead of "Regular Month". */
  highlight: { name: string; amount: number } | null;
}

export function monthSummary(data: AppData, subs: Subscription[], y: number, m: number, today: string): MonthSummary {
  const [from, to] = monthRange(y, m);
  const occ = occurrencesIn(subs, from, to);
  const main = toMain(data);
  const total = occ.reduce((a, o) => a + main(o), 0);
  const remaining = occ.filter((o) => o.date >= today).reduce((a, o) => a + main(o), 0);
  let highlight: MonthSummary['highlight'] = null;
  for (const o of occ) {
    const pm = periodMonths(o.schedule);
    // Highlights annual charges of active subscriptions only (a canceled annual
    // subscription does not replace "Regular Month").
    if (pm !== null && pm >= 12 && o.sub.status === 'active') {
      const v = main(o);
      if (!highlight || v > highlight.amount) highlight = { name: o.sub.name, amount: v };
    }
  }
  return { occurrences: occ, total, remaining, highlight };
}

export interface CategorySlice { categoryId: string; name: string; color: string; total: number; share: number }

export interface YearStats {
  year: number;
  months: { total: number; top: { name: string; amount: number; sub: Subscription } | null }[];
  total: number;
  previousTotal: number;
  /** Percent change vs previous year; null when there is nothing to compare with. */
  change: number | null;
  averageMonthly: number;
  activeCount: number;
  categories: CategorySlice[];
}

export function yearStats(data: AppData, subs: Subscription[], year: number): YearStats {
  const main = toMain(data);
  const occ = occurrencesIn(subs, `${year}-01-01`, `${year}-12-31`);
  const prev = occurrencesIn(subs, `${year - 1}-01-01`, `${year - 1}-12-31`);
  const months: YearStats['months'] = Array.from({ length: 12 }, () => ({ total: 0, top: null }));
  const byCat = new Map<string, number>();
  for (const o of occ) {
    const v = main(o);
    const mo = months[Number(o.date.slice(5, 7)) - 1];
    mo.total += v;
    if (!mo.top || v > mo.top.amount) mo.top = { name: o.sub.name, amount: v, sub: o.sub };
    byCat.set(o.sub.categoryId, (byCat.get(o.sub.categoryId) ?? 0) + v);
  }
  const total = months.reduce((a, mo) => a + mo.total, 0);
  const previousTotal = prev.reduce((a, o) => a + main(o), 0);
  const categories = [...byCat.entries()]
    .map(([id, t]) => {
      const c = data.categories.find((x) => x.id === id) ?? data.categories.find((x) => x.id === 'other')!;
      return { categoryId: c.id, name: c.name, color: c.color, total: t, share: total ? t / total : 0 };
    })
    .sort((a, b) => b.total - a.total);
  return {
    year,
    months,
    total,
    previousTotal,
    change: previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null,
    averageMonthly: total / 12,
    activeCount: new Set(occ.map((o) => o.sub.id)).size,
    categories,
  };
}

export interface CategoryLine { sub: Subscription; total: number }

export function categoryBreakdown(data: AppData, subs: Subscription[], year: number, categoryId: string): CategoryLine[] {
  const main = toMain(data);
  const per = new Map<string, CategoryLine>();
  for (const o of occurrencesIn(subs, `${year}-01-01`, `${year}-12-31`)) {
    if (o.sub.categoryId !== categoryId) continue;
    const line = per.get(o.sub.id) ?? { sub: o.sub, total: 0 };
    line.total += main(o);
    per.set(o.sub.id, line);
  }
  return [...per.values()].sort((a, b) => b.total - a.total);
}
