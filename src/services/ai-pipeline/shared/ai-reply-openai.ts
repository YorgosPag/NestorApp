/**
 * =============================================================================
 * 🏢 AI REPLY GENERATOR — OPENAI API LAYER
 * =============================================================================
 *
 * Extracted from ai-reply-generator.ts (ADR-065 Phase 5)
 * Low-level OpenAI Responses API call for free-form text generation
 *
 * @module services/ai-pipeline/shared/ai-reply-openai
 * @see ADR-080 (Pipeline Implementation)
 */

import 'server-only';

import { getErrorMessage } from '@/lib/error-utils';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { PIPELINE_REPLY_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import {
  executeResponsesRequest,
  extractOutputText,
  type ResponsesRequestBody,
} from '@/services/ai/openai-responses';

const logger = createModuleLogger('ai-reply-openai');

// ============================================================================
// OPENAI API CALL
// ============================================================================

/**
 * Call OpenAI Responses API for free-form text generation.
 * No JSON schema — just system prompt + user prompt → plain text reply.
 * Retries on failure up to PIPELINE_REPLY_CONFIG.MAX_RETRIES times.
 */
export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  requestId: string,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set — skipping AI reply generation', { requestId });
    return null;
  }

  const request: ResponsesRequestBody = {
    model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: userPrompt }],
      },
    ],
  };

  try {
    const payload = await executeResponsesRequest(
      {
        apiKey,
        baseUrl: AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL,
        timeoutMs: PIPELINE_REPLY_CONFIG.TIMEOUT_MS,
        maxRetries: PIPELINE_REPLY_CONFIG.MAX_RETRIES,
      },
      request,
    );
    return extractOutputText(payload);
  } catch (error) {
    logger.error('OpenAI reply generation failed after retries', {
      requestId,
      error: getErrorMessage(error),
    });
    return null;
  }
}
