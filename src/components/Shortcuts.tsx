import { motion } from 'motion/react';
import { SheetHeader } from './ui';

const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: 'Calendar',
    items: [
      [['←', '→'], 'Previous / next month'],
      [['Mouse wheel'], 'Change month'],
      [['T'], 'Go to the current month'],
      [['Click total'], 'Toggle month total and remaining'],
    ],
  },
  {
    title: 'Actions',
    items: [
      [['N'], 'Add subscription'],
      [['Ctrl', 'N'], 'Add subscription (anywhere)'],
      [['F'], 'Search'],
      [['Ctrl', 'F'], 'Search (anywhere)'],
      [['S'], 'Statistics'],
      [['Ctrl', ','], 'Settings'],
    ],
  },
  {
    title: 'General',
    items: [
      [['?'], 'Show keyboard shortcuts'],
      [['Esc'], 'Close the current panel or menu'],
      [['Enter'], 'Confirm search or form'],
    ],
  },
];

export function Shortcuts({ onClose }: { onClose: () => void }) {
  let n = 0;
  return (
    <>
      <SheetHeader title="Keyboard Shortcuts" onClose={onClose} />
      <div className="sheet-body">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="section-title">{g.title}</div>
            <div className="group" style={{ marginTop: 0 }}>
              {g.items.map(([keys, label]) => (
                <motion.div key={label} className="row" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * n++, type: 'spring', stiffness: 400, damping: 32 }}>
                  <span className="label">{label}</span>
                  <span className="keys">{keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
