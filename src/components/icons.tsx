// Small stroke icons in the style of SF Symbols.
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const SearchIcon = () => (
  <svg viewBox="0 0 20 20" {...S}><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
);
export const ChartIcon = () => (
  <svg viewBox="0 0 20 20" {...S}><path d="M5 16V9M10 16V4M15 16v-5" /></svg>
);
export const GearIcon = () => (
  <svg viewBox="0 0 20 20" {...S}>
    <circle cx="10" cy="10" r="2.6" />
    <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
    <circle cx="10" cy="10" r="5.6" />
  </svg>
);
export const CloseIcon = () => (
  <svg viewBox="0 0 12 12" {...S} strokeWidth={1.8}><path d="m2.5 2.5 7 7m0-7-7 7" /></svg>
);
export const BackIcon = () => (
  <svg viewBox="0 0 12 12" {...S} strokeWidth={1.8}><path d="M7.5 2 3.5 6l4 4" /></svg>
);
export const MinIcon = () => (
  <svg viewBox="0 0 12 12" width="11" height="11" {...S} strokeWidth={1.2}><path d="M1.5 6h9" /></svg>
);
export const WinCloseIcon = () => (
  <svg viewBox="0 0 12 12" width="11" height="11" {...S} strokeWidth={1.2}><path d="m1.5 1.5 9 9m0-9-9 9" /></svg>
);
export const Chevrons = () => (
  <svg className="chev" viewBox="0 0 9 12" {...S} strokeWidth={1.5}><path d="m2 4.5 2.5-2.5L7 4.5M2 7.5 4.5 10 7 7.5" /></svg>
);
export const ChevRight = () => (
  <svg className="chev-right" viewBox="0 0 7 11" {...S} strokeWidth={1.6}><path d="m1.5 1.5 4 4-4 4" /></svg>
);
export const ArrowLeft = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" {...S} strokeWidth={1.8}><path d="M7.5 2 3.5 6l4 4" /></svg>
);
export const ArrowRight = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" {...S} strokeWidth={1.8}><path d="m4.5 2 4 4-4 4" /></svg>
);
export const ReturnIcon = () => (
  <svg viewBox="0 0 14 14" width="13" height="13" fill="var(--orange)"><path d="M6 2.2 1.5 6 6 9.8V7.4c3 0 5 .8 6.5 3.1-.4-3.5-2.4-5.6-6.5-6V2.2Z" /></svg>
);
export const TagIcon = () => (
  <svg className="row-icon" viewBox="0 0 16 16" {...S} strokeWidth={1.3}><path d="M2 8.6V2.5c0-.3.2-.5.5-.5h6.1l5.4 5.4-6.6 6.6L2 8.6Z" /><circle cx="5.2" cy="5.2" r="1" /></svg>
);
export const CardIcon = () => (
  <svg className="row-icon" viewBox="0 0 16 16" {...S} strokeWidth={1.3}><rect x="1.8" y="3.5" width="12.4" height="9" rx="1.6" /><path d="M1.8 6.5h12.4M4.5 10h2.5" /></svg>
);
export const BellIcon = () => (
  <svg className="row-icon" viewBox="0 0 16 16" {...S} strokeWidth={1.3}><path d="M4 11V7a4 4 0 0 1 8 0v4l1.2 1.4H2.8L4 11ZM6.5 13.8a1.6 1.6 0 0 0 3 0" /></svg>
);
export const GridIcon = () => (
  <svg className="row-icon" viewBox="0 0 16 16" {...S} strokeWidth={1.3}><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
);
export const TrashIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" {...S} strokeWidth={1.3}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></svg>
);
export const PlusCircle = ({ color }: { color: string }) => (
  <span style={{ width: 18, height: 18, borderRadius: '50%', background: color, display: 'grid', placeItems: 'center', flex: 'none' }}>
    <svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"><path d="M5 2v6M2 5h6" /></svg>
  </span>
);
export const KeyIcon = () => (
  <svg viewBox="0 0 20 20" {...S}><rect x="2.5" y="5" width="15" height="10" rx="2" /><path d="M5.5 8h1M8.5 8h1M11.5 8h1M14.5 8h0M6 12h8" /></svg>
);
