// Vercel Serverless Function — Direct REST call to Gemini API (v1)
// Bypasses the @google/genai SDK to avoid v1beta model availability issues.

const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash';

const schema = {
  type: "OBJECT",
  properties: {
    clientName: { type: "STRING", description: "Nom du client ou de l'entreprise cliente" },
    clientAddress: { type: "STRING", description: "Adresse complète du client" },
    date: { type: "STRING", description: "Date de la facture ou du devis au format YYYY-MM-DD" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING", description: "Description de la prestation ou du produit" },
          quantity: { type: "NUMBER", description: "Quantité" },
          unitPrice: { type: "NUMBER", description: "Prix unitaire HT ou TTC" },
          vatRate: { type: "NUMBER", description: "Taux de TVA en pourcentage (ex: 20, 10, 5.5, 0). Si non précisé, mettre 20." }
        },
        required: ["description", "quantity", "unitPrice", "vatRate"]
      }
    },
    notes: { type: "STRING", description: "Notes supplémentaires, mentions, ou numéro de facture" }
  },
  required: ["clientName", "items"]
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  try {
    const { mode, base64Image, mimeType, promptText, catalogContext } = req.body;

    let parts: any[] = [];
    
    // Ajout d'une antisèche pour l'IA si un catalogue existe
    const catalogPrompt = catalogContext 
      ? `\n\n[TRÈS IMPORTANT] Voici mon catalogue de produits enregistrés (Articles et Prix connus) : ${catalogContext}. Si les éléments mentionnés dans la pièce jointe ou le texte correspondent à des articles de ce catalogue, DOIS utiliser le prix unitaire et la description exacts de ce catalogue.` 
      : '';

    if (mode === 'image') {
      if (!base64Image || !mimeType) {
        return res.status(400).json({ error: 'Missing base64Image or mimeType' });
      }
      const userDescription = typeof promptText === 'string' ? promptText.trim() : '';
      const photoPrompt = userDescription
        ? `Tu es un assistant expert en facturation pour artisans. Génère une PROPOSITION de facture modifiable à partir de deux sources :

1. Description de l'artisan, source principale et prioritaire :
${userDescription}

2. Photo jointe, utilisée uniquement comme contexte visuel secondaire.

Règles importantes :
- Ne prétends pas détecter automatiquement toutes les surfaces, quantités ou détails depuis la photo.
- Ne devine pas les m², dimensions, matériaux, prix ou détails non indiqués par l'artisan.
- Base les lignes de facture surtout sur la description texte/voix.
- Utilise la photo seulement pour confirmer le contexte général du chantier si elle aide.
- Si une information manque, laisse-la vide ou mets une valeur prudente plutôt que d'inventer.
- Ne renvoie que du JSON valide correspondant au schéma.`
        : `Tu es un assistant expert en facturation. Analyse cette image seulement comme contexte visuel pour pré-remplir une proposition de facture. Ne prétends pas détecter automatiquement les surfaces, quantités, matériaux ou prix depuis une seule photo. Si des informations manquent, laisse vide plutôt que d'inventer. Ne renvoie que du JSON valide correspondant au schéma.`;
      parts = [
        { text: photoPrompt + catalogPrompt },
        { inlineData: { data: base64Image, mimeType } }
      ];
    } else if (mode === 'document') {
      // PDF files: sent as inlineData (Gemini supports PDF natively)
      // Excel files: content already extracted as text by the client
      if (base64Image && mimeType) {
        // PDF sent as binary
        parts = [
          { text: "Tu es un assistant expert en facturation. Analyse ce document PDF (facture, devis, bon de commande, relevé…). Extrait toutes les informations utiles pour pré-remplir un formulaire de facturation : nom du client, adresse, date, lignes de prestation avec description, quantité, prix unitaire et taux de TVA. Si des informations manquent, laisse vide. Ne renvoie que du JSON valide correspondant au schéma." + catalogPrompt },
          { inlineData: { data: base64Image, mimeType } }
        ];
      } else if (promptText) {
        // Excel content sent as extracted text
        parts = [
          { text: "Tu es un assistant expert en facturation. Voici le contenu d'un fichier Excel (tableur) exporté en texte. Analyse ces données et extrait les informations pour pré-remplir un formulaire de facturation : nom du client, adresse, date, lignes de prestation avec description, quantité, prix unitaire et taux de TVA. Interprète les colonnes intelligemment. Ne renvoie que du JSON valide correspondant au schéma.\n\nContenu du tableur :\n" + promptText + catalogPrompt }
        ];
      } else {
        return res.status(400).json({ error: 'Missing document data' });
      }
    } else if (mode === 'text') {
      if (!promptText) {
        return res.status(400).json({ error: 'Missing promptText' });
      }
      parts = [
        { text: "Tu es un assistant expert en facturation. Voici une transcription vocale ou un texte brut d'un artisan décrivant sa prestation. Extrait les informations pour pré-remplir un formulaire de facturation. Si le client n'est pas précisé avec précision, met un nom générique ou vide. Ne renvoie que du JSON valide correspondant au schéma.\n\nDescription de l'artisan: " + promptText + catalogPrompt }
      ];
    } else {
      return res.status(400).json({ error: 'Invalid mode. Must be "image", "document", or "text".' });
    }

    // Direct REST call to Gemini API v1beta (preview models are only on v1beta)
    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1,
      }
    };

    // Try primary model first, then fallback
    async function callGemini(model: string, apiUrl: string) {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
      // Try primary model
      const primaryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
      const data = await callGemini(GEMINI_MODEL, primaryUrl);
      return res.status(200).json(data);
    } catch (primaryError: any) {
      console.warn(`Primary model ${GEMINI_MODEL} failed, trying fallback ${GEMINI_FALLBACK_MODEL}...`);
      try {
        // Fallback to stable model (uses v1 endpoint)
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_FALLBACK_MODEL}:generateContent?key=${apiKey}`;
        const data = await callGemini(GEMINI_FALLBACK_MODEL, fallbackUrl);
        return res.status(200).json({ ...data, _fallback: true });
      } catch (fallbackError: any) {
        console.error("Both primary and fallback Gemini models failed:", fallbackError.message);
        return res.status(500).json({ error: 'Service IA indisponible. Veuillez réessayer plus tard.' });
      }
    }

  } catch (error: any) {
    console.error("Erreur serveur lors de l'extraction IA:", error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
