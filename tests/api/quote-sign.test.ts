import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse } from './testResponse';
import { hashShareToken } from '../../api/_lib/quoteShare';

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

vi.mock('../../api/_lib/rateLimit.js', () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '203.0.113.11'),
}));

import handler from '../../api/quote-sign';
import { ensureFirebaseAdmin } from '../../api/_lib/firebaseAdmin.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';

describe('api/quote-sign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuse un token invalide', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true });
    const tx = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          tokenHash: hashShareToken('good-token'),
          status: 'pending_signature',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          originalInvoiceId: 'invoice_1',
          ownerId: 'owner_1',
        }),
      }),
    };
    vi.mocked(ensureFirebaseAdmin).mockReturnValue({
      db: {
        collection: vi.fn(() => ({ doc: vi.fn(() => ({ id: 'ref' })) })),
        runTransaction: vi.fn(async (fn: any) => fn(tx)),
      },
    } as any);

    const res = createMockResponse();
    await handler({
      method: 'POST',
      headers: {},
      body: {
        quoteId: 'share_1',
        token: 'bad-token',
        signerName: 'Client',
        signatureDataUrl: 'data:image/png;base64,abc',
      },
    }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('invalide');
  });

  it('renvoie 429 quand le rate limit IP est dépassé', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, retryAfterMs: 60_000 });

    const res = createMockResponse();
    await handler({
      method: 'POST',
      headers: {},
      body: {
        quoteId: 'share_1',
        token: 'token',
        signerName: 'Client',
        signatureDataUrl: 'data:image/png;base64,abc',
      },
    }, res);

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain('Trop de tentatives');
    expect(ensureFirebaseAdmin).not.toHaveBeenCalled();
  });
});
