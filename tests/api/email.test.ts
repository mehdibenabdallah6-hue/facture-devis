import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse } from './testResponse';

vi.mock('../../api/_lib/auth.js', () => ({
  verifyAuth: vi.fn(),
}));

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

vi.mock('../../api/_lib/rateLimit.js', () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '203.0.113.11'),
}));

vi.mock('../../api/_lib/audit.js', () => ({
  writeAuditEvent: vi.fn(),
}));

import handler from '../../api/email';
import { buildResendFromHeader, sendResendEmail, verifiedFromEmail } from '../../api/_lib/email';
import { verifyAuth } from '../../api/_lib/auth.js';
import { ensureFirebaseAdmin } from '../../api/_lib/firebaseAdmin.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';
import { writeAuditEvent } from '../../api/_lib/audit.js';

describe('api/email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.RESEND_API_KEY = 'test_resend_key';
    delete process.env.RESEND_FROM_EMAIL;
    vi.mocked(verifyAuth).mockResolvedValue({ uid: 'user_1', email: 'account@example.fr' });
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true });
    vi.mocked(writeAuditEvent).mockResolvedValue(undefined);
    vi.mocked(ensureFirebaseAdmin).mockReturnValue(createMockAdmin());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('utilise contact@photofacto.fr comme fallback RESEND_FROM_EMAIL', () => {
    expect(verifiedFromEmail()).toBe('contact@photofacto.fr');
  });

  it('construit un from Resend stable avec le nom artisan via Photofacto', async () => {
    let resendBody: any;
    global.fetch = vi.fn().mockImplementation(async (_url, init: any) => {
      resendBody = JSON.parse(String(init.body));
      return {
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'email_1' }),
      };
    }) as any;

    await sendResendEmail({
      to: ['client@example.fr'],
      subject: 'Facture F-2026-001',
      html: '<p>Bonjour</p>',
      fromName: 'Nom Artisan',
      replyTo: 'artisan@example.fr',
    });

    expect(resendBody.from).toBe('Nom Artisan via Photofacto <contact@photofacto.fr>');
    expect(resendBody.reply_to).toBe('artisan@example.fr');
  });

  it('nettoie les séparateurs qui rendent le champ from invalide', () => {
    expect(buildResendFromHeader('Dupont, Martin; BTP')).toBe('Dupont Martin BTP via Photofacto <contact@photofacto.fr>');
  });

  it('retourne une erreur JSON contrôlée quand Resend refuse un envoi de facture', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: vi.fn().mockResolvedValue({
        message: 'Invalid `from` field. The email address needs to follow the email@example.com format.',
        name: 'validation_error',
      }),
    }) as any;

    const res = createMockResponse();
    await handler(baseReq(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      error: 'L’e-mail n’a pas pu être envoyé.',
      code: 'email_send_failed',
    });
    expect(res.body.detail).toContain('Invalid `from` field');
    expect(console.error).toHaveBeenCalledWith('[email] send-invoice failed', expect.objectContaining({
      uid: 'user_1',
      invoiceId: 'invoice_1',
      step: 'send_resend',
      status: 422,
      code: 'validation_error',
      recipientDomain: 'example.fr',
      hasReplyTo: true,
      fromEmail: 'contact@photofacto.fr',
    }));
  });
});

function baseReq(body: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
    body: {
      action: 'send-invoice',
      invoiceId: 'invoice_1',
      to: 'client@example.fr',
      message: 'Voici votre facture.',
      ...body,
    },
  };
}

function createMockAdmin() {
  const invoiceRef = {
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'invoice_1',
        ownerId: 'user_1',
        clientId: 'client_1',
        clientName: 'Client Test',
        type: 'invoice',
        number: 'F-2026-001',
        totalTTC: 1275,
      }),
    }),
    set: vi.fn().mockResolvedValue(undefined),
  };
  const companyRef = {
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Nom Artisan',
        email: 'artisan@example.fr',
      }),
    }),
  };
  const clientRef = {
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        ownerId: 'user_1',
        email: 'client@example.fr',
      }),
    }),
  };

  return {
    db: {
      collection: vi.fn((name: string) => ({
        doc: vi.fn(() => {
          if (name === 'invoices') return invoiceRef;
          if (name === 'companies') return companyRef;
          if (name === 'clients') return clientRef;
          return { get: vi.fn(), set: vi.fn() };
        }),
      })),
    },
  } as any;
}
