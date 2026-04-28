import { useData } from '../contexts/DataContext';
import { hasPaidAccessForStatus } from '../lib/billing';

export interface PlanLimits {
  canAddPhotosToPDF: boolean;
  canExportCSV: boolean;
  canUseAICalculator: boolean;
  monthlyInvoiceLimit: number; // -1 for unlimited
  monthlyAiUsageLimit: number; // -1 for unlimited
}

export const PLAN_LIMITS: Record<'free' | 'starter' | 'pro', PlanLimits> = {
  free: {
    canAddPhotosToPDF: false,
    canExportCSV: false,
    canUseAICalculator: false,
    monthlyInvoiceLimit: 10,
    monthlyAiUsageLimit: 5,
  },
  starter: {
    canAddPhotosToPDF: false,
    canExportCSV: false,
    canUseAICalculator: true,
    monthlyInvoiceLimit: -1,
    monthlyAiUsageLimit: 50,
  },
  pro: {
    canAddPhotosToPDF: true,
    canExportCSV: true,
    canUseAICalculator: true,
    monthlyInvoiceLimit: -1,
    monthlyAiUsageLimit: -1,
  }
};

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
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const lastResetMonth = company?.monthlyResetAt ? new Date(company.monthlyResetAt).getMonth() : -1;
  const lastResetYear = company?.monthlyResetAt ? new Date(company.monthlyResetAt).getFullYear() : -1;
  const needsMonthlyReset = currentMonth !== lastResetMonth || currentYear !== lastResetYear;

  const hasPaidAccess = hasPaidAccessForStatus(company?.subscriptionStatus);
  const isPendingActivation = company?.subscriptionStatus === 'pending_activation';
  const paidPlan = company?.plan && company.plan !== 'free' ? company.plan : 'starter';
  const currentPlan = hasPaidAccess ? paidPlan : 'free';
  const limits = PLAN_LIMITS[currentPlan];

  const checkInvoiceLimit = () => {
    if (limits.monthlyInvoiceLimit === -1) return true;
    // If new month, counters will be reset → allow
    if (needsMonthlyReset) return true;
    return (company?.monthlyInvoiceCount || 0) < limits.monthlyInvoiceLimit;
  };

  const checkAiLimit = () => {
    if (limits.monthlyAiUsageLimit === -1) return true;
    // If new month, counters will be reset → allow
    if (needsMonthlyReset) return true;
    return (company?.monthlyAiUsageCount || 0) < limits.monthlyAiUsageLimit;
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
  const aiLimit = limits.monthlyAiUsageLimit;
  const aiUnlimited = aiLimit === -1;
  const aiRemaining = aiUnlimited ? Infinity : Math.max(0, aiLimit - aiUsed);
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
  const invoiceLimit = limits.monthlyInvoiceLimit;
  const invoiceUnlimited = invoiceLimit === -1;
  const invoiceRemaining = invoiceUnlimited ? Infinity : Math.max(0, invoiceLimit - invoiceUsed);
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
    checkAiLimit,
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
