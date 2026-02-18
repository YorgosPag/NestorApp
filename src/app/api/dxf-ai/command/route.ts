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
import { buildDxfAiSystemPrompt } from '@/subapps/dxf-viewer/ai-assistant/dxf-system-prompt';
import type {
  DxfAiCommandRequest,
  DxfAiCommandResponse,
  DxfAiToolCall,
  DxfAiToolName,
  DxfCanvasContext,
  DxfAiChatHistoryEntry,
} from '@/subapps/dxf-viewer/ai-assistant/types';
import { DXF_AI_LIMITS } from '@/subapps/dxf-viewer/config/ai-assistant-config';
import type { AgenticToolDefinition } from '@/services/ai-pipeline/tools/agentic-tool-definitions';

export const maxDuration = 60;

const logger = createModuleLogger('DXF_AI_COMMAND');

// ============================================================================
// OPENAI CHAT COMPLETIONS TYPES (same pattern as agentic-loop.ts)
// ============================================================================

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_TOOL_NAMES = new Set<string>([
  'draw_line',
  'draw_rectangle',
  'draw_circle',
  'draw_polyline',
  'query_entities',
  'undo_action',
]);

function isValidToolName(name: string): name is DxfAiToolName {
  return VALID_TOOL_NAMES.has(name);
}

function validateRequest(body: unknown): {
  valid: true;
  data: DxfAiCommandRequest;
} | {
  valid: false;
  error: string;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const req = body as Record<string, unknown>;

  if (typeof req.message !== 'string' || req.message.trim().length === 0) {
    return { valid: false, error: 'Message is required' };
  }

  if (req.message.length > DXF_AI_LIMITS.MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds ${DXF_AI_LIMITS.MAX_MESSAGE_LENGTH} characters` };
  }

  if (!req.canvasContext || typeof req.canvasContext !== 'object') {
    return { valid: false, error: 'canvasContext is required' };
  }

  const ctx = req.canvasContext as Record<string, unknown>;
  if (typeof ctx.entityCount !== 'number' || !Array.isArray(ctx.layers)) {
    return { valid: false, error: 'Invalid canvasContext format' };
  }

  return {
    valid: true,
    data: {
      message: req.message as string,
      canvasContext: req.canvasContext as DxfCanvasContext,
      chatHistory: Array.isArray(req.chatHistory)
        ? (req.chatHistory as DxfAiChatHistoryEntry[]).slice(-DXF_AI_LIMITS.MAX_HISTORY_ENTRIES)
        : [],
    },
  };
}

// ============================================================================
// OPENAI CALL
// ============================================================================

async function callOpenAI(
  messages: ChatCompletionMessage[],
  tools: AgenticToolDefinition[],
  timeoutMs: number,
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
        tool_choice: 'auto' as const,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMsg = `OpenAI error (${response.status})`;
      try {
        const errorPayload = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorPayload.error?.message) {
          errorMsg = errorPayload.error.message;
        }
      } catch {
        if (errorText.length > 0 && errorText.length < 500) {
          errorMsg += `: ${errorText}`;
        }
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

// ============================================================================
// EXTRACT TOOL CALLS
// ============================================================================

function extractToolCalls(rawCalls: ChatCompletionToolCall[] | undefined): DxfAiToolCall[] {
  if (!rawCalls || rawCalls.length === 0) return [];

  const result: DxfAiToolCall[] = [];

  for (const call of rawCalls) {
    const name = call.function.name;
    if (!isValidToolName(name)) {
      logger.warn(`Unknown tool call: ${name}`);
      continue;
    }

    try {
      const args: unknown = JSON.parse(call.function.arguments);
      result.push({
        name,
        arguments: args as DxfAiToolCall['arguments'],
      });
    } catch {
      logger.error(`Failed to parse tool arguments for ${name}`);
    }
  }

  return result;
}

// ============================================================================
// EXTRACT SUGGESTIONS
// ============================================================================

function extractSuggestions(content: string): string[] {
  // Try to find suggestion lines (lines starting with • or - or numbered)
  const lines = content.split('\n');
  const suggestions: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      (trimmed.startsWith('•') || trimmed.startsWith('-') || /^\d+[\.\)]/.test(trimmed)) &&
      trimmed.length > 5 &&
      trimmed.length < 100
    ) {
      // Clean prefix
      const cleaned = trimmed.replace(/^[•\-\d\.\)]+\s*/, '').trim();
      if (cleaned.length > 3) {
        suggestions.push(cleaned);
      }
    }
  }

  return suggestions.slice(0, 3);
}

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

    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add chat history (last N entries)
    for (const entry of chatHistory) {
      messages.push({
        role: entry.role === 'user' ? 'user' : 'assistant',
        content: entry.content,
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // Call OpenAI
    const { message: assistantMessage } = await callOpenAI(
      messages,
      DXF_AI_TOOL_DEFINITIONS,
      AI_ANALYSIS_DEFAULTS.OPENAI.TIMEOUT_MS,
    );

    // Extract results
    const toolCalls = extractToolCalls(assistantMessage.tool_calls);
    const answer = assistantMessage.content ?? '';
    const suggestions = extractSuggestions(answer);

    const processingTimeMs = Date.now() - startTime;

    logger.info(`DXF AI response: ${toolCalls.length} tool calls, ${answer.length} chars, ${processingTimeMs}ms`);

    return NextResponse.json({
      answer,
      toolCalls,
      suggestions,
      processingTimeMs,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
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
