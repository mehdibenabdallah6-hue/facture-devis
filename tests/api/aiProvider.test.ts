// Unit tests for the server-side AI provider orchestration.
//
// Strategy: mock the two underlying clients (callDeepseek, callGemini)
// at the aiProvider boundary so we test the routing/fallback policy
// without touching the real HTTP layer or any remote API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/deepseekClient.js', () => ({
  callDeepseek: vi.fn(),
  DEEPSEEK_MODEL: 'deepseek-chat',
}));
vi.mock('../../api/_lib/geminiClient.js', () => ({
  callGemini: vi.fn(),
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_FALLBACK_MODEL: 'gemini-2.0-flash',
}));

import { extractFromText, extractFromImage } from '../../api/_lib/aiProvider';
import { callDeepseek } from '../../api/_lib/deepseekClient.js';
import { callGemini } from '../../api/_lib/geminiClient.js';

const sampleData = {
  clientName: 'Mme Dupont',
  clientAddress: '',
  date: '',
  notes: '',
  items: [
    { description: 'pose vasque', quantity: 1, unitPrice: 280, vatRate: 10, needsReview: true, source: 'ai_suggestion' as const },
  ],
  needsReview: true,
};

const ENV_KEYS = [
  'AI_TEXT_PROVIDER',
  'AI_VISION_PROVIDER',
  'AI_FALLBACK_PROVIDER',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
];
const previousEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) previousEnv[k] = process.env[k];
  // Sane defaults for a green-path test.
  process.env.AI_TEXT_PROVIDER = 'deepseek';
  process.env.AI_VISION_PROVIDER = 'gemini';
  process.env.AI_FALLBACK_PROVIDER = 'gemini';
  process.env.DEEPSEEK_API_KEY = 'ds-test';
  process.env.GEMINI_API_KEY = 'gem-test';
  vi.clearAllMocks();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (previousEnv[k] === undefined) delete process.env[k];
    else process.env[k] = previousEnv[k];
  }
});

describe('extractFromText', () => {
  it('routes to DeepSeek when AI_TEXT_PROVIDER=deepseek', async () => {
    vi.mocked(callDeepseek).mockResolvedValue({ data: sampleData, model: 'deepseek-chat' });

    const result = await extractFromText({
      systemPrompt: 'sys',
      userPrompt: 'pose vasque + déplacement',
    });

    expect(callDeepseek).toHaveBeenCalledTimes(1);
    expect(callGemini).not.toHaveBeenCalled();
    expect(result.provider).toBe('deepseek');
    expect(result.fallback).toBe(false);
  });

  it('falls back to Gemini once when DeepSeek throws', async () => {
    vi.mocked(callDeepseek).mockRejectedValue(new Error('deepseek_502:bad gateway'));
    vi.mocked(callGemini).mockResolvedValue({
      data: sampleData,
      model: 'gemini-2.5-flash',
      fallback: false,
    });

    const result = await extractFromText({
      systemPrompt: 'sys',
      userPrompt: 'texte',
    });

    expect(callDeepseek).toHaveBeenCalledTimes(1);
    expect(callGemini).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('gemini');
    expect(result.fallback).toBe(true);
  });

  it('falls back to Gemini when DEEPSEEK_API_KEY is missing', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    vi.mocked(callGemini).mockResolvedValue({
      data: sampleData,
      model: 'gemini-2.5-flash',
      fallback: false,
    });

    const result = await extractFromText({
      systemPrompt: 'sys',
      userPrompt: 'texte',
    });

    expect(callDeepseek).not.toHaveBeenCalled();
    expect(callGemini).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('gemini');
    expect(result.fallback).toBe(true);
  });

  it('throws ai_text_unavailable when both providers are unavailable', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await expect(
      extractFromText({ systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow(/ai_text_unavailable/);
    expect(callDeepseek).not.toHaveBeenCalled();
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('does not call any provider twice on success (single quota worth)', async () => {
    vi.mocked(callDeepseek).mockResolvedValue({ data: sampleData, model: 'deepseek-chat' });

    await extractFromText({ systemPrompt: 's', userPrompt: 'u' });

    expect(callDeepseek).toHaveBeenCalledTimes(1);
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('only calls Gemini once on fallback (no infinite loop)', async () => {
    vi.mocked(callDeepseek).mockRejectedValue(new Error('deepseek_invalid_json'));
    vi.mocked(callGemini).mockRejectedValue(new Error('gemini_503:down'));

    await expect(
      extractFromText({ systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow();

    expect(callDeepseek).toHaveBeenCalledTimes(1);
    expect(callGemini).toHaveBeenCalledTimes(1);
  });

  it('honours AI_FALLBACK_PROVIDER empty (no fallback)', async () => {
    process.env.AI_FALLBACK_PROVIDER = '';
    vi.mocked(callDeepseek).mockRejectedValue(new Error('deepseek_500'));

    await expect(
      extractFromText({ systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toThrow(/ai_text_unavailable/);
    expect(callGemini).not.toHaveBeenCalled();
  });
});

describe('extractFromImage', () => {
  it('routes images to Gemini regardless of AI_TEXT_PROVIDER', async () => {
    process.env.AI_TEXT_PROVIDER = 'deepseek';
    vi.mocked(callGemini).mockResolvedValue({
      data: sampleData,
      model: 'gemini-2.5-flash',
      fallback: false,
    });

    const result = await extractFromImage({
      base64: 'AAAA',
      mimeType: 'image/jpeg',
      promptText: 'photo prompt',
    });

    expect(callDeepseek).not.toHaveBeenCalled();
    expect(callGemini).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('gemini');
  });

  it('refuses to route vision to a non-Gemini provider', async () => {
    process.env.AI_VISION_PROVIDER = 'deepseek';

    await expect(
      extractFromImage({ base64: 'a', mimeType: 'image/png', promptText: 'p' }),
    ).rejects.toThrow(/ai_vision_unsupported_provider/);
    expect(callDeepseek).not.toHaveBeenCalled();
    expect(callGemini).not.toHaveBeenCalled();
  });

  it('throws when GEMINI_API_KEY is missing for image input', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      extractFromImage({ base64: 'a', mimeType: 'image/png', promptText: 'p' }),
    ).rejects.toThrow(/gemini_missing_api_key/);
  });
});
