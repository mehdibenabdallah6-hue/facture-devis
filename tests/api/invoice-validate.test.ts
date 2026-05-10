import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse } from './testResponse';

vi.mock('../../api/_verify-auth.js', () => ({
  verifyAuth: vi.fn(),
}));

vi.mock('../../api/_firebase-admin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

import handler from '../../api/invoice-validate';
import { verifyAuth } from '../../api/_verify-auth.js';
import { ensureFirebaseAdmin } from '../../api/_firebase-admin.js';

describe('api/invoice-validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(verifyAuth).mockResolvedValue({ uid: 'user_1', email: 'artisan@example.fr' });
    vi.mocked(ensureFirebaseAdmin).mockReturnValue(createMockAdmin());
  });

  it('retourne une erreur JSON si Firebase Admin ne démarre pas', async () => {
    vi.mocked(ensureFirebaseAdmin).mockImplementation(() => {
      throw new Error('Missing Firebase Admin credentials');
    });

    const res = createMockResponse();
    await handler(baseReq(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      error: 'Configuration serveur Firebase indisponible.',
      code: 'firebase_admin_init_failed',
    });
  });

  it('retourne 404 si la facture est introuvable', async () => {
    vi.mocked(ensureFirebaseAdmin).mockReturnValue(createMockAdmin({ invoiceExists: false }));

    const res = createMockResponse();
    await handler(baseReq(), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      error: 'Invoice not found',
      code: 'invoice_not_found',
    });
  });

  it('valide une facture et écrit le numéro, le verrou et l’événement', async () => {
    const admin = createMockAdmin();
    vi.mocked(ensureFirebaseAdmin).mockReturnValue(admin);

    const res = createMockResponse();
    await handler(baseReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, number: 'F-2026-0001', alreadyValidated: false });
    expect(admin.tx.update).toHaveBeenCalledWith(admin.invoiceRef, expect.objectContaining({
      number: 'F-2026-0001',
      status: 'validated',
      isLocked: true,
      validatedBy: 'user_1',
    }));
    expect(admin.tx.set).toHaveBeenCalledWith(admin.eventRef, expect.objectContaining({
      invoiceId: 'invoice_1',
      ownerId: 'user_1',
      type: 'validate',
    }));
  });
});

function baseReq(body: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
    body: {
      invoiceId: 'invoice_1',
      draft: {
        type: 'invoice',
        clientId: 'client_1',
        clientName: 'Client Test',
        clientEmail: 'client@example.fr',
        date: '2026-05-10',
        dueDate: '2026-06-10',
        serviceDate: '2026-05-10',
        vatRegime: 'standard',
        items: [{ description: 'Prestation', quantity: 2, unitPrice: 100, vatRate: 20 }],
        notes: 'Paiement à réception.',
        paymentMethod: 'Virement',
      },
      ...body,
    },
  };
}

function createMockAdmin(options: { invoiceExists?: boolean } = {}) {
  const invoiceRef = { id: 'invoice_1' };
  const counterRef = { id: 'invoice-2026' };
  const eventRef = { id: 'event_1' };
  const companyRef = {
    id: 'user_1',
    collection: vi.fn(() => ({
      doc: vi.fn(() => counterRef),
    })),
  };

  const invoiceSnap = {
    exists: options.invoiceExists !== false,
    data: () => ({
      ownerId: 'user_1',
      type: 'invoice',
      status: 'draft',
      isLocked: false,
      date: '2026-05-10',
      items: [{ description: 'Ancienne ligne', quantity: 1, unitPrice: 50, vatRate: 20 }],
    }),
  };
  const companySnap = {
    exists: true,
    data: () => ({
      plan: 'pro',
      subscriptionStatus: 'active',
      invoicePrefix: 'F',
      defaultVat: 20,
      monthlyInvoiceCount: 0,
      monthlyInvoiceResetAt: '2026-05-01T00:00:00.000Z',
    }),
  };
  const counterSnap = {
    exists: false,
    data: () => ({ value: 0 }),
  };

  const tx = {
    get: vi.fn()
      .mockResolvedValueOnce(invoiceSnap)
      .mockResolvedValueOnce(companySnap)
      .mockResolvedValueOnce(counterSnap),
    set: vi.fn(),
    update: vi.fn(),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'invoices') return { doc: vi.fn(() => invoiceRef) };
      if (name === 'companies') return { doc: vi.fn(() => companyRef) };
      if (name === 'invoiceEvents') return { doc: vi.fn(() => eventRef) };
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (fn: any) => fn(tx)),
  };

  return { db, tx, invoiceRef, eventRef };
}
