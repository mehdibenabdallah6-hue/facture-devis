// Vercel Serverless Function — Direct REST call to Gemini API (v1)
// Bypasses the @google/genai SDK to avoid v1beta model availability issues.
//
// SECURITY:
//  - Auth required: Firebase ID token via Authorization: Bearer header.
//  - Quota check + atomic increment server-side (the client cannot skip the
//    counter the way it could when increments lived in DataContext).
//  - On AI failure (both models down) we roll back the quota so the user
//    isn't billed a quota-slot for nothing.
import { verifyAuth } from './_verify-auth';
import { ensureFirebaseAdmin } from './_firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Stable, generally-available Gemini models. `gemini-3-flash-preview` was a
// short-lived preview that has since been retired — calling it now returns
// 404 from the Generative Language API and surfaces as a 500 to clients.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash';

// Mirror of src/lib/billing.ts and src/hooks/usePlan.ts. Keep in sync if
// you change plan limits there.
const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);
const PLAN_AI_LIMITS: Record<string, number> = {
  free: 5,
  starter: 50,
  pro: -1, // -1 = unlimited
};

const schema = {
  type: 'OBJECT',
  properties: {
    clientName: { type: 'STRING', description: "Nom du client ou de l'entreprise cliente" },
    clientAddress: { type: 'STRING', description: "Adresse complète du client" },
    date: { type: 'STRING', description: "Date de la facture ou du devis au format YYYY-MM-DD" },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING', description: 'Description de la prestation ou du produit' },
          quantity: { type: 'NUMBER', description: 'Quantité' },
          unitPrice: { type: 'NUMBER', description: 'Prix unitaire HT ou TTC' },
          vatRate: { type: 'NUMBER', description: 'Taux de TVA en pourcentage (ex: 20, 10, 5.5, 0). Si non précisé, mettre 20.' },
        },
        required: ['description', 'quantity', 'unitPrice', 'vatRate'],
      },
    },
    notes: { type: 'STRING', description: 'Notes supplémentaires, mentions, ou numéro de facture' },
  },
  required: ['clientName', 'items'],
};

