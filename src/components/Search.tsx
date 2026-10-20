import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { formatMoney, settingsFormat } from '../lib/money';
import { scheduleLabel } from '../lib/schedule';
import type { Status, Subscription } from '../lib/types';
import { useStore } from '../store';
import { Chevrons, ChevRight, CloseIcon, SearchIcon } from './icons';
import { Select, ServiceIcon } from './ui';

const ORDER: Record<Status, number> = { active: 0, canceled: 1, archived: 2 };

export function Search({ onOpen, onClose }: { onOpen: (s: Subscription) => void; onClose: () => void }) {
  const { data } = useStore();
  const fmt = settingsFormat(data.settings);
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [status, setStatus] = useState<Status | 'all'>('all');

  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.subscriptions
      .filter((s) => status === 'all' || s.status === status)
      .filter((s) => {
        if (!words.length) return true;
        const hay = `${s.name} ${scheduleLabel(s.schedule)} ${s.schedule.kind === 'yearly' ? 'yearly' : ''} ${s.schedule.kind === 'once' ? 'one-time onetime' : ''} ${s.status}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));
  }, [data.subscriptions, q, status]);

  const listing = showAll || q.trim().length > 0;

  return (
    <>
      <div className="search-top">
        <div className="search-box">
          <SearchIcon />
          <input autoFocus placeholder="Search subscriptions" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="round-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
      </div>
      <div className="sheet-body">
        <AnimatePresence mode="popLayout" initial={false}>
          {!listing ? (
            <motion.div key="empty" className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(6px)' }}>
              <div className="tray" />
              You can search subscriptions by name, by type such as Monthly, Yearly, Trial, or One-time, or by their status Active, Canceled, or Archived.
              <div style={{ marginTop: 22 }}><button className="text-pill" onClick={() => setShowAll(true)}>All your subscriptions</button></div>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 4px 8px' }}>
                <b style={{ fontSize: 15 }}>{q.trim() ? 'Results' : 'All'}</b>
                <Select value={status} onChange={setStatus} className="text-pill" align="left"
                  options={[{ value: 'all' as const, label: 'All' }, { value: 'active' as const, label: 'Active' }, { value: 'canceled' as const, label: 'Canceled' }, { value: 'archived' as const, label: 'Archived' }]}>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{status === 'all' ? 'Status' : status[0].toUpperCase() + status.slice(1)} <Chevrons /></span>
                </Select>
              </div>
              {results.length === 0 && <div className="empty-state" style={{ paddingTop: 30 }}>No subscriptions found.</div>}
              {results.map((s, i) => {
                return (
                  <motion.button key={s.id} className="sub-row" onClick={() => onOpen(s)}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 15) * 0.02 }}>
                    <ServiceIcon sub={s} size={32} />
                    <div className="meta">
                      <div>{s.name}</div>
                      <div>{scheduleLabel(s.schedule)} • {formatMoney(s.amount, s.currency, fmt)}</div>
                    </div>
                    <span className={`status ${s.status}`}>{s.status[0].toUpperCase() + s.status.slice(1)}</span>
                    <ChevRight />
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
