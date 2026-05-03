import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse } from './testResponse';

vi.mock('../../api/_lib/adminAuth.js', () => ({
  requireAdmin: vi.fn(),
  handleAdminAuthError: vi.fn((res: any, error: any) => res.status(error.status || 401).json({ error: error.message })),
}));

vi.mock('../../api/_firebase-admin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

import adminHandler from '../../api/cron-reminders';
import { requireAdmin } from '../../api/_lib/adminAuth.js';
import { ensureFirebaseAdmin } from '../../api/_firebase-admin.js';

const previousProjectId = process.env.POSTHOG_PROJECT_ID;
const previousPersonalKey = process.env.POSTHOG_PERSONAL_API_KEY;

describe('admin API routes V2', () => {
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

  it('retourne 401 si non connecté', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(Object.assign(new Error('Non authentifié'), { status: 401 }));

    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-summary', { adminResource: 'summary' }), res);

    expect(res.statusCode).toBe(401);
  });

  it('retourne 403 si le claim admin manque', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(Object.assign(new Error('Accès admin requis'), { status: 403 }));

    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-summary', { adminResource: 'summary' }), res);

    expect(res.statusCode).toBe(403);
  });

  it('admin-summary renvoie un cockpit agrégé sans données sensibles', async () => {
    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-summary', { adminResource: 'summary' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.acquisition.totalUsers).toBe(3);
    expect(res.body.acquisition.usersWithoutCompany).toBe(1);
    expect(res.body.business.plans).toEqual({ free: 1, pro: 1 });
    expect(res.body.funnel).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'company_created', count: 2 }),
      expect.objectContaining({ event: 'client_created', count: 1 }),
    ]));
    expect(JSON.stringify(res.body)).not.toContain('artisan@example.fr');
    expect(JSON.stringify(res.body)).not.toContain('client@example.fr');
    expect(JSON.stringify(res.body)).not.toContain('75001');
    expect(JSON.stringify(res.body)).not.toContain('12345678901234');
    expect(JSON.stringify(res.body)).not.toContain('Rue privée');
    expect(JSON.stringify(res.body)).not.toContain('Pose confidentielle');
  });

  it('admin-users masque les emails et ne renvoie pas les champs sensibles', async () => {
    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-users', { adminResource: 'users' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.users[0]).toMatchObject({
      userKey: expect.stringMatching(/^usr_[a-f0-9]{12}$/),
      emailMasked: expect.stringMatching(/^[a-z]\*\*\*@example\.fr$/),
      plan: expect.any(String),
      activationStatus: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain('artisan@example.fr');
    expect(JSON.stringify(res.body)).not.toContain('client@example.fr');
    expect(JSON.stringify(res.body)).not.toContain('12345678901234');
    expect(JSON.stringify(res.body)).not.toContain('FR76123456789');
    expect(JSON.stringify(res.body)).not.toContain('75001');
  });

  it('admin-events retourne un fallback vide si PostHog serveur est absent', async () => {
    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-events', { adminResource: 'events', period: '7d' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.events[0]).toHaveProperty('event');
    expect(res.body.events[0]).toHaveProperty('count', 0);
    expect(res.body.recent).toEqual([]);
  });

  it('admin-errors agrège les erreurs sans stack trace ni données brutes', async () => {
    const res = createMockResponse();
    await adminHandler(getReq('/api/admin-errors', { adminResource: 'errors' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.byType.email_failed).toBe(1);
    expect(res.body.byRoute['/api/email']).toBe(1);
    expect(res.body.bySeverity.warning).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(res.body)).not.toContain('client@example.fr');
    expect(JSON.stringify(res.body)).not.toContain('STACK_SECRET');
    expect(JSON.stringify(res.body)).not.toContain('Rue privée');
  });
});

function getReq(url: string, query: Record<string, string> = {}) {
  return { method: 'GET', url, query, headers: { authorization: 'Bearer token' } };
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
          createdAt: '2026-04-30T00:00:00.000Z',
          updatedAt: '2026-05-02T10:00:00.000Z',
          profession: 'Plombier',
          monthlyInvoiceCount: 3,
          monthlyAiUsageCount: 5,
          email: 'artisan@example.fr',
          siret: '12345678901234',
          vatNumber: 'FR76123456789',
          postalCode: '75001',
          address: 'Rue privée',
        }),
      },
      {
        id: 'uid_2',
        data: () => ({
          plan: 'pro',
          subscriptionStatus: 'active',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-02T11:00:00.000Z',
          profession: 'Peintre',
          monthlyInvoiceCount: 0,
          monthlyAiUsageCount: 1,
        }),
      },
    ],
    clients: [
      { id: 'client_1', data: () => ({ ownerId: 'uid_1', email: 'client@example.fr', address: 'Rue privée client', createdAt: '2026-05-01T12:00:00.000Z' }) },
    ],
    invoices: [
      {
        id: 'inv_1',
        data: () => ({
          ownerId: 'uid_1',
          type: 'invoice',
          status: 'sent',
          isLocked: true,
          validatedAt: '2026-05-02T09:00:00.000Z',
          createdAt: '2026-05-02T08:00:00.000Z',
          totalTTC: 1200,
          clientEmail: 'client@example.fr',
          items: [{ description: 'Pose confidentielle' }],
        }),
      },
      {
        id: 'quote_1',
        data: () => ({
          ownerId: 'uid_1',
          type: 'quote',
          status: 'accepted',
          signedAt: '2026-05-02T13:00:00.000Z',
          createdAt: '2026-05-02T12:00:00.000Z',
          signature: 'data:image/png;base64,secret',
        }),
      },
    ],
    invoiceEvents: [
      {
        id: 'event_1',
        data: () => ({
          ownerId: 'uid_1',
          type: 'email_failed',
          timestamp: '2026-05-02T14:00:00.000Z',
          metadata: { email: 'client@example.fr', route: '/api/email?invoiceId=secret' },
          stack: 'STACK_SECRET',
        }),
      },
      {
        id: 'event_2',
        data: () => ({ ownerId: 'uid_1', type: 'invoice_validated', timestamp: '2026-05-02T09:00:00.000Z' }),
      },
    ],
    auditTrail: [
      { id: 'audit_1', data: () => ({ ownerId: 'uid_2', type: 'quota_exceeded', createdAt: '2026-05-02T00:00:00.000Z', metadata: { prompt: 'private' } }) },
    ],
  };

  return {
    auth: {
      listUsers: vi.fn().mockResolvedValue({
        users: [
          authUser('uid_1', 'artisan@example.fr', '2026-04-30T00:00:00.000Z', '2026-05-02T10:00:00.000Z'),
          authUser('uid_2', 'pro@example.fr', '2026-05-01T00:00:00.000Z', '2026-05-02T11:00:00.000Z'),
          authUser('uid_3', 'new@example.fr', '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'),
        ],
      }),
    },
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

function authUser(uid: string, email: string, creationTime: string, lastSignInTime: string) {
  return { uid, email, metadata: { creationTime, lastSignInTime } };
}
