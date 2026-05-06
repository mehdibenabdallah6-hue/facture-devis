import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planFromPriceId } from '../api/_lib/billing';
import {
  PLAN_DISPLAY_NAMES,
  PLAN_LIMITS,
  PRICE_TAX_LABEL,
  formatPlanPrice,
  getRemainingQuota,
  needsMonthlyReset,
  planLimitMessage,
  resolveEffectivePlan,
} from '../src/lib/billing';

const PRICE_ENV_KEYS = [
  'PADDLE_PRICE_ID_STARTER',
  'PADDLE_PRICE_ID_STARTER_ANNUAL',
  'PADDLE_PRICE_ID_PRO',
  'PADDLE_PRICE_ID_PRO_ANNUAL',
  'PADDLE_PRICE_ID_PREMIUM',
  'PADDLE_PRICE_ID_PREMIUM_ANNUAL',
  'VITE_PADDLE_PRICE_STARTER_ID',
  'VITE_PADDLE_PRICE_STARTER_ANNUAL_ID',
  'VITE_PADDLE_PRICE_PRO_ID',
  'VITE_PADDLE_PRICE_PRO_ANNUAL_ID',
] as const;

const previousEnv: Record<string, string | undefined> = {};

describe('planFromPriceId', () => {
  beforeEach(() => {
    for (const key of PRICE_ENV_KEYS) {
      previousEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of PRICE_ENV_KEYS) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  });

  it('mappe les prix starter vers starter', () => {
    process.env.PADDLE_PRICE_ID_STARTER = 'pri_starter_month';
    process.env.PADDLE_PRICE_ID_STARTER_ANNUAL = 'pri_starter_year';

    expect(planFromPriceId('pri_starter_month')).toBe('starter');
    expect(planFromPriceId('pri_starter_year')).toBe('starter');
  });

  it('mappe les prix pro vers pro', () => {
    process.env.PADDLE_PRICE_ID_PRO = 'pri_pro_month';
    process.env.PADDLE_PRICE_ID_PRO_ANNUAL = 'pri_pro_year';

    expect(planFromPriceId('pri_pro_month')).toBe('pro');
    expect(planFromPriceId('pri_pro_year')).toBe('pro');
  });

  it('garde les prix inconnus en free', () => {
    process.env.PADDLE_PRICE_ID_STARTER = 'pri_starter_month';
    process.env.PADDLE_PRICE_ID_PRO = 'pri_pro_month';

    expect(planFromPriceId('pri_unknown')).toBe('free');
    expect(planFromPriceId(null)).toBe('free');
  });

  it('ne mappe pas les anciens noms premium vers pro', () => {
    process.env.PADDLE_PRICE_ID_PREMIUM = 'pri_legacy_premium_month';
    process.env.PADDLE_PRICE_ID_PREMIUM_ANNUAL = 'pri_legacy_premium_year';

    expect(planFromPriceId('pri_legacy_premium_month')).toBe('free');
    expect(planFromPriceId('pri_legacy_premium_year')).toBe('free');
  });
});

describe('PLAN_LIMITS', () => {
  it('centralise les limites Free, Solo et Pro', () => {
    expect(PLAN_DISPLAY_NAMES.starter).toBe('Solo');
    expect(PLAN_LIMITS.free).toMatchObject({
      invoicesPerMonth: 5,
      clients: 3,
      aiUsagesPerMonth: 3,
      signatureLinksPerMonth: 1,
      catalogImportAiPerMonth: 1,
      pdfBranding: true,
      facturX: false,
      accountingExports: false,
    });
    expect(PLAN_LIMITS.starter).toMatchObject({
      invoicesPerMonth: null,
      clients: null,
      aiUsagesPerMonth: 30,
      signatureLinksPerMonth: 20,
      catalogImportAiPerMonth: 5,
      pdfBranding: false,
      facturX: false,
      accountingExports: false,
    });
    expect(PLAN_LIMITS.pro).toMatchObject({
      aiUsagesPerMonth: 500,
      signatureLinksPerMonth: null,
      catalogImportAiPerMonth: null,
      automaticReminders: true,
      facturX: true,
      accountingExports: true,
    });
  });

  it('affiche les prix en TTC sans renommer le plan technique starter', () => {
    expect(PRICE_TAX_LABEL).toBe('TTC');
    expect(formatPlanPrice('starter', 'monthly')).toBe('14,90 € TTC / mois');
    expect(formatPlanPrice('pro', 'annual')).toBe('249 € TTC / an');
  });

  it('calcule le reset mensuel et les quotas restants', () => {
    expect(needsMonthlyReset('2026-04-01T00:00:00.000Z', new Date('2026-05-05T12:00:00.000Z'))).toBe(true);
    expect(needsMonthlyReset('2026-05-01T00:00:00.000Z', new Date('2026-05-05T12:00:00.000Z'))).toBe(false);
    expect(getRemainingQuota(4, 5)).toBe(1);
    expect(getRemainingQuota(400, null)).toBe(Infinity);
  });

  it('résout le plan effectif uniquement si le statut payant est valide', () => {
    expect(resolveEffectivePlan({ plan: 'starter', subscriptionStatus: 'active' })).toBe('starter');
    expect(resolveEffectivePlan({ plan: 'pro', subscriptionStatus: 'past_due' })).toBe('pro');
    expect(resolveEffectivePlan({ plan: 'pro', subscriptionStatus: 'expired' })).toBe('free');
    expect(planLimitMessage('signatureLinksPerMonth', 'starter')).toContain('signatures illimitées');
  });
});
