import { motion } from 'motion/react';
import { useState } from 'react';
import { diffDays, longDate } from '../lib/dates';
import { convert, formatMoney, settingsFormat } from '../lib/money';
import { planTimeline, startNewPlan } from '../lib/history';
import { nextCharge, pastCharges, scheduleLabel } from '../lib/schedule';
import type { Status, Subscription } from '../lib/types';
import { useStore } from '../store';
import { CardIcon, Chevrons, TagIcon } from './icons';
import { DateField } from './pickers';
import { alpha, CardBadge, Popover, Select, ServiceIcon, SheetHeader, usePopover } from './ui';

const STATUS: { value: Status; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: '#34c759' },
  { value: 'canceled', label: 'Canceled', color: '#8e8e93' },
  { value: 'archived', label: 'Archived', color: '#e5534b' },
];

function pauseLength(days: number): string {
  if (days < 45) return `${days} days`;
  const months = Math.round(days / 30.44);
  return months < 24 ? `${months} months` : `${(days / 365.25).toFixed(1).replace('.', ',')} years`;
}

export function Detail({ sub, onEdit, onClose }: { sub: Subscription; onEdit: () => void; onClose: () => void }) {
  const { data, update, today } = useStore();
  const fmt = settingsFormat(data.settings);
  const next = sub.status === 'active' ? nextCharge(sub, today) : null;
  // Total across every plan; converted to the main currency when plans used different currencies.
  const charges = pastCharges(sub, today);
  const currencies = new Set(charges.map((o) => o.currency));
  const single = currencies.size <= 1 ? (charges[0]?.currency ?? sub.currency) : null;
  const spentText = single
    ? formatMoney(charges.reduce((a, o) => a + o.amount, 0), single, fmt)
    : `≈ ${formatMoney(charges.reduce((a, o) => a + convert(o.amount, o.currency, data.settings.mainCurrency, data.settings.rates), 0), data.settings.mainCurrency, fmt)}`;
  const timeline = planTimeline(sub, today);
  const resumePop = usePopover();
  const [resumeOn, setResumeOn] = useState(today);
  const resume = () => {
    resumePop.close();
    update((d) => ({ ...d, subscriptions: d.subscriptions.map((x) => (x.id === sub.id ? startNewPlan(x, resumeOn) : x)) }));
  };
  const st = STATUS.find((x) => x.value === sub.status)!;
  const main = data.settings.mainCurrency;

  const setStatus = (status: Status) =>
    update((d) => ({
      ...d,
      subscriptions: d.subscriptions.map((x) => (x.id === sub.id
        ? { ...x, status, statusDate: status === 'active' ? undefined : (x.status === 'active' ? today : x.statusDate ?? today) }
        : x)),
    }));

  const nextText = next
    ? `${longDate(next).replace(/ \d{4}$/, '')} (${diffDays(today, next) === 0 ? 'today' : `in ${diffDays(today, next)} day${diffDays(today, next) === 1 ? '' : 's'}`})`
    : '—';

  return (
    <>
      <div className="form-hero" style={{ background: `linear-gradient(${alpha(sub.color, 0.5)}, ${alpha(sub.color, 0.14)} 55%, transparent)` }} />
      <SheetHeader
        title=""
        left={
          <Select value={sub.status} onChange={setStatus} className="status-pill" align="left"
            options={STATUS.map((x) => ({ value: x.value, label: x.label, dot: x.color }))}>
            <i style={{ background: st.color, boxShadow: `0 0 8px ${st.color}` }} />{st.label}<Chevrons />
          </Select>
        }
        right={<button className="text-pill" onClick={onEdit}>Edit</button>}
        onClose={onClose}
      />
      <div className="sheet-body">
        <div className="detail-hero">
          <motion.div style={{ display: 'inline-block' }} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}>
            <ServiceIcon sub={sub} size={64} glow />
          </motion.div>
          <h2>{sub.name}</h2>
          <p>{scheduleLabel(sub.schedule)}</p>
          {sub.status === 'canceled' && (
            <>
              <button className="text-pill resume-btn" onClick={resumePop.open}>Resume subscription…</button>
              <Popover anchor={resumePop.anchor} onClose={resumePop.close} className="popover">
                <div className="resume-pop">
                  <span>Charging again from</span>
                  <DateField value={resumeOn} onChange={setResumeOn} />
                  <small>The current plan and the pause stay in the history.</small>
                  <button className="primary-btn" onClick={resume}>Resume</button>
                </div>
              </Popover>
            </>
          )}
        </div>
        <div className="group">
          <div className="row">
            <span className="label">Amount</span>
            <span className="value">
              {sub.currency !== main && <span style={{ color: 'var(--text-3)' }}>≈ {formatMoney(convert(sub.amount, sub.currency, main, data.settings.rates), main, fmt)}</span>}
              <span style={{ color: 'var(--text)' }}>{formatMoney(sub.amount, sub.currency, fmt)}</span>
            </span>
          </div>
          <div className="row"><span className="label">Next payment</span><span className="value">{nextText}</span></div>
          <div className="row"><span className="label">Total spent<small>{charges.length} charge{charges.length === 1 ? '' : 's'}</small></span><span className="value">{spentText}</span></div>
          <div className="row"><span className="label">Notifications</span><span className="value">{sub.notifications === 'default' ? 'Default' : 'Disabled'}</span></div>
          <div className="row"><span className="label">{sub.periods?.length ? 'Current plan since' : 'Started'}</span><span className="value">{longDate(sub.startDate)}</span></div>
          {sub.endDate && <div className="row"><span className="label">Ends on</span><span className="value">{longDate(sub.endDate)}</span></div>}
        </div>
        <div className="group">
          <div className="row">
            <TagIcon /><span className="label">Category</span>
            <span className="value">
              <i style={{ width: 8, height: 8, borderRadius: '50%', background: data.categories.find((c) => c.id === sub.categoryId)?.color ?? '#6e6e73' }} />
              {data.categories.find((c) => c.id === sub.categoryId)?.name ?? 'Other'}
            </span>
          </div>
          <div className="row">
            <CardIcon /><span className="label">Pay with</span>
            <span className="value">
              {(() => {
                const pm = data.paymentMethods.find((p) => p.id === sub.paymentMethodId);
                return pm ? <><CardBadge brand={pm.brand} /><span className="card-line" style={{ textAlign: 'right' }}>{pm.name}{pm.last4 && <small>•••• {pm.last4}</small>}</span></> : 'None';
              })()}
            </span>
          </div>
        </div>
        {(timeline.length > 1 || sub.priceHistory?.length) ? (
          <>
            <div className="section-title">History</div>
            <div className="timeline">
              {timeline.map((seg, i) => seg.kind === 'pause' ? (
                <motion.div key={`p${seg.from}`} className="tl-item pause" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <i className="tl-dot" />
                  <div className="tl-body">
                    <b>Paused</b>
                    <small>{longDate(seg.from)} – {longDate(seg.to)} · {pauseLength(seg.days)}</small>
                  </div>
                </motion.div>
              ) : (
                <motion.div key={`s${seg.start}`} className={`tl-item ${seg.index === null ? 'current' : ''}`}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <i className="tl-dot" style={{ background: seg.index === null ? sub.color : undefined }} />
                  <div className="tl-body">
                    <div className="tl-head">
                      <b>{scheduleLabel(seg.schedule)}{seg.index === null && sub.status === 'active' ? ' · current' : ''}</b>
                      <span>{seg.prices.map((p) => formatMoney(p, seg.currency, fmt)).join(' → ')}</span>
                    </div>
                    <small>
                      {longDate(seg.start)} – {seg.end ? longDate(seg.end) : 'now'}
                      {' · '}{seg.charges} charge{seg.charges === 1 ? '' : 's'}, {formatMoney(seg.total, seg.currency, fmt)}
                    </small>
                    {(() => {
                      const pm = data.paymentMethods.find((p) => p.id === seg.paymentMethodId);
                      return pm ? <small className="tl-card"><CardBadge brand={pm.brand} />{pm.name}{pm.last4 ? ` ·· ${pm.last4}` : ''}</small> : null;
                    })()}
                    {seg.note && <small>{seg.note}</small>}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : null}
        {sub.notes && <div className="group"><div style={{ padding: 12, color: 'var(--text-2)', whiteSpace: 'pre-wrap', userSelect: 'text' }}>{sub.notes}</div></div>}
      </div>
    </>
  );
}
