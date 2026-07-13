/**
 * @module api/dxf-ai/command/command-helpers
 * @description Pure helpers for the DXF AI command route (validation, tool-call
 * extraction, suggestion parsing, simulated tool-result messages).
 *
 * Extracted from `route.ts` to keep the API route under its 300-line limit
 * (Google SRP, N.7.1). No behavioural change — byte-identical logic.
 *
 * @see ADR-185 (AI Drawing Assistant)
 */

import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  ChatCompletionToolCall,
} from '@/subapps/dxf-viewer/ai-assistant/dxf-openai-call';
import type {
  DxfAiCommandRequest,
  DxfAiToolCall,
  DxfAiToolName,
  DxfCanvasContext,
  DxfAiChatHistoryEntry,
} from '@/subapps/dxf-viewer/ai-assistant/types';
import { DXF_AI_LIMITS } from '@/subapps/dxf-viewer/config/ai-assistant-config';
import { TOPO_TOOL_NAMES } from '@/subapps/dxf-viewer/ai-assistant/topo-tool-definitions';

const logger = createModuleLogger('DXF_AI_COMMAND');

/** Max iterations for mini agentic loop (prevents runaway) */
export const MAX_LOOP_ITERATIONS = 3;

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_TOOL_NAMES = new Set<string>([
  'draw_line',
  'draw_rectangle',
  'draw_circle',
  'draw_polyline',
  'draw_shapes',
  'draw_regular_polygon',
  'query_entities',
  'undo_action',
  // Grid tools (ADR-189 — activated when Grid System is implemented)
  'add_grid_guide',
  'remove_grid_guide',
  'move_grid_guide',
  'create_grid_group',
  'set_grid_spacing',
  'toggle_grid_snap',
  // Topography tools (ADR-650 M5β — «μίλα στο σχέδιο»)
  ...TOPO_TOOL_NAMES,
]);

function isValidToolName(name: string): name is DxfAiToolName {
  return VALID_TOOL_NAMES.has(name);
}

export function validateRequest(body: unknown): {
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
// EXTRACT TOOL CALLS
// ============================================================================

export function extractToolCalls(rawCalls: ChatCompletionToolCall[] | undefined): DxfAiToolCall[] {
  if (!rawCalls || rawCalls.length === 0) return [];

  const result: DxfAiToolCall[] = [];

  for (const call of rawCalls) {
    const name = call.function.name;
    if (!isValidToolName(name)) {
      logger.warn(`Unknown tool call: ${name}`);
      continue;
    }

    const args = safeJsonParse<unknown>(call.function.arguments, null);
    if (args === null) {
      logger.error(`Failed to parse tool arguments for ${name}`);
      continue;
    }
    result.push({
      name,
      arguments: args as DxfAiToolCall['arguments'],
    });
  }

  return result;
}

// ============================================================================
// EXTRACT SUGGESTIONS
// ============================================================================

export function extractSuggestions(content: string): string[] {
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
// SIMULATED TOOL RESULTS
// ============================================================================

/**
 * Build simulated tool result messages to send back to OpenAI.
 * The server doesn't execute drawing tools — it simulates success
 * so OpenAI continues calling more tools if needed.
 *
 * Results are descriptive to encourage the model to continue with remaining work.
 */
export function buildToolResultMessages(
  rawCalls: ChatCompletionToolCall[],
): Array<{ role: 'tool'; tool_call_id: string; content: string }> {
  return rawCalls.map(call => {
    let description = '';
    const args = safeJsonParse<Record<string, unknown>>(call.function.arguments, null as unknown as Record<string, unknown>);
    if (args !== null) {
      if (call.function.name === 'draw_line') {
        description = ` from (${args.start_x},${args.start_y}) to (${args.end_x},${args.end_y})`;
      } else if (call.function.name === 'draw_rectangle') {
        description = ` ${args.width}x${args.height} at (${args.x},${args.y})`;
      } else if (call.function.name === 'draw_circle') {
        description = ` radius=${args.radius} at (${args.center_x},${args.center_y})`;
      }
    }

    return {
      role: 'tool' as const,
      tool_call_id: call.id,
      content: `OK: ${call.function.name}${description} drawn. If user requested more items, continue calling tools for the remaining ones.`,
    };
  });
}
