/**
 * =============================================================================
 * AGENTIC LOOP — Multi-Step Reasoning Engine (Chat Completions API)
 * =============================================================================
 *
 * Implements the agentic loop: AI calls tools iteratively until it produces
 * a final text answer. Each iteration:
 *   1. Send messages + tools to OpenAI Chat Completions API
 *   2. If AI requests tool calls → execute them, append results
 *   3. If AI returns text → done
 *
 * Uses Chat Completions API (not Responses API) because:
 * - Well-established multi-turn tool calling with tool_call_id tracking
 * - Proper assistant + tool message format for iterative reasoning
 * - Better error handling for complex multi-step flows
 *
 * Safety limits:
 * - maxIterations: 5 (prevent infinite loops)
 * - totalTimeoutMs: 50_000 (within Vercel 60s limit)
 * - perCallTimeoutMs: 15_000 (per OpenAI call)
 * - maxToolResultChars: 8000 (truncate large results)
 *
 * @module services/ai-pipeline/agentic-loop
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';
// RBAC v2 — force recompile
import { AI_ANALYSIS_DEFAULTS, AI_COST_CONFIG } from '@/config/ai-analysis-config';
import { getAgenticToolExecutor } from './tools/agentic-tool-executor';
import type { AgenticContext } from './tools/agentic-tool-executor';
import type { AgenticToolDefinition } from './tools/agentic-tool-definitions';
// ADR-173: Prompt enhancement with learned patterns
import { enhanceSystemPrompt } from './prompt-enhancer';
// System prompt builder (extracted for Google file size standard)
import { buildAgenticSystemPrompt } from './agentic-system-prompt';
// Reply post-processing utilities (extracted for Google file size standard)
import { extractSuggestions, cleanAITextReply } from './agentic-reply-utils';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { captureMessage as sentryCaptureMessage } from '@/lib/telemetry/sentry';

const logger = createModuleLogger('AGENTIC_LOOP');

// ============================================================================
// TYPES
// ============================================================================

export interface AgenticLoopConfig {
  maxIterations: number;
  totalTimeoutMs: number;
  perCallTimeoutMs: number;
  maxToolResultChars: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    name: string;
    args: string;
    result: string;
  }>;
}

/** ADR-259A: Token usage from a single OpenAI API call */
export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AgenticResult {
  answer: string;
  suggestions: string[];
  toolCalls: Array<{
    name: string;
    args: string;
    result: string;
  }>;
  iterations: number;
  totalDurationMs: number;
  /** ADR-259A: Aggregated token usage across all iterations */
  totalUsage: OpenAIUsage;
}

// ── Chat Completions API types ──

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Only for assistant messages with tool calls */
  tool_calls?: ChatCompletionToolCall[];
  /** Only for tool result messages */
  tool_call_id?: string;
}

interface ChatCompletionToolCall {
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

const DEFAULT_CONFIG: AgenticLoopConfig = {
  // SSoT: AI_COST_CONFIG.LIMITS — overridden per role in executeAgenticLoop()
  maxIterations: AI_COST_CONFIG.LIMITS.ADMIN_MAX_ITERATIONS,
  // 55s for Vercel (60s limit), but localhost has no limit
  totalTimeoutMs: process.env.NODE_ENV === 'production' ? 55_000 : 120_000,
  perCallTimeoutMs: 30_000,
  maxToolResultChars: 12_000,
};

// ============================================================================
// OPENAI CHAT COMPLETIONS API CALL
// ============================================================================
// System prompt builder extracted to agentic-system-prompt.ts (Google file size standard)

async function callChatCompletions(
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

// ============================================================================
// MAIN AGENTIC LOOP
// ============================================================================

/**
 * Execute the agentic loop — AI reasons with tools iteratively.
 *
 * @param userMessage - The user's message
 * @param chatHistory - Previous conversation messages
 * @param tools - Available tool definitions
 * @param context - Execution context (companyId, permissions, etc.)
 * @param config - Loop configuration overrides
 * @returns Agentic result with answer and tool call history
 */
export async function executeAgenticLoop(
  userMessage: string,
  chatHistory: ChatMessage[],
  tools: AgenticToolDefinition[],
  context: AgenticContext,
  config?: Partial<AgenticLoopConfig>
): Promise<AgenticResult> {
  // ADR-259A: Role-aware maxIterations (customer: 8, admin: 15)
  const roleMaxIterations = context.isAdmin
    ? AI_COST_CONFIG.LIMITS.ADMIN_MAX_ITERATIONS
    : AI_COST_CONFIG.LIMITS.CUSTOMER_MAX_ITERATIONS;
  const cfg = { ...DEFAULT_CONFIG, maxIterations: roleMaxIterations, ...config };
  const startTime = Date.now();
  const executor = getAgenticToolExecutor();
  const allToolCalls: AgenticResult['toolCalls'] = [];
  // ADR-259A: Aggregate token usage across all iterations
  const totalUsage: OpenAIUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  // ADR-173: Fetch learned patterns for dynamic prompt enhancement
  const learnedPatterns = await enhanceSystemPrompt(userMessage);

  // Build message history for OpenAI Chat Completions
  const messages: ChatCompletionMessage[] = [
    {
      role: 'system',
      content: buildAgenticSystemPrompt(context, chatHistory, learnedPatterns),
    },
  ];

  // Add chat history as alternating user/assistant messages
  // Tool call context injected as system note (not inside assistant content — prevents AI from copying technical IDs into replies)
  const toolContextParts: string[] = [];

  for (const msg of chatHistory.slice(-6)) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });

