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

import { isRecord, isNonEmptyTrimmedString } from '@/lib/type-guards';
import { getErrorMessage } from '@/lib/error-utils';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { PIPELINE_REPLY_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('ai-reply-openai');

// ============================================================================
// OUTPUT EXTRACTION
// ============================================================================

/**
 * Extract output text from OpenAI Responses API payload.
 * Mirrors the pattern from OpenAIAnalysisProvider.
 */
export function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  // Direct output_text field (shortcut in newer API versions)
  const outputText = payload.output_text;
  if (isNonEmptyTrimmedString(outputText)) {
    return outputText.trim();
  }

  // Walk the output array for message content
  const output = payload.output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item.type !== 'message') continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;

    for (const entry of content) {
      if (!isRecord(entry)) continue;
      if (entry.type !== 'output_text') continue;
      const text = entry.text;
      if (isNonEmptyTrimmedString(text)) {
        return text.trim();
      }
    }
  }

  return null;
}

// ============================================================================
// OPENAI API CALL
// ============================================================================

interface OpenAIErrorPayload {
  error?: {
    message?: string;
    type?: string;
  };
}

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

  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;
  const timeoutMs = PIPELINE_REPLY_CONFIG.TIMEOUT_MS;
  const maxRetries = PIPELINE_REPLY_CONFIG.MAX_RETRIES;

  const requestBody = {
    model,
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

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${baseUrl}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as OpenAIErrorPayload;
        const message = errorPayload.error?.message || `OpenAI error (${response.status})`;
        throw new Error(message);
      }

      const payload: unknown = await response.json();
      return extractOutputText(payload);
    } catch (error) {
      if (attempt >= maxRetries) {
        logger.error('OpenAI reply generation failed after retries', {
          requestId,
          error: getErrorMessage(error),
        });
        return null;
      }
      attempt += 1;
    }
  }

  return null;
}
