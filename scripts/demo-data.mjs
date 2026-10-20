// Fictional subscriptions used for the README screenshots (and handy to try the app).
// Run: node scripts/demo-data.mjs <output.json>   — then Settings → Import Data.
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CATEGORIES = [
  { id: 'streaming', name: 'Streaming', color: '#E5484D' },
  { id: 'music', name: 'Music', color: '#30A46C' },
  { id: 'ai', name: 'AI', color: '#12A594' },
  { id: 'apps', name: 'Apps & Cloud', color: '#2F81F7' },
  { id: 'games', name: 'Games & RPG', color: '#8E4EC6' },
  { id: 'creators', name: 'Creators', color: '#F76B15' },
  { id: 'learning', name: 'Learning', color: '#E2C044' },
  { id: 'services', name: 'Services', color: '#D6409F' },
  { id: 'other', name: 'Other', color: '#6E6E73', system: true },
];

const monthly = { kind: 'monthly' };
const yearly = { kind: 'yearly' };

/** Builds the demo file relative to `today` (YYYY-MM-DD) so the calendar always looks busy. */
export function demoData(today = new Date().toISOString().slice(0, 10)) {
  const [y, m] = today.split('-').map(Number);
  const day = (monthsAgo, d) => {
    const dt = new Date(Date.UTC(y, m - 1 - monthsAgo, d));
    return dt.toISOString().slice(0, 10);
  };
  let n = 0;
  const sub = (name, serviceId, slug, color, categoryId, amount, currency, schedule, startDate, extra = {}) => ({
    id: `demo${String(++n).padStart(2, '0')}`,
    name, serviceId, icon: { type: 'simple', slug }, color, categoryId,
    amount, currency, schedule, startDate,
    status: 'active', notifications: 'default', notes: '', createdAt: `${today}T09:00:00.000Z`,
    ...extra,
  });
  return {
    version: 1,
    categories: CATEGORIES,
    paymentMethods: [
      { id: 'visa', name: 'Everyday Visa', brand: 'visa', last4: '4242' },
      { id: 'mc', name: 'Travel Mastercard', brand: 'mastercard', last4: '5454' },
    ],
    subscriptions: [
      sub('Netflix', 'netflix', 'netflix', '#E50914', 'streaming', 13.99, 'EUR', monthly, day(14, 3), {
        paymentMethodId: 'visa', priceHistory: [{ until: day(5, 3), amount: 12.99 }],
      }),
      sub('Spotify', 'spotify', 'spotify', '#1ED760', 'music', 11.99, 'EUR', monthly, day(30, 12), { paymentMethodId: 'visa' }),
      sub('YouTube', 'youtube', 'youtube', '#FF0000', 'streaming', 13.99, 'USD', monthly, day(8, 21), { paymentMethodId: 'mc' }),
      sub('Disney+', 'disneyplus', 'tabler:brand-disney', '#113CCF', 'streaming', 109.9, 'EUR', yearly, day(4, 27), { paymentMethodId: 'visa' }),
      sub('ChatGPT', 'chatgpt', 'ri:openai-fill', '#10A37F', 'ai', 20, 'USD', monthly, day(3, 8), {
        paymentMethodId: 'mc',
        periods: [{ start: day(16, 8), end: day(9, 8), schedule: monthly, amount: 20, currency: 'USD', note: 'First plan, paused for a while.' }],
      }),
      sub('Claude', 'claude', 'claude', '#D97757', 'ai', 18, 'EUR', monthly, day(6, 17), { paymentMethodId: 'mc' }),
      sub('Notion', 'notion', 'notion', '#4A4A4A', 'apps', 96, 'USD', yearly, day(9, 9), { paymentMethodId: 'visa' }),
      sub('1Password', '1password', '1password', '#145FE4', 'apps', 35.88, 'USD', yearly, day(1, 15), { paymentMethodId: 'visa' }),
      sub('Apple iCloud', 'icloud', 'icloud', '#3693F3', 'apps', 2.99, 'EUR', monthly, day(20, 25), { paymentMethodId: 'visa' }),
      sub('Duolingo', 'duolingo', 'duolingo', '#58CC02', 'learning', 59.99, 'EUR', yearly, day(3, 2), { paymentMethodId: 'mc' }),
      sub('Xbox Game Pass', 'xbox', 'fa6-brands:xbox', '#107C10', 'games', 14.99, 'EUR', monthly, day(2, 19), { paymentMethodId: 'mc' }),
      sub('Figma', 'figma', 'figma', '#F24E1E', 'apps', 75, 'BRL', monthly, day(5, 6), { paymentMethodId: 'mc' }),
      sub('Dropbox', 'dropbox', 'dropbox', '#0061FF', 'apps', 9.99, 'EUR', monthly, day(24, 1), {
        status: 'canceled', statusDate: day(2, 1), paymentMethodId: 'visa',
      }),
    ],
    settings: {
      mainCurrency: 'EUR',
      rounding: false,
      abbreviate: true,
      trueDark: false,
      firstReminder: { days: 1, time: '09:00' },
      secondReminder: { days: null, time: '09:00' },
      startWithWindows: false,
      rates: { EUR: 1, USD: 1.12, BRL: 5.9, updatedAt: `${today}T08:00:00.000Z` },
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  if (!out) throw new Error('usage: node scripts/demo-data.mjs <output.json>');
  if (existsSync(out)) throw new Error(`${out} already exists; refusing to overwrite`);
  writeFileSync(out, JSON.stringify(demoData(), null, 2));
  console.log(`wrote ${out}`);
}
