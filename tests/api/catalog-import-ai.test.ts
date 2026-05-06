import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse } from './testResponse';

vi.mock('../../api/_verify-auth.js', () => ({
  verifyAuth: vi.fn(),
}));

vi.mock('../../api/_firebase-admin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

vi.mock('../../api/_lib/rateLimit.js', () => ({
  checkRateLimit: vi.fn(),
}));

import handler from '../../api/catalog-import-ai';
import { verifyAuth } from '../../api/_verify-auth.js';
import { ensureFirebaseAdmin } from '../../api/_firebase-admin.js';
import { checkRateLimit } from '../../api/_lib/rateLimit.js';

const previousGeminiKey = process.env.GEMINI_API_KEY;

describe('api/catalog-import-ai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'gemini-key';
    vi.mocked(verifyAuth).mockResolvedValue({ uid: 'user_1', email: 'artisan@example.fr' });
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true });
    vi.mocked(ensureFirebaseAdmin).mockReturnValue(createMockAdmin());
    global.fetch = vi.fn().mockResolvedValue(geminiResponse({ items: [] })) as any;
  });

  afterEach(() => {
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
    vi.restoreAllMocks();
  });

  it('refuse une requête sans authentification', async () => {
    vi.mocked(verifyAuth).mockRejectedValue(Object.assign(new Error('Non authentifié'), { status: 401 }));

    const res = createMockResponse();
    await handler(baseReq({}), res);

    expect(res.statusCode).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuse un type MIME invalide', async () => {
    const res = createMockResponse();
    await handler(baseReq({ mimeType: 'text/plain', base64Data: Buffer.from('prix').toString('base64') }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Format non accepté');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuse un PDF trop lourd', async () => {
    const tooLargePdf = Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64');

    const res = createMockResponse();
    await handler(baseReq({ mimeType: 'application/pdf', base64Data: tooLargePdf }), res);

    expect(res.statusCode).toBe(413);
    expect(res.body.error).toContain('trop lourd');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('répond 429 quand le rate limit est dépassé', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, retryAfterMs: 60_000 });

    const res = createMockResponse();
    await handler(baseReq({}), res);

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain('Trop de demandes');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('bloque le deuxième import catalogue IA du plan gratuit', async () => {
    const admin = createMockAdmin({
      company: {
        plan: 'free',
        subscriptionStatus: 'expired',
        monthlyCatalogImportCount: 1,
        monthlyResetAt: new Date().toISOString(),
      },
    });
    vi.mocked(ensureFirebaseAdmin).mockReturnValue(admin);

    const res = createMockResponse();
    await handler(baseReq({}), res);

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain('imports catalogue IA');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(admin.transactionSet).not.toHaveBeenCalled();
  });

  it('répond 422 si aucune prestation exploitable n’est détectée et ne crée aucun article', async () => {
    const admin = createMockAdmin();
    vi.mocked(ensureFirebaseAdmin).mockReturnValue(admin);
    vi.mocked(global.fetch as any).mockResolvedValue(geminiResponse({ items: [] }));

    const res = createMockResponse();
    await handler(baseReq({}), res);

    expect(res.statusCode).toBe(422);
    expect(res.body.error).toContain('Aucune prestation');
    expect(admin.articleSet).not.toHaveBeenCalled();
  });

  it('répond 502 si Gemini renvoie un JSON invalide', async () => {
    vi.mocked(global.fetch as any).mockResolvedValue(geminiRawResponse('pas du json'));

    const res = createMockResponse();
    await handler(baseReq({}), res);

    expect(res.statusCode).toBe(502);
    expect(res.body.error).toContain('réponse IA');
  });

  it('renvoie une preview avec doublon décoché sans écrire dans le catalogue', async () => {
    const admin = createMockAdmin({
      articles: [{ id: 'deplacement', description: 'Déplacement', unitPrice: 45, vatRate: 20 }],
    });
    vi.mocked(ensureFirebaseAdmin).mockReturnValue(admin);
    vi.mocked(global.fetch as any).mockResolvedValue(geminiResponse({
      items: [
        { name: 'Déplacement', description: 'Frais de déplacement', unit: 'forfait', priceHT: 45, vatRate: 20, confidence: 0.95 },
        { name: 'Main-d’œuvre', unit: 'h', priceHT: 55, vatRate: 20, confidence: 0.9 },
      ],
    }));

    const res = createMockResponse();
    await handler(baseReq({}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ duplicateOfId: 'deplacement', selected: false });
    expect(res.body.items[1]).toMatchObject({ unit: 'heure', selected: true });
    expect(admin.articleSet).not.toHaveBeenCalled();
  });
});

function baseReq(overrides: Record<string, unknown>) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
    body: {
      fileName: 'catalogue.png',
      mimeType: 'image/png',
      base64Data: Buffer.from('déplacement 45 euros').toString('base64'),
      sourceType: 'photo',
      ...overrides,
    },
  };
}

function geminiResponse(payload: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  };
}

function geminiRawResponse(text: string) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

function createMockAdmin(options: { articles?: any[]; company?: any } = {}) {
  const articleSet = vi.fn();
  const articleDocs = (options.articles || []).map(article => ({
    id: article.id,
    data: () => article,
  }));
  const articleCollection = {
    get: vi.fn().mockResolvedValue({ docs: articleDocs }),
    doc: vi.fn(() => ({ set: articleSet })),
  };
  const companyRef = {
    collection: vi.fn((name: string) => {
      if (name !== 'articles') throw new Error(`Unexpected subcollection ${name}`);
      return articleCollection;
    }),
  };
  const companiesCollection = {
    doc: vi.fn(() => companyRef),
  };
  const tx = {
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        subscriptionStatus: 'active',
        plan: 'pro',
        monthlyAiUsageCount: 0,
        monthlyCatalogImportCount: 0,
        monthlyResetAt: new Date().toISOString(),
        ...options.company,
      }),
    }),
    set: vi.fn(),
  };
  return {
    articleSet,
    transactionSet: tx.set,
    db: {
      collection: vi.fn((name: string) => {
        if (name !== 'companies') throw new Error(`Unexpected collection ${name}`);
        return companiesCollection;
      }),
      runTransaction: vi.fn(async (callback: any) => callback(tx)),
    },
  } as any;
}
