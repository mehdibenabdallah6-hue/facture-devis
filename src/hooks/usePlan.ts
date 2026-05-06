import { useData } from '../contexts/DataContext';
import {
  getRemainingQuota,
  hasPaidAccessForStatus,
  isUnlimited,
  needsMonthlyReset as hasMonthlyResetElapsed,
  PLAN_LIMITS,
  resolveEffectivePlan,
} from '../lib/billing';

export function usePlan() {
  const { company } = useData();

  // Check if referral discount is still valid
  const hasReferralDiscount = company?.referralDiscountCode && company.referralDiscountExpiry
    ? new Date(company.referralDiscountExpiry) > new Date()
    : false;

  // Check if welcome discount (48h) is still valid
  const hasWelcomeDiscount = company?.welcomeDiscountExpiry
    ? new Date(company.welcomeDiscountExpiry) > new Date()
    : false;

  // Get active discount info
  const activeDiscount = hasReferralDiscount
    ? { code: company!.referralDiscountCode!, type: company?.referralDiscountType ?? '50_monthly_or_15_annual', source: 'referral' as const }
    : hasWelcomeDiscount
    ? { code: 'BIENVENUE', type: '20_annual' as string, source: 'welcome' as const }
    : null;

  // Check if monthly counters need reset (new month)
  const needsMonthlyReset = hasMonthlyResetElapsed(company?.monthlyResetAt);

  const hasPaidAccess = hasPaidAccessForStatus(company?.subscriptionStatus);
  const isPendingActivation = company?.subscriptionStatus === 'pending_activation';
  const currentPlan = resolveEffectivePlan(company);
  const limits = PLAN_LIMITS[currentPlan];

  const checkInvoiceLimit = () => {
    if (isUnlimited(limits.invoicesPerMonth)) return true;
    if (needsMonthlyReset) return true;
    return (company?.monthlyInvoiceCount || 0) < limits.invoicesPerMonth;
  };

  const checkClientLimit = () => {
    if (isUnlimited(limits.clients)) return true;
    return (company?.monthlyClientCount || 0) < limits.clients;
  };

  const checkAiLimit = () => {
    if (isUnlimited(limits.aiUsagesPerMonth)) return true;
    if (needsMonthlyReset) return true;
    return (company?.monthlyAiUsageCount || 0) < limits.aiUsagesPerMonth;
  };

  const checkSignatureLimit = () => {
    if (isUnlimited(limits.signatureLinksPerMonth)) return true;
    if (needsMonthlyReset) return true;
    return (company?.monthlySignatureCount || 0) < limits.signatureLinksPerMonth;
  };

  const checkCatalogImportLimit = () => {
    if (isUnlimited(limits.catalogImportAiPerMonth)) return true;
    if (needsMonthlyReset) return true;
    return (company?.monthlyCatalogImportCount || 0) < limits.catalogImportAiPerMonth;
  };

  // ---- AI usage info (for in-UI feedback + post-use paywall gating) ----
  // We surface the raw counter so screens can show "3 / 5 utilisations IA
  // ce mois-ci" before/after the AI runs, and `willExceedAiLimitAfterUse`
  // so callers can decide whether to push the user to the paywall after
  // an AI feature consumed quota. This replaces the previous (buggy)
  // pattern of paywalling free users after every AI use, regardless of
  // remaining quota.
  const aiUsedRaw = company?.monthlyAiUsageCount || 0;
  // If the month rolled over since the last persisted reset, the counter
  // is logically 0 even though the doc still has the old value — the next
  // increment will reset it server-side.
  const aiUsed = needsMonthlyReset ? 0 : aiUsedRaw;
  const aiLimit = limits.aiUsagesPerMonth;
  const aiUnlimited = isUnlimited(aiLimit);
  const aiRemaining = getRemainingQuota(aiUsed, aiLimit);
  // After the upcoming use, will we be at or over the limit? Used by the
  // creation flow to show the paywall once the user has consumed their
  // final free use — never before.
  const willExceedAiLimitAfterUse = aiUnlimited
    ? false
    : (aiUsed + 1) >= aiLimit;

  // ---- Invoice usage info (mirrors AI helpers) ----
  // Surfaces the same raw counter logic so the UI can render progressive
  // upsell banners (60 / 80 / 90 % of monthly quota) instead of the
  // previous "either silent or hard-blocked" UX.
  const invoiceUsedRaw = company?.monthlyInvoiceCount || 0;
  const invoiceUsed = needsMonthlyReset ? 0 : invoiceUsedRaw;
  const invoiceLimit = limits.invoicesPerMonth;
  const invoiceUnlimited = isUnlimited(invoiceLimit);
  const invoiceRemaining = getRemainingQuota(invoiceUsed, invoiceLimit);
  const willExceedInvoiceLimitAfterUse = invoiceUnlimited
    ? false
    : (invoiceUsed + 1) >= invoiceLimit;

  const isPro = currentPlan === 'pro';
  const isStarter = currentPlan === 'starter' || currentPlan === 'pro';
  const isFree = currentPlan === 'free';

  return {
    plan: currentPlan,
    limits,
    isPro,
    isStarter,
    isFree,
    hasPaidAccess,
    isPendingActivation,
    checkInvoiceLimit,
    checkClientLimit,
    checkAiLimit,
    checkSignatureLimit,
    checkCatalogImportLimit,
    aiUsed,
    aiLimit,
    aiUnlimited,
    aiRemaining,
    willExceedAiLimitAfterUse,
    invoiceUsed,
    invoiceLimit,
    invoiceUnlimited,
    invoiceRemaining,
    willExceedInvoiceLimitAfterUse,
    activeDiscount,
    hasReferralDiscount,
    hasWelcomeDiscount,
  };
}
