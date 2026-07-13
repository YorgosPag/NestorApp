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
import type { TopoAiToolName } from './topo-tool-definitions';
import type { ContourDisplayStyle } from '../systems/topography/contour-config';
import type { TerrainSurfaceStyle, CutFillReferenceMode } from '../systems/topography/topo-types';

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
  | 'toggle_grid_snap'
  // Topography tools (ADR-650 M5β — names owned by topo-tool-definitions SSoT)
  | TopoAiToolName;

/** A single tool call returned by the AI */
export interface DxfAiToolCall {
  name: DxfAiToolName;
  arguments:
    | DrawLineArgs | DrawRectangleArgs | DrawCircleArgs | DrawPolylineArgs
    | DrawShapesArgs | DrawRegularPolygonArgs | QueryEntitiesArgs | UndoActionArgs
    // Grid tool arguments (ADR-189)
    | AddGuideArgs | RemoveGuideArgs | MoveGuideArgs
    | CreateGridGroupArgs | SetGridSpacingArgs | ToggleGridSnapArgs
    // Topography tool arguments (ADR-650 M5β)
    | GenerateContoursArgs | SetContourStyleArgs | ToggleTerrain3DArgs | SetTerrainStyleArgs
    | SetCutfillReferenceArgs | TopoNoArgs;
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
// TOPOGRAPHY TOOL ARGUMENTS (ADR-650 M5β) — units in METRES (executor → mm)
// ============================================================================

/** Arguments for generate_contours — both optional (null = keep panel defaults). */
export interface GenerateContoursArgs {
  interval_m: number | null;
  major_every: number | null;
}

/** Arguments for set_contour_style. */
export interface SetContourStyleArgs {
  style: ContourDisplayStyle;
}

/** Arguments for toggle_terrain_3d. */
export interface ToggleTerrain3DArgs {
  visible: boolean;
}

/** Arguments for set_terrain_style. */
export interface SetTerrainStyleArgs {
  style: TerrainSurfaceStyle;
}

/** Arguments for set_cutfill_reference — datum_z_m in METRES, null unless mode is "datum". */
export interface SetCutfillReferenceArgs {
  mode: CutFillReferenceMode;
  datum_z_m: number | null;
}

/** Arguments for the parameter-less topo tools (run_quality_check / run_cutfill / spikes). */
export type TopoNoArgs = Record<string, never>;

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

/**
 * A destructive topo action awaiting the engineer's explicit confirm (§9 human-certifier).
 * The executor returns this instead of mutating; the chat shows a Confirm/Cancel affordance
 * and, on confirm, runs the paired command.
 */
export interface TopoPendingConfirm {
  /** Which destructive action is pending (only spike removal for now). */
  readonly kind: 'remove-elevation-spikes';
  /** How many raw points would be deleted — shown in the confirm prompt. */
  readonly count: number;
}

/**
 * Result of executing topography tool calls. Messages are i18n keys + params (N.11) resolved
 * by the caller with `t()`, mirroring the M5α QA flag contract — the executor never bakes
 * user-facing text.
 */
export interface TopoAiExecutionResult {
  /** i18n keys (+ params) describing what happened, in call order. */
  readonly messages: ReadonlyArray<{ key: string; params?: Record<string, string | number> }>;
  /** A destructive action awaiting confirm, if any (at most one per turn). */
  readonly pendingConfirm: TopoPendingConfirm | null;
}
