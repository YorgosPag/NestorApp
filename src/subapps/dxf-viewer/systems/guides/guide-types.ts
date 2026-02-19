/**
 * @module systems/guides/guide-types
 * @description Core type definitions for the Construction Guide System
 *
 * Extends the AI-prepared GridGuide type with runtime state fields
 * (visible, locked, createdAt) needed for rendering and interaction.
 *
 * Guide types are separate from DXF entity types — guides are auxiliary
 * reference lines that do NOT export to DXF files.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-19
 */

import type { GridAxis, GridGuideStyle } from '../../ai-assistant/grid-types';

// Re-export for convenience
export type { GridAxis } from '../../ai-assistant/grid-types';

// ============================================================================
// GUIDE ENTITY
// ============================================================================

/** A construction guide with runtime state */
export interface Guide {
  /** Unique identifier (e.g. "guide_X_001") */
  readonly id: string;
  /** Axis: 'X' = vertical line, 'Y' = horizontal line */
  readonly axis: GridAxis;
  /** Offset from origin along the perpendicular axis (in canvas/world units) */
  offset: number;
  /** Optional user-visible label (e.g. "A", "1") */
  label: string | null;
  /** Visual style override (null = use default for axis type) */
  style: GridGuideStyle | null;
  /** Whether this guide is visible on canvas */
  visible: boolean;
  /** Whether this guide is locked (prevents modification/deletion) */
  locked: boolean;
  /** ISO timestamp of creation */
  readonly createdAt: string;
  /** Optional reference to parent guide (for parallel guides) */
  readonly parentId: string | null;
}

// ============================================================================
// RENDERING CONFIGURATION
// ============================================================================

/** Rendering style for a guide line on canvas */
export interface GuideRenderStyle {
  /** Stroke color (hex) */
  color: string;
  /** Line width in CSS pixels (constant regardless of zoom) */
  lineWidth: number;
  /** Dash pattern [dash, gap] — empty array for solid line */
  dashPattern: number[];
  /** Opacity (0.0 to 1.0) */
  opacity: number;
}

/** Default colors per guide axis — construction-industry standard */
export const GUIDE_COLORS = {
  /** Cyan — vertical (X-axis) guides */
  X: '#00BCD4',
  /** Tomato — horizontal (Z/Y-axis) guides */
  Y: '#FF6347',
  /** Purple — parallel offset guides */
  PARALLEL: '#9370DB',
  /** Ghost preview (during placement) */
  GHOST: '#FFFFFF',
} as const;

/** Default rendering style for construction guides */
export const DEFAULT_GUIDE_STYLE: GuideRenderStyle = {
  color: GUIDE_COLORS.X,
  lineWidth: 0.5,
  dashPattern: [6, 3],
  opacity: 0.4,
};

/** Guide rendering style for ghost (preview) state */
export const GHOST_GUIDE_STYLE: GuideRenderStyle = {
  color: GUIDE_COLORS.GHOST,
  lineWidth: 0.5,
  dashPattern: [4, 4],
  opacity: 0.25,
};

// ============================================================================
// SYSTEM LIMITS
// ============================================================================

/** Performance budgets for the guide system */
export const GUIDE_LIMITS = {
  /** Maximum number of guide lines */
  MAX_GUIDES: 500,
  /** Maximum number of snap points (intersections) */
  MAX_SNAP_POINTS: 5000,
  /** Minimum offset between two guides on the same axis (prevents duplicates) */
  MIN_OFFSET_DELTA: 0.001,
} as const;
