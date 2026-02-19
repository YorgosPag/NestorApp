/**
 * @module ai-assistant/grid-types
 * @description Domain types for AI-driven Grid & Guide operations
 *
 * Defines the type contract between the AI Assistant and the Grid System (ADR-189).
 * These types are used by:
 * - Grid tool definitions (OpenAI function calling schemas)
 * - Grid executor interface (headless API)
 * - Grid ghost preview (visual feedback before commit)
 * - DxfCanvasContext extension (grid state awareness)
 *
 * IMPORTANT: This file is preparatory infrastructure — the Grid System
 * implementation (ADR-189) will consume these types when built.
 * Zero runtime impact until grid tools are activated.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @see ADR-185 (AI Drawing Assistant — extended with grid awareness)
 * @since 2026-02-19
 */

import type { GhostableEntity } from '../rendering/utils/ghost-entity-renderer';

// ============================================================================
// CORE GRID DOMAIN TYPES
// ============================================================================

/** Axis direction for a grid guide line */
export type GridAxis = 'X' | 'Y';

/** Visual style for a grid guide */
export interface GridGuideStyle {
  /** Line color as hex string, e.g. "#FF0000" */
  color: string;
  /** Line width in pixels */
  lineWidth: number;
  /** Dash pattern [dashLength, gapLength] — empty for solid */
  dashPattern: number[];
}

/** A single grid guide line (axis-aligned infinite reference line) */
export interface GridGuide {
  /** Unique identifier (e.g. "guide_X_001") */
  id: string;
  /** Axis this guide runs along — 'X' = vertical line, 'Y' = horizontal line */
  axis: GridAxis;
  /** Offset from origin along the perpendicular axis (in canvas units) */
  offset: number;
  /** Optional user-visible label (e.g. "A", "B", "1", "2") */
  label: string | null;
  /** Optional visual style override (null = default style) */
  style: GridGuideStyle | null;
}

/** A named group of guides that form a grid pattern */
export interface GridGroup {
  /** Unique identifier (e.g. "grid_structural") */
  id: string;
  /** User-visible name (e.g. "Structural Grid", "Module Grid") */
  name: string;
  /** Guides belonging to this group */
  guides: GridGuide[];
  /** Uniform spacing (null if guides have irregular spacing) */
  spacing: number | null;
  /** Origin point of this grid group (in canvas units) */
  origin: { x: number; y: number };
}

// ============================================================================
// CANVAS CONTEXT EXTENSION
// ============================================================================

/** Snapshot of the current grid state, sent to the AI for context awareness */
export interface GridContextSnapshot {
  /** All grid groups currently defined */
  groups: GridGroup[];
  /** Currently active grid group ID (null = none) */
  activeGroupId: string | null;
  /** Whether snap-to-grid is enabled */
  snapToGrid: boolean;
  /** Whether grid is visible on canvas */
  gridVisible: boolean;
}

// ============================================================================
// OPERATION RESULT
// ============================================================================

/** Result of a grid operation (add/remove/move guide, create group, etc.) */
export interface GridOperationResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** IDs of guides affected by the operation */
  affectedGuides: string[];
  /** IDs of groups affected by the operation */
  affectedGroups: string[];
  /** Human-readable message (for AI response construction) */
  message: string | null;
}

// ============================================================================
// GHOST PREVIEW (AI visual feedback before commit)
// ============================================================================

/** Ghost entities representing a grid guide preview on the canvas */
export type GridGhostPreview = GhostableEntity[];

// ============================================================================
// AI TOOL ARGUMENT TYPES
// ============================================================================

/** Arguments for add_grid_guide tool */
export interface AddGuideArgs {
  /** Axis direction: 'X' for vertical guide, 'Y' for horizontal guide */
  axis: GridAxis;
  /** Offset from origin along the perpendicular axis (in canvas units) */
  offset: number;
  /** Optional label for the guide (null = auto-generated) */
  label: string | null;
  /** Target group ID (null = active group or default) */
  group_id: string | null;
}

/** Arguments for remove_grid_guide tool */
export interface RemoveGuideArgs {
  /** ID of the guide to remove */
  guide_id: string;
}

/** Arguments for move_grid_guide tool */
export interface MoveGuideArgs {
  /** ID of the guide to move */
  guide_id: string;
  /** New offset value (in canvas units) */
  new_offset: number;
}

/** Arguments for create_grid_group tool */
export interface CreateGridGroupArgs {
  /** Name for the new grid group */
  name: string;
  /** Axis for the initial guides: 'X', 'Y', or both */
  axis: GridAxis | 'both';
  /** Uniform spacing between guides (in canvas units) */
  spacing: number;
  /** Number of guides to create */
  count: number;
  /** Origin X coordinate */
  origin_x: number;
  /** Origin Y coordinate */
  origin_y: number;
}

/** Arguments for set_grid_spacing tool */
export interface SetGridSpacingArgs {
  /** Target group ID (null = active group) */
  group_id: string | null;
  /** New spacing value (in canvas units, must be > 0) */
  spacing: number;
}

/** Arguments for toggle_grid_snap tool */
export interface ToggleGridSnapArgs {
  /** Whether to enable or disable snap-to-grid */
  enabled: boolean;
}
