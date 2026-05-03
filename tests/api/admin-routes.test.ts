import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse } from './testResponse';

vi.mock('../../api/_lib/adminAuth.js', () => ({
  requireAdmin: vi.fn(),
  handleAdminAuthError: vi.fn((res: any, error: any) => res.status(error.status || 401).json({ error: error.message })),
}));

vi.mock('../../api/_firebase-admin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

import adminHandler from '../../api/admin';
import { requireAdmin } from '../../api/_lib/adminAuth.js';
import { ensureFirebaseAdmin } from '../../api/_firebase-admin.js';

const previousProjectId = process.env.POSTHOG_PROJECT_ID;
const previousPersonalKey = process.env.POSTHOG_PERSONAL_API_KEY;

describe('admin API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.POSTHOG_PROJECT_ID;
    delete process.env.POSTHOG_PERSONAL_API_KEY;
    vi.mocked(requireAdmin).mockResolvedValue({ uid: 'admin_1' });
    vi.mocked(ensureFirebaseAdmin).mockReturnValue(createMockAdmin());
  });

  afterEach(() => {
    restoreEnv('POSTHOG_PROJECT_ID', previousProjectId);
    restoreEnv('POSTHOG_PERSONAL_API_KEY', previousPersonalKey);
  });

  it('protège les routes admin avec 403 si le claim admin manque', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(Object.assign(new Error('Accès admin requis'), { status: 403 }));

    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-summary'), res);

    expect(res.statusCode).toBe(403);
  });

  it('renvoie un résumé agrégé sans données sensibles', async () => {
    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-summary'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.users.total).toBe(2);
    expect(res.body.users.plans).toEqual({ free: 1, pro: 1 });
    expect(JSON.stringify(res.body)).not.toContain('artisan@example.fr');
    expect(JSON.stringify(res.body)).not.toContain('75001');
  });

  it('anonymise la liste utilisateurs', async () => {
    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-users'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.users[0]).toMatchObject({
      userKey: expect.stringMatching(/^usr_[a-f0-9]{12}$/),
      plan: 'free',
      invoiceUsageBucket: '3_5',
    });
    expect(JSON.stringify(res.body)).not.toContain('artisan@example.fr');
    expect(JSON.stringify(res.body)).not.toContain('12345678901234');
  });

  it('admin-events retourne un fallback vide si PostHog serveur est absent', async () => {
    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-events'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.events[0]).toHaveProperty('event');
    expect(res.body.events[0]).toHaveProperty('count', 0);
  });

  it('admin-errors agrège seulement les types techniques', async () => {
    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-errors'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.errors).toEqual([{ type: 'email_failed', count: 1 }]);
    expect(JSON.stringify(res.body)).not.toContain('client@example.fr');
  });
});

function getReq(url: string) {
  return { method: 'GET', url, headers: { authorization: 'Bearer token' } };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function createMockAdmin() {
  const collections: Record<string, any[]> = {
    companies: [
      {
        id: 'uid_1',
        data: () => ({
          plan: 'free',
          subscriptionStatus: 'inactive',
          createdAt: '2026-04-01T00:00:00.000Z',
          profession: 'Plombier',
          monthlyInvoiceCount: 3,
          monthlyAiUsageCount: 5,
          email: 'artisan@example.fr',
          siret: '12345678901234',
          postalCode: '75001',
        }),
      },
      {
        id: 'uid_2',
        data: () => ({
          plan: 'pro',
          subscriptionStatus: 'active',
          createdAt: '2026-05-01T00:00:00.000Z',
          profession: 'Peintre',
          monthlyInvoiceCount: 0,
          monthlyAiUsageCount: 1,
        }),
      },
    ],
    invoices: [
      { id: 'inv_1', data: () => ({ type: 'invoice', status: 'sent', totalTTC: 1200, clientEmail: 'client@example.fr' }) },
      { id: 'quote_1', data: () => ({ type: 'quote', status: 'accepted', totalTTC: 500 }) },
    ],
    auditTrail: [
      { id: 'event_1', data: () => ({ type: 'email_failed', createdAt: '2026-05-02T00:00:00.000Z', metadata: { email: 'client@example.fr' } }) },
      { id: 'event_2', data: () => ({ type: 'invoice_validated', createdAt: '2026-05-02T00:00:00.000Z' }) },
    ],
  };

  return {
    db: {
      collection: vi.fn((name: string) => ({
        limit: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            size: collections[name]?.length || 0,
            docs: collections[name] || [],
          }),
        })),
      })),
    },
  } as any;
}
