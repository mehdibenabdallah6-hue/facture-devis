export async function extractInvoiceData(base64Image: string, mimeType: string, catalogContext?: string) {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'image',
        base64Image,
        mimeType,
        catalogContext
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Erreur HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Erreur lors de l'extraction IA via API:", error);
    throw error;
  }
}

export async function extractDataFromText(promptText: string, catalogContext?: string) {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'text',
        promptText,
        catalogContext
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Erreur HTTP: ${response.status}`);
    }

    return await response.json();
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
      throw new Error("Format de document non supporté");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Erreur HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Erreur lors de l'extraction IA du document:", error);
    throw error;
  }
}
