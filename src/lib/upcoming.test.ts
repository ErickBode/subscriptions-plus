import { describe, expect, it } from 'vitest';
import { defaultData } from './defaults';
import type { Subscription } from './types';
import { bigChargesAhead, monthBreakdown, relativeDay, trialsEnding, upcomingCharges } from './upcoming';

const sub = (over: Partial<Subscription>): Subscription => ({
  id: 'x', name: 'Test', icon: { type: 'letter' }, color: '#fff', amount: 10, currency: 'EUR',
  schedule: { kind: 'monthly' }, startDate: '2026-01-20', status: 'active', categoryId: 'other',
  notifications: 'default', notes: '', createdAt: '2026-01-01', ...over,
});

describe('upcoming', () => {
  const data = defaultData();
  data.settings.rates = { EUR: 1, USD: 1, BRL: 5, updatedAt: null };
  data.subscriptions = [
    sub({ id: 'm', name: 'Monthly' }),
    sub({ id: 'y', name: 'Annual', amount: 500, currency: 'BRL', schedule: { kind: 'yearly' }, startDate: '2026-03-01', categoryId: 'apps' }),
    sub({ id: 'c', name: 'Canceled', status: 'canceled', statusDate: '2026-02-01' }),
    sub({ id: 't', name: 'Trial', amount: 12, schedule: { kind: 'trial', days: 7 }, startDate: '2026-10-15' }),
  ];
  const today = '2026-10-19';

  it('relative day labels', () => {
    expect(relativeDay(today, today)).toBe('Today');
    expect(relativeDay(today, '2026-10-20')).toBe('Tomorrow');
    expect(relativeDay(today, '2026-10-22')).toBe('In 3 days');
    expect(relativeDay(today, '2027-03-01')).toBe('1 Mar');
  });
  it('lists only active charges in range', () => {
    expect(upcomingCharges(data, data.subscriptions, today, 7).map((o) => o.sub.id)).toEqual(['m', 't']);
  });
  it('trials ending soon', () => {
    expect(trialsEnding(data.subscriptions, today)).toEqual([expect.objectContaining({ endDate: '2026-10-22', daysLeft: 3 })]);
    expect(trialsEnding(data.subscriptions, '2026-10-23')).toEqual([]);
  });
  it('big charges ahead are annual or semiannual', () => {
    expect(bigChargesAhead(data, data.subscriptions, today).map((o) => [o.sub.id, o.date])).toEqual([['y', '2027-03-01']]);
  });
  it('month breakdown: paid, remaining, categories and currencies', () => {
    const b = monthBreakdown(data, data.subscriptions, 2026, 10, today);
    expect(b.total).toBeCloseTo(22);
    expect(b.paid).toBeCloseTo(0);
    expect(b.remaining).toBeCloseTo(22);
    const mar = monthBreakdown(data, data.subscriptions, 2026, 3, today);
    expect(mar.categories[0]).toMatchObject({ id: 'apps', total: 100 });
    expect(mar.categories[0].items.map((o) => o.sub.id)).toEqual(['y']);
    expect(mar.currencies.find((c) => c.currency === 'BRL')).toMatchObject({ amount: 500, main: 100 });
    expect(mar.cards).toEqual([expect.objectContaining({ id: null, total: 110 })]);
    expect(mar.paid).toBeCloseTo(110);
  });
});
