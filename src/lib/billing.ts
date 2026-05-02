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

export const PLAN_FEATURES: Record<AppPlan, string[]> = {
  free: ['10 factures/mois', '5 usages IA/mois', 'Mentions de base', 'Pas de photos PDF'],
  starter: [
    'Factures illimitées',
    '50 usages IA/mois',
    'Export Factur-X',
    'Envoi emails auto',
  ],
  pro: ['Tout illimité', 'Photos dans PDF', 'Export CSV/FEC', 'Parrainage illimité'],
};

const PAID_ACCESS_STATUSES = new Set<AppSubscriptionStatus>(['active', 'trialing', 'past_due']);

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

export function formatEuroPrice(price: number): string {
  return price % 1 === 0 ? `${price}€` : `${price.toFixed(2)}€`;
}

export function getMonthlyEquivalent(plan: Exclude<AppPlan, 'free'>, billingCycle: BillingCycle): number {
  const price = PLAN_PRICING[plan][billingCycle];
  return billingCycle === 'annual' ? price / 12 : price;
}
