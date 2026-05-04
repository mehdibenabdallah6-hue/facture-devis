import { describe, expect, it } from 'vitest';
import { canAccessPrivateApp, requiresEmailVerification } from './authVerification';

describe('authVerification', () => {
  it('bloque un compte email/password non vérifié', () => {
    const user = {
      email: 'artisan@example.fr',
      emailVerified: false,
      providerData: [{ providerId: 'password' }],
    };

    expect(requiresEmailVerification(user)).toBe(true);
    expect(canAccessPrivateApp(user)).toBe(false);
  });

  it('accepte un compte email/password après vérification', () => {
    const user = {
      email: 'artisan@example.fr',
      emailVerified: true,
      providerData: [{ providerId: 'password' }],
    };

    expect(requiresEmailVerification(user)).toBe(false);
    expect(canAccessPrivateApp(user)).toBe(true);
  });

  it('ne bloque pas Google login', () => {
    const user = {
      email: 'artisan@gmail.com',
      emailVerified: false,
      providerData: [{ providerId: 'google.com' }],
    };

    expect(requiresEmailVerification(user)).toBe(false);
    expect(canAccessPrivateApp(user)).toBe(true);
  });
});
