import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { daysInMonth, firstWeekday, fmt, MONTHS, WEEKDAYS } from '../lib/dates';
import { convert, formatMoney, settingsFormat } from '../lib/money';
import { scheduleLabel } from '../lib/schedule';
import { monthSummary } from '../lib/stats';
import type { Occurrence, Subscription } from '../lib/types';
import { useStore } from '../store';
import { ReturnIcon } from './icons';
import { alpha, blurSwap, Money, Popover, ServiceIcon, softSpring, usePopover } from './ui';

interface Props {
  year: number;
  month: number;
  direction: 1 | -1;
  subs: Subscription[];
  onShift: (delta: number) => void;
  onToday: () => void;
  onAdd: (date?: string) => void;
  onOpen: (sub: Subscription) => void;
}

const GAP = 6;
const BAR_H = 58;
const HEAD_H = 150;
const WEEK_H = 34;

export function Calendar({ year, month, direction, subs, onShift, onToday, onAdd, onOpen }: Props) {
  const { data, today } = useStore();
  const [showRemaining, setShowRemaining] = useState(false);
  const summary = useMemo(() => monthSummary(data, subs, year, month, today), [data, subs, year, month, today]);
  const fmtOpts = settingsFormat(data.settings);
  const isCurrent = today.startsWith(`${year}-${String(month).padStart(2, '0')}`);

  // Cell height from the available space: always room for six week rows.
  const root = useRef<HTMLDivElement>(null);
  const [cellH, setCellH] = useState(48);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const avail = el.clientHeight - HEAD_H - WEEK_H - BAR_H - 26;
      const byHeight = (avail - GAP * 5) / 6;
      const byWidth = ((el.clientWidth - 36 - GAP * 6) / 7) * 0.9;
      setCellH(Math.max(30, Math.min(byHeight, byWidth)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mouse wheel and horizontal drag change the month.
  const wheelAcc = useRef(0);
  const wheelLock = useRef(0);
  const onWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now < wheelLock.current) return;
    wheelAcc.current += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(wheelAcc.current) > 60) {
      onShift(wheelAcc.current > 0 ? 1 : -1);
      wheelAcc.current = 0;
      wheelLock.current = now + 380;
    }
  };
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const byDay = useMemo(() => {
    const map = new Map<number, Occurrence[]>();
    for (const o of summary.occurrences) {
      const d = Number(o.date.slice(8, 10));
      map.set(d, [...(map.get(d) ?? []), o]);
    }
    // Most expensive charge of the day leads (its icon and colour represent the day).
    const value = (o: Occurrence) => convert(o.amount, o.currency, data.settings.mainCurrency, data.settings.rates);
    for (const list of map.values()) list.sort((a, b) => value(b) - value(a));
    return map;
  }, [summary, data.settings.mainCurrency, data.settings.rates]);

  const dayPop = usePopover();

  // Hovering a day with charges shows them after a short delay, without clicking.
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverTimer = useRef(0);
  const showHover = (el: Element, iso: string, occ: Occurrence[]) => {
    window.clearTimeout(hoverTimer.current);
    const rect = el.getBoundingClientRect();
    hoverTimer.current = window.setTimeout(() => setHover({ rect, iso, occ }), hover ? 60 : 260);
  };
  const hideHover = () => { window.clearTimeout(hoverTimer.current); setHover(null); };
  const [popDay, setPopDay] = useState<Occurrence[]>([]);

  useEffect(() => { setShowRemaining(false); hideHover(); }, [year, month]); // eslint-disable-line

  const lead = firstWeekday(year, month);
  const total = daysInMonth(year, month);
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const rows = Math.ceil(cells.length / 7);

  return (
    <div className="calendar" onWheel={onWheel} ref={root}>
      <div className="cal-head">
        <div className="cal-month">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={showRemaining ? 'rem' : `${year}-${month}`} {...blurSwap}>
              {showRemaining ? 'Remaining' : `${MONTHS[month - 1]}, ${year}`}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="cal-total" onClick={() => setShowRemaining((v) => !v)} title="Click to toggle remaining">
          <Money value={showRemaining ? summary.remaining : summary.total} currency={data.settings.mainCurrency} opts={fmtOpts} />
        </div>
        <div className="badge-wrap">
          <AnimatePresence mode="popLayout" initial={false}>
            {summary.highlight ? (
              <motion.span key={`h-${summary.highlight.name}`} className="badge highlight" {...blurSwap}>
                <i style={{ background: 'var(--text-3)' }} />
                {summary.highlight.name} · {formatMoney(summary.highlight.amount, data.settings.mainCurrency, fmtOpts)}
              </motion.span>
            ) : (
              <motion.span key="regular" className="badge regular" {...blurSwap}>Regular Month</motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div style={{ flex: 1, maxHeight: 70 }} />
      <div className="weekdays">{WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}</div>

      <div className="grid-area">
      <motion.div
        className="grid-viewport"
        initial={false}
        animate={{ height: rows * cellH + (rows - 1) * GAP }}
        transition={softSpring}
        onPointerDown={(e) => { drag.current = { x: e.clientX, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d && !d.moved && Math.abs(e.clientX - d.x) > 50) {
            d.moved = true;
            suppressClick.current = true;
            onShift(e.clientX < d.x ? 1 : -1);
          }
        }}
        onPointerUp={() => { drag.current = null; setTimeout(() => (suppressClick.current = false), 0); }}
        onPointerLeave={() => { drag.current = null; }}
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={`${year}-${month}`}
            className="grid"
            style={{ gridAutoRows: cellH, gap: GAP, alignContent: 'start' }}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: `${d * 105}%`, opacity: 0.6 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: `${-d * 105}%`, opacity: 0.6 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={softSpring}
          >
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} className="cell empty" />;
              const iso = fmt({ y: year, m: month, d: day });
              const occ = byDay.get(day) ?? [];
              const tint = occ[0]?.sub.color;
              return (
                <div
                  key={day}
                  className={`cell clickable ${iso === today ? 'today' : ''}`}
                  style={tint ? { background: alpha(tint, 0.26) } : undefined}
                  onClick={(e) => {
                    hideHover();
                    if (suppressClick.current) return;
                    if (occ.length === 1) onOpen(occ[0].sub);
                    else if (occ.length > 1) { setPopDay(occ); dayPop.open(e); }
                    else onAdd(iso);
                  }}
                  onMouseEnter={(e) => occ.length && showHover(e.currentTarget, iso, occ)}
                  onMouseLeave={hideHover}
                >
                  {occ.length > 0 && (
                    <div className="icons">
                      <motion.div className="icon-stack" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 26, delay: 0.05 + (i % 7) * 0.015 }}>
                        <ServiceIcon sub={occ[0].sub} size={Math.min(38, cellH * 0.56)} />
                        {occ.length === 2 && <ServiceIcon sub={occ[1].sub} size={Math.min(38, cellH * 0.56)} />}
                        {/* First icon + how many more charges share the day. */}
                        {occ.length > 2 && <span className="count">{occ.length - 1}</span>}
                      </motion.div>
                    </div>
                  )}
                  <span className="num">{day}</span>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="bottom-bar">
        <motion.button layout className="pill-btn" onClick={() => (isCurrent ? onAdd() : onToday())}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={isCurrent ? 'add' : 'cur'} style={{ display: 'flex', gap: 6, alignItems: 'center' }} {...blurSwap}>
              {isCurrent ? <><span className="accent">+</span>Add subscription</> : <><ReturnIcon />Current</>}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
      </div>

      <DayHoverCard hover={dayPop.anchor ? null : hover} />

      <Popover anchor={dayPop.anchor} onClose={dayPop.close}>
        {popDay.map((o) => (
          <button key={o.sub.id} className="day-pop-row" onClick={() => { dayPop.close(); onOpen(o.sub); }}>
            <ServiceIcon sub={o.sub} size={26} />
            <span className="meta">
              {o.sub.name}
              <small>{scheduleLabel(o.schedule)}</small>
            </span>
            <span style={{ color: 'var(--text-2)' }}>{formatMoney(o.amount, o.currency, fmtOpts)}</span>
          </button>
        ))}
      </Popover>
    </div>
  );
}

