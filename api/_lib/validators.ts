export const MAX_BASE64_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_AI_PROMPT_LENGTH = 8000;
export const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function sanitizeText(value: unknown, max = 1000): string {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

export function escapeHtml(value: unknown): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function base64ByteLength(base64: string): number {
  const clean = String(base64 || '').replace(/^data:[^,]+,/, '').replace(/\s/g, '');
  return Math.floor((clean.length * 3) / 4);
}

export function isAllowedImage(mimeType: unknown, base64: unknown): boolean {
  return typeof mimeType === 'string' &&
    ALLOWED_IMAGE_MIME.has(mimeType) &&
    typeof base64 === 'string' &&
    base64ByteLength(base64) <= MAX_BASE64_IMAGE_BYTES;
}

export function isValidPdfAttachment(att: any): boolean {
  return !!att &&
    typeof att.filename === 'string' &&
    /\.pdf$/i.test(att.filename) &&
    typeof att.content === 'string' &&
    base64ByteLength(att.content) <= MAX_PDF_BYTES;
}

export function isIsoDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

export function isValidAmountCents(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= -100_000_000 && Number(value) <= 100_000_000;
}

export function luhn(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return digits.length > 0 && sum % 10 === 0;
}

export function isSiret(value: unknown): boolean {
  return typeof value === 'string' && /^\d{14}$/.test(value.replace(/\s/g, '')) && luhn(value);
}

export function isSiren(value: unknown): boolean {
  return typeof value === 'string' && /^\d{9}$/.test(value.replace(/\s/g, '')) && luhn(value);
}

// French VAT numbers can start with two alphanumeric checksum chars followed by SIREN.
export function isFrenchVatNumber(value: unknown): boolean {
  return typeof value === 'string' && /^FR[0-9A-Z]{2}\d{9}$/i.test(value.replace(/\s/g, ''));
}

