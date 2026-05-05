// Stateless DeepSeek client (text-only). DeepSeek is OpenAI-compatible,
// so we use the chat-completions endpoint with `response_format`
// json_object and parse the assistant content as JSON. We never send
// images here — vision stays on Gemini.
import { aiInvoiceSchemaPromptHint, normalizeAiResponse } from './aiSchema.js';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
export const DEEPSEEK_MODEL = 'deepseek-chat';

export interface DeepseekCallResult {
  data: ReturnType<typeof normalizeAiResponse>;
  model: string;
}

/**
 * Send a text-only prompt to DeepSeek and parse a strict-JSON response
 * matching the Photofacto invoice schema. Throws on missing key,
 * non-2xx response, or invalid JSON.
 */
export async function callDeepseek(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
): Promise<DeepseekCallResult> {
  if (!apiKey) {
    throw new Error('deepseek_missing_api_key');
  }

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      // We embed the schema hint in the system message rather than
      // relying on a strict JSON-schema parameter (DeepSeek's
      // response_format: json_object guarantees JSON, not the shape).
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'system',
          content: aiInvoiceSchemaPromptHint,
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(
      `deepseek_${response.status}:${errBody.slice(0, 240)}`,
    );
  }

  const result = await response.json();
  const text = result?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('deepseek_empty_response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // DeepSeek occasionally wraps the JSON in markdown despite
    // response_format. Try to recover by stripping fences before
    // giving up.
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '');
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('deepseek_invalid_json');
    }
  }

  return { data: normalizeAiResponse(parsed), model: DEEPSEEK_MODEL };
}
