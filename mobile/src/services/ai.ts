/**
 * AI Service for Mobile App
 * Calls Photofacto's Vercel Functions for AI extraction
 */

const API_BASE_URL = 'https://photofacto.fr/api';

export async function extractFromImage(base64Image: string, mimeType: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'image',
        base64Image,
        mimeType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors de l\'analyse IA');
    }

    return await response.json();
  } catch (error) {
    console.error('[AI Service Mobile]', error);
    throw error;
  }
}

export async function extractFromText(text: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'text',
        promptText: text,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erreur lors de l\'analyse vocale');
    }

    return await response.json();
  } catch (error) {
    console.error('[AI Service Mobile Text]', error);
    throw error;
  }
}
