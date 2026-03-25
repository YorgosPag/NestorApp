/**
 * OpenAI Chat Completions client for the agentic loop.
 * Extracted for Google file size standard (≤400 lines per general file).
 * @module services/ai-pipeline/agentic-openai-client
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import type { AgenticToolDefinition } from './tools/agentic-tool-definitions';
import { safeJsonParse } from '@/lib/json-utils';

// ── Types ──

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ChatCompletionToolCall[];
  tool_call_id?: string;
}

export interface ChatCompletionToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatCompletionChoice {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: ChatCompletionToolCall[];
  };
  finish_reason: string;
}

// ── API Call ──

export async function callChatCompletions(
  messages: ChatCompletionMessage[],
  tools: AgenticToolDefinition[],
  timeoutMs: number
): Promise<{
  message: ChatCompletionChoice['message'];
  finishReason: string;
  usage: OpenAIUsage;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const model = AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;

  const requestBody = {
    model,
    messages,
    tools,
    tool_choice: 'auto' as const,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
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

    const payload = await response.json() as {
      choices?: ChatCompletionChoice[];
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const choice = payload.choices?.[0];
    if (!choice) {
      throw new Error('OpenAI returned no choices');
    }

    const usage: OpenAIUsage = payload.usage
      ? { prompt_tokens: payload.usage.prompt_tokens, completion_tokens: payload.usage.completion_tokens, total_tokens: payload.usage.total_tokens }
      : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return {
      message: choice.message,
      finishReason: choice.finish_reason,
      usage,
    };
  } finally {
    clearTimeout(timeout);
  }
}
