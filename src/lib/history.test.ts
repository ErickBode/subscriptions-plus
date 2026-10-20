import { describe, expect, it } from 'vitest';
import { planTimeline, startNewPlan } from './history';
import { occurrences } from './schedule';
import type { Subscription } from './types';

const base: Subscription = {
  id: 'gpt', name: 'ChatGPT', icon: { type: 'letter' }, color: '#10A37F', amount: 18.7, currency: 'EUR',
  schedule: { kind: 'monthly' }, startDate: '2026-06-05', status: 'active', categoryId: 'ai',
  notifications: 'default', notes: '', createdAt: '2026-01-01',
  periods: [
    { start: '2024-11-07', end: '2025-03-07', schedule: { kind: 'monthly' }, amount: 24.6, currency: 'USD' },
    { start: '2025-10-07', end: '2025-11-07', schedule: { kind: 'monthly' }, amount: 24.6, currency: 'USD' },
  ],
};

describe('plan periods', () => {
  it('charges every period with its own currency, with pauses in between', () => {
    const occ = occurrences(base, '2024-01-01', '2026-08-31');
    expect(occ.map((o) => `${o.date} ${o.amount} ${o.currency}`)).toEqual([
      '2024-11-07 24.6 USD', '2024-12-07 24.6 USD', '2025-01-07 24.6 USD', '2025-02-07 24.6 USD', '2025-03-07 24.6 USD',
      '2025-10-07 24.6 USD', '2025-11-07 24.6 USD',
      '2026-06-05 18.7 EUR', '2026-07-05 18.7 EUR', '2026-08-05 18.7 EUR',
    ]);
  });

  it('builds a timeline with pauses, newest first', () => {
    const t = planTimeline(base, '2026-10-20');
    expect(t.map((s) => (s.kind === 'pause' ? `pause ${s.from}..${s.to}` : `plan ${s.start} x${s.charges} ${s.total.toFixed(2)} ${s.currency}`))).toEqual([
      'plan 2026-06-05 x5 93.50 EUR',
      'pause 2025-11-08..2026-06-04',
      'plan 2025-10-07 x2 49.20 USD',
      'pause 2025-03-08..2025-10-06',
      'plan 2024-11-07 x5 123.00 USD',
    ]);
  });

  it('a plan change keeps earlier charges and starts the new schedule', () => {
    const tv: Subscription = { ...base, periods: undefined, name: 'Apple TV', amount: 29.9, currency: 'BRL', startDate: '2025-02-18',
      priceHistory: [{ until: '2025-09-18', amount: 21.9 }] };
    const annual = startNewPlan(tv, '2025-12-18', { schedule: { kind: 'yearly' }, amount: 219 });
    const occ = occurrences(annual, '2025-01-01', '2026-12-31').map((o) => `${o.date} ${o.amount}`);
    expect(occ).toHaveLength(12);
    expect(occ.slice(0, 1)).toEqual(['2025-02-18 21.9']);
    expect(occ.slice(-3)).toEqual(['2025-11-18 29.9', '2025-12-18 219', '2026-12-18 219']);
  });

  it('resuming a canceled subscription adds a pause', () => {
    const canceled: Subscription = { ...base, periods: undefined, startDate: '2021-09-19', amount: 32, currency: 'BRL', status: 'canceled', statusDate: '2021-11-19' };
    const resumed = startNewPlan(canceled, '2024-03-05', { amount: 24.9 });
    const t = planTimeline(resumed, '2024-05-01');
    expect(t[0]).toMatchObject({ kind: 'plan', start: '2024-03-05', charges: 2 });
    expect(t[1]).toMatchObject({ kind: 'pause', from: '2021-11-20', to: '2024-03-04' });
    expect(t[2]).toMatchObject({ kind: 'plan', start: '2021-09-19', charges: 3, total: 96 });
  });
});
