import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('token'),
    },
  },
}));

import { callAuthenticatedApi } from '../src/services/apiClient';

describe('callAuthenticatedApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('remonte error, detail et code de la réponse serveur', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({
        error: 'Erreur serveur pendant la validation de la facture.',
        detail: 'write_invoice failed',
        code: 'invoice_validate_failed',
      }),
    }) as any;

    await expect(callAuthenticatedApi(mockUser(), '/api/invoice-validate', { invoiceId: 'invoice_1' }))
      .rejects
      .toThrow('Erreur serveur pendant la validation de la facture. — write_invoice failed — code: invoice_validate_failed');
  });
});

function mockUser() {
  return {
    email: 'artisan@example.fr',
    emailVerified: true,
    providerData: [{ providerId: 'password' }],
  } as any;
}
