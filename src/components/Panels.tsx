import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { addDays, MONTHS, MONTHS_SHORT, shiftMonth } from '../lib/dates';
import { formatMoney, formatNumber, settingsFormat, SYMBOL } from '../lib/money';
import { monthSummary } from '../lib/stats';
import type { Occurrence, Subscription } from '../lib/types';
import { bigChargesAhead, monthBreakdown, relativeDay, sumMain, trialsEnding, upcomingCharges } from '../lib/upcoming';
import { useStore } from '../store';
import { blurSwap, CardBadge, Money, ServiceIcon, softSpring } from './ui';

const listItem = (i: number) => ({
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { delay: 0.04 + Math.min(i, 10) * 0.03, type: 'spring' as const, stiffness: 380, damping: 30 },
});

// ---------- left: upcoming ----------
export function UpcomingPanel({ subs, onOpen }: { subs: Subscription[]; onOpen: (s: Subscription) => void }) {
  const { data, today } = useStore();
  const fmt = settingsFormat(data.settings);
  const main = data.settings.mainCurrency;
  const next30 = useMemo(() => upcomingCharges(data, subs, today, 30), [data, subs, today]);
  const week = next30.filter((o) => o.date <= addDays(today, 7));
  const trials = useMemo(() => trialsEnding(subs, today), [subs, today]);
  const big = useMemo(() => bigChargesAhead(data, subs, today).filter((o) => !next30.includes(o)), [data, subs, today, next30]);
  const [range, setRange] = useState<7 | 30>(7);
  const shown = range === 7 ? week : next30;

  return (
    <motion.aside className="panel" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={softSpring}>
      <div className="panel-head">
        <span className="panel-title">Upcoming</span>
        <div className="seg">
          {([7, 30] as const).map((r) => (
            <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
              {range === r && <motion.i layoutId="seg-pill" className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <span>{r}d</span>
            </button>
          ))}
        </div>
      </div>
      <div className="panel-total">
        <Money value={sumMain(data, shown)} currency={main} opts={fmt} />
        <small>{shown.length} charge{shown.length === 1 ? '' : 's'} in the next {range} days</small>
      </div>

      <AnimatePresence initial={false}>
        {trials.map((t) => (
          <motion.button key={t.sub.id} className={`trial-card ${t.daysLeft <= 3 ? 'urgent' : ''}`} onClick={() => onOpen(t.sub)}
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={softSpring}>
            <ServiceIcon sub={t.sub} size={28} />
            <span className="meta">
              <b>{t.sub.name} trial ends {t.daysLeft === 0 ? 'today' : t.daysLeft === 1 ? 'tomorrow' : `in ${t.daysLeft} days`}</b>
              <small>{t.sub.amount > 0 ? `Then ${formatMoney(t.sub.amount, t.sub.currency, fmt)} will be charged` : 'Cancel before it ends if you do not want to keep it'}</small>
            </span>
          </motion.button>
        ))}
      </AnimatePresence>

      <div className="panel-list">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.length === 0 ? (
            <motion.div key="empty" className="panel-empty" {...blurSwap}>No charges in the next {range} days.</motion.div>
          ) : shown.map((o, i) => (
            <motion.button key={`${range}-${o.sub.id}-${o.date}`} className="up-row" onClick={() => onOpen(o.sub)} {...listItem(i)} layout="position">
              <ServiceIcon sub={o.sub} size={28} />
              <span className="meta">
                <span>{o.sub.name}</span>
                <small className={o.date === today ? 'today' : ''}>{relativeDay(today, o.date)}</small>
              </span>
              <span className="amt">{formatMoney(o.amount, o.currency, fmt)}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {big.length > 0 && (
        <>
          <div className="panel-sub">Big charges ahead</div>
          <div className="panel-list">
            {big.map((o, i) => (
              <motion.button key={`${o.sub.id}-${o.date}`} className="up-row" onClick={() => onOpen(o.sub)} {...listItem(i)}>
                <ServiceIcon sub={o.sub} size={28} />
                <span className="meta"><span>{o.sub.name}</span><small>{relativeDay(today, o.date)}</small></span>
                <span className="amt">{formatMoney(o.amount, o.currency, fmt)}</span>
              </motion.button>
            ))}
          </div>
        </>
      )}
    </motion.aside>
  );
}

// ---------- right: this month ----------
export function MonthPanel({ subs, year, month, onOpen }: {
  subs: Subscription[]; year: number; month: number; onOpen: (s: Subscription) => void;
}) {
  const { data, today } = useStore();
  const fmt = settingsFormat(data.settings);
  const main = data.settings.mainCurrency;
  const b = useMemo(() => monthBreakdown(data, subs, year, month, today), [data, subs, year, month, today]);
  const paidShare = b.total > 0 ? b.paid / b.total : 0;
  const maxCat = Math.max(...b.categories.map((c) => c.total), 1);
  const maxCard = Math.max(...b.cards.map((c) => c.total), 1);
  // Any number of rows can be open. "Expand all" opens every row (also in other months);
  // rows toggled by hand are exceptions to that default. Open rows stay open while browsing months.
  const [allOpen, setAllOpen] = useState(false);
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const isOpen = (section: string, id: string) => allOpen !== flipped.has(`${section}:${id}`);
  const toggle = (section: string, id: string) => setFlipped((f) => {
    const n = new Set(f);
    const k = `${section}:${id}`;
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const keys = [
    ...b.categories.map((c) => `cat:${c.id}`),
    ...b.currencies.map((c) => `cur:${c.currency}`),
    ...b.cards.map((c) => `card:${c.id ?? 'none'}`),
  ];
  const anyOpen = keys.some((k) => allOpen !== flipped.has(k));
  const setAll = (v: boolean) => { setAllOpen(v); setFlipped(new Set()); };

  return (
    <motion.aside className="panel" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={softSpring}>
      <div className="panel-head">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={`${year}-${month}`} className="panel-title" {...blurSwap}>{MONTHS[month - 1]}</motion.span>
        </AnimatePresence>
        <span className="panel-head-right">
          <span className="panel-hint">{b.count} charge{b.count === 1 ? '' : 's'}</span>
          {keys.length > 0 && (
            <button className="icon-btn small expand-all" onClick={() => setAll(!anyOpen)}
              title={anyOpen ? 'Collapse all' : 'Expand all'} aria-label={anyOpen ? 'Collapse all' : 'Expand all'}>
              <motion.svg viewBox="0 0 12 12" width="12" height="12" animate={{ rotate: anyOpen ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
                <path d="M3 2.5 6 5.5l3-3M3 6.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </button>
          )}
        </span>
      </div>

      <div className="kv"><span>Paid</span><Money value={b.paid} currency={main} opts={fmt} /></div>
      <div className="kv"><span>Remaining</span><Money value={b.remaining} currency={main} opts={fmt} /></div>
      <div className="progress"><motion.i animate={{ width: `${paidShare * 100}%` }} transition={softSpring} /></div>
      <AnimatePresence mode="popLayout" initial={false}>
        {b.vsAverage !== null && (
          <motion.div key={Math.round(b.vsAverage)} className="kv small" {...blurSwap}>
            <span>vs 12-month average</span>
            <span className={`change ${b.vsAverage <= 0 ? 'down' : ''}`}>
              {b.vsAverage <= 0 ? '↓' : '↑'} {formatNumber(Math.abs(Math.round(b.vsAverage)), { rounding: true })}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="panel-sub">By category</div>
      {b.categories.length === 0 && <div className="panel-empty">No charges this month.</div>}
      {b.categories.map((c) => (
        <AccordionRow key={c.id} open={isOpen('cat', c.id)} onToggle={() => toggle('cat', c.id)}
          label={<><i className="dot" style={{ background: c.color }} />{c.name}</>}
          value={formatMoney(c.total, main, fmt)}
          bar={{ color: c.color, share: c.total / maxCat }}
          items={c.items} today={today} onOpen={onOpen} />
      ))}

      <div className="panel-sub">By currency</div>
      {b.currencies.map((c) => (
        <AccordionRow key={c.currency} open={isOpen('cur', c.currency)} onToggle={() => toggle('cur', c.currency)}
          label={<><span className="cur">{SYMBOL[c.currency]}</span>{c.currency}</>}
          value={<>{formatMoney(c.amount, c.currency, fmt)}{c.currency !== main && <small className="conv"> ≈ {formatMoney(c.main, main, fmt)}</small>}</>}
          items={c.items} today={today} onOpen={onOpen} />
      ))}

      <div className="panel-sub">By card</div>
      {b.cards.map((c) => {
        const pm = data.paymentMethods.find((x) => x.id === c.id);
        const key = c.id ?? 'none';
        return (
          <AccordionRow key={key} open={isOpen('card', key)} onToggle={() => toggle('card', key)}
            label={pm
              ? <><CardBadge brand={pm.brand} /><span className="card-line"><span className="card-name">{pm.name}</span>{pm.last4 && <small>•••• {pm.last4}</small>}</span></>
              : <><CardBadge brand="other" /><span className="card-line"><span className="card-name">No card</span><small>Not assigned yet</small></span></>}
            value={formatMoney(c.total, main, fmt)}
            bar={{ color: pm ? '#2f81f7' : '#6e6e73', share: c.total / maxCard }}
            items={c.items} today={today} onOpen={onOpen} />
        );
      })}
    </motion.aside>
  );
}

// Height-only collapse: siblings follow in normal flow, so nothing has to "correct" its position at the end.
const collapse = { duration: 0.32, ease: [0.32, 0.72, 0, 1] as const };

/** A breakdown row that opens in place to list the charges behind its total. */
function AccordionRow({ open, onToggle, label, value, bar, items, today, onOpen }: {
  open: boolean;
  onToggle: () => void;
  label: ReactNode;
  value: ReactNode;
  bar?: { color: string; share: number };
  items: Occurrence[];
  today: string;
  onOpen: (s: Subscription) => void;
}) {
  const { data } = useStore();
  const fmt = settingsFormat(data.settings);
  return (
    <div className={`acc-row ${open ? 'open' : ''}`}>
      <button className="acc-toggle" onClick={onToggle} aria-expanded={open}>
        <div className="kv small">
          <span>
            <motion.svg className="cat-chev" viewBox="0 0 8 8" animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
              <path d="M2.5 1.5 5.5 4l-3 2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
            {label}
          </span>
          <span>{value}</span>
        </div>
        {bar && (
          <div className="bar">
            <motion.i style={{ background: bar.color }} initial={{ width: 0 }} animate={{ width: `${bar.share * 100}%` }} transition={softSpring} />
          </div>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="items" className="acc-items"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={collapse}>
            {/* Spacing lives inside the animated box, so the collapse ends exactly at the row edge. */}
            <div className="acc-inner">
              {items.map((o, i) => (
                <motion.button key={`${o.sub.id}-${o.date}`} className="up-row cat-item" onClick={() => onOpen(o.sub)}
                  initial={{ opacity: 0, x: -8, filter: 'blur(3px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.03 + i * 0.03, type: 'spring', stiffness: 420, damping: 32 }}>
                  <ServiceIcon sub={o.sub} size={24} />
                  <span className="meta">
                    <span>{o.sub.name}</span>
                    <small className={o.date === today ? 'today' : ''}>{dayLabel(o.date, today)}</small>
                  </span>
                  <span className="amt">{formatMoney(o.amount, o.currency, fmt)}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- year strip above the calendar ----------
export function YearStrip({ subs, year, month, onPick }: {
  subs: Subscription[]; year: number; month: number; onPick: (y: number, m: number) => void;
}) {
  const { data, today } = useStore();
  const fmt = settingsFormat(data.settings);
  const totals = useMemo(
    () => Array.from({ length: 12 }, (_, i) => monthSummary(data, subs, year, i + 1, today).total),
    [data, subs, year, today],
  );
  const max = Math.max(...totals, 1);
  const [hover, setHover] = useState<number | null>(null);
  const todayY = Number(today.slice(0, 4));
  const todayM = Number(today.slice(5, 7));
  return (
    <div className="year-strip">
      <div className="ys-head">
        <button className="icon-btn small" onClick={() => onPick(shiftMonth(year, month, -12).y, month)} aria-label="Previous year">‹</button>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={hover ?? year} {...blurSwap}>
            {hover !== null ? `${MONTHS[hover]} · ${formatMoney(totals[hover], data.settings.mainCurrency, fmt)}` : `${year} · ${formatMoney(totals.reduce((a, b) => a + b, 0), data.settings.mainCurrency, { ...fmt, rounding: true })}`}
          </motion.span>
        </AnimatePresence>
        <button className="icon-btn small" onClick={() => onPick(shiftMonth(year, month, 12).y, month)} aria-label="Next year">›</button>
      </div>
      <div className="ys-bars" onMouseLeave={() => setHover(null)}>
        {totals.map((t, i) => {
          const sel = i + 1 === month;
          return (
            <button key={i} className={`ys-col ${sel ? 'sel' : ''}`} onMouseEnter={() => setHover(i)} onClick={() => onPick(year, i + 1)}>
              <span className="ys-track">
                <motion.i className="ys-bar" initial={false} animate={{ height: `${Math.max(4, (t / max) * 100)}%` }} transition={softSpring} />
                {sel && <motion.i layoutId="ys-sel" className="ys-bar ys-bar-sel" style={{ height: `${Math.max(4, (t / max) * 100)}%` }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              </span>
              <span className={`ys-label ${year === todayY && i + 1 === todayM ? 'now' : ''}`}>{MONTHS_SHORT[i][0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Today", "5 Nov · paid" for past charges, "20 Nov" for upcoming ones. */
function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  const [, m, d] = date.split('-').map(Number);
  const label = `${d} ${MONTHS_SHORT[m - 1]}`;
  return date < today ? `${label} · paid` : label;
}
