// Stateless Gemini client. Owns nothing about auth, quota or HTTP
// routing — just the "given parts, return normalized JSON" contract.
// Two-model resilience (primary then fallback) is kept here because
// it's a Gemini-specific concern, not a Photofacto policy.
import { aiInvoiceSchema, normalizeAiResponse } from './aiSchema.js';

export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash';

export interface GeminiPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
}

export interface GeminiCallResult {
  data: ReturnType<typeof normalizeAiResponse>;
  /** Which Gemini model produced the response (the primary or the secondary). */
  model: string;
  /** True when the primary model failed and we recovered via the secondary one. */
  fallback: boolean;
}

async function callGeminiOnce(parts: GeminiPart[], apiKey: string, model: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: aiInvoiceSchema,
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(`gemini_${response.status}:${JSON.stringify(errBody).slice(0, 240)}`);
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('gemini_empty_response');
  }
  return normalizeAiResponse(JSON.parse(text));
}

/**
 * Call Gemini with two-model resilience. Throws if both the primary
 * and the fallback model fail — the caller decides what to do then
 * (refund quota, surface a clean error, or hand off to another
 * provider).
 */
export async function callGemini(
  parts: GeminiPart[],
  apiKey: string,
): Promise<GeminiCallResult> {
  if (!apiKey) {
    throw new Error('gemini_missing_api_key');
  }
  try {
    const data = await callGeminiOnce(parts, apiKey, GEMINI_MODEL);
    return { data, model: GEMINI_MODEL, fallback: false };
  } catch (primaryError) {
    // Don't log the prompt or response body — keep it to the model name
    // and a short safe error code. The caller is responsible for the
    // user-facing message.
    console.warn(
      `[ai] gemini primary ${GEMINI_MODEL} failed, trying ${GEMINI_FALLBACK_MODEL}`,
    );
    const data = await callGeminiOnce(parts, apiKey, GEMINI_FALLBACK_MODEL);
    return { data, model: GEMINI_FALLBACK_MODEL, fallback: true };
  }
}
