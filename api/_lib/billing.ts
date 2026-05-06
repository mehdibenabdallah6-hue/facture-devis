import {
  monthStartIso,
  needsMonthlyReset,
  normalizeMonthlyUsage,
  PAID_ACCESS_STATUSES,
  PLAN_LIMITS,
  planLimitMessage,
  resolveEffectivePlan,
  type AppPlan,
  type PlanLimitValue,
  type PlanLimits,
} from '../../src/lib/billing';

export const PAID_STATUSES = PAID_ACCESS_STATUSES;

export type QuotaResource =
  | 'invoicesPerMonth'
  | 'aiUsagesPerMonth'
  | 'signatureLinksPerMonth'
  | 'catalogImportAiPerMonth';

export function planFromPriceId(priceId?: string | null): AppPlan {
  if (!priceId) return 'free';
  const starter = [
    process.env.PADDLE_PRICE_ID_STARTER,
    process.env.PADDLE_PRICE_ID_STARTER_ANNUAL,
    process.env.VITE_PADDLE_PRICE_STARTER_ID,
    process.env.VITE_PADDLE_PRICE_STARTER_ANNUAL_ID,
  ].filter(Boolean);
  const pro = [
    process.env.PADDLE_PRICE_ID_PRO,
    process.env.PADDLE_PRICE_ID_PRO_ANNUAL,
    process.env.VITE_PADDLE_PRICE_PRO_ID,
    process.env.VITE_PADDLE_PRICE_PRO_ANNUAL_ID,
  ].filter(Boolean);
  if (pro.includes(priceId)) return 'pro';
  if (starter.includes(priceId)) return 'starter';
  return 'free';
}

export function effectivePlanForCompany(company: any): AppPlan {
  return resolveEffectivePlan(company || {});
}

export function getPlanLimitsForCompany(company: any): PlanLimits {
  return PLAN_LIMITS[effectivePlanForCompany(company)];
}

export function getMonthlyQuotaState(input: {
  company: any;
  countField: string;
  resetField?: string;
  limit: PlanLimitValue;
  now?: Date;
}) {
  const now = input.now || new Date();
  const resetAt = input.company?.[input.resetField || 'monthlyResetAt'];
  const needsReset = needsMonthlyReset(resetAt, now);
  const used = normalizeMonthlyUsage(input.company?.[input.countField], resetAt, now);
  return {
    used,
    needsReset,
    monthStart: monthStartIso(now),
    resetAt,
    isUnlimited: input.limit === null,
    isBlocked: input.limit !== null && used >= input.limit,
  };
}

export function quotaExceededMessage(resource: keyof PlanLimits, plan: AppPlan): string {
  return planLimitMessage(resource, plan);
}
