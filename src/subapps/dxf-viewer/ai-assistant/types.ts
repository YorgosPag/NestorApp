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
import type {
  AddGuideArgs,
  RemoveGuideArgs,
  MoveGuideArgs,
  CreateGridGroupArgs,
  SetGridSpacingArgs,
  ToggleGridSnapArgs,
  GridContextSnapshot,
} from './grid-types';

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
  /** Grid state snapshot (null until Grid System ADR-189 is implemented) */
  gridContext: GridContextSnapshot | null;
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
  | 'draw_polyline'
  | 'draw_shapes'
  | 'draw_regular_polygon'
  | 'query_entities'
  | 'undo_action'
  // Grid tools (ADR-189 — activated when Grid System is implemented)
  | 'add_grid_guide'
  | 'remove_grid_guide'
  | 'move_grid_guide'
  | 'create_grid_group'
  | 'set_grid_spacing'
  | 'toggle_grid_snap';

/** A single tool call returned by the AI */
export interface DxfAiToolCall {
  name: DxfAiToolName;
  arguments:
    | DrawLineArgs | DrawRectangleArgs | DrawCircleArgs | DrawPolylineArgs
    | DrawShapesArgs | DrawRegularPolygonArgs | QueryEntitiesArgs | UndoActionArgs
    // Grid tool arguments (ADR-189)
    | AddGuideArgs | RemoveGuideArgs | MoveGuideArgs
    | CreateGridGroupArgs | SetGridSpacingArgs | ToggleGridSnapArgs;
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

/** A 2D vertex used in polyline tool calls */
export interface DxfAiVertex {
  x: number;
  y: number;
}

/** Arguments for draw_polyline tool */
export interface DrawPolylineArgs {
  vertices: DxfAiVertex[];
  closed: boolean;
  layer: string | null;
  color: string | null;
}

/** A single shape in the draw_shapes compound tool */
export interface DrawShapeItem {
  shape_type: 'line' | 'rectangle' | 'circle' | 'polyline';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  vertices: DxfAiVertex[] | null;
  closed: boolean | null;
  color: string | null;
  layer: string | null;
}

/** Arguments for draw_shapes compound tool */
export interface DrawShapesArgs {
  shapes: DrawShapeItem[];
}

/** Arguments for draw_regular_polygon tool — vertices computed by code, not AI */
export interface DrawRegularPolygonArgs {
  center_x: number;
  center_y: number;
  radius: number;
  sides: number;
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
