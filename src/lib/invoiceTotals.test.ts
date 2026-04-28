import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotals, vatBreakdown } from './invoiceTotals';

describe('calculateInvoiceTotals', () => {
  it('returns zeros for an empty list', () => {
    expect(calculateInvoiceTotals([], 'standard')).toEqual({
      totalHT: 0,
      totalVAT: 0,
      totalTTC: 0,
    });
    expect(calculateInvoiceTotals(null, 'standard')).toEqual({
      totalHT: 0,
      totalVAT: 0,
      totalTTC: 0,
    });
    expect(calculateInvoiceTotals(undefined, 'standard')).toEqual({
      totalHT: 0,
      totalVAT: 0,
      totalTTC: 0,
    });
  });

  it('computes a simple single-line invoice (qty 1, 1000 € HT, 20 %)', () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 1000, vatRate: 20 }],
      'standard'
    );
    expect(totals).toEqual({ totalHT: 1000, totalVAT: 200, totalTTC: 1200 });
  });

  it('handles multi-line totals with mixed VAT rates', () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 2, unitPrice: 100, vatRate: 20 }, // 200 HT, 40 VAT
        { quantity: 5, unitPrice: 30, vatRate: 10 },  // 150 HT, 15 VAT
        { quantity: 1, unitPrice: 50, vatRate: 5.5 }, // 50 HT, 2.75 VAT
      ],
      'standard'
    );
    expect(totals.totalHT).toBe(400);
    expect(totals.totalVAT).toBe(57.75);
    expect(totals.totalTTC).toBe(457.75);
  });

  it('rounds to 2 decimals using half-away-from-zero', () => {
    // 17 % of 33.33 = 5.6661 → expect 5.67 with HAFZ rounding
    const totals = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 33.33, vatRate: 17 }],
      'standard'
    );
    expect(totals.totalHT).toBe(33.33);
    expect(totals.totalVAT).toBe(5.67);
    expect(totals.totalTTC).toBe(39);
  });

  it('keeps totalTTC === totalHT + totalVAT after rounding', () => {
    // Lots of small lines that would drift a cent without sum-then-round
    const items = Array.from({ length: 47 }, () => ({
      quantity: 1,
      unitPrice: 19.99,
      vatRate: 20,
    }));
    const totals = calculateInvoiceTotals(items, 'standard');
    // Math equality must hold to the cent
    expect(totals.totalTTC).toBeCloseTo(totals.totalHT + totals.totalVAT, 2);
  });

  it('zeroes VAT under franchise en base (art. 293 B CGI)', () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 1, unitPrice: 1000, vatRate: 20 },
        { quantity: 2, unitPrice: 250, vatRate: 10 },
      ],
      'franchise'
    );
    expect(totals.totalHT).toBe(1500);
    expect(totals.totalVAT).toBe(0);
    expect(totals.totalTTC).toBe(1500);
  });

  it('zeroes VAT under autoliquidation (art. 283-2 CGI)', () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 10, unitPrice: 50, vatRate: 20 }],
      'autoliquidation'
    );
    expect(totals.totalHT).toBe(500);
    expect(totals.totalVAT).toBe(0);
    expect(totals.totalTTC).toBe(500);
  });

  it('handles credit notes with negative quantities', () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: -1, unitPrice: 200, vatRate: 20 }],
      'standard'
    );
    expect(totals.totalHT).toBe(-200);
    expect(totals.totalVAT).toBe(-40);
    expect(totals.totalTTC).toBe(-240);
  });

  it('treats invalid quantity / unitPrice / rate as 0', () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: NaN, unitPrice: 100, vatRate: 20 } as any,
        { quantity: 1, unitPrice: Infinity, vatRate: 20 } as any,
        { quantity: 1, unitPrice: 100, vatRate: NaN } as any,
      ],
      'standard'
    );
    // Only the third row contributes (NaN rate becomes 0 → no VAT, but HT = 100)
    expect(totals.totalHT).toBe(100);
    expect(totals.totalVAT).toBe(0);
    expect(totals.totalTTC).toBe(100);
  });
});

describe('vatBreakdown', () => {
  it('groups items by VAT rate, sorted ascending', () => {
    const rows = vatBreakdown(
      [
        { quantity: 1, unitPrice: 100, vatRate: 20 },
        { quantity: 1, unitPrice: 50, vatRate: 5.5 },
        { quantity: 2, unitPrice: 100, vatRate: 20 },
      ],
      'standard'
    );
    expect(rows).toEqual([
      { rate: 5.5, baseHT: 50, vatAmount: 2.75 },
      { rate: 20, baseHT: 300, vatAmount: 60 },
    ]);
  });

  it('returns a single row at rate 0 under franchise', () => {
    const rows = vatBreakdown(
      [
        { quantity: 1, unitPrice: 1000, vatRate: 20 },
        { quantity: 1, unitPrice: 500, vatRate: 10 },
      ],
      'franchise'
    );
    expect(rows).toEqual([{ rate: 0, baseHT: 1500, vatAmount: 0 }]);
  });

  it('returns [] for empty input', () => {
    expect(vatBreakdown([], 'standard')).toEqual([]);
    expect(vatBreakdown(null, 'standard')).toEqual([]);
  });
});
