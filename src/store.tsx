import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchRates, loadData, saveData, scheduleNotifications, updateTray } from './lib/backend';
import { addDays, longDate, todayISO } from './lib/dates';
import { normalize } from './lib/defaults';
import { formatMoney, settingsFormat } from './lib/money';
import { buildReminders } from './lib/reminders';
import { occurrencesIn } from './lib/schedule';
import type { AppData } from './lib/types';

interface Store {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  refreshRates: () => Promise<void>;
  today: string;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

function trayText(data: AppData, today: string): string {
  const subs = data.subscriptions.filter((s) => s.status === 'active');
  const next = occurrencesIn(subs, today, addDays(today, 400))[0];
  if (!next) return 'Subscriptions+';
  const price = formatMoney(next.amount, next.sub.currency, settingsFormat(data.settings));
  return `Subscriptions+\nNext: ${next.sub.name} · ${price} · ${longDate(next.date)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [today, setToday] = useState(todayISO());
  const saveTimer = useRef<number>(0);

  useEffect(() => {
    loadData()
      .then((raw) => {
        const d = normalize(raw);
        setData(d);
        // Rewrite files from older versions (e.g. with the removed Personal/Work lists).
        if (raw && 'lists' in raw) saveData(d).catch(console.error);
      })
      .catch(() => setData(normalize(null)));
    // Keep "today" correct when the app stays open past midnight.
    const t = window.setInterval(() => setToday(todayISO()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const persist = useCallback((d: AppData) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveData(d).catch(console.error);
      scheduleNotifications(buildReminders(d)).catch(console.error);
      updateTray(trayText(d, todayISO())).catch(console.error);
    }, 250);
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  const refreshRates = useCallback(async () => {
    const r = await fetchRates();
    update((d) => ({ ...d, settings: { ...d.settings, rates: { EUR: 1, USD: r.USD, BRL: r.BRL, updatedAt: new Date().toISOString() } } }));
  }, [update]);

  // First run of the day: refresh rates (silently) and re-sync reminders/tray.
  useEffect(() => {
    if (!data) return;
    const last = data.settings.rates.updatedAt;
    if (!last || Date.now() - Date.parse(last) > 12 * 3600_000) refreshRates().catch(() => {});
    scheduleNotifications(buildReminders(data)).catch(console.error);
    updateTray(trayText(data, today)).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data === null, today]);

  useEffect(() => {
    document.documentElement.classList.toggle('true-dark', !!data?.settings.trueDark);
  }, [data?.settings.trueDark]);

  if (!data) return null;
  return <Ctx.Provider value={{ data, update, refreshRates, today }}>{children}</Ctx.Provider>;
}
