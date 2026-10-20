import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ServiceIcon, Money, blurSwap } from './components/ui';
import { loadData, onTrayShown, openMain } from './lib/backend';
import { MONTHS, todayISO } from './lib/dates';
import { normalize } from './lib/defaults';
import { formatMoney, settingsFormat } from './lib/money';
import { monthSummary } from './lib/stats';
import type { AppData } from './lib/types';
import { relativeDay, sumMain, trialsEnding, upcomingCharges } from './lib/upcoming';

/** Compact panel shown when clicking the tray icon: this month and the next charges. */
export function TrayApp() {
  const [data, setData] = useState<AppData | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const load = () => loadData().then((raw) => { setData(normalize(raw)); setShown((n) => n + 1); }).catch(console.error);
    load();
    return onTrayShown(load);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('true-dark', !!data?.settings.trueDark);
    document.documentElement.classList.add('tray-root');
  }, [data?.settings.trueDark]);

  if (!data) return null;
  const today = todayISO();
  const [y, m] = today.split('-').map(Number);
  const subs = data.subscriptions;
  const month = monthSummary(data, subs, y, m, today);
  let upcoming = upcomingCharges(data, subs, today, 7);
  let range = 7;
  if (upcoming.length === 0) { upcoming = upcomingCharges(data, subs, today, 30); range = 30; }
  const trials = trialsEnding(subs, today);
  const fmt = settingsFormat(data.settings);
  const main = data.settings.mainCurrency;

  return (
    <div className="tray-app" key={shown}>
      <motion.div className="tray-head" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
        <div className="tray-month">{MONTHS[m - 1]}, {y}</div>
        <div className="tray-total"><Money value={month.total} currency={main} opts={fmt} /></div>
        <div className="tray-sub">
          <span>Remaining <b>{formatMoney(month.remaining, main, fmt)}</b></span>
          <span>Next {range}d <b>{formatMoney(sumMain(data, upcoming), main, fmt)}</b></span>
        </div>
      </motion.div>

      {trials.map((t) => (
        <motion.button key={t.sub.id} className={`trial-card ${t.daysLeft <= 3 ? 'urgent' : ''}`} onClick={() => openMain(`open:${t.sub.id}`)}
          initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
          <ServiceIcon sub={t.sub} size={24} />
          <span className="meta">
            <b>{t.sub.name} trial ends {t.daysLeft === 0 ? 'today' : t.daysLeft === 1 ? 'tomorrow' : `in ${t.daysLeft} days`}</b>
          </span>
        </motion.button>
      ))}

      <div className="tray-list">
        <AnimatePresence initial>
          {upcoming.length === 0 && <motion.div className="panel-empty" {...blurSwap}>No charges in the next 30 days.</motion.div>}
          {upcoming.slice(0, 8).map((o, i) => (
            <motion.button key={`${o.sub.id}-${o.date}`} className="up-row" onClick={() => openMain(`open:${o.sub.id}`)}
              initial={{ opacity: 0, x: 14, filter: 'blur(4px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.05 + i * 0.035, type: 'spring', stiffness: 400, damping: 30 }}>
              <ServiceIcon sub={o.sub} size={26} />
              <span className="meta">
                <span>{o.sub.name}</span>
                <small className={o.date === today ? 'today' : ''}>{relativeDay(today, o.date)}</small>
              </span>
              <span className="amt">{formatMoney(o.amount, o.currency, fmt)}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <div className="tray-foot">
        <button className="pill-btn" onClick={() => openMain('add')}><span className="accent">+</span>Add</button>
        <button className="pill-btn" onClick={() => openMain()}>Open Subscriptions+</button>
      </div>
    </div>
  );
}
