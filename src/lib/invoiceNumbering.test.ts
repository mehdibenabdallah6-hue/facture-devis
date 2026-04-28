import { describe, it, expect } from 'vitest';
import {
  buildInvoiceNumber,
  pickInvoicePrefix,
  parseInvoiceNumber,
  PREFIX_FALLBACK,
} from './invoiceNumbering';

describe('buildInvoiceNumber', () => {
  it('pads the sequence to 4 digits', () => {
    expect(buildInvoiceNumber('F', 2026, 1)).toBe('F-2026-0001');
    expect(buildInvoiceNumber('F', 2026, 7)).toBe('F-2026-0007');
    expect(buildInvoiceNumber('F', 2026, 42)).toBe('F-2026-0042');
    expect(buildInvoiceNumber('F', 2026, 9999)).toBe('F-2026-9999');
  });

  it('preserves prefix length beyond 4 chars (5+ digit sequences)', () => {
    expect(buildInvoiceNumber('F', 2026, 12345)).toBe('F-2026-12345');
  });

  it('respects custom prefixes (uppercase preserved by caller)', () => {
    expect(buildInvoiceNumber('AV', 2026, 3)).toBe('AV-2026-0003');
    expect(buildInvoiceNumber('AC', 2026, 12)).toBe('AC-2026-0012');
    expect(buildInvoiceNumber('INVOICE2', 2026, 1)).toBe('INVOICE2-2026-0001');
  });

  it('throws on impossible years', () => {
    expect(() => buildInvoiceNumber('F', 0, 1)).toThrow();
    expect(() => buildInvoiceNumber('F', 1899, 1)).toThrow();
    expect(() => buildInvoiceNumber('F', 10000, 1)).toThrow();
    expect(() => buildInvoiceNumber('F', 2026.5 as any, 1)).toThrow();
  });

  it('throws on non-positive sequences', () => {
    expect(() => buildInvoiceNumber('F', 2026, 0)).toThrow();
    expect(() => buildInvoiceNumber('F', 2026, -1)).toThrow();
    expect(() => buildInvoiceNumber('F', 2026, 1.5 as any)).toThrow();
  });
});

describe('pickInvoicePrefix', () => {
  it('returns the static fallbacks for non-invoice types', () => {
    expect(pickInvoicePrefix('quote')).toBe(PREFIX_FALLBACK.quote);
    expect(pickInvoicePrefix('credit')).toBe(PREFIX_FALLBACK.credit);
    expect(pickInvoicePrefix('deposit')).toBe(PREFIX_FALLBACK.deposit);
  });

  it('returns the company override only for invoices', () => {
    expect(pickInvoicePrefix('invoice', 'inv')).toBe('INV');
    expect(pickInvoicePrefix('invoice', 'FACT2026')).toBe('FACT2026');
  });

  it('ignores the company override for quote / credit / deposit', () => {
    expect(pickInvoicePrefix('quote', 'INV')).toBe('D');
    expect(pickInvoicePrefix('credit', 'INV')).toBe('AV');
    expect(pickInvoicePrefix('deposit', 'INV')).toBe('AC');
  });

  it('falls back when override is empty / null / too long', () => {
    expect(pickInvoicePrefix('invoice', '')).toBe('F');
    expect(pickInvoicePrefix('invoice', null)).toBe('F');
    expect(pickInvoicePrefix('invoice', undefined)).toBe('F');
    expect(pickInvoicePrefix('invoice', 'TOOLONGPREFIX')).toBe('F'); // 13 chars > 8
  });
});

describe('parseInvoiceNumber', () => {
  it('round-trips every prefix supported by buildInvoiceNumber', () => {
    const cases: Array<[string, number, number]> = [
      ['F', 2026, 1],
      ['AV', 2026, 999],
      ['AC', 2026, 42],
      ['D', 2025, 7],
    ];
    for (const [prefix, year, seq] of cases) {
      const built = buildInvoiceNumber(prefix, year, seq);
      const parsed = parseInvoiceNumber(built);
      expect(parsed).toEqual({ prefix, year, sequence: seq });
    }
  });

  it('returns null for malformed strings', () => {
    expect(parseInvoiceNumber('')).toBeNull();
    expect(parseInvoiceNumber('foo')).toBeNull();
    expect(parseInvoiceNumber('F-2026')).toBeNull();
    expect(parseInvoiceNumber('f-2026-0001')).toBeNull(); // lowercase prefix not allowed
    expect(parseInvoiceNumber('F-26-1')).toBeNull(); // year not 4 digits
  });
});
