/**
 * =============================================================================
 * OPENAI PROVIDER — SSoT lazy singleton for Vercel AI SDK
 * =============================================================================
 *
 * Centralizes the OpenAI provider creation used by all AI features
 * (agentic loop, property description generator, future one-shot completions).
 *
 * @module services/ai/openai-provider
 * @enterprise SSoT — `createOpenAI` must only be called here (ADR-294 ratchet)
 * @see ADR-171 (Vercel AI SDK migration)
 */

import 'server-only';
import { createOpenAI } from '@ai-sdk/openai';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';

let _openaiProvider: ReturnType<typeof createOpenAI> | null = null;

/**
 * Lazily-initialized OpenAI provider singleton.
 * Reads `OPENAI_API_KEY` env var at first access.
 * Uses `AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL` from config SSoT.
 */
export function getOpenAIProvider(): ReturnType<typeof createOpenAI> {
  if (!_openaiProvider) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    _openaiProvider = createOpenAI({
      apiKey,
      baseURL: AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL,
    });
  }
  return _openaiProvider;
}
