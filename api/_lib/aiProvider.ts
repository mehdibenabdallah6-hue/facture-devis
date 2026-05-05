// Server-only AI orchestration for invoice extraction.
//
// Routing rules (driven by env vars, default values keep behaviour
// backwards-compatible):
//   - text / dictée  → AI_TEXT_PROVIDER   (default: 'deepseek')
//   - photo / image  → AI_VISION_PROVIDER (default: 'gemini')
//   - fallback       → AI_FALLBACK_PROVIDER (default: 'gemini')
//
// The fallback only applies when the *text* provider fails (DeepSeek
// being the typical primary). Vision stays on Gemini exclusively —
// DeepSeek is text-only at the time of writing and we don't want to
// silently degrade vision quality. If the vision provider fails we
// surface a clean error and let the caller refund the quota.
//
// Quota policy: this module performs **at most one** AI call worth of
// user-quota consumption per `extract*` call. Internal fallbacks (e.g.
// DeepSeek → Gemini text) are part of the same single reservation —
// they never count as two.
import { callGemini, type GeminiPart } from './geminiClient.js';
import { callDeepseek } from './deepseekClient.js';
import { aiInvoiceSchemaPromptHint, normalizeAiResponse } from './aiSchema.js';

export type AiInputType = 'text' | 'image';

export interface AiResult {
  data: ReturnType<typeof normalizeAiResponse>;
  /** Which provider actually answered. */
  provider: 'deepseek' | 'gemini';
  /** Concrete model name (for logs). */
  model: string;
  /** True when the primary text provider failed and we recovered via the fallback. */
  fallback: boolean;
}

interface TextInput {
  /** A short system prompt describing the task (invoice / quote / catalog…). */
  systemPrompt: string;
  /** The artisan's notes / dictation / pre-extracted spreadsheet text. */
  userPrompt: string;
  /** Catalogue prompt block, already formatted by the caller. May be empty. */
  catalogPrompt?: string;
}

interface ImageInput {
  base64: string;
  mimeType: string;
  /** Optional companion text (the artisan's description on top of the photo). */
  promptText: string;
  /** Catalogue prompt block, already formatted by the caller. May be empty. */
  catalogPrompt?: string;
}

function envProvider(name: string, fallback: string) {
  const v = (process.env[name] || '').trim().toLowerCase();
  return v || fallback;
}

function assembleTextUserPrompt(input: TextInput): string {
  return `${input.userPrompt}${input.catalogPrompt || ''}`;
}

/**
 * Run a text/dictée extraction. Tries the configured text provider
 * first (default DeepSeek), then falls back to the configured fallback
 * (default Gemini) — but at most once. Both attempts share the same
 * user-quota slot reserved by the caller.
 */
export async function extractFromText(input: TextInput): Promise<AiResult> {
  const textProvider = envProvider('AI_TEXT_PROVIDER', 'deepseek');
  // AI_FALLBACK_PROVIDER='' explicitly disables the fallback — do not
  // substitute the default in that case (only use the default when the
  // variable is completely absent from the environment).
  const rawFallback = process.env.AI_FALLBACK_PROVIDER;
  const fallbackProvider =
    rawFallback === undefined ? 'gemini' : rawFallback.trim().toLowerCase();
  const deepseekKey = process.env.DEEPSEEK_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';

  const userPrompt = assembleTextUserPrompt(input);

  // Helper closures so the fallback path is symmetrical with the primary.
  const tryDeepseek = async (): Promise<AiResult> => {
    const { data, model } = await callDeepseek(
      input.systemPrompt,
      userPrompt,
      deepseekKey,
    );
    return { data, provider: 'deepseek', model, fallback: false };
  };

  const tryGeminiText = async (fromFallback: boolean): Promise<AiResult> => {
    // Gemini accepts the schema as a structured response_format, but to
    // share one prompt-shape across providers we still embed the hint.
    const parts: GeminiPart[] = [
      {
        text: `${input.systemPrompt}\n\n${aiInvoiceSchemaPromptHint}\n\n${userPrompt}`,
      },
    ];
    const { data, model } = await callGemini(parts, geminiKey);
    return { data, provider: 'gemini', model, fallback: fromFallback };
  };

  // Primary: text provider.
  if (textProvider === 'deepseek') {
    if (!deepseekKey) {
      // Treat missing key as a failure of the primary, then defer to
      // the fallback (if any) — this keeps the platform usable while
      // the operator is still rolling out DeepSeek.
      console.warn('[ai] DEEPSEEK_API_KEY missing, trying fallback');
    } else {
      try {
        return await tryDeepseek();
      } catch (err: any) {
        console.warn(
          `[ai] deepseek text call failed (${safeErrorCode(err)}), trying fallback`,
        );
      }
    }
    if (fallbackProvider === 'gemini' && geminiKey) {
      return tryGeminiText(true);
    }
    throw new Error('ai_text_unavailable');
  }

  // Primary: gemini directly.
  if (textProvider === 'gemini') {
    if (!geminiKey) throw new Error('gemini_missing_api_key');
    return tryGeminiText(false);
  }

  throw new Error(`ai_text_unknown_provider:${textProvider}`);
}

/**
 * Run a vision extraction. Vision stays on Gemini — DeepSeek does not
 * expose a vision endpoint we trust at this date, so we never try to
 * route an image through it. If Gemini fails, the caller refunds the
 * quota.
 */
export async function extractFromImage(input: ImageInput): Promise<AiResult> {
  const visionProvider = envProvider('AI_VISION_PROVIDER', 'gemini');
  const geminiKey = process.env.GEMINI_API_KEY || '';

  if (visionProvider !== 'gemini') {
    throw new Error(`ai_vision_unsupported_provider:${visionProvider}`);
  }
  if (!geminiKey) throw new Error('gemini_missing_api_key');

  const parts: GeminiPart[] = [
    { text: `${input.promptText}${input.catalogPrompt || ''}` },
    { inlineData: { data: input.base64, mimeType: input.mimeType } },
  ];

  const { data, model, fallback } = await callGemini(parts, geminiKey);
  return { data, provider: 'gemini', model, fallback };
}

/**
 * Strip everything but the provider's safe error code from a thrown
 * Error message. Avoids accidentally logging response bodies that may
 * contain echoed prompt fragments.
 */
function safeErrorCode(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // `deepseek_429:...` → `deepseek_429`
  const colonIdx = msg.indexOf(':');
  return colonIdx > 0 ? msg.slice(0, colonIdx) : msg.slice(0, 60);
}
