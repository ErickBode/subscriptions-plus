import NumberFlow from '@number-flow/react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLYPHS, type Glyph } from '../lib/glyphs';
import { flowParts, SYMBOL, type FormatOpts } from '../lib/money';
import type { Currency, Subscription } from '../lib/types';
import { CloseIcon } from './icons';

export const spring = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } as const;
export const softSpring = { type: 'spring', stiffness: 260, damping: 30 } as const;
export const blurSwap = {
  initial: { opacity: 0, filter: 'blur(6px)', scale: 0.96 },
  animate: { opacity: 1, filter: 'blur(0px)', scale: 1 },
  exit: { opacity: 0, filter: 'blur(6px)', scale: 0.96 },
  transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] },
} as const;

// ---------- service icon ----------
export function ServiceIcon({ sub, size = 26, glow = false }: {
  sub: Pick<Subscription, 'icon' | 'color' | 'name'>; size?: number; glow?: boolean;
}) {
  const glyph: Glyph | undefined = sub.icon.type === 'simple' ? GLYPHS[sub.icon.slug] : sub.icon.type === 'svg' ? sub.icon : undefined;
  const g = size * 0.52;
  // Icon sets pad their artwork differently; reframe each glyph on its real bounds so every
  // logo is optically centred and fills the same share of the circle.
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el || !glyph) return;
    try {
      const b = el.getBBox();
      if (!b.width || !b.height) return;
      const stroked = /stroke-width|stroke="/.test(glyph.body);
      const side = Math.max(b.width, b.height) * (stroked ? 1.12 : 1);
      setViewBox(`${b.x + b.width / 2 - side / 2} ${b.y + b.height / 2 - side / 2} ${side} ${side}`);
    } catch { /* not rendered yet: keep the original frame */ }
  }, [glyph?.body]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span
      className="svc"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${sub.color}ee, ${sub.color} 60%, ${shade(sub.color, -0.25)})`,
        fontSize: size * 0.46,
        boxShadow: glow ? `0 8px 30px ${sub.color}66, inset 0 0 0 1px rgba(255,255,255,.15)` : undefined,
      }}
    >
      {glyph ? (
        <svg ref={svgRef} viewBox={viewBox ?? `0 0 ${glyph.width} ${glyph.height}`} width={g} height={g} style={{ color: '#fff', overflow: 'visible' }}
          dangerouslySetInnerHTML={{ __html: glyph.body }} />
      ) : (
        (sub.name.trim()[0] ?? '?').toUpperCase()
      )}
    </span>
  );
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c : 255 - c) * amt)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ---------- animated money ----------
export function Money({ value, currency, opts, className }: {
  value: number; currency: Currency; opts: FormatOpts; className?: string;
}) {
  const p = flowParts(value, opts);
  return (
    <NumberFlow
      className={className}
      value={p.value}
      locales="de-DE"
      format={p.format}
      prefix={SYMBOL[currency]}
      suffix={p.suffix}
      spinTiming={{ duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      opacityTiming={{ duration: 350, easing: 'ease-out' }}
    />
  );
}

// ---------- toggle ----------
export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <motion.span className="knob" animate={{ left: on ? 18 : 2 }} transition={{ type: 'spring', stiffness: 700, damping: 35 }} />
    </button>
  );
}

// ---------- anchored popovers & menus ----------
type Anchor = { x: number; y: number; w: number; h: number };

export function usePopover() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  return {
    anchor,
    open: (e: { currentTarget: Element }) => {
      const r = e.currentTarget.getBoundingClientRect();
      setAnchor({ x: r.left, y: r.top, w: r.width, h: r.height });
    },
    close: () => setAnchor(null),
  };
}

/** Floating panel that grows from its anchor with a blur, like iOS context menus. */
export function Popover({ anchor, onClose, children, className = 'menu', align = 'auto' }: {
  anchor: Anchor | null; onClose: () => void; children: ReactNode; className?: string; align?: 'auto' | 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);
  useLayoutEffect(() => {
    if (!anchor || !ref.current) { setPos(null); return; }
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    const vw = window.innerWidth, vh = window.innerHeight;
    const rightAligned = align === 'right' || (align === 'auto' && anchor.x + anchor.w / 2 > vw / 2);
    let left = rightAligned ? anchor.x + anchor.w - w : anchor.x;
    left = Math.max(8, Math.min(left, vw - w - 8));
    let top = anchor.y + anchor.h + 6;
    let fromTop = true;
    if (top + h > vh - 8) { top = Math.max(8, anchor.y - h - 6); fromTop = false; }
    setPos({ left, top, origin: `${rightAligned ? 'right' : 'left'} ${fromTop ? 'top' : 'bottom'}` });
  }, [anchor, align]);
  useEffect(() => {
    if (!anchor) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [anchor, onClose]);
  return createPortal(
    <AnimatePresence>
      {anchor && (
        <div className="menu-layer" onMouseDown={onClose} key="layer">
          <motion.div
            ref={ref}
            className={className}
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, transformOrigin: pos?.origin }}
            initial={{ opacity: 0, scale: 0.4, filter: 'blur(10px)' }}
            animate={pos ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
            exit={{ opacity: 0, scale: 0.6, filter: 'blur(8px)', transition: { duration: 0.16 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export interface MenuOption<T> { value: T; label: ReactNode; dot?: string; separatorBefore?: boolean }

/** A value + chevrons button that opens a check-mark menu. */
export function Select<T>({ value, options, onChange, children, className = 'select-btn', align }: {
  value: T; options: MenuOption<T>[]; onChange: (v: T) => void; children: ReactNode; className?: string; align?: 'auto' | 'left' | 'right';
}) {
  const pop = usePopover();
  return (
    <>
      <button className={className} onClick={pop.open}>{children}</button>
      <Popover anchor={pop.anchor} onClose={pop.close} align={align}>
        {options.map((o, i) => (
          <div key={i}>
            {o.separatorBefore && <div className="menu-sep" />}
            <button className="menu-item" onClick={() => { pop.close(); onChange(o.value); }}>
              <span className="check">{o.value === value ? '✓' : ''}</span>
              {o.dot && <i className="dot" style={{ background: o.dot }} />}
              {o.label}
            </button>
          </div>
        ))}
      </Popover>
    </>
  );
}

// ---------- sheets ----------
export function Sheet({ open, onClose, children, stacked = false }: {
  open: boolean; onClose: () => void; children: ReactNode; stacked?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="bd" className="backdrop" style={stacked ? { zIndex: 30 } : undefined}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          onMouseDown={onClose} />
      )}
      {open && (
        <motion.div key="sh" className={`sheet ${stacked ? 'stacked' : ''}`} style={stacked ? { zIndex: 31 } : undefined}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 330, damping: 34, mass: 0.9 }}>
          <div className="sheet-grabber" />
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SheetHeader({ title, left, right, onClose }: {
  title: ReactNode; left?: ReactNode; right?: ReactNode; onClose?: () => void;
}) {
  return (
    <div className="sheet-header">
      {left && <div className="left">{left}</div>}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={String(title)} {...blurSwap}>{title}</motion.span>
      </AnimatePresence>
      <div className="right">
        {right}
        {onClose && <button className="round-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>}
      </div>
    </div>
  );
}

/** Push/pop navigation inside a sheet. */
export function Pages({ pageKey, direction, children }: { pageKey: string; direction: 1 | -1; children: ReactNode }) {
  return (
    <div className="pages">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={pageKey}
          className="page"
          custom={direction}
          variants={{
            enter: (d: number) => ({ x: d > 0 ? '100%' : '-30%', opacity: d > 0 ? 1 : 0.4 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d > 0 ? '-30%' : '100%', opacity: d > 0 ? 0.4 : 1, zIndex: d > 0 ? 0 : 2 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 360, damping: 38 }}
          style={{ zIndex: 1 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------- payment card badge ----------
const CARD_STYLE: Record<string, { bg: string; glyph?: string }> = {
  visa: { bg: '#1A1F71', glyph: 'visa' },
  mastercard: { bg: '#252525', glyph: 'mastercard' },
  amex: { bg: '#2E77BC', glyph: 'americanexpress' },
  other: { bg: '#4A4A4A', glyph: 'tabler:credit-card' },
};

/** Small card-shaped badge with the brand mark, like a wallet entry. */
export function CardBadge({ brand = 'other' }: { brand?: string }) {
  const s = CARD_STYLE[brand] ?? CARD_STYLE.other;
  const g = s.glyph ? GLYPHS[s.glyph] : undefined;
  return (
    <span className="card-badge" style={{ background: s.bg }}>
      {g && <svg viewBox={`0 0 ${g.width} ${g.height}`} style={{ color: brand === 'mastercard' ? '#F79E1B' : '#fff' }}
        dangerouslySetInnerHTML={{ __html: g.body }} />}
    </span>
  );
}

/** "Everyday Visa" + "•••• 4242". */
export function cardLabel(p: { name: string; last4?: string }): string {
  return p.last4 ? `${p.name} ·· ${p.last4}` : p.name;
}
