import { motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { ALL_SERVICES, colorForName, POPULAR_SERVICES, serviceIcon, type Service } from '../lib/catalog';
import { SearchIcon } from './icons';
import { ServiceIcon, SheetHeader } from './ui';

export function ServicePicker({ onCancel, onPick }: {
  onCancel: () => void;
  onPick: (s: Service | { name: string; custom: true }) => void;
}) {
  const [q, setQ] = useState('');
  const body = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () => (query ? ALL_SERVICES.filter((s) => s.name.toLowerCase().includes(query)) : ALL_SERVICES),
    [query],
  );
  const exact = ALL_SERVICES.some((s) => s.name.toLowerCase() === query);

  const card = (s: Service, i: number) => (
    <motion.button key={s.id} className="svc-card" onClick={() => onPick(s)}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 12) * 0.018, type: 'spring', stiffness: 400, damping: 30 }}>
      <ServiceIcon sub={{ icon: serviceIcon(s), color: s.color, name: s.name }} size={30} />
      {s.name}
    </motion.button>
  );

  return (
    <>
      <div style={{
        backdropFilter: scrolled ? 'blur(18px)' : 'none',
        background: scrolled ? 'rgba(42,42,42,.7)' : 'transparent',
        transition: 'background .25s',
        position: 'relative', zIndex: 2,
      }}>
        <SheetHeader title="Add Subscription" left={<button className="text-pill" onClick={onCancel}>Cancel</button>} />
      </div>
      <div className="sheet-body" ref={body} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)} style={{ paddingBottom: 64 }}>
        {query && !exact && (
          <>
            <div className="section-title">Custom</div>
            <div className="svc-grid">
              <button className="svc-card" onClick={() => onPick({ name: q.trim(), custom: true })}>
                <ServiceIcon sub={{ icon: { type: 'letter' }, color: colorForName(q.trim()), name: q.trim() }} size={30} />
                Add “{q.trim()}”
              </button>
            </div>
          </>
        )}
        {!query && (
          <>
            <div className="section-title">Popular services</div>
            <div className="svc-grid">{POPULAR_SERVICES.map(card)}</div>
          </>
        )}
        {filtered.length > 0 && (
          <>
            <div className="section-title">{query ? 'Results' : 'All services'}</div>
            <div className="svc-grid">{filtered.map(card)}</div>
          </>
        )}
      </div>
      <div className="floating-search">
        <SearchIcon />
        <input autoFocus placeholder="Search services or type a name" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !query) return;
            const match = ALL_SERVICES.find((s) => s.name.toLowerCase() === query)
              ?? (filtered.length === 1 ? filtered[0] : undefined);
            onPick(match ?? { name: q.trim(), custom: true });
          }} />
      </div>
    </>
  );
}