    // Collect document IDs from tool calls for internal context (system-level, not user-facing)
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        const resultStr = tc.result ?? '';
        const idMatches = resultStr.match(/"id"\s*:\s*"([^"]+)"/g);
        const ids = idMatches
          ? idMatches.map(m => m.replace(/"id"\s*:\s*"/, '').replace(/"$/, '')).slice(0, 3)
          : [];
        if (ids.length > 0) {
          toolContextParts.push(`${tc.name}: ${ids.join(', ')}`);
        }
      }
    }
  }

  // Inject tool context as system note (AI sees it for lookups, but won't echo it in replies)
  if (toolContextParts.length > 0) {
    messages.push({
      role: 'system',
      content: `[Εσωτερικό context — ΜΗΝ το αναφέρεις στον χρήστη] Document IDs από προηγούμενα tool calls: ${toolContextParts.join('; ')}`,
    });
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  logger.info('Starting agentic loop', {
    requestId: context.requestId,
    messageLength: userMessage.length,
    historyCount: chatHistory.length,
    maxIterations: cfg.maxIterations,
  });

  for (let iteration = 0; iteration < cfg.maxIterations; iteration++) {
    // Check total timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= cfg.totalTimeoutMs) {
      logger.warn('Agentic loop timeout', {
        requestId: context.requestId,
        iteration,
        elapsedMs: elapsed,
      });
      // ADR-259D: Capture timeout as Sentry warning
      sentryCaptureMessage('Agentic loop timeout', 'warning', {
        tags: { component: 'agentic-loop', channel: context.channel, isAdmin: String(context.isAdmin) },
        extra: { requestId: context.requestId, iteration, elapsedMs: elapsed, toolCalls: allToolCalls.length },
      });
      return {
        answer: 'Η αναζήτηση πήρε πολύ χρόνο. Δοκίμασε μια πιο συγκεκριμένη ερώτηση.',
        suggestions: [],
        toolCalls: allToolCalls,
        iterations: iteration + 1,
        totalDurationMs: Date.now() - startTime,
        totalUsage,
      };
    }

    // Call OpenAI Chat Completions
    const remainingTimeMs = Math.min(
      cfg.perCallTimeoutMs,
      cfg.totalTimeoutMs - elapsed
    );

    const response = await callChatCompletions(messages, tools, remainingTimeMs);

    // ADR-259A: Aggregate token usage
    totalUsage.prompt_tokens += response.usage.prompt_tokens;
    totalUsage.completion_tokens += response.usage.completion_tokens;
    totalUsage.total_tokens += response.usage.total_tokens;

    // Check for tool calls
    const toolCalls = response.message.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      // Add the assistant message WITH tool_calls to conversation
      messages.push({
        role: 'assistant',
        content: response.message.content ?? null,
        tool_calls: toolCalls,
      });

      // Execute each tool call and add results
      for (const tc of toolCalls) {
        const toolName = tc.function.name;
        const argsString = tc.function.arguments;
        let toolArgs: Record<string, unknown> = {};

        toolArgs = safeJsonParse<Record<string, unknown>>(argsString, {});

        logger.info('Executing tool call', {
          requestId: context.requestId,
          iteration,
          tool: toolName,
          callId: tc.id,
        });

        const result = await executor.executeTool(toolName, toolArgs, context);

        const resultStr = JSON.stringify(result.data ?? result.error ?? 'no data');
        const truncatedResult = resultStr.length > cfg.maxToolResultChars
          ? resultStr.substring(0, cfg.maxToolResultChars) + '...[truncated]'
          : resultStr;

        // ADR-259C: Append warning to tool result so AI knows data may be degraded
        const toolResultContent = result.warning
          ? `${truncatedResult}\n⚠️ WARNING: ${result.warning}`
          : truncatedResult;

        allToolCalls.push({
          name: toolName,
          args: argsString,
          result: truncatedResult,
        });

        // Add tool result message with matching tool_call_id
        messages.push({
          role: 'tool',
          content: toolResultContent,
          tool_call_id: tc.id,
        });
      }

      continue; // Next iteration — AI processes tool results
    }

    // No tool calls — AI generated final text answer
    const answer = response.message.content
      ?? 'Δεν μπόρεσα να επεξεργαστώ το αίτημα.';

    // Clean potential JSON wrapping
    const cleanedAnswer = cleanAITextReply(answer);

    // Phase 6B: Extract suggested follow-up actions from AI response
    const { cleanAnswer: finalAnswer, suggestions } = extractSuggestions(cleanedAnswer);

    logger.info('Agentic loop completed', {
      requestId: context.requestId,
      iterations: iteration + 1,
      toolCallsTotal: allToolCalls.length,
      suggestionsCount: suggestions.length,
      totalDurationMs: Date.now() - startTime,
    });

    return {
      answer: finalAnswer,
      suggestions,
      toolCalls: allToolCalls,
      iterations: iteration + 1,
      totalDurationMs: Date.now() - startTime,
      totalUsage,
    };
  }

  // Max iterations reached — ask AI to summarize what it found so far
  logger.warn('Agentic loop max iterations, requesting summary', {
    requestId: context.requestId,
    iterations: cfg.maxIterations,
    toolCallsTotal: allToolCalls.length,
  });

  // Final attempt: ask AI to answer with whatever data it collected
  try {
    messages.push({
      role: 'user',
      content: 'ΣΤΑΜΑΤΑ τις αναζητήσεις. Με βάση τα δεδομένα που ΕΧΕΙΣ ΗΔΗ συλλέξει, δώσε την καλύτερη δυνατή απάντηση στον χρήστη. Αν δεν βρήκες τίποτα, πες ακριβώς τι δεν μπόρεσες να βρεις.',
    });

    const summaryResponse = await callChatCompletions(messages, [], cfg.perCallTimeoutMs);
    // ADR-259A: Aggregate summary call usage
    totalUsage.prompt_tokens += summaryResponse.usage.prompt_tokens;
    totalUsage.completion_tokens += summaryResponse.usage.completion_tokens;
    totalUsage.total_tokens += summaryResponse.usage.total_tokens;
    const summaryContent = summaryResponse.message?.content;

    if (summaryContent) {
      const { cleanAnswer: summaryAnswer, suggestions: summarySuggestions } = extractSuggestions(summaryContent);
      return {
        answer: summaryAnswer,
        suggestions: summarySuggestions,
        toolCalls: allToolCalls,
        iterations: cfg.maxIterations,
        totalDurationMs: Date.now() - startTime,
        totalUsage,
      };
    }
  } catch {
    // Non-fatal — fall through to default message
  }

  // ADR-259D: Capture max iterations exhaustion as Sentry warning
  sentryCaptureMessage('Agentic loop exhausted max iterations', 'warning', {
    tags: { component: 'agentic-loop', channel: context.channel, isAdmin: String(context.isAdmin) },
    extra: { requestId: context.requestId, maxIterations: cfg.maxIterations, toolCalls: allToolCalls.length, totalTokens: totalUsage.total_tokens },
  });

  return {
    answer: 'Η αναζήτηση ήταν πολύπλοκη αλλά δεν κατάφερα να ολοκληρώσω. Δοκίμασε πιο συγκεκριμένη ερώτηση.',
    suggestions: [],
    toolCalls: allToolCalls,
    iterations: cfg.maxIterations,
    totalDurationMs: Date.now() - startTime,
    totalUsage,
  };
}

// ============================================================================

