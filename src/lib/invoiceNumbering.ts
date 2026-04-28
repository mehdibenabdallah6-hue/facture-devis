/**
 * Pure invoice-number builder.
 *
 * Used both by the server (api/invoice-validate.ts at validation time) and
 * by tests. Numbering rules follow French commercial law (CGI art. 242
 * nonies A annexe II): unique, chronological, continuous per type per year.
 *
 * Format:  {prefix}-{YYYY}-{NNNN}   e.g.  F-2026-0007
 *
 * Default prefixes:
 *   invoice  → 'F'   (or company override, ≤ 8 chars, uppercased)
 *   quote    → 'D'
 *   credit   → 'AV'  (avoir)
 *   deposit  → 'AC'  (acompte)
 *
 * The company can override the *invoice* prefix only — quote and credit-note
 * sequences are kept stable to avoid breaking historical references.
 */

export type InvoiceType = 'invoice' | 'quote' | 'credit' | 'deposit';

export const PREFIX_FALLBACK: Record<InvoiceType, string> = {
  invoice: 'F',
  quote: 'D',
  credit: 'AV',
  deposit: 'AC',
};

/** Build the canonical invoice number string from its parts. */
export function buildInvoiceNumber(prefix: string, year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new Error(`Invalid year for invoice number: ${year}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Invalid sequence for invoice number: ${sequence}`);
  }
  return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
}

/** Pick the prefix to use for a given invoice type, applying company override. */
export function pickInvoicePrefix(type: InvoiceType, companyInvoicePrefix?: string | null): string {
  if (type === 'invoice' && companyInvoicePrefix && companyInvoicePrefix.length <= 8) {
    return companyInvoicePrefix.toUpperCase();
  }
  return PREFIX_FALLBACK[type];
}

/** Parse a canonical number string back into its parts (handy for tests + reports). */
export interface ParsedInvoiceNumber {
  prefix: string;
  year: number;
  sequence: number;
}

export function parseInvoiceNumber(value: string): ParsedInvoiceNumber | null {
  if (!value || typeof value !== 'string') return null;
  // Allow A-Z, 0-9 in the prefix (e.g. F, AV, INV2, but not lower-case).
  const match = value.match(/^([A-Z0-9]{1,8})-(\d{4})-(\d{1,8})$/);
  if (!match) return null;
  const [, prefix, yearStr, seqStr] = match;
  return {
    prefix,
    year: Number.parseInt(yearStr, 10),
    sequence: Number.parseInt(seqStr, 10),
  };
}
