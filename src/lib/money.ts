import type { Currency, Rates, Settings } from './types';

export const SYMBOL: Record<Currency, string> = { EUR: '€', USD: '$', BRL: 'R$' };
export const CURRENCY_NAME: Record<Currency, string> = {
  EUR: 'Euro', USD: 'US Dollar', BRL: 'Brazilian Real',
};

export function convert(amount: number, from: Currency, to: Currency, rates: Rates): number {
  if (from === to) return amount;
  return (amount / rates[from]) * rates[to];
}

export interface FormatOpts { rounding?: boolean; abbreviate?: boolean }

/** Number part only, European style: 1.395,20 / 99,14 / 46,60 / 74,5k. Always two decimals unless rounding. */
export function formatNumber(value: number, opts: FormatOpts = {}): string {
  if (opts.abbreviate && Math.abs(value) >= 10000) {
    const units: [number, string][] = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
    const [div, suffix] = units.find(([d]) => Math.abs(value) >= d)!;
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value / div) + suffix;
  }
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: opts.rounding ? 0 : 2,
    maximumFractionDigits: opts.rounding ? 0 : 2,
  }).format(value);
}

export function formatMoney(value: number, currency: Currency, opts: FormatOpts = {}): string {
  return SYMBOL[currency] + formatNumber(value, opts);
}

export function settingsFormat(s: Settings): FormatOpts {
  return { rounding: s.rounding, abbreviate: s.abbreviate };
}

/** Value, suffix and Intl options for NumberFlow so animated numbers match formatMoney. */
export function flowParts(value: number, opts: FormatOpts) {
  if (opts.abbreviate && Math.abs(value) >= 10000) {
    const [div, suffix] = ([[1e9, 'B'], [1e6, 'M'], [1e3, 'k']] as [number, string][])
      .find(([d]) => Math.abs(value) >= d)!;
    return { value: value / div, suffix, format: { maximumFractionDigits: 1 } };
  }
  return {
    value,
    suffix: '',
    format: { minimumFractionDigits: opts.rounding ? 0 : 2, maximumFractionDigits: opts.rounding ? 0 : 2 },
  };
}
