import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planFromPriceId } from '../api/_lib/billing';

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
