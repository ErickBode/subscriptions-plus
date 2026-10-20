export type Currency = 'EUR' | 'USD' | 'BRL';
export const CURRENCIES: Currency[] = ['EUR', 'USD', 'BRL'];

export type Unit = 'day' | 'week' | 'month' | 'year';

export type Schedule =
  | { kind: 'monthly' }
  | { kind: 'yearly' }
  | { kind: 'once' }
  | { kind: 'custom'; every: number; unit: Unit }
  | { kind: 'trial'; days: number };

export type Status = 'active' | 'canceled' | 'archived';

/** `simple` = a glyph from the bundled registry (simple-icons slug or Iconify key); `svg` = picked online. */
export type Icon =
  | { type: 'simple'; slug: string }
  | { type: 'svg'; body: string; width: number; height: number }
  | { type: 'letter' };

/** A previous price, valid for charges up to and including `until`. */
export interface PriceChange { until: string; amount: number }

/** An earlier plan of the same subscription. Gaps between periods are pauses. */
export interface Period {
  /** First charge of the period (anchors its schedule). */
  start: string;
  /** Last day the period could charge (inclusive). */
  end: string;
  schedule: Schedule;
  amount: number;
  currency: Currency;
  priceHistory?: PriceChange[];
  paymentMethodId?: string;
  note?: string;
}

export interface Subscription {
  id: string;
  name: string;
  serviceId?: string;
  icon: Icon;
  color: string;
  /** Current price. Earlier prices live in `priceHistory`. */
  amount: number;
  priceHistory?: PriceChange[];
  currency: Currency;
  schedule: Schedule;
  /** ISO date YYYY-MM-DD of the first charge. */
  startDate: string;
  endDate?: string;
  status: Status;
  /** Date the status left "active"; charges stop after it. */
  statusDate?: string;
  categoryId: string;
  paymentMethodId?: string;
  notifications: 'default' | 'disabled';
  notes: string;
  /** Earlier plans and pauses; the fields above describe the current plan. */
  periods?: Period[];
  createdAt: string;
}

export interface Category { id: string; name: string; color: string; system?: boolean }
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'other';
export interface PaymentMethod { id: string; name: string; brand?: CardBrand; last4?: string }

/** Days before the charge; null = never. */
export interface Reminder { days: number | null; time: string }

export interface Rates {
  /** Units of each currency per 1 EUR. */
  EUR: number;
  USD: number;
  BRL: number;
  updatedAt: string | null;
}

export interface Settings {
  mainCurrency: Currency;
  rounding: boolean;
  abbreviate: boolean;
  trueDark: boolean;
  firstReminder: Reminder;
  secondReminder: Reminder;
  startWithWindows: boolean;
  rates: Rates;
}

export interface AppData {
  version: 1;
  subscriptions: Subscription[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  settings: Settings;
}

export interface Occurrence {
  sub: Subscription;
  date: string;
  /** Amount in `currency` (the currency of the plan that charged it). */
  amount: number;
  currency: Currency;
  /** Schedule of the plan that charged it. */
  schedule: Schedule;
  /** Index into `sub.periods` when an earlier plan charged it. */
  period?: number;
  /** Card of the plan that charged it. */
  paymentMethodId?: string;
}
