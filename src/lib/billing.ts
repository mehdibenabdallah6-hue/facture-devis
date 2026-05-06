export type AppPlan = 'free' | 'starter' | 'pro';
export type BillingCycle = 'monthly' | 'annual';
export type AppSubscriptionStatus =
  | 'trial'
  | 'pending_activation'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'expired';

export type PlanLimitValue = number | null;

export interface PlanLimits {
  invoicesPerMonth: PlanLimitValue;
  clients: PlanLimitValue;
  aiUsagesPerMonth: PlanLimitValue;
  signatureLinksPerMonth: PlanLimitValue;
  catalogImportAiPerMonth: PlanLimitValue;
  pdfBranding: boolean;
  pdfCustom: boolean;
  manualReminders: boolean;
  automaticReminders: boolean;
  facturX: boolean;
  accountingExports: boolean;
  catalogImportAi: boolean;
}

export const PLAN_DISPLAY_NAMES: Record<AppPlan, string> = {
  free: 'Gratuit',
  starter: 'Solo',
  pro: 'Pro',
};

export const PLAN_PRICING: Record<
  Exclude<AppPlan, 'free'>,
  Record<BillingCycle, number>
> = {
  starter: {
    monthly: 14.9,
    annual: 129,
  },
  pro: {
    monthly: 29.9,
    annual: 249,
  },
};

export const PRICE_TAX_LABEL = 'TTC';
export const FOUNDER_PRICE_NOTICE =
  'Prix bêta fondateur — réservés aux premiers utilisateurs. Les premiers artisans gardent leur prix tant qu’ils restent abonnés.';

export const PLAN_LIMITS: Record<AppPlan, PlanLimits> = {
  free: {
    invoicesPerMonth: 5,
    clients: 3,
    aiUsagesPerMonth: 3,
    signatureLinksPerMonth: 1,
    catalogImportAiPerMonth: 1,
    pdfBranding: true,
    pdfCustom: false,
    manualReminders: false,
    automaticReminders: false,
    facturX: false,
    accountingExports: false,
    catalogImportAi: true,
  },
  starter: {
    invoicesPerMonth: null,
    clients: null,
    aiUsagesPerMonth: 30,
    signatureLinksPerMonth: 20,
    catalogImportAiPerMonth: 5,
    pdfBranding: false,
    pdfCustom: true,
    manualReminders: true,
    automaticReminders: false,
    facturX: false,
    accountingExports: false,
    catalogImportAi: true,
  },
  pro: {
    invoicesPerMonth: null,
    clients: null,
    aiUsagesPerMonth: 500,
    signatureLinksPerMonth: null,
    catalogImportAiPerMonth: null,
    pdfBranding: false,
    pdfCustom: true,
    manualReminders: true,
    automaticReminders: true,
    facturX: true,
    accountingExports: true,
    catalogImportAi: true,
  },
} as const;

export const PLAN_FEATURES: Record<AppPlan, string[]> = {
  free: [
    '5 devis/factures par mois',
    '3 clients',
    '3 usages IA par mois',
    '1 lien de signature par mois',
    'PDF avec branding Photofacto',
  ],
  starter: [
    'Devis & factures illimités',
    'Clients illimités',
    'Catalogue intelligent',
    '30 usages IA / mois',
    '20 liens de signature / mois',
    'Relances simples',
    'PDF personnalisé',
  ],
  pro: [
    'Tout Solo',
    'IA avancée : audio, photo de notes, anciens devis',
    'Import catalogue photo/PDF/Excel',
    'Signatures de devis illimitées',
    'Relances automatiques d’impayés',
    'Factur-X exportable',
    'Exports comptables CSV/FEC',
  ],
};

export const PAID_ACCESS_STATUSES = new Set<AppSubscriptionStatus>(['active', 'trialing', 'past_due']);

export function hasPaidAccessForStatus(status?: string | null): boolean {
  return status ? PAID_ACCESS_STATUSES.has(status as AppSubscriptionStatus) : false;
}

