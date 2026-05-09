import { describe, expect, it } from 'vitest';
import { buildOnboardingCompanyPayload, needsOnboarding } from './onboarding';

describe('buildOnboardingCompanyPayload', () => {
  it("prépare un nouveau compte gratuit sans subscriptionStatus ni essai", () => {
    const payload = buildOnboardingCompanyPayload({
      userId: 'user_1',
      companyName: '  Dupont Plomberie  ',
      profession: 'Plombier',
      nowIso: '2026-05-09T10:00:00.000Z',
      welcomeDiscountExpiryIso: '2026-05-11T10:00:00.000Z',
    });

    expect(payload).toEqual({
      ownerId: 'user_1',
      name: 'Dupont Plomberie',
      profession: 'Plombier',
      plan: 'free',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
      welcomeDiscountExpiry: '2026-05-11T10:00:00.000Z',
    });
    expect(payload).not.toHaveProperty('subscriptionStatus');
    expect(payload).not.toHaveProperty('trialStartedAt');
  });

  it('ne force pas le plan free sur une entreprise existante sans plan', () => {
    const payload = buildOnboardingCompanyPayload({
      userId: 'user_1',
      companyName: 'Dupont Plomberie',
      profession: 'Plombier',
      existingCompany: { createdAt: '2026-05-01T10:00:00.000Z' },
      nowIso: '2026-05-09T10:00:00.000Z',
    });

    expect(payload).not.toHaveProperty('plan');
    expect(payload.createdAt).toBe('2026-05-01T10:00:00.000Z');
  });
});

describe('needsOnboarding', () => {
  it('reste vrai tant que le nom ou la profession manque', () => {
    expect(needsOnboarding(null)).toBe(true);
    expect(needsOnboarding({ name: 'Dupont Plomberie' })).toBe(true);
    expect(needsOnboarding({ profession: 'Plombier' })).toBe(true);
    expect(needsOnboarding({ name: 'Mon Entreprise', profession: 'Plombier' })).toBe(true);
  });

  it('devient false quand le nom et la profession existent', () => {
    expect(needsOnboarding({ name: 'Dupont Plomberie', profession: 'Plombier' })).toBe(false);
  });
});
