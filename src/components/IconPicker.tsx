import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { Icon } from '../lib/types';
import { SearchIcon } from './icons';
import { Popover, ServiceIcon, usePopover } from './ui';

// Monochrome sets only, so every result renders as a clean white glyph on the service colour.
const PREFIXES = 'simple-icons,ri,tabler,mdi,fa6-brands,bxl,lucide,ph,game-icons,material-symbols,streamline-logos';
const API = 'https://api.iconify.design';
const PALETTE = ['#E5484D', '#F76B15', '#E2C044', '#30A46C', '#12A594', '#2F81F7', '#3E63DD', '#8E4EC6', '#D6409F', '#6E6E73', '#2A2A2A'];

/** Strips anything executable from an SVG fragment before it is stored and rendered. */
function sanitize(body: string): string {
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '');
}

export function IconPicker({ name, color, icon, onChange }: {
  name: string; color: string; icon: Icon; onChange: (p: { icon?: Icon; color?: string }) => void;
}) {
  const pop = usePopover();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'offline'>('idle');

  useEffect(() => { if (pop.anchor) setQ(name.replace(/[-–(].*$/, '').trim()); }, [pop.anchor]); // eslint-disable-line

  useEffect(() => {
    if (!pop.anchor || q.trim().length < 2) { setResults([]); return; }
    setState('loading');
    const t = window.setTimeout(() => {
      fetch(`${API}/search?query=${encodeURIComponent(q.trim())}&limit=48&prefixes=${PREFIXES}`)
        .then((r) => r.json())
        .then((j: { icons?: string[] }) => { setResults(j.icons ?? []); setState('idle'); })
        .catch(() => setState('offline'));
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, pop.anchor]);

  const pick = async (key: string) => {
    const [prefix, iconName] = key.split(':');
    try {
      const j = await fetch(`${API}/${prefix}.json?icons=${iconName}`).then((r) => r.json());
      const data = j.icons?.[iconName];
      if (!data) return;
      onChange({ icon: { type: 'svg', body: sanitize(data.body), width: data.width ?? j.width ?? 16, height: data.height ?? j.height ?? 16 } });
    } catch {
      setState('offline');
    }
  };

  return (
    <>
      <button className="icon-pick-btn" onClick={pop.open} title="Change icon and colour">
        <ServiceIcon sub={{ icon, color, name }} size={58} glow />
        <span className="icon-pick-hint">Edit</span>
      </button>
      <Popover anchor={pop.anchor} onClose={pop.close} className="popover icon-picker" align="auto">
        <div className="search-box" style={{ marginBottom: 10 }}>
          <SearchIcon />
          <input autoFocus placeholder="Search icons" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="ip-grid">
          <button className={`ip-cell ${icon.type === 'letter' ? 'sel' : ''}`} title="First letter" onClick={() => onChange({ icon: { type: 'letter' } })}>
            <span className="ip-letter">{(name.trim()[0] ?? '?').toUpperCase()}</span>
          </button>
          <AnimatePresence initial={false}>
            {results.map((key, i) => (
              <motion.button key={key} className="ip-cell" title={key} onClick={() => pick(key)}
                initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i, 24) * 0.012, type: 'spring', stiffness: 500, damping: 30 }}>
                <img src={`${API}/${key.replace(':', '/')}.svg?color=%23ffffff`} alt="" width={20} height={20} draggable={false} />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        <div className="ip-status">
          {state === 'loading' ? 'Searching…' : state === 'offline' ? 'Icon search needs an internet connection.' : results.length === 0 && q.trim().length >= 2 ? 'No icons found.' : 'Icons from Iconify, saved with the subscription.'}
        </div>
        <div className="palette" style={{ padding: '8px 0 0' }}>
          {PALETTE.map((c) => (
            <button key={c} className={`swatch ${c.toLowerCase() === color.toLowerCase() ? 'sel' : ''}`} style={{ background: c }} onClick={() => onChange({ color: c })} />
          ))}
        </div>
      </Popover>
    </>
  );
}