interface HoverState { rect: DOMRect; iso: string; occ: Occurrence[] }

function DayHoverCard({ hover }: { hover: HoverState | null }) {
  const { data } = useStore();
  const fmt = settingsFormat(data.settings);
  const main = data.settings.mainCurrency;
  const W = 230;
  const pos = hover && (() => {
    const right = hover.rect.right + 10 + W < window.innerWidth;
    return {
      left: right ? hover.rect.right + 10 : hover.rect.left - 10 - W,
      top: Math.max(8, Math.min(hover.rect.top - 6, window.innerHeight - 60 - hover.occ.length * 44)),
      origin: right ? 'left center' : 'right center',
    };
  })();
  const total = hover ? hover.occ.reduce((a, o) => a + convert(o.amount, o.currency, main, data.settings.rates), 0) : 0;
  return createPortal(
    <AnimatePresence>
      {hover && pos && (
        <motion.div key={hover.iso} className="hover-card" style={{ left: pos.left, top: pos.top, width: W, transformOrigin: pos.origin }}
          initial={{ opacity: 0, scale: 0.85, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.9, filter: 'blur(6px)', transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}>
          <div className="hc-date">{longWeekday(hover.iso)}</div>
          {hover.occ.map((o) => (
            <div key={o.sub.id} className="hc-row">
              <ServiceIcon sub={o.sub} size={24} />
              <span className="meta">{o.sub.name}<small>{scheduleLabel(o.schedule)}</small></span>
              <span>{formatMoney(o.amount, o.currency, fmt)}</span>
            </div>
          ))}
          {hover.occ.length > 1 && <div className="hc-total"><span>Total</span><span>{formatMoney(total, main, fmt)}</span></div>}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function longWeekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
