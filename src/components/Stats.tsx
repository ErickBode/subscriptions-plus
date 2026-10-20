import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MONTHS } from '../lib/dates';
import { formatMoney, formatNumber, settingsFormat } from '../lib/money';
import { scheduleLabel } from '../lib/schedule';
import { categoryBreakdown, yearStats, type CategorySlice, type YearStats } from '../lib/stats';
import type { Subscription } from '../lib/types';
import { useStore } from '../store';
import { Chevrons, ChevRight } from './icons';
import { blurSwap, Money, Select, ServiceIcon, SheetHeader } from './ui';

type Mode = 'category' | 'year';

export function Stats({ subs, onClose, onBreakdown }: {
  subs: Subscription[];
  onClose: () => void;
  onBreakdown: (year: number, categoryId: string) => void;
}) {
  const { data, today } = useStore();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [mode, setMode] = useState<Mode>('category');
  const stats = useMemo(() => yearStats(data, subs, year), [data, subs, year]);
  const minYear = Math.min(thisYear - 1, ...data.subscriptions.map((s) => Number(s.startDate.slice(0, 4))));
  const years = Array.from({ length: thisYear + 1 - minYear + 1 }, (_, i) => minYear + i);
  const fmt = settingsFormat(data.settings);

  return (
    <>
      <SheetHeader title="" onClose={onClose}
        left={
          <Select value={year} onChange={setYear} className="text-pill" align="left" options={years.map((y) => ({ value: y, label: String(y) }))}>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{year} <Chevrons /></span>
          </Select>
        }
        right={
          <Select value={mode} onChange={setMode} className="text-pill"
            options={[{ value: 'year' as const, label: 'Year' }, { value: 'category' as const, label: 'Category' }]}>
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{mode === 'year' ? 'Year' : 'Category'} <Chevrons /></span>
          </Select>
        }
      />
      <div className="sheet-body">
        <div className="stats-sub">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={`${stats.activeCount}-${year}`} {...blurSwap}>
              You have {stats.activeCount} active subscription{stats.activeCount === 1 ? '' : 's'}
            </motion.div>
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mode} initial={{ opacity: 0, scale: 0.92, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.92, filter: 'blur(8px)' }} transition={{ duration: 0.25 }}>
            {mode === 'category'
              ? <Donut slices={stats.categories} year={year} onCenter={(id) => onBreakdown(year, id)} />
              : <Radar stats={stats} />}
          </motion.div>
        </AnimatePresence>
        <div className="stat-cards">
          <div className="stat-card">
            <div className="t">
              <span>Yearly<br />Forecast</span>
              {stats.change !== null && (
                <span className={`change ${stats.change < 0 ? 'down' : ''}`}>{stats.change < 0 ? '↓' : '↑'} {formatNumber(Math.abs(Math.round(stats.change)), { rounding: true })}%</span>
              )}
            </div>
            <div className="v"><Money value={stats.total} currency={data.settings.mainCurrency} opts={{ ...fmt, rounding: true }} /></div>
          </div>
          <div className="stat-card">
            <div className="t"><span>Average<br />Monthly Cost</span></div>
            <div className="v"><Money value={stats.averageMonthly} currency={data.settings.mainCurrency} opts={{ ...fmt, rounding: true }} /></div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- donut ----------
const R = 92;
const SW = 17;
const GAP_DEG = 7;

function arcPath(a0: number, a1: number): string {
  // Angles in degrees, 0 = 12 o'clock, clockwise.
  const p = (a: number) => {
    const r = ((a - 90) * Math.PI) / 180;
    return `${(R * Math.cos(r)).toFixed(2)} ${(R * Math.sin(r)).toFixed(2)}`;
  };
  return `M ${p(a0)} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
}

function Donut({ slices, year, onCenter }: { slices: CategorySlice[]; year: number; onCenter: (categoryId: string) => void }) {
  const { data } = useStore();
  const fmt = settingsFormat(data.settings);
  const [sel, setSel] = useState(0);
  const rotation = useMotionValue(0);
  const rotRef = useRef(0);

  // Segment geometry; tiny slices still get a visible minimum.
  const segs = useMemo(() => {
    if (!slices.length) return [];
    const gap = slices.length > 1 ? GAP_DEG : 0;
    const avail = 360 - gap * slices.length;
    const min = 6;
    const raw = slices.map((s) => Math.max(min, s.share * avail));
    const scale = avail / raw.reduce((a, b) => a + b, 0);
    let a = 0;
    return slices.map((s, i) => {
      const len = raw[i] * scale;
      const seg = { ...s, a0: a, a1: a + len, mid: a + len / 2 };
      a += len + gap;
      return seg;
    });
  }, [slices]);

  useEffect(() => setSel(0), [year]);
  const idx = Math.min(sel, Math.max(0, segs.length - 1));
  const cur = segs[idx];

  // Rotate so the selected segment sits under the ▼ marker, taking the shortest way round.
  useEffect(() => {
    if (!cur) return;
    let target = -cur.mid;
    const delta = ((target - rotRef.current + 540) % 360) - 180;
    target = rotRef.current + delta;
    rotRef.current = target;
    animate(rotation, target, { type: 'spring', stiffness: 140, damping: 18, mass: 0.9 });
  }, [cur?.mid, cur, rotation]);

  const step = (d: number) => segs.length && setSel((i) => (i + d + segs.length) % segs.length);
  const wheelLock = useRef(0);
  const drag = useRef<number | null>(null);

  if (!cur) return <div className="chart-area"><div className="empty-state" style={{ padding: 0 }}>No charges in {year}.</div></div>;

  return (
    <div
      className="chart-area"
      onWheel={(e) => {
        if (Date.now() < wheelLock.current) return;
        wheelLock.current = Date.now() + 260;
        step(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1);
      }}
      onPointerDown={(e) => { drag.current = e.clientX; }}
      onPointerMove={(e) => {
        if (drag.current !== null && Math.abs(e.clientX - drag.current) > 40) {
          step(e.clientX < drag.current ? 1 : -1);
          drag.current = e.clientX;
        }
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerLeave={() => { drag.current = null; }}
    >
      <motion.div className="glow" animate={{ background: `radial-gradient(circle, ${cur.color}, transparent 65%)` }} transition={{ duration: 0.6 }} />
      <svg width="250" height="250" viewBox="-125 -125 250 250" style={{ overflow: 'visible' }}>
        <path d="M -6 -122 L 6 -122 L 0 -114 Z" fill="rgba(255,255,255,.55)" />
        <circle r={R + 22} fill="none" stroke="rgba(255,255,255,.05)" />
        <motion.g style={{ rotate: rotation }}>
          {segs.map((s, i) => (
            <motion.path
              key={s.categoryId}
              d={arcPath(s.a0, s.a1)}
              fill="none"
              strokeWidth={SW}
              strokeLinecap="round"
              initial={{ pathLength: 0, stroke: 'rgba(255,255,255,.16)' }}
              animate={{ pathLength: 1, stroke: i === idx ? s.color : 'rgba(255,255,255,.16)' }}
              transition={{ pathLength: { delay: 0.08 + i * 0.07, duration: 0.55, ease: [0.3, 0.8, 0.3, 1] }, stroke: { duration: 0.35 } }}
              style={{ cursor: 'pointer', filter: i === idx ? `drop-shadow(0 0 10px ${s.color}88)` : undefined }}
              onClick={() => setSel(i)}
            />
          ))}
        </motion.g>
        <circle r={R - 26} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onCenter(cur.categoryId)} />
      </svg>
      <div className="donut-label">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={cur.categoryId} {...blurSwap}>
            <b>{cur.name}</b>
            <span>{formatMoney(cur.total, data.settings.mainCurrency, fmt)} • {Math.round(cur.share * 100)}%</span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="dots" style={{ position: 'absolute', bottom: 0 }}>
        {segs.map((s, i) => (
          <i key={s.categoryId} onClick={() => setSel(i)} style={{ cursor: 'pointer', background: i === idx ? s.color : undefined, transform: i === idx ? 'scale(1.3)' : undefined }} />
        ))}
      </div>
    </div>
  );
}

// ---------- radar ----------
const RR = 100;

function smoothPath(pts: [number, number][]): string {
  // Closed Catmull-Rom spline through the points.
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + ' Z';
}

function Radar({ stats }: { stats: YearStats }) {
  const { data, today } = useStore();
  const fmt = settingsFormat(data.settings);
  const max = Math.max(...stats.months.map((m) => m.total), 1);
  const pts = stats.months.map((m, i): [number, number] => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    const r = 14 + (m.total / max) * (RR - 14);
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  const peak = stats.months.findIndex((m) => m.total === max);
  const curMonth = Number(today.slice(0, 4)) === stats.year ? Number(today.slice(5, 7)) - 1 : peak;
  const [hover, setHover] = useState<number | null>(curMonth);
  useEffect(() => setHover(curMonth), [stats.year]); // eslint-disable-line
  const h = hover !== null ? stats.months[hover] : null;

  return (
    <div className="chart-area">
      <svg width="250" height="250" viewBox="-125 -125 250 250" style={{ overflow: 'visible' }}>
        {[0.33, 0.66, 1].map((k) => <circle key={k} r={RR * k} fill="none" stroke="rgba(255,255,255,.08)" />)}
        {pts.map((_, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          return <line key={i} x1={0} y1={0} x2={RR * Math.cos(a)} y2={RR * Math.sin(a)} stroke="rgba(255,255,255,.06)" />;
        })}
        <motion.path
          initial={{ d: smoothPath(pts.map(() => [0, 0])), opacity: 0 }}
          animate={{ d: smoothPath(pts), opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          fill="rgba(255,255,255,.16)"
          stroke="rgba(255,255,255,.28)"
          strokeWidth={1}
        />
        {pts.map(([x, y], i) => (
          <motion.circle key={i} r={i === hover ? 5.5 : 3}
            animate={{ cx: x, cy: y }} initial={{ cx: 0, cy: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 16 }}
            fill={i === peak ? '#2f81f7' : i === hover ? '#fff' : 'rgba(255,255,255,.45)'}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
        {pts.map(([x, y], i) => (
          <text key={`t${i}`} x={x * 0 + 1.12 * RR * Math.cos(((i * 30 - 90) * Math.PI) / 180)} y={1.12 * RR * Math.sin(((i * 30 - 90) * Math.PI) / 180) + 3}
            fontSize="8.5" fill="rgba(255,255,255,.3)" textAnchor="middle">{MONTHS[i][0]}</text>
        ))}
      </svg>
      <AnimatePresence>
        {h && hover !== null && (
          <motion.div key="tip" className="radar-tip" style={{ left: '50%', bottom: 4 }}
            initial={{ opacity: 0, y: 6, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={hover} {...blurSwap}>
                <b>{MONTHS[hover]}</b>
                <div className="amt">{formatMoney(h.total, data.settings.mainCurrency, fmt)}</div>
                {h.top && (
                  <div className="top">
                    <ServiceIcon sub={h.top.sub} size={16} />
                    <span style={{ color: 'var(--text)' }}>{h.top.name}</span> • {formatMoney(h.top.amount, data.settings.mainCurrency, fmt)}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- category breakdown ----------
export function Breakdown({ subs, year, categoryId, onOpen, onClose }: {
  subs: Subscription[]; year: number; categoryId: string; onOpen: (s: Subscription) => void; onClose: () => void;
}) {
  const { data } = useStore();
  const fmt = settingsFormat(data.settings);
  const lines = categoryBreakdown(data, subs, year, categoryId);
  const cat = data.categories.find((c) => c.id === categoryId);
  const total = lines.reduce((a, l) => a + l.total, 0);
  return (
    <>
      <SheetHeader title={<span style={{ display: 'block', lineHeight: 1.2 }}>{cat?.name}<small style={{ display: 'block', color: 'var(--text-3)', fontWeight: 400, fontSize: 10.5 }}>Total in {year}</small></span>} onClose={onClose} />
      <div className="sheet-body">
        <div className="group" style={{ padding: '4px 6px' }}>
          {lines.map((l, i) => (
            <motion.button key={l.sub.id} className="sub-row" onClick={() => onOpen(l.sub)}
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <ServiceIcon sub={l.sub} size={30} />
              <div className="meta"><div>{l.sub.name}</div><div>{scheduleLabel(l.sub.schedule)}</div></div>
              <span>{formatMoney(l.total, data.settings.mainCurrency, fmt)}</span>
              <ChevRight />
            </motion.button>
          ))}
        </div>
        <div className="group"><div className="row"><span className="label">Total</span><b>{formatMoney(total, data.settings.mainCurrency, fmt)}</b></div></div>
      </div>
    </>
  );
}