export function normalizePaddleStatus(status?: string | null): AppSubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'paused':
      return 'paused';
    case 'canceled':
      return 'canceled';
    default:
      return 'expired';
  }
}

export function resolveEffectivePlan(input?: {
  plan?: string | null;
  subscriptionStatus?: string | null;
}): AppPlan {
  if (!hasPaidAccessForStatus(input?.subscriptionStatus)) return 'free';
  return input?.plan === 'pro' ? 'pro' : input?.plan === 'starter' ? 'starter' : 'free';
}

export function formatEuroPrice(price: number): string {
  const value = price % 1 === 0 ? `${price}` : price.toFixed(2).replace('.', ',');
  return `${value} €`;
}

export function formatPlanPrice(plan: Exclude<AppPlan, 'free'>, cycle: BillingCycle): string {
  const suffix = cycle === 'monthly' ? '/ mois' : '/ an';
  return `${formatEuroPrice(PLAN_PRICING[plan][cycle])} ${PRICE_TAX_LABEL} ${suffix}`;
}

export function getMonthlyEquivalent(plan: Exclude<AppPlan, 'free'>, billingCycle: BillingCycle): number {
  const price = PLAN_PRICING[plan][billingCycle];
  return billingCycle === 'annual' ? price / 12 : price;
}

export function isUnlimited(limit: PlanLimitValue): limit is null {
  return limit === null;
}

export function getRemainingQuota(used: number, limit: PlanLimitValue): number {
  if (isUnlimited(limit)) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - used);
}

export function isQuotaExceeded(used: number, limit: PlanLimitValue): boolean {
  return !isUnlimited(limit) && used >= limit;
}

export function normalizeMonthlyUsage(count: unknown, resetAt: unknown, now = new Date()): number {
  return needsMonthlyReset(resetAt, now) ? 0 : Math.max(0, Number(count) || 0);
}

export function needsMonthlyReset(resetAt: unknown, now = new Date()): boolean {
  const parsed = typeof resetAt === 'string' ? new Date(resetAt) : null;
  return (
    !parsed ||
    Number.isNaN(parsed.getTime()) ||
    parsed.getMonth() !== now.getMonth() ||
    parsed.getFullYear() !== now.getFullYear()
  );
}

export function monthStartIso(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export function planLimitMessage(resource: keyof PlanLimits, plan: AppPlan): string {
  if (resource === 'invoicesPerMonth') {
    return plan === 'free'
      ? 'Vous avez atteint la limite de 5 devis/factures ce mois-ci. Passez à Solo pour créer des documents illimités.'
      : 'Vous avez atteint la limite de documents de votre plan.';
  }
  if (resource === 'clients') {
    return 'Le plan Gratuit permet jusqu’à 3 clients. Passez à Solo pour gérer tous vos clients.';
  }
  if (resource === 'aiUsagesPerMonth') {
    return 'Vous avez utilisé vos usages IA du mois. Passez à Solo ou Pro pour continuer.';
  }
  if (resource === 'signatureLinksPerMonth') {
    return plan === 'starter'
      ? 'Votre plan ne permet plus de créer de lien de signature ce mois-ci. Passez à Pro pour les signatures illimitées.'
      : 'Votre plan ne permet plus de créer de lien de signature ce mois-ci. Passez à Solo ou Pro pour continuer.';
  }
  if (resource === 'catalogImportAiPerMonth') {
    return 'Vous avez utilisé vos imports catalogue IA du mois. Passez à Solo ou Pro pour continuer.';
  }
  if (resource === 'facturX') return 'L’export Factur-X est disponible avec le plan Pro.';
  if (resource === 'accountingExports') return 'Les exports comptables CSV/FEC sont disponibles avec le plan Pro.';
  if (resource === 'automaticReminders') return 'Les relances automatiques sont disponibles avec le plan Pro.';
  return 'Cette fonctionnalité nécessite un plan supérieur.';
}
