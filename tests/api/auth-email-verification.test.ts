import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

vi.mock('../../api/_firebase-admin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

import { verifyAuth as verifyLibAuth } from '../../api/_lib/auth';
import { verifyAuth as verifyLegacyAuth } from '../../api/_verify-auth';
import { ensureFirebaseAdmin as ensureLibFirebaseAdmin } from '../../api/_lib/firebaseAdmin.js';
import { ensureFirebaseAdmin as ensureLegacyFirebaseAdmin } from '../../api/_firebase-admin.js';

const passwordUnverifiedToken = {
  uid: 'user_password',
  email: 'artisan@example.fr',
  email_verified: false,
  firebase: { sign_in_provider: 'password' },
};

const passwordVerifiedToken = {
  uid: 'user_password',
  email: 'artisan@example.fr',
  email_verified: true,
  firebase: { sign_in_provider: 'password' },
};

const googleToken = {
  uid: 'user_google',
  email: 'artisan@gmail.com',
  email_verified: false,
  firebase: { sign_in_provider: 'google.com' },
};

describe('API auth email verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuse un compte password non vérifié dans api/_lib/auth', async () => {
    vi.mocked(ensureLibFirebaseAdmin).mockReturnValue(adminFor(passwordUnverifiedToken) as any);

    await expect(verifyLibAuth(req())).rejects.toMatchObject({ status: 403 });
  });

  it('accepte un compte password vérifié dans api/_lib/auth', async () => {
    vi.mocked(ensureLibFirebaseAdmin).mockReturnValue(adminFor(passwordVerifiedToken) as any);

    await expect(verifyLibAuth(req())).resolves.toEqual({ uid: 'user_password', email: 'artisan@example.fr' });
  });

  it('accepte Google login dans api/_lib/auth', async () => {
    vi.mocked(ensureLibFirebaseAdmin).mockReturnValue(adminFor(googleToken) as any);

    await expect(verifyLibAuth(req())).resolves.toEqual({ uid: 'user_google', email: 'artisan@gmail.com' });
  });

  it('refuse aussi un compte password non vérifié dans api/_verify-auth', async () => {
    vi.mocked(ensureLegacyFirebaseAdmin).mockReturnValue(adminFor(passwordUnverifiedToken) as any);

    await expect(verifyLegacyAuth(req())).rejects.toMatchObject({ status: 403 });
  });
});

function req() {
  return { headers: { authorization: 'Bearer token' } };
}

function adminFor(decoded: Record<string, unknown>) {
  return {
    auth: {
      verifyIdToken: vi.fn().mockResolvedValue(decoded),
    },
  };
}
