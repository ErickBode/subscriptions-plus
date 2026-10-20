// Calendar-date helpers on plain YYYY-MM-DD strings (no time zones involved).

export interface YMD { y: number; m: number; d: number } // m: 1-12

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');

export function parse(s: string): YMD {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function fmt({ y, m, d }: YMD): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function todayISO(now = new Date()): string {
  return fmt({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

function toUTC(s: string): number {
  const { y, m, d } = parse(s);
  return Date.UTC(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const t = new Date(toUTC(s) + n * 86400000);
  return fmt({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

/** Adds months keeping the anchor day, clamped to the month length (31 → 30/28). */
export function addMonthsAnchored(start: string, n: number): string {
  const { y, m, d } = parse(start);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return fmt({ y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) });
}

export function monthKey(y: number, m: number): string {
  return `${y}-${pad(m)}`;
}

export function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** Sunday-first weekday (0 = Sunday) of the first day of the month. */
export function firstWeekday(y: number, m: number): number {
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

export function longDate(s: string): string {
  const { y, m, d } = parse(s);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}
