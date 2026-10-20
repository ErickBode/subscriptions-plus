import { describe, expect, it } from 'vitest';
import { defaultData } from './defaults';
import { exportFileName, exportJson, parseImport } from './transfer';

describe('export and import', () => {
  it('round-trips everything the app stores', () => {
    const d = defaultData();
    d.paymentMethods.push({ id: 'card', name: 'Card', brand: 'visa', last4: '4242' });
    d.settings.mainCurrency = 'BRL';
    expect(parseImport(exportJson(d))).toEqual(d);
    expect(exportFileName('2026-10-20')).toBe('subscriptions-plus-2026-10-20.json');
  });

  it('accepts a file with a BOM and fills missing settings', () => {
    const d = parseImport('﻿{"subscriptions": []}');
    expect(d.settings.mainCurrency).toBe('EUR');
    expect(d.categories.length).toBeGreaterThan(0);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseImport('not json')).toThrow('not valid JSON');
    expect(() => parseImport('{"name": "x"}')).toThrow('not a Subscriptions+ backup');
  });
});
