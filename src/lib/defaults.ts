import type { AppData, Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
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

export function defaultData(): AppData {
  return {
    version: 1,
    subscriptions: [],
    categories: DEFAULT_CATEGORIES,
    paymentMethods: [],
    settings: {
      mainCurrency: 'EUR',
      rounding: false,
      abbreviate: true,
      trueDark: false,
      firstReminder: { days: 1, time: '09:00' },
      secondReminder: { days: null, time: '09:00' },
      startWithWindows: false,
      // Approximate fallback until the first online update.
      rates: { EUR: 1, USD: 1.08, BRL: 6.1, updatedAt: null },
    },
  };
}

/** Fills fields added in later versions so older files keep loading. */
export function normalize(raw: Partial<AppData> | null): AppData {
  const d = defaultData();
  if (!raw) return d;
  // Lists (Personal/Work) were removed in 1.2: drop them from older files.
  const { lists: _lists, ...rest } = raw as Partial<AppData> & { lists?: unknown };
  return {
    ...d,
    ...rest,
    settings: { ...d.settings, ...raw.settings, rates: { ...d.settings.rates, ...raw.settings?.rates } },
    categories: raw.categories?.length ? raw.categories : d.categories,
    paymentMethods: raw.paymentMethods ?? d.paymentMethods,
    subscriptions: (raw.subscriptions ?? []).map((s) => {
      const { listId: _listId, ...sub } = s as typeof s & { listId?: string };
      return sub;
    }),
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
