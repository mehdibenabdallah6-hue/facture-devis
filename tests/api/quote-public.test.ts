import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse } from './testResponse';
import { hashShareToken } from '../../api/_lib/quoteShare';

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

vi.mock('../../api/_lib/rateLimit.js', () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '203.0.113.10'),
}));

vi.mock('../../api/_lib/auth.js', () => ({
  verifyAuth: vi.fn(),
}));

vi.mock('../../api/_lib/audit.js', () => ({
  writeAuditEvent: vi.fn(),
}));

import handler from '../../api/quote';
import { ensureFirebaseAdmin } from '../../api/_lib/firebaseAdmin.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { verifyAuth } from '../../api/_lib/auth.js';

describe('api/quote-public', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuse un token invalide', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true });
    vi.mocked(ensureFirebaseAdmin).mockReturnValue({
      db: {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                tokenHash: hashShareToken('good-token'),
                status: 'pending_signature',
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
              }),
            }),
          })),
        })),
      },
    } as any);

    const res = createMockResponse();
    await handler({ method: 'GET', headers: {}, query: { action: 'public', shareId: 'share_1', token: 'bad-token' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('invalide');
  });

  it('renvoie 429 quand le rate limit IP est dépassé', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, retryAfterMs: 60_000 });

    const res = createMockResponse();
    await handler({ method: 'GET', headers: {}, query: { action: 'public', shareId: 'share_1', token: 'token' } }, res);

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain('Trop de tentatives');
    expect(ensureFirebaseAdmin).not.toHaveBeenCalled();
  });

  it('bloque la création d’un deuxième lien de signature sur le plan gratuit', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ uid: 'artisan_1', email: 'artisan@example.fr' });
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true });
    const invoiceGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        ownerId: 'artisan_1',
        type: 'quote',
        number: 'D-2026-0001',
        items: [],
      }),
    });
    const companyGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        plan: 'free',
        subscriptionStatus: 'expired',
        monthlySignatureCount: 1,
        monthlyResetAt: new Date().toISOString(),
      }),
    });
    vi.mocked(ensureFirebaseAdmin).mockReturnValue({
      db: {
        collection: vi.fn((name: string) => ({
          doc: vi.fn((id?: string) => ({
            id: id || 'share_1',
            get: name === 'invoices' ? invoiceGet : companyGet,
          })),
        })),
        runTransaction: vi.fn(),
      },
    } as any);

    const res = createMockResponse();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer token', host: 'photofacto.fr' },
      body: { action: 'share', invoiceId: 'quote_1' },
    }, res);

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain('lien de signature');
  });
});