/**
 * Atomically check the user's IA quota and increment the counter. Returns
 * `{ ok: true }` if the request can proceed, or `{ ok: false, ... }` if the
 * monthly quota is exhausted. The transaction guarantees that two parallel
 * requests can't both pass when only one slot remains.
 */
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
      tx.set(
        ref,
        {
          monthlyAiUsageCount: 1,
          monthlyResetAt: monthStart.toISOString(),
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

/** Roll back a previously reserved AI quota slot (atomic decrement, floored at 0). */
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
    // Refund failure is non-fatal — log it, the user just loses one slot.
    console.error('refundAiQuota failed:', err);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  // 1. Auth — never trust an unauthenticated caller.
  let auth: { uid: string; email?: string };
  try {
    auth = await verifyAuth(req);
  } catch (e: any) {
    return res.status(e.status || 401).json({ error: e.message || 'Non authentifié' });
  }

  // 2. Quota reservation — atomic increment so a flood of parallel requests
  //    can't slip past the limit.
  let reserved = false;
  try {
    const quotaResult = await reserveAiQuota(auth.uid);
    if (quotaResult.ok === false) {
      return res.status(quotaResult.status).json({ error: quotaResult.reason });
    }
    reserved = true;
  } catch (err: any) {
    console.error('reserveAiQuota threw:', err);
    return res.status(500).json({ error: 'Erreur de vérification du quota IA. Réessayez.' });
  }

  try {
    const { mode, base64Image, mimeType, promptText, catalogContext } = req.body;

    let parts: any[] = [];

    // Ajout d'une antisèche pour l'IA si un catalogue existe
    const catalogPrompt = catalogContext
      ? `\n\n[CATALOGUE PRIORITAIRE] Voici le catalogue de prestations/prix de l'artisan : ${catalogContext}.
Règles catalogue :
- Si une prestation de la description correspond à un élément du catalogue, utilise le nom, le prix unitaire et le taux de TVA du catalogue.
- Si une quantité/surface est donnée par l'artisan, applique-la avec le prix catalogue correspondant.
- Si aucun prix fiable n'est trouvé, mets unitPrice à 0 pour que l'artisan le complète.
- Ne crée pas de prix inventé quand le catalogue ne permet pas de le justifier.`
      : '';

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
      const photoPrompt = `Tu es un assistant expert en facturation pour artisans. Génère une PROPOSITION de facture modifiable, pas une facture définitive.

Priorité des sources :
1. Description de l'artisan = source principale.
2. Catalogue/prix existants = source prioritaire pour les noms de prestations, prix et TVA.
3. Photo jointe = contexte visuel secondaire uniquement.

Description de l'artisan :
${userDescription}

Règles importantes :
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
      parts = [
        { text: photoPrompt + catalogPrompt },
        { inlineData: { data: base64Image, mimeType } },
      ];
    } else if (mode === 'document') {
      if (base64Image && mimeType) {
        parts = [
          {
            text:
              "Tu es un assistant expert en facturation. Analyse ce document PDF (facture, devis, bon de commande, relevé…). Extrait toutes les informations utiles pour pré-remplir un formulaire de facturation : nom du client, adresse, date, lignes de prestation avec description, quantité, prix unitaire et taux de TVA. Si des informations manquent, laisse vide. Ne renvoie que du JSON valide correspondant au schéma." +
              catalogPrompt,
          },
          { inlineData: { data: base64Image, mimeType } },
        ];
      } else if (promptText) {
        parts = [
          {
            text:
              "Tu es un assistant expert en facturation. Voici le contenu d'un fichier Excel (tableur) exporté en texte. Analyse ces données et extrait les informations pour pré-remplir un formulaire de facturation : nom du client, adresse, date, lignes de prestation avec description, quantité, prix unitaire et taux de TVA. Interprète les colonnes intelligemment. Ne renvoie que du JSON valide correspondant au schéma.\n\nContenu du tableur :\n" +
              promptText +
              catalogPrompt,
          },
        ];
      } else {
        await refundAiQuota(auth.uid);
        return res.status(400).json({ error: 'Missing document data' });
      }
    } else if (mode === 'text') {
      if (!promptText) {
        await refundAiQuota(auth.uid);
        return res.status(400).json({ error: 'Missing promptText' });
      }
      parts = [
        {
          text:
            "Tu es un assistant expert en facturation. Voici une transcription vocale ou un texte brut d'un artisan décrivant sa prestation. Extrait les informations pour pré-remplir un formulaire de facturation. Si le client n'est pas précisé avec précision, met un nom générique ou vide. Ne renvoie que du JSON valide correspondant au schéma.\n\nDescription de l'artisan: " +
            promptText +
            catalogPrompt,
        },
      ];
    } else {
      await refundAiQuota(auth.uid);
      return res.status(400).json({ error: 'Invalid mode. Must be "image", "document", or "text".' });
    }

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.1,
      },
    };

    async function callGemini(model: string, apiUrl: string) {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        console.error(`Gemini API error (${model}):`, JSON.stringify(errBody));
        throw new Error(JSON.stringify(errBody));
      }

      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No data extracted from AI response.');
      }
      return JSON.parse(text);
    }

    try {
      const primaryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
      const data = await callGemini(GEMINI_MODEL, primaryUrl);
      return res.status(200).json(data);
    } catch (primaryError: any) {
      console.warn(`Primary model ${GEMINI_MODEL} failed, trying fallback ${GEMINI_FALLBACK_MODEL}...`);
      try {
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FALLBACK_MODEL}:generateContent?key=${apiKey}`;
        const data = await callGemini(GEMINI_FALLBACK_MODEL, fallbackUrl);
        return res.status(200).json({ ...data, _fallback: true });
      } catch (fallbackError: any) {
        // Both models failed — refund the quota slot we reserved.
        if (reserved) await refundAiQuota(auth.uid);
        console.error('Both primary and fallback Gemini models failed:', fallbackError.message);
        return res.status(500).json({ error: 'Service IA indisponible. Veuillez réessayer plus tard.' });
      }
    }
  } catch (error: any) {
    if (reserved) await refundAiQuota(auth.uid);
    console.error("Erreur serveur lors de l'extraction IA:", error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
