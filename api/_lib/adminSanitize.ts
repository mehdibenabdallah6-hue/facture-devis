import crypto from 'node:crypto';

export const ADMIN_ALLOWED_EVENTS = [
  'user_signed_up',
  'company_created',
  'client_created',
  'quote_created',
  'quote_sent',
  'quote_signed',
  'invoice_created',
  'invoice_validated',
  'ai_extraction_started',
  'ai_extraction_succeeded',
  'ai_extraction_failed',
  'quota_limit_reached',
  'email_sent',
  'email_failed',
  'checkout_started',
  'subscription_started',
  'clicked_create_invoice',
  'clicked_create_quote',
  'clicked_ai_photo_upload',
  'clicked_send_email',
  'clicked_validate_invoice',
  'clicked_upgrade_plan',
] as const;

const PLAN_VALUES = new Set(['free', 'starter', 'pro']);
const SUBSCRIPTION_VALUES = new Set(['none', 'inactive', 'active', 'trialing', 'past_due', 'cancelled', 'pending_activation']);
const STATUS_VALUES = new Set(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'validated', 'accepted', 'converted']);
const ACTIVATION_VALUES = new Set([
  'new',
  'onboarding_started',
  'company_created',
  'activated',
  'power_user',
  'blocked',
  'paying',
]);

export function anonymizeId(value: unknown): string {
  const input = String(value || 'unknown');
  return `usr_${crypto.createHash('sha256').update(input).digest('hex').slice(0, 12)}`;
}

export function truncateUid(value: unknown): string {
  const uid = String(value || '');
  if (!uid) return 'unknown';
  return uid.length <= 10 ? `${uid.slice(0, 4)}…` : `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

export function maskEmail(value: unknown): string {
  const email = String(value || '').trim().toLowerCase();
  const match = email.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
  if (!match) return '';
  const [, local, domain] = match;
  const first = local[0] || 'u';
  return `${first}***@${domain}`;
}

export function safePlan(value: unknown): string {
  const plan = String(value || 'free').toLowerCase();
  return PLAN_VALUES.has(plan) ? plan : 'free';
}

export function safeSubscriptionStatus(value: unknown): string {
  const status = String(value || 'none').toLowerCase();
  return SUBSCRIPTION_VALUES.has(status) ? status : 'none';
}

export function safeDocumentStatus(value: unknown): string {
  const status = String(value || 'unknown').toLowerCase();
  return STATUS_VALUES.has(status) ? status : 'unknown';
}

export function safeActivationStatus(value: unknown): string {
  const status = String(value || 'new').toLowerCase();
  return ACTIVATION_VALUES.has(status) ? status : 'new';
}

export function monthBucket(value: unknown): string {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function bucketCount(value: unknown): string {
  const count = Math.max(0, Math.round(parseNumber(value)));
  if (count === 0) return '0';
  if (count <= 2) return '1_2';
  if (count <= 5) return '3_5';
  if (count <= 10) return '6_10';
  if (count <= 20) return '11_20';
  return '21_plus';
}

export function incrementCounter(counter: Record<string, number>, key: string) {
  counter[key] = (counter[key] || 0) + 1;
}

export function percent(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function safeProfession(value: unknown): string {
  return String(value || 'non_renseigne')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 40) || 'non_renseigne';
}

export function sanitizeErrorType(value: unknown): string {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 60) || 'unknown';
}

export function sanitizeRoute(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';
  const noQuery = raw.split('?')[0] || '';
  const apiMatch = noQuery.match(/^\/api\/([a-z0-9_-]+)/i);
  if (apiMatch) return `/api/${apiMatch[1].toLowerCase()}`;
  if (/^https?:\/\//i.test(noQuery)) return 'external';
  if (noQuery.startsWith('/')) {
    const first = noQuery.split('/').filter(Boolean)[0];
    return first ? `/${first.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}` : '/';
  }
  return sanitizeErrorType(noQuery).slice(0, 40) || 'unknown';
}

export function classifySeverity(type: unknown): 'critical' | 'warning' | 'info' {
  const normalized = sanitizeErrorType(type);
  if (/(paddle|webhook|invoice_validate|credit_note|permission|forbidden|unauthorized|500|server)/.test(normalized)) {
    return 'critical';
  }
  if (/(failed|error|quota|gemini|email|timeout|rate_limit)/.test(normalized)) {
    return 'warning';
  }
  return 'info';
}

export function isErrorLikeType(type: unknown): boolean {
  return /(failed|error|quota|invalid|unauthorized|forbidden|permission|timeout|rate_limit)/i.test(String(type || ''));
}

export function safeIsoDate(value: unknown): string {
  const date = toDate(value);
  return date ? date.toISOString() : '';
}

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'object' && value && typeof (value as any).toDate === 'function') {
    const converted = (value as any).toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const parsed = Number.parseFloat(value.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
