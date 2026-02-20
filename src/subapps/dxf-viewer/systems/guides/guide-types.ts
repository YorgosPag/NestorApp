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
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ADR-189: Centralized hover highlight config (single source of truth)
import { HOVER_HIGHLIGHT } from '../../config/color-config';

// Re-export for convenience
export type { GridAxis } from '../../ai-assistant/grid-types';

// ============================================================================
// GUIDE ENTITY
// ============================================================================

/** A construction guide with runtime state */
export interface Guide {
  /** Unique identifier (e.g. "guide_X_001") */
  readonly id: string;
  /** Axis: 'X' = vertical line, 'Y' = horizontal line, 'XZ' = diagonal (finite segment) */
  readonly axis: GridAxis;
  /** Offset from origin along the perpendicular axis (in canvas/world units). For XZ: unused (0). */
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
  /** Start point for diagonal (XZ) guides. Undefined for axis-aligned guides. */
  readonly startPoint?: Point2D;
  /** End point for diagonal (XZ) guides. Undefined for axis-aligned guides. */
  readonly endPoint?: Point2D;
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
  /** Indigo — diagonal (XZ) guides */
  XZ: '#6366F1',
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

/** Guide rendering style for hover highlight (delete/parallel selection)
 * 🏢 Centralized: Values from HOVER_HIGHLIGHT.GUIDE (color-config.ts)
 */
export const HIGHLIGHT_GUIDE_STYLE: GuideRenderStyle = {
  color: HOVER_HIGHLIGHT.GUIDE.glowColor,
  lineWidth: HOVER_HIGHLIGHT.GUIDE.lineWidth,
  dashPattern: [...HOVER_HIGHLIGHT.GUIDE.dashPattern],
  opacity: HOVER_HIGHLIGHT.GUIDE.opacity,
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

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

/** Type guard: checks if a guide is a diagonal (XZ) guide with defined endpoints */
export function isDiagonalGuide(guide: Guide): guide is Guide & { readonly startPoint: Point2D; readonly endPoint: Point2D } {
  return guide.axis === 'XZ' && guide.startPoint !== undefined && guide.endPoint !== undefined;
}

/**
 * Distance from a point to a line segment (clamped to endpoints).
 * Reused by GuideStore.findNearestGuide() and GuideSnapEngine.
 */
export function pointToSegmentDistance(point: Point2D, segStart: Point2D, segEnd: Point2D): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt((point.x - segStart.x) ** 2 + (point.y - segStart.y) ** 2);
  }

  const t = Math.max(0, Math.min(1, ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq));
  const projX = segStart.x + t * dx;
  const projY = segStart.y + t * dy;
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Project a point onto a line segment, returning the projected point and parameter t.
 * t is clamped to [0, 1] (bounded to segment endpoints).
 */
export function projectPointOnSegment(
  point: Point2D,
  segStart: Point2D,
  segEnd: Point2D,
): { snapPoint: Point2D; distance: number; t: number } {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const d = Math.sqrt((point.x - segStart.x) ** 2 + (point.y - segStart.y) ** 2);
    return { snapPoint: { x: segStart.x, y: segStart.y }, distance: d, t: 0 };
  }

  const t = Math.max(0, Math.min(1, ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq));
  const snapPoint = { x: segStart.x + t * dx, y: segStart.y + t * dy };
  const distance = Math.sqrt((point.x - snapPoint.x) ** 2 + (point.y - snapPoint.y) ** 2);

  return { snapPoint, distance, t };
}
