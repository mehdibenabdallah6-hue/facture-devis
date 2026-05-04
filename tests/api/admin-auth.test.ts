import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_firebase-admin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

import { requireAdmin } from '../../api/_lib/adminAuth';
import { ensureFirebaseAdmin } from '../../api/_firebase-admin.js';

describe('api/_lib/adminAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne 401 sans bearer token', async () => {
    await expect(requireAdmin({ headers: {} })).rejects.toMatchObject({ status: 401 });
  });

  it('retourne 403 si le claim admin est absent', async () => {
    vi.mocked(ensureFirebaseAdmin).mockReturnValue({
      auth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user_1', admin: false }) },
    } as any);

    await expect(requireAdmin(req())).rejects.toMatchObject({ status: 403 });
  });

  it('accepte uniquement admin === true', async () => {
    vi.mocked(ensureFirebaseAdmin).mockReturnValue({
      auth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'admin_1', admin: true, email: 'admin@example.fr' }) },
    } as any);

    await expect(requireAdmin(req())).resolves.toEqual({ uid: 'admin_1' });
  });

  it('retourne 403 si admin password non vérifié', async () => {
    vi.mocked(ensureFirebaseAdmin).mockReturnValue({
      auth: {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: 'admin_1',
          admin: true,
          email: 'admin@example.fr',
          email_verified: false,
          firebase: { sign_in_provider: 'password' },
        }),
      },
    } as any);

    await expect(requireAdmin(req())).rejects.toMatchObject({ status: 403 });
  });
});

function req() {
  return { headers: { authorization: 'Bearer token' } };
}
