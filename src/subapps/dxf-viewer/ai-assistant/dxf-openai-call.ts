/**
 * @module ai-assistant/dxf-openai-call
 * @description Shared OpenAI Chat Completions caller for DXF AI routes (SSoT).
 *
 * Extracted from `app/api/dxf-ai/command/route.ts` (ADR-581 §12 — Boy-Scout
 * centralization) so both the Drawing Assistant route AND the Match/Transfer
 * Properties intent route (`app/api/dxf-ai/match/route.ts`) share one caller,
 * one timeout/error contract, zero drift.
 *
 * Raw `fetch` against Chat Completions (same pattern as agentic-loop.ts). Does
 * NOT call `createOpenAI` → does not touch the `openai-provider` SSoT ratchet
 * (that ratchet forbids inline `createOpenAI(`, not raw fetch).
 *
 * @see ADR-185 (AI Drawing Assistant)
 * @see ADR-581 §12 (Optional AI layer for Match Properties)
 */

import 'server-only';
import { safeJsonParse } from '@/lib/json-utils';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import type { AgenticToolDefinition } from '@/services/ai-pipeline/tools/agentic-tool-definitions';

// ============================================================================
// OPENAI CHAT COMPLETIONS TYPES (same pattern as agentic-loop.ts)
// ============================================================================

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionChoice {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: ChatCompletionToolCall[];
  };
  finish_reason: string;
}

/** How the model is allowed to pick tools. Default `'auto'`. */
export type OpenAiToolChoice =
  | 'auto'
  | 'required'
  | 'none'
  | { type: 'function'; function: { name: string } };

/** Optional knobs — defaults preserve the Drawing Assistant behaviour verbatim. */
export interface OpenAiCallOptions {
  /** Force a specific tool (e.g. single-intent extraction). Default `'auto'`. */
  readonly toolChoice?: OpenAiToolChoice;
  /** Allow parallel tool calls. Default `true`. */
  readonly parallelToolCalls?: boolean;
}

// ============================================================================
// OPENAI CALL
// ============================================================================

/**
 * One Chat Completions round-trip with tools. Returns the assistant message +
 * finish reason. Throws on missing key, non-OK response, or timeout.
 */
export async function callOpenAI(
  messages: ChatCompletionMessage[],
  tools: AgenticToolDefinition[],
  timeoutMs: number,
  options?: OpenAiCallOptions,
): Promise<{ message: ChatCompletionChoice['message']; finishReason: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: options?.toolChoice ?? 'auto',
        parallel_tool_calls: options?.parallelToolCalls ?? true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMsg = `OpenAI error (${response.status})`;
      const errorPayload = safeJsonParse<{ error?: { message?: string } }>(errorText, null as unknown as { error?: { message?: string } });
      if (errorPayload?.error?.message) {
        errorMsg = errorPayload.error.message;
      } else if (errorText.length > 0 && errorText.length < 500) {
        errorMsg += `: ${errorText}`;
      }
      throw new Error(errorMsg);
    }

    const payload = await response.json() as { choices?: ChatCompletionChoice[] };
    const choice = payload.choices?.[0];

    if (!choice) {
      throw new Error('No response from OpenAI');
    }

    return {
      message: choice.message,
      finishReason: choice.finish_reason,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('OpenAI request timed out');
    }
    throw err;
  }
}
