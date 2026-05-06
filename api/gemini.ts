// Vercel Serverless Function — invoice-extraction endpoint.
//
// Route name kept as /api/gemini for backwards compatibility with the
// existing client (src/services/ai.ts), but the actual provider routing
// now lives in api/_lib/aiProvider.ts:
//   - text  / dictation        → DeepSeek (with Gemini fallback)
//   - photo / image            → Gemini
//   - document (PDF binary)    → Gemini   (treated as vision)
//   - document (Excel as text) → DeepSeek (treated as text)
//
// SECURITY:
//  - Auth required: Firebase ID token via Authorization: Bearer header.
//  - Quota is reserved atomically before any provider call and refunded
//    if the *whole* extraction (primary + fallback) fails. A successful
//    fallback never costs the user a second quota slot.
//  - No API key is ever sent to the client — DEEPSEEK_API_KEY and
//    GEMINI_API_KEY only live on the server.
import { verifyAuth } from './_verify-auth.js';
import { ensureFirebaseAdmin } from './_firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit } from './_lib/rateLimit.js';
import { writeAuditEvent } from './_lib/audit.js';
import {
  base64ByteLength,
  isAllowedImage,
  MAX_AI_PROMPT_LENGTH,
  MAX_BASE64_IMAGE_BYTES,
  sanitizeText,
} from './_lib/validators.js';
import { extractFromImage, extractFromText, type AiResult } from './_lib/aiProvider.js';
import { effectivePlanForCompany, getMonthlyQuotaState, getPlanLimitsForCompany, quotaExceededMessage } from './_lib/billing.js';

/**
 * Atomically check the user's IA quota and increment the counter.
 */
async function reserveAiQuota(
  uid: string,
): Promise<{ ok: true } | { ok: false; reason: string; status: number }> {
  const { db } = ensureFirebaseAdmin();
  const ref = db.collection('companies').doc(uid);

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = (snap.exists ? snap.data() : {}) || {};

    const now = new Date();
    const plan = effectivePlanForCompany(data);
    const limit = getPlanLimitsForCompany(data).aiUsagesPerMonth;
    const quota = getMonthlyQuotaState({
      company: data,
      countField: 'monthlyAiUsageCount',
      resetField: 'monthlyResetAt',
      limit,
      now,
    });

    if (quota.isBlocked) {
      return {
        ok: false as const,
        reason: quotaExceededMessage('aiUsagesPerMonth', plan),
        status: 429,
      };
    }

    if (quota.needsReset) {
      tx.set(
        ref,
        {
          monthlyAiUsageCount: 1,
          monthlyResetAt: quota.monthStart,
          updatedAt: now.toISOString(),
        },
        { merge: true },
      );
    } else {
      tx.set(
        ref,
        {
          monthlyAiUsageCount: FieldValue.increment(1),
          updatedAt: now.toISOString(),
        },
        { merge: true },
      );
    }
    return { ok: true as const };
  });
}

/** Roll back a previously reserved AI quota slot. */
async function refundAiQuota(uid: string): Promise<void> {
  try {
    const { db } = ensureFirebaseAdmin();
    const ref = db.collection('companies').doc(uid);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = (snap.exists ? snap.data() : {}) || {};
      const current = data.monthlyAiUsageCount || 0;
      if (current <= 0) return;
      tx.set(
        ref,
        {
          monthlyAiUsageCount: FieldValue.increment(-1),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    });
  } catch (err) {
    console.error('refundAiQuota failed:', err);
  }
}

function buildCatalogPrompt(catalogContext?: string) {
  if (!catalogContext) return '';
  return `\n\n[CATALOGUE PRIORITAIRE] Voici le catalogue de prestations/prix de l'artisan : ${catalogContext}.
Règles catalogue :
- Si une prestation de la description correspond à un élément du catalogue, utilise le nom, le prix unitaire et le taux de TVA du catalogue.
- Si une quantité/surface est donnée par l'artisan, applique-la avec le prix catalogue correspondant.
- Si aucun prix fiable n'est trouvé, mets unitPrice à 0 pour que l'artisan le complète.
- Ne crée pas de prix inventé quand le catalogue ne permet pas de le justifier.`;
}

