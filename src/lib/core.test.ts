import { describe, expect, it } from 'vitest';
import { addMonthsAnchored } from './dates';
import { defaultData } from './defaults';
import { convert, formatMoney } from './money';
import { reminderSafe } from './testutil';
import { nextCharge, occurrences, pastCharges } from './schedule';

const spent = (s: Subscription, today: string) => pastCharges(s, today).reduce((a, o) => a + o.amount, 0);
import { monthSummary, yearStats } from './stats';
import type { Subscription } from './types';

const sub = (over: Partial<Subscription>): Subscription => ({
  id: 'x', name: 'Test', icon: { type: 'letter' }, color: '#fff', amount: 10, currency: 'EUR',
  schedule: { kind: 'monthly' }, startDate: '2026-01-31', status: 'active', categoryId: 'other',
  notifications: 'default', notes: '', createdAt: '2026-01-01', ...over,
});

describe('dates', () => {
  it('clamps anchored months to the month length and returns to the anchor day', () => {
    expect(addMonthsAnchored('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsAnchored('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonthsAnchored('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsAnchored('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('occurrences', () => {
  it('monthly keeps the anchor day', () => {
    const d = occurrences(sub({}), '2026-01-01', '2026-04-30').map((o) => o.date);
    expect(d).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('yearly, custom months, weeks and days', () => {
    expect(occurrences(sub({ schedule: { kind: 'yearly' }, startDate: '2024-02-29' }), '2024-01-01', '2026-12-31')
      .map((o) => o.date)).toEqual(['2024-02-29', '2025-02-28', '2026-02-28']);
    expect(occurrences(sub({ schedule: { kind: 'custom', every: 6, unit: 'month' }, startDate: '2026-03-14' }), '2026-01-01', '2027-12-31')
      .map((o) => o.date)).toEqual(['2026-03-14', '2026-09-14', '2027-03-14', '2027-09-14']);
    expect(occurrences(sub({ schedule: { kind: 'custom', every: 31, unit: 'day' }, startDate: '2026-01-01' }), '2026-01-01', '2026-03-31')
      .map((o) => o.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-04']);
    expect(occurrences(sub({ schedule: { kind: 'custom', every: 2, unit: 'week' }, startDate: '2026-10-01' }), '2026-10-01', '2026-10-31')
      .map((o) => o.date)).toEqual(['2026-10-01', '2026-10-15', '2026-10-29']);
  });
  it('one-time, trial, end date, cancellation and archive', () => {
    expect(occurrences(sub({ schedule: { kind: 'once' }, startDate: '2026-05-05' }), '2026-01-01', '2026-12-31')).toHaveLength(1);
    expect(occurrences(sub({ schedule: { kind: 'trial', days: 7 }, startDate: '2026-10-19' }), '2026-10-01', '2026-10-31')[0].date).toBe('2026-10-26');
    expect(occurrences(sub({ endDate: '2026-03-15' }), '2026-01-01', '2026-12-31')).toHaveLength(2);
    expect(occurrences(sub({ status: 'canceled', statusDate: '2026-04-01' }), '2026-01-01', '2026-12-31')).toHaveLength(3);
    expect(occurrences(sub({ status: 'archived' }), '2026-01-01', '2026-12-31')).toHaveLength(0);
  });
  it('finds occurrences far from the start date', () => {
    const d = occurrences(sub({ startDate: '2010-01-31' }), '2026-02-01', '2026-02-28').map((o) => o.date);
    expect(d).toEqual(['2026-02-28']);
  });
  it('price history applies older prices to older charges', () => {
    const s = sub({ schedule: { kind: 'yearly' }, startDate: '2023-05-19', amount: 47.88, priceHistory: [{ until: '2026-05-18', amount: 35.88 }] });
    expect(occurrences(s, '2023-01-01', '2026-12-31').map((o) => o.amount)).toEqual([35.88, 35.88, 35.88, 47.88]);
    expect(spent(s, '2026-10-20')).toBeCloseTo(35.88 * 3 + 47.88);
  });
  it('next charge and total spent', () => {
    const s = sub({ startDate: '2026-01-10' });
    expect(nextCharge(s, '2026-10-19')).toBe('2026-11-10');
    expect(spent(s, '2026-10-19')).toBe(100);
  });
});

describe('money', () => {
  const rates = { EUR: 1, USD: 1.1, BRL: 6, updatedAt: null };
  it('converts through EUR', () => {
    expect(convert(60, 'BRL', 'EUR', rates)).toBeCloseTo(10);
    expect(convert(11, 'USD', 'BRL', rates)).toBeCloseTo(60);
  });
  it('formats with two decimals', () => {
    expect(formatMoney(99.14, 'EUR')).toBe('€99,14');
    expect(formatMoney(46.6, 'EUR')).toBe('€46,60');
    expect(formatMoney(4, 'USD')).toBe('$4,00');
    expect(formatMoney(1395.2, 'EUR', { rounding: true })).toBe('€1.395');
    expect(formatMoney(74500, 'USD', { abbreviate: true })).toBe('$74,5k');
    expect(formatMoney(14.9, 'BRL')).toBe('R$14,90');
  });
});

describe('stats', () => {
  const data = defaultData();
  data.settings.rates = { EUR: 1, USD: 1, BRL: 5, updatedAt: null };
  data.subscriptions = [
    sub({ id: 'a', name: 'Monthly', amount: 10, startDate: '2026-01-05', categoryId: 'streaming' }),
    sub({ id: 'b', name: 'Annual', amount: 500, currency: 'BRL', schedule: { kind: 'yearly' }, startDate: '2026-05-20', categoryId: 'apps' }),
    sub({ id: 'c', name: 'Half', amount: 30, schedule: { kind: 'custom', every: 6, unit: 'month' }, startDate: '2026-09-14' }),
  ];
  it('month summary with highlight only for annual-or-longer charges', () => {
    const may = monthSummary(data, data.subscriptions, 2026, 5, '2026-05-10');
    expect(may.total).toBeCloseTo(110);
    expect(may.remaining).toBeCloseTo(100);
    expect(may.highlight).toEqual({ name: 'Annual', amount: 100 });
    expect(monthSummary(data, data.subscriptions, 2026, 9, '2026-05-10').highlight).toBeNull();
  });
  it('year stats', () => {
    const y = yearStats(data, data.subscriptions, 2026);
    expect(y.total).toBeCloseTo(120 + 100 + 30);
    expect(y.activeCount).toBe(3);
    expect(y.categories[0].categoryId).toBe('streaming');
    expect(y.change).toBeNull();
    const n = yearStats(data, data.subscriptions, 2027);
    expect(n.change).toBeCloseTo(((120 + 100 + 60) - 250) / 250 * 100);
  });
  it('reminder ids fit the Windows limit', () => {
    expect(reminderSafe(data)).toBe(true);
  });
});
