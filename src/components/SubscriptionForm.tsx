import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { addDays, addMonthsAnchored, longDate } from '../lib/dates';
import { uid } from '../lib/defaults';
import { formatMoney, SYMBOL } from '../lib/money';
import { startNewPlan } from '../lib/history';
import { nextCharge, scheduleLabel } from '../lib/schedule';
import { CURRENCIES, type Currency, type Period, type Schedule, type Subscription, type Unit } from '../lib/types';
import { useStore } from '../store';
import { BackIcon, BellIcon, CardIcon, Chevrons, TagIcon, TrashIcon } from './icons';
import { IconPicker } from './IconPicker';
import { DateField } from './pickers';
import { alpha, CardBadge, cardLabel, Select, SheetHeader, Toggle } from './ui';

const SCHEDULES: { value: Schedule['kind']; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'once', label: 'One-time' },
  { value: 'custom', label: 'Custom' },
  { value: 'trial', label: 'Trial' },
];
const UNITS: Unit[] = ['day', 'week', 'month', 'year'];
const TRIAL_DAYS = [3, 7, 14, 30, 60, 90];

const rowAnim = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { type: 'spring', stiffness: 400, damping: 36 },
} as const;

export function SubscriptionForm({ initial, isNew, onBack, onDone, onDelete }: {
  initial: Subscription;
  isNew: boolean;
  onBack: () => void;
  onDone: (s: Subscription) => void;
  onDelete?: () => void;
}) {
  const { data, today } = useStore();
  const [s, setS] = useState<Subscription>(initial);
  const [amountText, setAmountText] = useState(initial.amount ? initial.amount.toFixed(2).replace('.', ',') : '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Subscription>(k: K, v: Subscription[K]) => setS((p) => ({ ...p, [k]: v }));

  const setKind = (kind: Schedule['kind']) => {
    const sch: Schedule = kind === 'custom' ? { kind, every: 1, unit: 'month' }
      : kind === 'trial' ? { kind, days: 7 } : { kind } as Schedule;
    setS((p) => ({ ...p, schedule: sch }));
  };
  // "47,88", "1.395,20" and "47.88" all work: with a comma, dots are thousand separators.
  const parse = (txt: string) => Number(txt.includes(',') ? txt.replace(/\./g, '').replace(',', '.') : txt) || 0;
  const amount = parse(amountText);
  // Changing the schedule or currency of an existing subscription starts a new plan;
  // changing only the price keeps the old price for earlier charges.
  const planChanged = !isNew && (JSON.stringify(s.schedule) !== JSON.stringify(initial.schedule) || s.currency !== initial.currency);
  const priceChanged = !isNew && !planChanged && initial.amount > 0 && amount > 0 && amount !== initial.amount;
  const [priceSince, setPriceSince] = useState(() => nextCharge(initial, today) ?? today);
  const [oldUntil, setOldUntil] = useState(() => addDays(today, -1));
  const [oldAmount, setOldAmount] = useState('');
  const history = [...(s.priceHistory ?? [])].sort((a, b) => b.until.localeCompare(a.until));
  const valid = s.name.trim().length > 0 && (amount > 0 || s.schedule.kind === 'trial')
    && (!s.endDate || s.endDate >= s.startDate);

  const submit = () => {
    if (!valid) return;
    if (planChanged && priceSince > initial.startDate) {
      const keepOldPlan = { ...s, schedule: initial.schedule, amount: initial.amount, currency: initial.currency,
        priceHistory: initial.priceHistory, paymentMethodId: initial.paymentMethodId, startDate: initial.startDate, endDate: initial.endDate };
      onDone(startNewPlan({ ...keepOldPlan, name: s.name.trim() }, priceSince,
        { schedule: s.schedule, amount, currency: s.currency, paymentMethodId: s.paymentMethodId, endDate: s.endDate }));
      return;
    }
    let priceHistory = s.priceHistory ?? [];
    if (priceChanged && priceSince > s.startDate) {
      priceHistory = [...priceHistory.filter((p) => p.until < priceSince), { until: addDays(priceSince, -1), amount: initial.amount }];
    }
    onDone({ ...s, name: s.name.trim(), amount, priceHistory: priceHistory.length ? priceHistory : undefined });
  };

  return (
    <>
      <div className="form-hero" style={{ background: `linear-gradient(${alpha(s.color, 0.45)}, ${alpha(s.color, 0.12)} 55%, transparent)` }} />
      <SheetHeader
        title={isNew ? 'New Subscription' : 'Edit Subscription'}
        left={<button className="round-btn" onClick={onBack} aria-label="Back"><BackIcon /></button>}
      />
      <div className="sheet-body" style={{ position: 'relative' }}>
        <div className="form-icon">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
            <IconPicker name={s.name} color={s.color} icon={s.icon} onChange={(p) => setS((x) => ({ ...x, ...p }))} />
          </motion.div>
        </div>

        <div className="group">
          <div className="row">
            <span className="label">Name</span>
            <input className="inline" value={s.name} placeholder="Name" onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="row">
            <span className="label">Payment Schedule</span>
            <Select value={s.schedule.kind} onChange={setKind} options={SCHEDULES}>
              {SCHEDULES.find((x) => x.value === s.schedule.kind)!.label} <Chevrons />
            </Select>
          </div>
          <AnimatePresence initial={false}>
            {s.schedule.kind === 'custom' && (
              <motion.div key="every" className="row" {...rowAnim} style={{ overflow: 'hidden', borderTop: '1px solid var(--sep)' }}>
                <span className="label">Every</span>
                <input className="amount-input" style={{ width: 44 }} type="number" min={1} max={999}
                  value={(s.schedule as { every: number }).every}
                  onChange={(e) => set('schedule', { ...(s.schedule as Extract<Schedule, { kind: 'custom' }>), every: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })} />
                <Select value={(s.schedule as { unit: Unit }).unit}
                  onChange={(unit) => set('schedule', { ...(s.schedule as Extract<Schedule, { kind: 'custom' }>), unit })}
                  options={UNITS.map((u) => ({ value: u, label: u[0].toUpperCase() + u.slice(1) }))}>
                  {(s.schedule as { every: number }).every === 1 ? (s.schedule as { unit: Unit }).unit : `${(s.schedule as { unit: Unit }).unit}s`} <Chevrons />
                </Select>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="row">
            <span className="label">Start Date</span>
            <DateField value={s.startDate} onChange={(v) => set('startDate', v)} />
          </div>
          <AnimatePresence initial={false}>
            {s.schedule.kind === 'trial' && (
              <motion.div key="trial" className="row" {...rowAnim} style={{ overflow: 'hidden', borderTop: '1px solid var(--sep)' }}>
                <span className="label">Trial Duration</span>
                <Select value={(s.schedule as { days: number }).days} onChange={(days) => set('schedule', { kind: 'trial', days })}
                  options={TRIAL_DAYS.map((d) => ({ value: d, label: `${d} Days` }))}>
                  {(s.schedule as { days: number }).days} Days <Chevrons />
                </Select>
              </motion.div>
            )}
          </AnimatePresence>
          {s.schedule.kind !== 'once' && s.schedule.kind !== 'trial' && (
            <div className="row">
              <span className="label">End Date</span>
              <Toggle on={!!s.endDate} onChange={(on) => set('endDate', on ? addMonthsAnchored(s.startDate, 1) : undefined)} />
            </div>
          )}
          <AnimatePresence initial={false}>
            {s.endDate && s.schedule.kind !== 'once' && s.schedule.kind !== 'trial' && (
              <motion.div key="ends" className="row" {...rowAnim} style={{ overflow: 'hidden', borderTop: '1px solid var(--sep)' }}>
                <span className="label">Ends On</span>
                <DateField value={s.endDate} onChange={(v) => set('endDate', v)} short />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="group">
          <div className="row">
            <span className="label">Amount{s.schedule.kind === 'trial' ? <small>Charged when the trial ends (optional)</small> : null}</span>
            <input className="amount-input" inputMode="decimal" placeholder={`${SYMBOL[s.currency]}0,00`} value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <Select value={s.currency} onChange={(c: Currency) => set('currency', c)}
              options={CURRENCIES.map((c) => ({ value: c, label: `${c} (${SYMBOL[c]})` }))}>
              {s.currency} <Chevrons />
            </Select>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {(priceChanged || planChanged) && (
            <motion.div key="since" className="group" {...rowAnim} style={{ overflow: 'hidden' }}>
              <div className="row">
                <span className="label">{planChanged ? 'New plan since' : 'New price since'}
                  <small>{planChanged
                    ? `Earlier charges stay on the ${scheduleLabel(initial.schedule).toLowerCase()} plan (${formatMoney(initial.amount, initial.currency)})`
                    : `Earlier charges keep ${formatMoney(initial.amount, s.currency)}`}</small>
                </span>
                <DateField value={priceSince} onChange={setPriceSince} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isNew && (
          <>
            <div className="section-title">Price changes · current plan</div>
            <div className="group" style={{ marginTop: 0 }}>
              <AnimatePresence initial={false}>
                {history.map((h) => (
                  <motion.div key={h.until} className="row" {...rowAnim} style={{ overflow: 'hidden' }}>
                    <span className="label">Until {longDate(h.until)}</span>
                    <span className="value">{formatMoney(h.amount, s.currency)}</span>
                    <button className="trash" style={{ opacity: 1 }} aria-label="Remove price"
                      onClick={() => set('priceHistory', (s.priceHistory ?? []).filter((x) => x.until !== h.until))}><TrashIcon /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div className="row">
                <span className="label">Earlier price until</span>
                <DateField value={oldUntil} onChange={setOldUntil} short />
                <input className="amount-input" style={{ width: 70 }} inputMode="decimal" placeholder={`${SYMBOL[s.currency]}0,00`}
                  value={oldAmount} onChange={(e) => setOldAmount(e.target.value.replace(/[^\d.,]/g, ''))} />
                <button className="add-link" disabled={parse(oldAmount) <= 0} onClick={() => {
                  set('priceHistory', [...(s.priceHistory ?? []).filter((x) => x.until !== oldUntil), { until: oldUntil, amount: parse(oldAmount) }]);
                  setOldAmount('');
                }}>Add</button>
              </div>
            </div>
            <div className="footnote">Charges up to each date use that price; later charges use the current amount.</div>

            <div className="section-title">Earlier plans and pauses</div>
            <PeriodsEditor periods={s.periods ?? []} currency={s.currency} onChange={(periods) => set('periods', periods.length ? periods : undefined)} />
          </>
        )}

        <div className="group">
          <div className="row">
            <TagIcon /><span className="label">Category</span>
            <Select value={s.categoryId} onChange={(v) => set('categoryId', v)}
              options={data.categories.map((c) => ({ value: c.id, label: c.name, dot: c.color }))}>
              {data.categories.find((c) => c.id === s.categoryId)?.name ?? 'Other'} <Chevrons />
            </Select>
          </div>
          <div className="row">
            <CardIcon /><span className="label">Pay with</span>
            <Select value={s.paymentMethodId ?? ''} onChange={(v) => set('paymentMethodId', v || undefined)}
              options={[{ value: '', label: 'None' }, ...data.paymentMethods.map((p) => ({
                value: p.id,
                label: <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CardBadge brand={p.brand} /><span className="card-line">{p.name}{p.last4 && <small>•••• {p.last4}</small>}</span></span>,
              }))]}>
              {(() => {
                const pm = data.paymentMethods.find((p) => p.id === s.paymentMethodId);
                return pm ? <><CardBadge brand={pm.brand} />{cardLabel(pm)}</> : 'None';
              })()} <Chevrons />
            </Select>
          </div>
          <div className="row">
            <BellIcon /><span className="label">Notifications</span>
            <Select value={s.notifications} onChange={(v) => set('notifications', v)}
              options={[{ value: 'default' as const, label: 'Default' }, { value: 'disabled' as const, label: 'Disabled' }]}>
              {s.notifications === 'default' ? 'Default' : 'Disabled'} <Chevrons />
            </Select>
          </div>
        </div>

        <div className="group">
          <textarea className="notes" placeholder="Notes" value={s.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        {onDelete && (
          <button className="danger-btn" onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            onMouseLeave={() => setConfirmDelete(false)}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={String(confirmDelete)} style={{ display: 'inline-block' }} initial={{ opacity: 0, filter: 'blur(4px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(4px)' }}>
                {confirmDelete ? 'Click again to delete' : 'Delete Subscription'}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
      </div>
      <div className="form-footer">
        <button className="primary-btn" disabled={!valid} onClick={submit}>{isNew ? 'Add Subscription' : 'Save'}</button>
      </div>
    </>
  );
}

export function blankSubscription(base: Partial<Subscription>, startDate: string): Subscription {
  return {
    id: uid(),
    name: '',
    icon: { type: 'letter' },
    color: '#6E6E73',
    amount: 0,
    currency: 'EUR',
    schedule: { kind: 'monthly' },
    startDate,
    status: 'active',
    categoryId: 'other',
    notifications: 'default',
    notes: '',
    createdAt: new Date().toISOString(),
    ...base,
  };
}

const PERIOD_KINDS: { value: string; label: string; schedule: Schedule }[] = [
  { value: 'monthly', label: 'Monthly', schedule: { kind: 'monthly' } },
  { value: 'yearly', label: 'Yearly', schedule: { kind: 'yearly' } },
  { value: 'q', label: 'Every 3 months', schedule: { kind: 'custom', every: 3, unit: 'month' } },
  { value: 's', label: 'Every 6 months', schedule: { kind: 'custom', every: 6, unit: 'month' } },
  { value: 'w', label: 'Weekly', schedule: { kind: 'custom', every: 1, unit: 'week' } },
  { value: 'once', label: 'One-time', schedule: { kind: 'once' } },
];

/** Earlier plans of the subscription: listed newest first, removable, and new ones can be added. Gaps are pauses. */
function PeriodsEditor({ periods, currency, onChange }: { periods: Period[]; currency: Currency; onChange: (p: Period[]) => void }) {
  const { data, today } = useStore();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(() => addDays(today, -365));
  const [end, setEnd] = useState(() => addDays(today, -1));
  const [kind, setKind] = useState('monthly');
  const [amountText, setAmountText] = useState('');
  const [cur, setCur] = useState<Currency>(currency);
  const [pm, setPm] = useState('');
  const amount = Number(amountText.includes(',') ? amountText.replace(/\./g, '').replace(',', '.') : amountText) || 0;
  const sorted = periods.map((p, i) => ({ p, i })).sort((a, b) => b.p.start.localeCompare(a.p.start));
  const pmOf = (id: string) => data.paymentMethods.find((x) => x.id === id);
  const add = () => {
    if (amount <= 0 || end < start) return;
    const schedule = PERIOD_KINDS.find((k) => k.value === kind)!.schedule;
    onChange([...periods, { start, end, schedule, amount, currency: cur, paymentMethodId: pm || undefined }]);
    setAmountText('');
    setOpen(false);
  };
  return (
    <>
      {sorted.length > 0 && (
        <div className="group" style={{ marginTop: 0 }}>
          <AnimatePresence initial={false}>
            {sorted.map(({ p, i }) => (
              <motion.div key={`${p.start}-${i}`} className="row" {...rowAnim} style={{ overflow: 'hidden' }}>
                <span className="label">
                  {scheduleLabel(p.schedule)} · {[...(p.priceHistory ?? []).map((h) => h.amount), p.amount]
                    .filter((x, j, a) => j === 0 || x !== a[j - 1]).map((x) => formatMoney(x, p.currency)).join(' → ')}
                  <small>{longDate(p.start)} – {longDate(p.end)}</small>
                </span>
                <button className="trash" style={{ opacity: 1 }} aria-label="Remove plan" onClick={() => onChange(periods.filter((_, j) => j !== i))}><TrashIcon /></button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <AnimatePresence initial={false} mode="popLayout">
        {!open ? (
          <motion.button key="btn" className="text-pill" style={{ marginTop: 10 }} onClick={() => setOpen(true)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>+ Add earlier plan</motion.button>
        ) : (
          <motion.div key="form" className="group" {...rowAnim} style={{ overflow: 'hidden', marginTop: sorted.length ? 10 : 0 }}>
            <div className="row"><span className="label">First charge</span><DateField value={start} onChange={setStart} /></div>
            <div className="row"><span className="label">Last day</span><DateField value={end} onChange={setEnd} /></div>
            <div className="row">
              <span className="label">Schedule</span>
              <Select value={kind} onChange={setKind} options={PERIOD_KINDS.map((k) => ({ value: k.value, label: k.label }))}>
                {PERIOD_KINDS.find((k) => k.value === kind)!.label} <Chevrons />
              </Select>
            </div>
            <div className="row">
              <span className="label">Amount</span>
              <input className="amount-input" inputMode="decimal" placeholder={`${SYMBOL[cur]}0,00`} value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, ''))} />
              <Select value={cur} onChange={(c: Currency) => setCur(c)} options={CURRENCIES.map((c) => ({ value: c, label: `${c} (${SYMBOL[c]})` }))}>
                {cur} <Chevrons />
              </Select>
            </div>
            <div className="row">
              <span className="label">Pay with</span>
              <Select value={pm} onChange={setPm} options={[{ value: '', label: 'None' }, ...data.paymentMethods.map((x) => ({ value: x.id, label: cardLabel(x) }))]}>
                {pmOf(pm) ? cardLabel(pmOf(pm)!) : 'None'} <Chevrons />
              </Select>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 14 }}>
              <button className="add-link" onClick={() => setOpen(false)}>Cancel</button>
              <button className="add-link" disabled={amount <= 0 || end < start} onClick={add} style={{ color: 'var(--text)' }}>Add plan</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="footnote">Each earlier plan charges from its first charge to its last day. Time between plans shows as a pause.</div>
    </>
  );
}
