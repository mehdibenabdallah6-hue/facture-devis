type ProviderInfo = { providerId?: string | null };

export type MinimalAuthUser = {
  email?: string | null;
  emailVerified?: boolean;
  providerData?: ProviderInfo[];
} | null | undefined;

export function hasAuthProvider(user: MinimalAuthUser, providerId: string): boolean {
  return Boolean(user?.providerData?.some(provider => provider.providerId === providerId));
}

export function requiresEmailVerification(user: MinimalAuthUser): boolean {
  if (!user) return false;
  if (user.emailVerified === true) return false;
  if (hasAuthProvider(user, 'google.com')) return false;
  return hasAuthProvider(user, 'password');
}

export function canAccessPrivateApp(user: MinimalAuthUser): boolean {
  return Boolean(user) && !requiresEmailVerification(user);
}
