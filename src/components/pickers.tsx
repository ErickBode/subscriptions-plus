import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { daysInMonth, firstWeekday, fmt, longDate, MONTHS, parse, shiftMonth } from '../lib/dates';
import { useStore } from '../store';
import { ArrowLeft, ArrowRight } from './icons';
import { Popover, usePopover } from './ui';

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Date chip that opens a month calendar popover (gold selection). */
export function DateField({ value, onChange, short = false }: { value: string; onChange: (v: string) => void; short?: boolean }) {
  const { today } = useStore();
  const pop = usePopover();
  const sel = parse(value);
  const [view, setView] = useState({ y: sel.y, m: sel.m, dir: 1 });
  useEffect(() => { if (pop.anchor) setView({ y: sel.y, m: sel.m, dir: 1 }); }, [pop.anchor]); // eslint-disable-line
  const lead = firstWeekday(view.y, view.m);
  const n = daysInMonth(view.y, view.m);
  const go = (d: number) => setView((v) => ({ ...shiftMonth(v.y, v.m, d), dir: d }));
  const label = short ? `${String(sel.d).padStart(2, '0')}/${String(sel.m).padStart(2, '0')}/${String(sel.y).slice(2)}` : longDate(value);
  return (
    <>
      <button className={`chip ${pop.anchor ? 'active' : ''}`} onClick={pop.open}>{label}</button>
      <Popover anchor={pop.anchor} onClose={pop.close} className="popover" align="right">
        <div className="dp-head">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={`${view.y}-${view.m}`} initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(4px)' }}>
              {MONTHS[view.m - 1]} {view.y}
            </motion.span>
          </AnimatePresence>
          <span className="nav">
            <button className="icon-btn" onClick={() => go(-1)}><ArrowLeft /></button>
            <button className="icon-btn" onClick={() => go(1)}><ArrowRight /></button>
          </span>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <AnimatePresence mode="popLayout" initial={false} custom={view.dir}>
            <motion.div key={`${view.y}-${view.m}`} className="dp-grid" custom={view.dir}
              variants={{ enter: (d: number) => ({ x: d * 60, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: -d * 60, opacity: 0 }) }}
              initial="enter" animate="center" exit="exit" transition={{ type: 'spring', stiffness: 400, damping: 36 }}>
              {WD.map((w) => <span key={w} className="wd">{w}</span>)}
              {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
              {Array.from({ length: n }, (_, i) => {
                const iso = fmt({ y: view.y, m: view.m, d: i + 1 });
                return (
                  <button key={iso} className={`dp-day ${iso === value ? 'sel' : ''} ${iso === today ? 'today' : ''}`}
                    onClick={() => { onChange(iso); pop.close(); }}>{i + 1}</button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </Popover>
    </>
  );
}

/** HH:MM chip with two scrolling columns. */
export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const pop = usePopover();
  const [h, m] = value.split(':');
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
  const hRef = useRef<HTMLDivElement>(null);
  const mRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pop.anchor) return;
    requestAnimationFrame(() => {
      hRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'center' });
      mRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'center' });
    });
  }, [pop.anchor]);
  return (
    <>
      <button className={`chip ${pop.anchor ? 'active' : ''}`} onClick={pop.open}>{value}</button>
      <Popover anchor={pop.anchor} onClose={pop.close} className="popover" align="right">
        <div className="tp">
          <div className="tp-col" ref={hRef}>
            {hours.map((x) => <button key={x} className={x === h ? 'sel' : ''} onClick={() => onChange(`${x}:${m}`)}>{x}</button>)}
          </div>
          <div className="tp-col" ref={mRef}>
            {mins.map((x) => <button key={x} className={x === m ? 'sel' : ''} onClick={() => onChange(`${h}:${x}`)}>{x}</button>)}
          </div>
        </div>
      </Popover>
    </>
  );
}