const PHOTO_SYSTEM_PROMPT_HEAD = `Tu es un assistant expert en facturation pour artisans. Génère une PROPOSITION de facture modifiable, pas une facture définitive.

Priorité des sources :
1. Description de l'artisan = source principale.
2. Catalogue/prix existants = source prioritaire pour les noms de prestations, prix et TVA.
3. Photo jointe = contexte visuel secondaire uniquement.`;

const PHOTO_RULES_TAIL = `Règles importantes :
- Base les lignes de facture surtout sur la description texte/voix.
- Utilise la photo seulement pour confirmer le contexte général du chantier.
- Ne devine jamais les mètres carrés, quantités, prix, matériaux précis ou détails invisibles si l'artisan ne les donne pas.
- Si une information manque, utilise une ligne générique claire plutôt qu'une estimation risquée.
- Préfère peu de lignes simples et réalistes plutôt que beaucoup de lignes incertaines.
- Si une prestation du catalogue correspond à la description, utilise son nom et son prix.
- Si aucun prix fiable n'est trouvé, mets unitPrice à 0 pour laisser l'artisan compléter.
- Ne présente jamais le résultat comme parfaitement automatique ou certain.
- La facture doit rester facilement modifiable par l'artisan.
- Ne renvoie que du JSON valide correspondant au schéma.`;

const TEXT_SYSTEM_PROMPT = `Tu es un assistant expert en facturation. Voici une transcription vocale ou un texte brut d'un artisan décrivant sa prestation. Extrait les informations pour pré-remplir un formulaire de facturation. Si le client n'est pas précisé avec précision, met un nom générique ou vide. Ne renvoie que du JSON valide correspondant au schéma.`;

const DOCUMENT_PDF_SYSTEM_PROMPT = `Tu es un assistant expert en facturation. Analyse ce document PDF (facture, devis, bon de commande, relevé…). Extrait toutes les informations utiles pour pré-remplir un formulaire de facturation : nom du client, adresse, date, lignes de prestation avec description, quantité, prix unitaire et taux de TVA. Si des informations manquent, laisse vide. Ne renvoie que du JSON valide correspondant au schéma.`;

