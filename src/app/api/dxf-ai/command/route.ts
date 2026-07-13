/**
 * @module api/dxf-ai/command
 * @description API route for DXF AI Drawing Assistant commands
 *
 * Receives a user message + canvas context, calls OpenAI Chat Completions API
 * with DXF-specific tools, and returns tool calls + assistant text.
 *
 * Pattern: Single-call (NOT agentic loop) — Phase 1 doesn't need multi-step.
 * Uses same OpenAI infrastructure as agentic-loop.ts but scoped to DXF tools.
 *
 * Pure helpers (validation, tool-call extraction, suggestions, simulated tool
 * results) live in `./command-helpers` to keep this route <300 lines (N.7.1).
 *
 * @see ADR-185 (AI Drawing Assistant)
 * @since 2026-02-17
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { createModuleLogger } from '@/lib/telemetry';
import { DXF_AI_TOOL_DEFINITIONS } from '@/subapps/dxf-viewer/ai-assistant/dxf-tool-definitions';
import { TOPO_TOOL_DEFINITIONS } from '@/subapps/dxf-viewer/ai-assistant/topo-tool-definitions';
import { buildDxfAiSystemPrompt } from '@/subapps/dxf-viewer/ai-assistant/dxf-system-prompt';
import {
  callOpenAI,
  type ChatCompletionMessage,
  type ChatCompletionToolCall,
} from '@/subapps/dxf-viewer/ai-assistant/dxf-openai-call';
import type {
  DxfAiCommandResponse,
  DxfAiToolCall,
} from '@/subapps/dxf-viewer/ai-assistant/types';
import { getErrorMessage } from '@/lib/error-utils';
import {
  MAX_LOOP_ITERATIONS,
  validateRequest,
  extractToolCalls,
  extractSuggestions,
  buildToolResultMessages,
} from './command-helpers';

export const maxDuration = 60;

const logger = createModuleLogger('DXF_AI_COMMAND');

// ============================================================================
// HANDLER
// ============================================================================

async function handler(
  request: NextRequest,
  _ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<DxfAiCommandResponse | { error: string }>> {
  const startTime = Date.now();

  try {
    const body = await request.json() as unknown;
    const validation = validateRequest(body);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { message, canvasContext, chatHistory } = validation.data;

    logger.info(`DXF AI command: "${message.substring(0, 80)}"`);

    // Build messages array
    const systemPrompt = buildDxfAiSystemPrompt(canvasContext);

    // ADR-650 M5β — the topo tool-set rides in the same chat/loop (one AI, many domain
    // tool-sets — exactly the grid-tool-definitions pattern). The client routes topo calls
    // to `executeTopoAiToolCalls`; drawing calls stay with the entity executor.
    const toolDefinitions = [...DXF_AI_TOOL_DEFINITIONS, ...TOPO_TOOL_DEFINITIONS];

    const conversationMessages: Array<ChatCompletionMessage | { role: 'assistant'; content: string | null; tool_calls?: ChatCompletionToolCall[] } | { role: 'tool'; tool_call_id: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add chat history (last N entries)
    for (const entry of chatHistory) {
      conversationMessages.push({
        role: entry.role === 'user' ? 'user' : 'assistant',
        content: entry.content,
      });
    }

    // Add current user message
    conversationMessages.push({ role: 'user', content: message });

    // ── Mini Agentic Loop ──
    // When OpenAI returns tool_calls, we send simulated results back
    // so the model can continue calling more tools (e.g., "draw 3 lines").
    // All tool_calls are collected and returned to the client for execution.
    const allToolCalls: DxfAiToolCall[] = [];
    let finalAnswer = '';
    let iteration = 0;

    while (iteration < MAX_LOOP_ITERATIONS) {
      iteration++;

      const { message: assistantMessage, finishReason } = await callOpenAI(
        conversationMessages as ChatCompletionMessage[],
        toolDefinitions,
        AI_ANALYSIS_DEFAULTS.OPENAI.TIMEOUT_MS,
      );

      // Collect tool calls from this iteration
      const iterationToolCalls = extractToolCalls(assistantMessage.tool_calls);
      allToolCalls.push(...iterationToolCalls);

      // If no tool calls or finish_reason is 'stop' → done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0 || finishReason === 'stop') {
        finalAnswer = assistantMessage.content ?? '';
        break;
      }

      // Model called tools → add assistant message + tool results to conversation
      conversationMessages.push({
        role: 'assistant',
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls,
      });

      const toolResults = buildToolResultMessages(assistantMessage.tool_calls);
      conversationMessages.push(...toolResults);

      // If we have text content alongside tool calls, save it
      if (assistantMessage.content) {
        finalAnswer = assistantMessage.content;
      }
    }

    const suggestions = extractSuggestions(finalAnswer);
    const processingTimeMs = Date.now() - startTime;

    logger.info(`DXF AI response: ${allToolCalls.length} tool calls, ${iteration} iterations, ${processingTimeMs}ms`);

    return NextResponse.json({
      answer: finalAnswer,
      toolCalls: allToolCalls,
      suggestions,
      processingTimeMs,
    });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    logger.error(`DXF AI error: ${errorMessage}`);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}

// ============================================================================
// EXPORT
// ============================================================================

const rateLimitedHandler = withStandardRateLimit(
  withAuth<DxfAiCommandResponse | { error: string }>(handler),
);

export const POST = rateLimitedHandler;
