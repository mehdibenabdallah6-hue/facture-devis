import type { CompanySettings } from '../contexts/DataContext';

export function needsOnboarding(company: Partial<Pick<CompanySettings, 'name' | 'profession'>> | null | undefined): boolean {
  return !company || !company.profession || !company.name || company.name === 'Mon Entreprise';
}

export function buildOnboardingCompanyPayload(input: {
  userId: string;
  companyName: string;
  profession: string;
  existingCompany?: Pick<CompanySettings, 'createdAt' | 'plan'> | null;
  nowIso?: string;
  welcomeDiscountExpiryIso?: string;
}): Partial<CompanySettings> {
  const now = input.nowIso || new Date().toISOString();
  const plan = input.existingCompany ? input.existingCompany.plan : 'free';
  return {
    ownerId: input.userId,
    name: input.companyName.trim(),
    profession: input.profession,
    ...(plan ? { plan } : {}),
    createdAt: input.existingCompany?.createdAt || now,
    updatedAt: now,
    welcomeDiscountExpiry: input.welcomeDiscountExpiryIso || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  };
}
