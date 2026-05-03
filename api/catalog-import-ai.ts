import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from './_verify-auth.js';
import { ensureFirebaseAdmin } from './_firebase-admin.js';
import { checkRateLimit } from './_lib/rateLimit.js';
import {
  base64ByteLength,
  MAX_BASE64_IMAGE_BYTES,
  MAX_PDF_BYTES,
  sanitizeText,
} from './_lib/validators.js';
import {
  normalizeCatalogImportItems,
  type ExistingCatalogArticle,
  type RawCatalogImportItem,
} from './_lib/catalogImport.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash';
const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);
const PLAN_AI_LIMITS: Record<string, number> = {
  free: 5,
  starter: 50,
  pro: -1,
};
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const SOURCE_TYPES = new Set(['photo', 'old_quote', 'pdf']);

const responseSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          description: { type: 'STRING' },
          unit: { type: 'STRING' },
          priceHT: { type: 'NUMBER' },
          vatRate: { type: 'NUMBER' },
          category: { type: 'STRING' },
          notes: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
        required: ['name'],
      },
    },
    warnings: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: ['items'],
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  let auth: { uid: string; email?: string };
  try {
    auth = await verifyAuth(req);
  } catch (error: any) {
    return res.status(error.status || 401).json({ error: error.message || 'Non authentifié' });
  }

  const body = req.body || {};
  const fileName = sanitizeText(body.fileName, 180);
  const mimeType = String(body.mimeType || '');
  const base64Data = String(body.base64Data || '').replace(/^data:[^,]+,/, '');
  const sourceType = String(body.sourceType || '');

  if (!SOURCE_TYPES.has(sourceType)) {
    return res.status(400).json({ error: 'Type de source invalide.' });
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    return res.status(400).json({ error: 'Format non accepté. Utilisez une image JPEG/PNG/WebP ou un PDF.' });
  }
  if (!base64Data) {
    return res.status(400).json({ error: 'Fichier manquant.' });
  }

  const fileSize = base64ByteLength(base64Data);
  const maxSize = mimeType === 'application/pdf' ? MAX_PDF_BYTES : MAX_BASE64_IMAGE_BYTES;
  if (fileSize > maxSize) {
    return res.status(413).json({ error: 'Fichier trop lourd. Essayez avec une image/PDF plus léger.' });
  }

  try {
    const limited = await checkRateLimit(`uid:catalog-import:${auth.uid}`, 10, 60 * 60 * 1000);
    if (!limited.ok) {
      return res.status(429).json({ error: 'Trop de demandes IA récemment. Réessayez plus tard.' });
    }
  } catch (error) {
    console.error('catalog import rate limit failed:', error);
    return res.status(500).json({ error: 'Erreur de limitation IA. Réessayez.' });
  }

  let reserved = false;
  try {
    const existingArticles = await loadExistingArticles(auth.uid);
    const quotaResult = await reserveAiQuota(auth.uid);
    if (quotaResult.ok === false) {
      return res.status(quotaResult.status).json({ error: quotaResult.reason });
    }
    reserved = true;

    const raw = await extractCatalogItemsWithGemini({
      apiKey,
      fileName,
      mimeType,
      base64Data,
      sourceType,
    });
    const items = normalizeCatalogImportItems(raw.items, existingArticles);
    const warnings = normalizeWarnings(raw.warnings);

    if (items.length === 0) {
      if (reserved) await refundAiQuota(auth.uid);
      return res.status(422).json({
        error: 'Aucune prestation exploitable détectée. Essayez une photo plus nette ou un autre document.',
        warnings,
      });
    }

    return res.status(200).json({
      items,
      warnings,
      needsReview: true,
    });
  } catch (error: any) {
    if (reserved) await refundAiQuota(auth.uid);
    const status = error.status || 500;
    if (status >= 500 && status !== 502) console.error('catalog-import-ai failed:', error);
    return res.status(status).json({ error: error.message || 'Erreur serveur. Veuillez réessayer.' });
  }
}

async function loadExistingArticles(uid: string): Promise<ExistingCatalogArticle[]> {
  const { db } = ensureFirebaseAdmin();
  const snap = await db.collection('companies').doc(uid).collection('articles').get();
  return snap.docs.map((doc: any) => ({
    id: doc.id,
    ...(doc.data() || {}),
  })) as ExistingCatalogArticle[];
}

