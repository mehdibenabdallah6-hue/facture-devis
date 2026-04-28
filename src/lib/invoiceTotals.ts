/**
 * Pure invoice-total calculator.
 *
 * Extracted from `pages/InvoiceCreate.tsx` so the math (HT, TVA, TTC)
 * lives in one tested place instead of being recomputed inline. Any
 * server-side validator or PDF renderer that needs these totals should
 * call this helper to avoid drift.
 *
 * VAT rules:
 *   - `standard`        → VAT applied per item from `item.vatRate` (%)
 *   - `franchise`       → no VAT (art. 293 B CGI), even if items carry rates
 *   - `autoliquidation` → no VAT, the client self-assesses (art. 283-2)
 *
 * Numerical precision:
 *   We round each result to 2 decimals at the very end (banker-style isn't
 *   required for invoices in France — half-away-from-zero is accepted by
 *   the DGFiP). Rounding line-by-line would cause €0.01 drifts on long
 *   invoices, so we sum first and round once.
 */

export type VatRegime = 'standard' | 'franchise' | 'autoliquidation';

export interface InvoiceLineLike {
  /** Quantity. May be negative for credit notes. */
  quantity: number;
  /** Unit price HT. */
  unitPrice: number;
  /** VAT rate as a percentage, e.g. 20 for 20 %. Ignored when regime ≠ standard. */
  vatRate: number;
}

export interface InvoiceTotals {
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

/** Round to 2 decimals, half-away-from-zero. */
function round2(n: number): number {
  // Math.round is half-to-even on negative numbers in some engines; force positive
  // semantics with a sign-preserving offset. Multiply by 100 to avoid float noise.
  if (n === 0) return 0;
  const sign = n < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(n) * 100) / 100;
}

export function calculateInvoiceTotals(
  items: InvoiceLineLike[] | null | undefined,
  vatRegime: VatRegime = 'standard'
): InvoiceTotals {
  if (!Array.isArray(items) || items.length === 0) {
    return { totalHT: 0, totalVAT: 0, totalTTC: 0 };
  }

  let totalHT = 0;
  let totalVAT = 0;

  for (const item of items) {
    const qty = Number.isFinite(item?.quantity) ? item.quantity : 0;
    const unit = Number.isFinite(item?.unitPrice) ? item.unitPrice : 0;
    const lineHT = qty * unit;
    totalHT += lineHT;

    if (vatRegime === 'standard') {
      const rate = Number.isFinite(item?.vatRate) ? item.vatRate : 0;
      totalVAT += lineHT * (rate / 100);
    }
    // franchise / autoliquidation → no VAT on the line, regardless of rate
  }

  const totalHTRounded = round2(totalHT);
  const totalVATRounded = round2(totalVAT);
  // Sum the rounded values so totalTTC always equals totalHT + totalVAT to
  // the cent — otherwise the PDF footer might show 1199.99 + 240.00 = 1440.00
  // while totalHT + totalVAT = 1439.99 due to a single rounding artefact.
  const totalTTC = round2(totalHTRounded + totalVATRounded);

  return {
    totalHT: totalHTRounded,
    totalVAT: totalVATRounded,
    totalTTC,
  };
}

/**
 * Group items by VAT rate and return the per-rate breakdown — used by the
 * Factur-X CII XML generator and by the PDF "Tableau récapitulatif TVA"
 * (mention obligatoire art. L.441-9 dès qu'il y a plusieurs taux).
 */
export interface VatBreakdownRow {
  rate: number;
  baseHT: number;
  vatAmount: number;
}

export function vatBreakdown(
  items: InvoiceLineLike[] | null | undefined,
  vatRegime: VatRegime = 'standard'
): VatBreakdownRow[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const map = new Map<number, { base: number; vat: number }>();
  for (const item of items) {
    const qty = Number.isFinite(item?.quantity) ? item.quantity : 0;
    const unit = Number.isFinite(item?.unitPrice) ? item.unitPrice : 0;
    const rate = vatRegime === 'standard' && Number.isFinite(item?.vatRate)
      ? item.vatRate
      : 0;
    const lineHT = qty * unit;
    const lineVAT = vatRegime === 'standard' ? lineHT * (rate / 100) : 0;
    const prev = map.get(rate) ?? { base: 0, vat: 0 };
    prev.base += lineHT;
    prev.vat += lineVAT;
    map.set(rate, prev);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, { base, vat }]) => ({
      rate,
      baseHT: round2(base),
      vatAmount: round2(vat),
    }));
}
