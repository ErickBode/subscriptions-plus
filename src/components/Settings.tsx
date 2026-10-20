import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { exportFile, importFile, setAutostart, testNotification } from '../lib/backend';
import { uid } from '../lib/defaults';
import { CURRENCY_NAME, SYMBOL } from '../lib/money';
import { exportFileName, exportJson, parseImport } from '../lib/transfer';
import { CURRENCIES, type AppData, type CardBrand, type PaymentMethod, type Reminder } from '../lib/types';
import { useStore } from '../store';
import { BackIcon, CardIcon, Chevrons, ChevRight, GridIcon, PlusCircle, TrashIcon } from './icons';
import { TimeField } from './pickers';
import { CardBadge, Pages, Popover, Select, SheetHeader, Toggle, usePopover } from './ui';

type Page = 'main' | 'categories' | 'payments';

const REMINDER_DAYS: (number | null)[] = [null, 0, 1, 2, 3, 4, 5, 10, 15, 30];
const dayLabel = (d: number | null) => (d === null ? 'Never' : d === 0 ? 'Same day' : d === 1 ? '1 Day' : `${d} Days`);
const COLORS = ['#E5484D', '#E8692A', '#E2C044', '#C9A227', '#30A46C', '#12A594', '#2F81F7', '#5B5FD6', '#8E4EC6', '#D6409F', '#6E6E73'];