async function reserveAiQuota(
  uid: string,
): Promise<{ ok: true } | { ok: false; reason: string; status: number }> {
  const { db } = ensureFirebaseAdmin();
  const ref = db.collection('companies').doc(uid);

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = (snap.exists ? snap.data() : {}) || {};

    const isPaid = PAID_STATUSES.has(data.subscriptionStatus || '');
    const plan = isPaid && data.plan && data.plan !== 'free' ? data.plan : 'free';
    const limit = PLAN_AI_LIMITS[plan] ?? PLAN_AI_LIMITS.free;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastReset = data.monthlyResetAt ? new Date(data.monthlyResetAt) : null;
    const needsReset =
      !lastReset ||
      lastReset.getMonth() !== now.getMonth() ||
      lastReset.getFullYear() !== now.getFullYear();

    const currentUsage = needsReset ? 0 : (data.monthlyAiUsageCount || 0);
    if (limit !== -1 && currentUsage >= limit) {
      return {
        ok: false as const,
        reason: `Quota IA atteint (${currentUsage}/${limit}). Passez au plan supérieur ou attendez le mois prochain.`,
        status: 429,
      };
    }

    if (needsReset) {
      tx.set(ref, {
        monthlyAiUsageCount: 1,
        monthlyResetAt: monthStart.toISOString(),
        updatedAt: now.toISOString(),
      }, { merge: true });
    } else {
      tx.set(ref, {
        monthlyAiUsageCount: FieldValue.increment(1),
        updatedAt: now.toISOString(),
      }, { merge: true });
    }

    return { ok: true as const };
  });
}

async function refundAiQuota(uid: string): Promise<void> {
  try {
    const { db } = ensureFirebaseAdmin();
    const ref = db.collection('companies').doc(uid);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = (snap.exists ? snap.data() : {}) || {};
      const current = data.monthlyAiUsageCount || 0;
      if (current <= 0) return;
      tx.set(ref, {
        monthlyAiUsageCount: FieldValue.increment(-1),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    });
  } catch (error) {
    console.error('catalog import refundAiQuota failed:', error);
  }
}

async function extractCatalogItemsWithGemini(input: {
  apiKey: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
  sourceType: string;
}): Promise<{ items: RawCatalogImportItem[]; warnings: string[] }> {
  const prompt = buildCatalogPrompt(input.fileName, input.sourceType);
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { data: input.base64Data, mimeType: input.mimeType } },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.1,
    },
  };

  const primaryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${input.apiKey}`;
  try {
    return await callGemini(primaryUrl, body);
  } catch (error: any) {
    if (error.status === 502) throw error;
    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FALLBACK_MODEL}:generateContent?key=${input.apiKey}`;
    return callGemini(fallbackUrl, body);
  }
}

async function callGemini(apiUrl: string, body: any): Promise<{ items: RawCatalogImportItem[]; warnings: string[] }> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const error = new Error('Service IA indisponible. Veuillez réessayer plus tard.');
    (error as any).status = 502;
    (error as any).details = details;
    throw error;
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const error = new Error('La réponse IA est vide. Réessayez avec un document plus lisible.');
    (error as any).status = 502;
    throw error;
  }

  try {
    const parsed = JSON.parse(text);
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      warnings: normalizeWarnings(parsed?.warnings),
    };
  } catch {
    const error = new Error('La réponse IA est invalide. Réessayez avec un document plus lisible.');
    (error as any).status = 502;
    throw error;
  }
}

function buildCatalogPrompt(fileName: string, sourceType: string): string {
  return `Tu es un assistant d'import catalogue pour Photofacto, logiciel de devis/factures pour artisans français.

Mission :
- Analyse le document fourni (${sourceType}, fichier: ${fileName || 'sans nom'}).
- Extrait uniquement les prestations, produits, forfaits, prix et lignes réutilisables dans un catalogue artisan.
- Ignore les totaux, conditions générales, coordonnées, numéros de facture, mentions légales et lignes non commerciales.
- Ne devine pas un prix si le document ne le donne pas clairement : mets priceHT à 0 et une confidence faible.
- Si une unité est visible, utilise : unité, heure, m², forfait, mètre linéaire, mètre.
- Si le taux de TVA n'est pas détecté, laisse vatRate vide ou mets 20 uniquement si le document indique clairement une TVA standard.
- Retourne peu de lignes propres plutôt que beaucoup de lignes incertaines.
- Le résultat sera affiché en prévisualisation modifiable : ne prétends jamais que tout est certain.

Réponse attendue : JSON strict uniquement.
{
  "items": [
    {
      "name": "Déplacement",
      "description": "Frais de déplacement",
      "unit": "forfait",
      "priceHT": 45,
      "vatRate": 20,
      "category": "Déplacement",
      "notes": "",
      "confidence": 0.92
    }
  ],
  "warnings": []
}`;
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => sanitizeText(item, 180)).filter(Boolean).slice(0, 5);
}
