// Client-side wrapper around the /api/gemini serverless endpoint.
//
// Why an Authorization header? The server enforces the AI quota
// (monthlyAiUsageCount) atomically — every call must be tied to a Firebase
// uid. Without a valid Bearer token the endpoint replies 401 by design.
// We re-fetch the ID token on every call so it cannot go stale (Firebase
// rotates them roughly every hour).
import { auth } from '../firebase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }
  const token = await current.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function postGemini(body: any, signal?: AbortSignal) {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const error: any = new Error(err.error || `Erreur HTTP: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

export async function extractInvoiceData(
  base64Image: string,
  mimeType: string,
  catalogContext?: string,
  promptText?: string
) {
  try {
    return await postGemini({
      mode: 'image',
      base64Image,
      mimeType,
      catalogContext,
      promptText,
    });
  } catch (error) {
    console.error("Erreur lors de l'extraction IA via API:", error);
    throw error;
  }
}

export async function extractDataFromText(promptText: string, catalogContext?: string) {
  try {
    return await postGemini({
      mode: 'text',
      promptText,
      catalogContext,
    });
  } catch (error) {
    console.error("Erreur lors de l'extraction IA via API (texte):", error);
    throw error;
  }
}

export async function extractFromDocument(
  base64Data: string | null,
  mimeType: string,
  textContent?: string,
  catalogContext?: string
) {
  try {
    const body: any = { mode: 'document', catalogContext };

    if (mimeType === 'application/pdf' && base64Data) {
      // PDF: send as binary inline data
      body.base64Image = base64Data;
      body.mimeType = mimeType;
    } else if (textContent) {
      // Excel: send pre-extracted text
      body.promptText = textContent;
    } else {
      throw new Error('Format de document non supporté');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
      return await postGemini(body, controller.signal);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Erreur lors de l'extraction IA du document:", error);
    throw error;
  }
}
