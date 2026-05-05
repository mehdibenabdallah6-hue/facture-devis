// Shared schema + sanitisation helpers for the AI invoice-extraction
// endpoint. Both the Gemini and the DeepSeek client target the same
// JSON shape so the existing /api/gemini consumers don't need to
// change a thing.
import { sanitizeText } from './validators.js';

/**
 * The Gemini-flavoured schema (uppercased type names) used as
 * `responseSchema` in `generateContent` requests.
 */
export const aiInvoiceSchema = {
  type: 'OBJECT',
  properties: {
    clientName: {
      type: 'STRING',
      description: "Nom du client ou de l'entreprise cliente",
    },
    clientAddress: {
      type: 'STRING',
      description: 'Adresse complète du client',
    },
    date: {
      type: 'STRING',
      description: 'Date de la facture ou du devis au format YYYY-MM-DD',
    },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: {
            type: 'STRING',
            description: 'Description de la prestation ou du produit',
          },
          quantity: { type: 'NUMBER', description: 'Quantité' },
          unitPrice: {
            type: 'NUMBER',
            description: 'Prix unitaire HT ou TTC',
          },
          vatRate: {
            type: 'NUMBER',
            description:
              'Taux de TVA en pourcentage (ex: 20, 10, 5.5, 0). Si non précisé, mettre 20.',
          },
        },
        required: ['description', 'quantity', 'unitPrice', 'vatRate'],
      },
    },
    notes: {
      type: 'STRING',
      description: 'Notes supplémentaires, mentions, ou numéro de facture',
    },
  },
  required: ['clientName', 'items'],
};

/**
 * Plain-English version of the schema, embedded in the prompt for
 * providers like DeepSeek that don't support a structured-response
 * schema parameter. Keep in sync with `aiInvoiceSchema`.
 */
export const aiInvoiceSchemaPromptHint = `Réponds uniquement avec un objet JSON valide qui respecte ce format :
{
  "clientName": string,                // nom du client ou entreprise (obligatoire)
  "clientAddress": string,             // adresse complète, ou ""
  "date": string,                      // YYYY-MM-DD, ou ""
  "items": [                           // au moins une ligne
    {
      "description": string,
      "quantity": number,
      "unitPrice": number,             // 0 si tu ne peux pas justifier le prix
      "vatRate": number                // pourcentage, mets 20 par défaut
    }
  ],
  "notes": string                      // notes / mentions / n° de facture, ou ""
}
N'ajoute aucun texte avant ou après le JSON. Pas de balises markdown.`;

export function safeNumber(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Project the raw provider JSON onto the canonical Photofacto invoice
 * shape, sanitising every field. All AI-generated lines are flagged
 * `needsReview: true` so the artisan validates them before sending.
 */
export function normalizeAiResponse(data: any) {
  const items = Array.isArray(data?.items)
    ? data.items.slice(0, 30).map((item: any) => ({
        description:
          sanitizeText(item?.description, 300) || 'Prestation à compléter',
        quantity: safeNumber(item?.quantity, 1),
        unitPrice: safeNumber(item?.unitPrice, 0),
        vatRate: safeNumber(item?.vatRate, 20),
        needsReview: true,
        source:
          Number(item?.unitPrice) === 0 ? 'ai_price_missing' : 'ai_suggestion',
      }))
    : [];

  return {
    clientName: sanitizeText(data?.clientName, 120),
    clientAddress: sanitizeText(data?.clientAddress, 500),
    date: sanitizeText(data?.date, 50),
    notes: sanitizeText(data?.notes, 1500),
    items,
    needsReview: true,
  };
}