export function Settings({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState<Page>('main');
  const [dir, setDir] = useState<1 | -1>(1);
  const go = (p: Page) => { setDir(p === 'main' ? -1 : 1); setPage(p); };
  return (
    <Pages pageKey={page} direction={dir}>
      {page === 'main' && <Main onClose={onClose} go={go} />}
      {page === 'categories' && <Categories back={() => go('main')} onClose={onClose} />}
      {page === 'payments' && <Payments back={() => go('main')} onClose={onClose} />}
    </Pages>
  );
}

function Main({ onClose, go }: { onClose: () => void; go: (p: Page) => void }) {
  const { data, update, refreshRates } = useStore();
  const s = data.settings;
  const [busy, setBusy] = useState(false);
  const [rateError, setRateError] = useState(false);
  const [tested, setTested] = useState(false);
  const setS = (patch: Partial<AppData['settings']>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const reminder = (key: 'firstReminder' | 'secondReminder', r: Reminder) => (
    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Select value={r.days} onChange={(days) => setS({ [key]: { ...r, days } })} options={REMINDER_DAYS.map((d) => ({ value: d, label: dayLabel(d) }))}>
        {dayLabel(r.days)} <Chevrons />
      </Select>
      {r.days !== null && <TimeField value={r.time} onChange={(time) => setS({ [key]: { ...r, time } })} />}
    </span>
  );
  const updated = s.rates.updatedAt ? new Date(s.rates.updatedAt) : null;

  return (
    <>
      <SheetHeader title="Settings" onClose={onClose} />
      <div className="sheet-body">
        <div className="group">
          <div className="row">
            <span className="label">Main Currency</span>
            <Select value={s.mainCurrency} onChange={(mainCurrency) => setS({ mainCurrency })}
              options={CURRENCIES.map((c) => ({ value: c, label: `${CURRENCY_NAME[c]} (${c})` }))}>
              <span style={{ color: 'var(--text-3)' }}>{SYMBOL[s.mainCurrency]}</span> {s.mainCurrency} <Chevrons />
            </Select>
          </div>
          <div className="row">
            <span className="label">Rounding<small>Display amounts without decimals</small></span>
            <Toggle on={s.rounding} onChange={(rounding) => setS({ rounding })} />
          </div>
          <div className="row">
            <span className="label">Abbreviate Large Numbers<small>Use compact format like 74,5k</small></span>
            <Toggle on={s.abbreviate} onChange={(abbreviate) => setS({ abbreviate })} />
          </div>
        </div>

        <div className="group">
          <button className="row button" onClick={() => go('categories')}><GridIcon /><span className="label">Categories</span><span className="value">{data.categories.length} <ChevRight /></span></button>
          <button className="row button" onClick={() => go('payments')}><CardIcon /><span className="label">Payment Methods</span><span className="value">{data.paymentMethods.length} <ChevRight /></span></button>
        </div>

        <div className="section-title">Notifications</div>
        <div className="group" style={{ marginTop: 0 }}>
          <div className="row"><span className="label">First Reminder</span>{reminder('firstReminder', s.firstReminder)}</div>
          <div className="row"><span className="label">Second Reminder</span>{reminder('secondReminder', s.secondReminder)}</div>
          <button className="row button gold" onClick={() => { testNotification().then(() => setTested(true)).catch(console.error); }}>
            <motion.span key={String(tested)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{tested ? 'Test Notification sent' : 'Test Notification'}</motion.span>
          </button>
        </div>
        <div className="footnote">Reminders are delivered by Windows even when the app is closed. If Do Not Disturb is on, notifications might not appear.</div>

        <div className="section-title">Interface</div>
        <div className="group" style={{ marginTop: 0 }}>
          <div className="row"><span className="label">True Dark Colors</span><Toggle on={s.trueDark} onChange={(trueDark) => setS({ trueDark })} /></div>
          <div className="row">
            <span className="label">Start with Windows<small>Opens in the system tray when you sign in</small></span>
            <Toggle on={s.startWithWindows} onChange={(v) => { setAutostart(v).then(() => setS({ startWithWindows: v })).catch(console.error); }} />
          </div>
        </div>

        <DataSection />

        <div className="section-title">Currency rates</div>
        <div className="group" style={{ marginTop: 0 }}>
          <div className="row">
            <span className="label">Last update:
              <small>{updated ? updated.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                {rateError ? ' · offline' : ''} · 1 € = {s.rates.USD.toFixed(2)} $ = {s.rates.BRL.toFixed(2)} R$</small>
            </span>
            <button className="text-pill" disabled={busy} onClick={() => {
              setBusy(true); setRateError(false);
              refreshRates().catch(() => setRateError(true)).finally(() => setBusy(false));
            }}>{busy ? 'Updating…' : 'Update Now'}</button>
          </div>
        </div>
        <div className="footnote">Rates come from the European Central Bank and are updated automatically. They are approximate and may differ from your bank.</div>

        <div className="footer-note"><span className="heart">♥</span>Subscriptions+ · Version 1.1.0</div>
      </div>
    </>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Export/import of everything the app stores, to move it to another PC or restore a backup. */
function DataSection() {
  const { data, update, today } = useStore();
  const [pending, setPending] = useState<AppData | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const fail = (e: unknown) => setMessage({ text: e instanceof Error ? e.message : String(e), error: true });

  const doExport = () => {
    setPending(null);
    exportFile(exportJson(data), exportFileName(today))
      .then((saved) => saved && setMessage({ text: 'Data exported.' }))
      .catch(fail);
  };
  const doImport = () => {
    setMessage(null);
    importFile()
      .then((text) => text !== null && setPending(parseImport(text)))
      .catch(fail);
  };
  const confirm = () => {
    if (!pending) return;
    const next = pending;
    update(() => next);
    setAutostart(next.settings.startWithWindows).catch(console.error);
    setPending(null);
    setMessage({ text: 'Data imported.' });
  };

  return (
    <>
      <div className="section-title">Data</div>
      <div className="group" style={{ marginTop: 0 }}>
        <button className="row button" onClick={doExport}>
          <span className="label">Export Data<small>Subscriptions, categories, cards and settings in one file</small></span>
        </button>
        <button className="row button" onClick={doImport}>
          <span className="label">Import Data<small>Restore a file exported from Subscriptions+</small></span>
        </button>
        <AnimatePresence initial={false}>
          {pending && (
            <motion.div key="confirm" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
              <div className="row">
                <span className="label">Replace all current data?
                  <small>{plural(pending.subscriptions.length, 'subscription')} · {plural(pending.categories.length, 'category', 'categories')} · {plural(pending.paymentMethods.length, 'card')}</small>
                </span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button className="text-pill" onClick={() => setPending(null)}>Cancel</button>
                  <button className="text-pill gold" onClick={confirm}>Replace</button>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="footnote">
        {message
          ? <motion.span key={message.text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={message.error ? { color: 'var(--red)' } : undefined}>{message.text}</motion.span>
          : 'Use it to move to another PC or keep a backup. Importing replaces everything, including these settings.'}
      </div>
    </>
  );
}

function SubHeader({ title, back, onClose }: { title: string; back: () => void; onClose: () => void }) {
  return <SheetHeader title={title} onClose={onClose} left={<button className="round-btn" onClick={back} aria-label="Back"><BackIcon /></button>} />;
}

function EditableName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <input className="edit-row-input" value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => (v.trim() ? onSave(v.trim()) : setV(value))}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
  );
}

function ColorDot({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const pop = usePopover();
  return (
    <>
      <button onClick={pop.open} style={{ width: 14, height: 14, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}88` }} aria-label="Color" />
      <Popover anchor={pop.anchor} onClose={pop.close} className="popover" align="right">
        <div className="palette" style={{ width: 200, padding: 2 }}>
          {COLORS.map((c) => <button key={c} className={`swatch ${c === color ? 'sel' : ''}`} style={{ background: c }} onClick={() => { onChange(c); pop.close(); }} />)}
        </div>
      </Popover>
    </>
  );
}

function AddRow({ placeholder, onAdd, color }: { placeholder: string; onAdd: (name: string, color: string) => void; color?: boolean }) {
  const [name, setName] = useState('');
  const [c, setC] = useState(COLORS[6]);
  const add = () => { if (name.trim()) { onAdd(name.trim(), c); setName(''); } };
  return (
    <div className="group">
      <div className="row">
        {color ? <ColorDot color={c} onChange={setC} /> : <PlusCircle color="rgba(255,255,255,.25)" />}
        <input className="edit-row-input" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="add-link" disabled={!name.trim()} onClick={add}>Add</button>
      </div>
    </div>
  );
}

function Categories({ back, onClose }: { back: () => void; onClose: () => void }) {
  const { data, update } = useStore();
  const patch = (id: string, p: Partial<{ name: string; color: string }>) =>
    update((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  return (
    <>
      <SubHeader title="Categories" back={back} onClose={onClose} />
      <div className="sheet-body">
        <div className="group">
          {data.categories.map((c) => (
            <motion.div layout key={c.id} className="row">
              <EditableName value={c.name} onSave={(name) => patch(c.id, { name })} />
              {!c.system && (
                <button className="trash" aria-label="Delete" onClick={() => update((d) => ({
                  ...d,
                  categories: d.categories.filter((x) => x.id !== c.id),
                  subscriptions: d.subscriptions.map((s) => (s.categoryId === c.id ? { ...s, categoryId: 'other' } : s)),
                }))}><TrashIcon /></button>
              )}
              <ColorDot color={c.color} onChange={(color) => patch(c.id, { color })} />
            </motion.div>
          ))}
        </div>
        <div className="footnote">The ‘Other’ category cannot be deleted as it automatically serves as a default for subscriptions without a specific category.</div>
        <AddRow placeholder="New Category" color onAdd={(name, color) => update((d) => ({ ...d, categories: [...d.categories, { id: uid(), name, color }] }))} />
      </div>
    </>
  );
}

const BRANDS: { value: CardBrand; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
  { value: 'other', label: 'Other' },
];

function Payments({ back, onClose }: { back: () => void; onClose: () => void }) {
  const { data, update } = useStore();
  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  const [brand, setBrand] = useState<CardBrand>('visa');
  const patch = (id: string, p: Partial<PaymentMethod>) =>
    update((d) => ({ ...d, paymentMethods: d.paymentMethods.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const add = () => {
    if (!name.trim()) return;
    update((d) => ({ ...d, paymentMethods: [...d.paymentMethods, { id: uid(), name: name.trim(), brand, last4: last4 || undefined }] }));
    setName(''); setLast4('');
  };
  return (
    <>
      <SubHeader title="Payment Methods" back={back} onClose={onClose} />
      <div className="sheet-body">
        {data.paymentMethods.length > 0 && (
          <div className="group">
            {data.paymentMethods.map((p) => (
              <motion.div layout key={p.id} className="row">
                <Select value={p.brand ?? 'other'} onChange={(b: CardBrand) => patch(p.id, { brand: b })} options={BRANDS} className="select-btn" align="left">
                  <CardBadge brand={p.brand} />
                </Select>
                <EditableName value={p.name} onSave={(n) => patch(p.id, { name: n })} />
                <span style={{ color: 'var(--text-3)' }}>••••</span>
                <input className="amount-input" style={{ width: 42 }} maxLength={4} value={p.last4 ?? ''} placeholder="0000"
                  onChange={(e) => patch(p.id, { last4: e.target.value.replace(/\D/g, '').slice(0, 4) || undefined })} />
                <button className="trash" aria-label="Delete" onClick={() => update((d) => ({
                  ...d,
                  paymentMethods: d.paymentMethods.filter((x) => x.id !== p.id),
                  subscriptions: d.subscriptions.map((s) => (s.paymentMethodId === p.id ? { ...s, paymentMethodId: undefined } : s)),
                }))}><TrashIcon /></button>
              </motion.div>
            ))}
          </div>
        )}
        <div className="group">
          <div className="row">
            <Select value={brand} onChange={setBrand} options={BRANDS} className="select-btn" align="left"><CardBadge brand={brand} /></Select>
            <input className="edit-row-input" placeholder="New card" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <span style={{ color: 'var(--text-3)' }}>••••</span>
            <input className="amount-input" style={{ width: 42 }} maxLength={4} placeholder="0000" value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button className="add-link" disabled={!name.trim()} onClick={add}>Add</button>
          </div>
        </div>
        <div className="footnote">Only the last four digits are stored, to recognise each card. Never store full card numbers.</div>
      </div>
    </>
  );
}