const DOCUMENT_TEXT_SYSTEM_PROMPT = `Tu es un assistant expert en facturation. Voici le contenu d'un fichier Excel (tableur) exporté en texte. Analyse ces données et extrait les informations pour pré-remplir un formulaire de facturation : nom du client, adresse, date, lignes de prestation avec description, quantité, prix unitaire et taux de TVA. Interprète les colonnes intelligemment. Ne renvoie que du JSON valide correspondant au schéma.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Auth — never trust an unauthenticated caller.
  let auth: { uid: string; email?: string };
  try {
    auth = await verifyAuth(req);
  } catch (e: any) {
    return res.status(e.status || 401).json({ error: e.message || 'Non authentifié' });
  }

  const requestBody = req.body || {};
  const { mode, base64Image, mimeType, promptText, catalogContext } = requestBody;
  const textLength = typeof promptText === 'string' ? promptText.length : 0;
  const catalogLength = typeof catalogContext === 'string' ? catalogContext.length : 0;
  if (textLength > MAX_AI_PROMPT_LENGTH) {
    return res.status(413).json({ error: 'Description trop longue pour l’analyse IA.' });
  }
  if (catalogLength > 12000) {
    return res.status(413).json({ error: 'Catalogue trop volumineux pour cette génération IA.' });
  }
  if (mode === 'image' && !isAllowedImage(mimeType, base64Image)) {
    return res.status(400).json({ error: 'Image invalide. Formats acceptés : JPEG, PNG ou WebP, 6 Mo maximum.' });
  }
  if (mode === 'document' && base64Image && mimeType) {
    const allowedDocumentMime = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(String(mimeType));
    if (!allowedDocumentMime || base64ByteLength(base64Image) > MAX_BASE64_IMAGE_BYTES) {
      return res.status(400).json({ error: 'Document invalide ou trop lourd.' });
    }
  }

  try {
    const limited = await checkRateLimit(`uid:gemini:${auth.uid}`, 20, 60 * 60 * 1000);
    if (!limited.ok) return res.status(429).json({ error: 'Trop de demandes IA récemment. Réessayez plus tard.' });
  } catch (err) {
    console.error('gemini rate limit failed:', err);
    return res.status(500).json({ error: 'Erreur de limitation IA. Réessayez.' });
  }

  // 2. Quota reservation — atomic increment so a flood of parallel requests
  //    can't slip past the limit. Refunded only if extraction fails.
  let reserved = false;
  try {
    const quotaResult = await reserveAiQuota(auth.uid);
    if (quotaResult.ok === false) {
      await writeAuditEvent({
        ownerId: auth.uid,
        actorUid: auth.uid,
        type: 'quota_exceeded',
        resourceType: 'ai',
        resourceId: auth.uid,
        metadata: { mode: sanitizeText(mode, 30) },
      }).catch(() => undefined);
      return res.status(quotaResult.status).json({ error: quotaResult.reason });
    }
    reserved = true;
  } catch (err: any) {
    console.error('reserveAiQuota threw:', err);
    return res.status(500).json({ error: 'Erreur de vérification du quota IA. Réessayez.' });
  }

  const startedAt = Date.now();
  let inputType: 'text' | 'image' = 'text';

  try {
    const catalogPrompt = buildCatalogPrompt(catalogContext);
    let result: AiResult;

    if (mode === 'image') {
      if (!base64Image || !mimeType) {
        await refundAiQuota(auth.uid);
        return res.status(400).json({ error: 'Missing base64Image or mimeType' });
      }
      const userDescription = typeof promptText === 'string' ? promptText.trim() : '';
      if (!userDescription) {
        await refundAiQuota(auth.uid);
        return res.status(400).json({
          error: 'Décrivez la prestation en quelques mots pour générer une facture plus précise.',
        });
      }
      inputType = 'image';
      const photoPrompt = `${PHOTO_SYSTEM_PROMPT_HEAD}\n\nDescription de l'artisan :\n${userDescription}\n\n${PHOTO_RULES_TAIL}`;
      result = await extractFromImage({
        base64: base64Image,
        mimeType,
        promptText: photoPrompt,
        catalogPrompt,
      });
    } else if (mode === 'document') {
      if (base64Image && mimeType) {
        // PDF (binary) → vision provider.
        inputType = 'image';
        result = await extractFromImage({
          base64: base64Image,
          mimeType,
          promptText: DOCUMENT_PDF_SYSTEM_PROMPT,
          catalogPrompt,
        });
      } else if (promptText) {
        // Excel pre-extracted text → text provider.
        inputType = 'text';
        result = await extractFromText({
          systemPrompt: DOCUMENT_TEXT_SYSTEM_PROMPT,
          userPrompt: `Contenu du tableur :\n${promptText}`,
          catalogPrompt,
        });
      } else {
        await refundAiQuota(auth.uid);
        return res.status(400).json({ error: 'Missing document data' });
      }
    } else if (mode === 'text') {
      if (!promptText) {
        await refundAiQuota(auth.uid);
        return res.status(400).json({ error: 'Missing promptText' });
      }
      inputType = 'text';
      result = await extractFromText({
        systemPrompt: TEXT_SYSTEM_PROMPT,
        userPrompt: `Description de l'artisan: ${promptText}`,
        catalogPrompt,
      });
    } else {
      await refundAiQuota(auth.uid);
      return res.status(400).json({ error: 'Invalid mode. Must be "image", "document", or "text".' });
    }

    // Audit log: provider + input type + duration + fallback flag — no
    // payload, no client data, no API key. The legacy `gemini_used`
    // event type is preserved so existing admin filters keep working.
    await writeAuditEvent({
      ownerId: auth.uid,
      actorUid: auth.uid,
      type: 'gemini_used',
      resourceType: 'ai',
      resourceId: auth.uid,
      metadata: {
        mode: sanitizeText(mode, 30),
        provider: result.provider,
        model: result.model,
        inputType,
        fallback: result.fallback,
        durationMs: Date.now() - startedAt,
      },
    }).catch(() => undefined);

    return res
      .status(200)
      .json({ ...result.data, _provider: result.provider, _fallback: result.fallback });
  } catch (error: any) {
    if (reserved) await refundAiQuota(auth.uid);
    console.error(
      `[ai] extraction failed type=${inputType} mode=${mode} ms=${Date.now() - startedAt}`,
      safeProviderError(error),
    );
    return res
      .status(500)
      .json({ error: 'Service IA indisponible. Veuillez réessayer plus tard.' });
  }
}

function safeProviderError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const colonIdx = msg.indexOf(':');
  return colonIdx > 0 ? msg.slice(0, colonIdx) : msg.slice(0, 60);
}
