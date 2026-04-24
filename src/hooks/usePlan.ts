import { useData } from '../contexts/DataContext';

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

  // New users default to 'free'. Legacy users with active subscription default to 'starter'.
  const currentPlan = company?.plan || (company?.subscriptionStatus === 'active' ? 'starter' : 'free');
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

  const isPro = currentPlan === 'pro';
  const isStarter = currentPlan === 'starter' || currentPlan === 'pro';
  const isFree = currentPlan === 'free';

  return {
    plan: currentPlan,
    limits,
    isPro,
    isStarter,
    isFree,
    checkInvoiceLimit,
    checkAiLimit,
    activeDiscount,
    hasReferralDiscount,
    hasWelcomeDiscount,
  };
}
