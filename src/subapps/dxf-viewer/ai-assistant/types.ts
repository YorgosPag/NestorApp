/**
 * @module ai-assistant/types
 * @description Type definitions for the DXF AI Drawing Assistant
 *
 * Provides strict TypeScript types for the entire AI assistant pipeline:
 * - Chat messages (user ↔ assistant)
 * - Canvas context summary
 * - API request/response payloads
 * - Tool call definitions and argument types
 * - Execution results
 *
 * @see ADR-185 (AI Drawing Assistant requirements)
 * @since 2026-02-17
 */

import type { Point2D } from '../rendering/types/Types';

// ============================================================================
// CHAT MESSAGE TYPES
// ============================================================================

/** Status of a chat message in the UI */
export type DxfAiMessageStatus = 'sending' | 'success' | 'error';

/** Role of a chat message participant */
export type DxfAiMessageRole = 'user' | 'assistant';

/** A single chat message in the AI assistant conversation */
export interface DxfAiMessage {
  id: string;
  role: DxfAiMessageRole;
  content: string;
  timestamp: string;
  status: DxfAiMessageStatus;
  toolCalls?: DxfAiToolCall[];
}

// ============================================================================
// CANVAS CONTEXT
// ============================================================================

/** Summary of the current canvas state, sent to the AI for context awareness */
export interface DxfCanvasContext {
  entityCount: number;
  layers: string[];
  bounds: {
    min: Point2D;
    max: Point2D;
  };
  units: string;
  currentLayer: string;
}

// ============================================================================
// API REQUEST / RESPONSE
// ============================================================================

/** Request body for POST /api/dxf-ai/command */
export interface DxfAiCommandRequest {
  message: string;
  canvasContext: DxfCanvasContext;
  chatHistory: DxfAiChatHistoryEntry[];
}

/** Minimal chat history entry sent to the API */
export interface DxfAiChatHistoryEntry {
  role: DxfAiMessageRole;
  content: string;
}

/** Response from POST /api/dxf-ai/command */
export interface DxfAiCommandResponse {
  answer: string;
  toolCalls: DxfAiToolCall[];
  suggestions: string[];
  processingTimeMs: number;
}

// ============================================================================
// TOOL CALL TYPES
// ============================================================================

/** Supported AI tool names */
export type DxfAiToolName =
  | 'draw_line'
  | 'draw_rectangle'
  | 'draw_circle'
  | 'query_entities'
  | 'undo_action';

/** A single tool call returned by the AI */
export interface DxfAiToolCall {
  name: DxfAiToolName;
  arguments: DrawLineArgs | DrawRectangleArgs | DrawCircleArgs | QueryEntitiesArgs | UndoActionArgs;
}

/** Arguments for draw_line tool */
export interface DrawLineArgs {
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  layer: string | null;
  color: string | null;
}

/** Arguments for draw_rectangle tool */
export interface DrawRectangleArgs {
  x: number;
  y: number;
  width: number;
  height: number;
  layer: string | null;
  color: string | null;
}

/** Arguments for draw_circle tool */
export interface DrawCircleArgs {
  center_x: number;
  center_y: number;
  radius: number;
  layer: string | null;
  color: string | null;
}

/** Arguments for query_entities tool */
export interface QueryEntitiesArgs {
  type: string | null;
  layer: string | null;
}

/** Arguments for undo_action tool */
export interface UndoActionArgs {
  count: number | null;
}

// ============================================================================
// EXECUTION RESULT
// ============================================================================

/** Result of executing AI tool calls on the canvas */
export interface DxfAiExecutionResult {
  success: boolean;
  entitiesCreated: string[];
  message: string;
  error?: string;
}
