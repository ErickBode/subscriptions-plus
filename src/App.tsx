import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import appIcon from '../src-tauri/icons/64x64.png';
import { Calendar } from './components/Calendar';
import { Detail } from './components/Detail';
import { ChartIcon, GearIcon, KeyIcon, MinIcon, SearchIcon, WinCloseIcon } from './components/icons';
import { MonthPanel, UpcomingPanel, YearStrip } from './components/Panels';
import { Search } from './components/Search';
import { Shortcuts } from './components/Shortcuts';
import { ServicePicker } from './components/ServicePicker';
import { Settings } from './components/Settings';
import { Breakdown, Stats } from './components/Stats';
import { blankSubscription, SubscriptionForm } from './components/SubscriptionForm';
import { Pages, Sheet } from './components/ui';
import { onTrayAction, windowAction } from './lib/backend';
import { colorForName, serviceIcon } from './lib/catalog';
import { parse, shiftMonth } from './lib/dates';
import type { Subscription } from './lib/types';
import { useStore } from './store';

type Main = null | 'add' | 'detail' | 'search' | 'stats' | 'settings' | 'shortcuts';

const WIDE = 940;

function useWide(): boolean {
  const [wide, setWide] = useState(() => window.innerWidth >= WIDE);
  useEffect(() => {
    const r = () => setWide(window.innerWidth >= WIDE);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  return wide;
}
type Stacked = null | { kind: 'breakdown'; year: number; categoryId: string } | { kind: 'detail'; subId: string };

export function App() {
  const { data, update, today } = useStore();
  const t = parse(today);
  const [view, setView] = useState({ y: t.y, m: t.m, dir: 1 as 1 | -1 });
  const [main, setMain] = useState<Main>(null);
  const [stacked, setStacked] = useState<Stacked>(null);
  const [draft, setDraft] = useState<{ sub: Subscription; page: 'picker' | 'form'; dir: 1 | -1 } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const wide = useWide();

  const subs = data.subscriptions;
  const shift = useCallback((delta: number) => setView((v) => ({ ...shiftMonth(v.y, v.m, delta), dir: delta > 0 ? 1 : -1 })), []);
  const goToday = useCallback(() => setView((v) => {
    const dir = v.y * 12 + v.m < t.y * 12 + t.m ? 1 : -1;
    return { y: t.y, m: t.m, dir };
  }), [t.y, t.m]);

  const openAdd = useCallback((date?: string) => {
    setDraft({
      sub: blankSubscription({ currency: data.settings.mainCurrency }, date ?? today),
      page: 'picker',
      dir: 1,
    });
    setMain('add');
  }, [data.settings.mainCurrency, today]);

  const openDetail = (s: Subscription) => { setDetailId(s.id); setMain('detail'); };

  const save = (s: Subscription) => update((d) => {
    const exists = d.subscriptions.some((x) => x.id === s.id);
    return { ...d, subscriptions: exists ? d.subscriptions.map((x) => (x.id === s.id ? s : x)) : [...d.subscriptions, s] };
  });
  const remove = (id: string) => update((d) => ({ ...d, subscriptions: d.subscriptions.filter((x) => x.id !== id) }));

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea');
      if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); openAdd(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); setMain('search'); return; }
      if (e.ctrlKey && e.key === ',') { e.preventDefault(); setMain('settings'); return; }
      if (main || typing || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (e.key === 'ArrowRight') shift(1);
      else if (e.key === 'ArrowLeft') shift(-1);
      else if (key === 't') goToday();
      else if (key === 'n') { e.preventDefault(); openAdd(); }
      else if (key === 'f') { e.preventDefault(); setMain('search'); }
      else if (key === 's') setMain('stats');
      else if (e.key === '?') setMain('shortcuts');
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [main, shift, goToday, openAdd]);

  // Actions requested from the tray mini-window.
  useEffect(() => onTrayAction((action) => {
    if (action === 'add') openAdd();
    else if (action.startsWith('open:')) { setDetailId(action.slice(5)); setMain('detail'); }
  }), [openAdd]);

  const closeMain = () => setMain(null);

  return (
    <div className="app">
      <div className="titlebar">
        <div className="app-title" data-tauri-drag-region>
          <img src={appIcon} alt="" width={18} height={18} draggable={false} />
          Subscriptions+
        </div>
        <div className="drag" data-tauri-drag-region />
        <button className="icon-btn" title="Search (F)" onClick={() => setMain('search')}><SearchIcon /></button>
        <button className="icon-btn" title="Statistics (S)" onClick={() => setMain('stats')}><ChartIcon /></button>
        <button className="icon-btn" title="Settings (Ctrl+,)" onClick={() => setMain('settings')}><GearIcon /></button>
        <button className="icon-btn" title="Keyboard shortcuts (?)" onClick={() => setMain('shortcuts')}><KeyIcon /></button>
        <span className="win-sep" />
        <button className="win-btn" title="Minimize" onClick={() => windowAction('minimize')}><MinIcon /></button>
        <button className="win-btn close" title="Close to tray" onClick={() => windowAction('close')}><WinCloseIcon /></button>
      </div>

      <div className={wide ? 'wide-layout' : 'compact-layout'}>
        <AnimatePresence>{wide && <UpcomingPanel key="up" subs={subs} onOpen={openDetail} />}</AnimatePresence>
        <div className="center-col">
          <AnimatePresence>
            {wide && (
              <YearStrip key="ys" subs={subs} year={view.y} month={view.m}
                onPick={(y, m) => setView((v) => ({ y, m, dir: y * 12 + m >= v.y * 12 + v.m ? 1 : -1 }))} />
            )}
          </AnimatePresence>
          <Calendar
            year={view.y} month={view.m} direction={view.dir} subs={subs}
            onShift={shift} onToday={goToday} onAdd={openAdd} onOpen={openDetail}
          />
        </div>
        <AnimatePresence>{wide && <MonthPanel key="mp" subs={subs} year={view.y} month={view.m} onOpen={openDetail} />}</AnimatePresence>
      </div>

      <Sheet open={main !== null} onClose={closeMain}>
        {main === 'add' && draft && (
          <Pages pageKey={draft.page} direction={draft.dir}>
            {draft.page === 'picker' ? (
              <ServicePicker
                onCancel={closeMain}
                onPick={(svc) => {
                  const sub = 'custom' in svc
                    ? { ...draft.sub, name: svc.name, icon: { type: 'letter' as const }, color: colorForName(svc.name), serviceId: undefined }
                    : {
                      ...draft.sub, name: svc.name, serviceId: svc.id, icon: serviceIcon(svc), color: svc.color,
                      categoryId: data.categories.some((c) => c.id === svc.category) ? svc.category : 'other',
                    };
                  setDraft({ sub, page: 'form', dir: 1 });
                }}
              />
            ) : (
              <SubscriptionForm
                initial={draft.sub}
                isNew
                onBack={() => setDraft({ ...draft, page: 'picker', dir: -1 })}
                onDone={(s) => {
                  save(s);
                  closeMain();
                  const d = parse(s.startDate);
                  if (d.y !== view.y || d.m !== view.m) {
                    setView((v) => ({ y: d.y, m: d.m, dir: d.y * 12 + d.m > v.y * 12 + v.m ? 1 : -1 }));
                  }
                }}
              />
            )}
          </Pages>
        )}
        {main === 'detail' && detailId && <DetailFlow subId={detailId} onClose={closeMain} save={save} remove={remove} />}
        {main === 'search' && <Search onClose={closeMain} onOpen={(s) => setStacked({ kind: 'detail', subId: s.id })} />}
        {main === 'stats' && (
          <Stats subs={subs} onClose={closeMain} onBreakdown={(year, categoryId) => setStacked({ kind: 'breakdown', year, categoryId })} />
        )}
        {main === 'settings' && <Settings onClose={closeMain} />}
        {main === 'shortcuts' && <Shortcuts onClose={closeMain} />}
      </Sheet>

      <Sheet open={stacked !== null} onClose={() => setStacked(null)} stacked>
        {stacked?.kind === 'breakdown' && (
          <Breakdown subs={subs} year={stacked.year} categoryId={stacked.categoryId} onClose={() => setStacked(null)}
            onOpen={(s) => setStacked({ kind: 'detail', subId: s.id })} />
        )}
        {stacked?.kind === 'detail' && <DetailFlow subId={stacked.subId} onClose={() => setStacked(null)} save={save} remove={remove} />}
      </Sheet>
    </div>
  );
}

function DetailFlow({ subId, onClose, save, remove }: {
  subId: string; onClose: () => void; save: (s: Subscription) => void; remove: (id: string) => void;
}) {
  const { data } = useStore();
  const [editing, setEditing] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const sub = data.subscriptions.find((s) => s.id === subId);
  if (!sub) return null;
  return (
    <Pages pageKey={editing ? 'edit' : 'detail'} direction={dir}>
      {editing ? (
        <SubscriptionForm
          initial={sub}
          isNew={false}
          onBack={() => { setDir(-1); setEditing(false); }}
          onDone={(s) => { save(s); setDir(-1); setEditing(false); }}
          onDelete={() => { onClose(); setTimeout(() => remove(sub.id), 250); }}
        />
      ) : (
        <Detail sub={sub} onClose={onClose} onEdit={() => { setDir(1); setEditing(true); }} />
      )}
    </Pages>
  );
}
