/**
 * 🏢 ENTERPRISE: Centralized Validation Bounds Configuration
 * ============================================================
 *
 * ADR-034: Validation Bounds Centralization
 *
 * Single source of truth για όλα τα validation ranges στην εφαρμογή.
 * Αντικαθιστά 30+ hardcoded min/max values σε clamp() κλήσεις.
 *
 * BENEFITS:
 * - Consistency: Ίδια bounds παντού για το ίδιο πράγμα
 * - Maintainability: Αλλαγή σε ένα σημείο
 * - Discoverability: Όλα τα επιτρεπτά ranges σε ένα μέρος
 *
 * @see ADR-071: Centralized clamp function (geometry-utils.ts)
 * @created 2026-02-01
 */

// 🏢 ADR-071: Centralized clamp function
import { clamp } from '../rendering/entities/shared/geometry-utils';

// ============================================================================
// OPACITY BOUNDS
// ============================================================================

/**
 * 🎨 Opacity validation bounds
 *
 * Standard CSS/Canvas opacity ranges:
 * - STANDARD: 0-1 (fully transparent to fully opaque)
 * - VISIBLE: 0.1-1 (ensures minimum visibility)
 */
export const OPACITY_BOUNDS = {
  /** Standard opacity range (0-1) - for general use */
  STANDARD: { min: 0, max: 1 },

  /** Opacity with minimum visibility (0.1-1) - for grips, overlays */
  VISIBLE: { min: 0.1, max: 1 },
} as const;

// ============================================================================
// TEXT/FONT BOUNDS
// ============================================================================

/**
 * 📝 Text/Font validation bounds
 *
 * Based on ISO 3098 technical drawing standards:
 * - FONT_SIZE: 8-72 points (readable range)
 * - FONT_WEIGHT: 100-900 (CSS font-weight spec)
 * - Other values are UX-tested reasonable limits
 */
export const TEXT_BOUNDS = {
  /** Font size in points (8-72) - ISO 3098 readable range */
  FONT_SIZE: { min: 8, max: 72 },

  /** CSS font-weight (100-900) - thin to black */
  FONT_WEIGHT: { min: 100, max: 900 },

  /** Letter spacing in pixels (-5 to 10) */
  LETTER_SPACING: { min: -5, max: 10 },

  /** Line height ratio (0.8-3.0) - multiplier of font size */
  LINE_HEIGHT: { min: 0.8, max: 3.0 },

  /** Shadow blur radius in pixels (0-20) */
  SHADOW_BLUR: { min: 0, max: 20 },

  /** Text stroke width in pixels (0-5) */
  STROKE_WIDTH: { min: 0, max: 5 },

  /** Background padding in pixels (0-20) */
  BACKGROUND_PADDING: { min: 0, max: 20 },
} as const;

// ============================================================================
// LINE/STROKE BOUNDS
// ============================================================================

/**
 * ✏️ Line/Stroke validation bounds
 *
 * Based on ISO 128 technical drawing standards:
 * - WIDTH: 0.1-100 (from hairline to thick lines)
 * - DASH_SCALE: 0.1-3.0 (pattern scaling factor)
 */
export const LINE_BOUNDS = {
  /** Line width in pixels (0.1-100) - ISO 128 range */
  WIDTH: { min: 0.1, max: 100 },

  /** Dash pattern scale factor (0.1-3.0) */
  DASH_SCALE: { min: 0.1, max: 3.0 },

  /** Dash pattern offset in pixels (0-100) */
  DASH_OFFSET: { min: 0, max: 100 },
} as const;

// ============================================================================
// GRIP/SELECTION BOUNDS
// ============================================================================

/**
 * 🎯 Grip/Selection validation bounds
 *
 * Based on AutoCAD system variables:
 * - GRIPSIZE: 1-255 DIPs
 * - PICKBOX: 0-50 DIPs
 * - APERTURE: 1-50 pixels
 */
export const GRIP_BOUNDS = {
  /** Grip size in DIPs (3-20) - AutoCAD-style, refined range */
  SIZE: { min: 3, max: 20 },

  /** Grip size extended range (1-255) - full AutoCAD GRIPSIZE range */
  SIZE_EXTENDED: { min: 1, max: 255 },

  /** Pick box size in DIPs (0-50) - AutoCAD PICKBOX */
  PICK_BOX: { min: 0, max: 50 },

  /** Aperture/tolerance in pixels (1-50) - AutoCAD APERTURE */
  APERTURE: { min: 1, max: 50 },

  /** Pick box size refined (1-20) - for UI sliders */
  PICK_BOX_REFINED: { min: 1, max: 20 },

  /** Maximum grips per entity (10-200) - performance limit */
  MAX_PER_ENTITY: { min: 10, max: 200 },

  /** Maximum grips per entity full range (1-100) - legacy support */
  MAX_PER_ENTITY_LEGACY: { min: 1, max: 100 },
} as const;

// ============================================================================
// SPATIAL/GRID BOUNDS
// ============================================================================

/**
 * 🌐 Spatial/Grid validation bounds
 *
 * For spatial indexing and grid operations:
 * - GRID_CELL_SIZE: 10-500 (reasonable grid cell dimensions)
 * - SNAP_ZOOM_FACTOR: 0.5-2 (zoom-adaptive snap radius factor)
 */
export const SPATIAL_BOUNDS = {
  /** Grid cell size in pixels (10-500) - for spatial indexing */
  GRID_CELL_SIZE: { min: 10, max: 500 },

  /** Snap zoom factor (0.5-2) - multiplier for snap radius based on zoom */
  SNAP_ZOOM_FACTOR: { min: 0.5, max: 2 },
} as const;

// ============================================================================
// PERCENTAGE BOUNDS
// ============================================================================

/**
 * 📊 Percentage validation bounds
 *
 * For percentage-based values:
 * - STANDARD: 0-100 (percentage)
 * - RATIO: 0-1 (normalized)
 * - FIT_TO_VIEW_PADDING: 0-0.9 (max 90% padding to prevent NaN)
 */
export const PERCENTAGE_BOUNDS = {
  /** Standard percentage (0-100) */
  STANDARD: { min: 0, max: 100 },

  /** Normalized ratio (0-1) */
  RATIO: { min: 0, max: 1 },

  /** Fit-to-view padding (0-0.9) - max 90% to prevent division issues */
  FIT_TO_VIEW_PADDING: { min: 0, max: 0.9 },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/** Bound range type with min and max */
export interface BoundRange {
  readonly min: number;
  readonly max: number;
}

// ============================================================================
// HELPER FUNCTIONS - Semantic Clamp Operations
// ============================================================================

/**
 * Clamp opacity to standard range (0-1)
 * @example clampOpacity(1.5) // returns 1
 */
export function clampOpacity(value: number): number {
  return clamp(value, OPACITY_BOUNDS.STANDARD.min, OPACITY_BOUNDS.STANDARD.max);
}

/**
 * Clamp opacity ensuring minimum visibility (0.1-1)
 * @example clampVisibleOpacity(0.05) // returns 0.1
 */
export function clampVisibleOpacity(value: number): number {
  return clamp(value, OPACITY_BOUNDS.VISIBLE.min, OPACITY_BOUNDS.VISIBLE.max);
}

/**
 * Clamp font size to valid range (8-72)
 * @example clampFontSize(100) // returns 72
 */
export function clampFontSize(value: number): number {
  return clamp(value, TEXT_BOUNDS.FONT_SIZE.min, TEXT_BOUNDS.FONT_SIZE.max);
}

/**
 * Clamp font weight to CSS valid range (100-900)
 * @example clampFontWeight(1000) // returns 900
 */
export function clampFontWeight(value: number): number {
  return clamp(value, TEXT_BOUNDS.FONT_WEIGHT.min, TEXT_BOUNDS.FONT_WEIGHT.max);
}

/**
 * Clamp letter spacing to valid range (-5 to 10)
 */
export function clampLetterSpacing(value: number): number {
  return clamp(value, TEXT_BOUNDS.LETTER_SPACING.min, TEXT_BOUNDS.LETTER_SPACING.max);
}

/**
 * Clamp line height to valid range (0.8-3.0)
 */
export function clampLineHeight(value: number): number {
  return clamp(value, TEXT_BOUNDS.LINE_HEIGHT.min, TEXT_BOUNDS.LINE_HEIGHT.max);
}

/**
 * Clamp grip size to refined range (3-20)
 * @example clampGripSize(25) // returns 20
 */
export function clampGripSize(value: number): number {
  return clamp(value, GRIP_BOUNDS.SIZE.min, GRIP_BOUNDS.SIZE.max);
}

/**
 * Clamp grip size to full AutoCAD range (1-255)
 */
export function clampGripSizeExtended(value: number): number {
  return clamp(value, GRIP_BOUNDS.SIZE_EXTENDED.min, GRIP_BOUNDS.SIZE_EXTENDED.max);
}

/**
 * Clamp pick box size to valid range (0-50)
 */
export function clampPickBoxSize(value: number): number {
  return clamp(value, GRIP_BOUNDS.PICK_BOX.min, GRIP_BOUNDS.PICK_BOX.max);
}

/**
 * Clamp aperture size to valid range (1-50)
 */
export function clampApertureSize(value: number): number {
  return clamp(value, GRIP_BOUNDS.APERTURE.min, GRIP_BOUNDS.APERTURE.max);
}

/**
 * Clamp line width to valid range (0.1-100)
 * @example clampLineWidth(0.05) // returns 0.1
 */
export function clampLineWidth(value: number): number {
  return clamp(value, LINE_BOUNDS.WIDTH.min, LINE_BOUNDS.WIDTH.max);
}

/**
 * Clamp dash scale to valid range (0.1-3.0)
 */
export function clampDashScale(value: number): number {
  return clamp(value, LINE_BOUNDS.DASH_SCALE.min, LINE_BOUNDS.DASH_SCALE.max);
}

/**
 * Clamp dash offset to valid range (0-100)
 */
export function clampDashOffset(value: number): number {
  return clamp(value, LINE_BOUNDS.DASH_OFFSET.min, LINE_BOUNDS.DASH_OFFSET.max);
}

/**
 * Clamp grid cell size to valid range (10-500)
 */
export function clampGridCellSize(value: number): number {
  return clamp(value, SPATIAL_BOUNDS.GRID_CELL_SIZE.min, SPATIAL_BOUNDS.GRID_CELL_SIZE.max);
}

/**
 * Clamp snap zoom factor to valid range (0.5-2)
 */
export function clampSnapZoomFactor(value: number): number {
  return clamp(value, SPATIAL_BOUNDS.SNAP_ZOOM_FACTOR.min, SPATIAL_BOUNDS.SNAP_ZOOM_FACTOR.max);
}

/**
 * Clamp fit-to-view padding to valid range (0-0.9)
 * Prevents NaN from division when padding is too large
 */
export function clampFitToViewPadding(value: number): number {
  return clamp(value, PERCENTAGE_BOUNDS.FIT_TO_VIEW_PADDING.min, PERCENTAGE_BOUNDS.FIT_TO_VIEW_PADDING.max);
}

/**
 * Clamp max grips per entity to valid range (10-200)
 */
export function clampMaxGripsPerEntity(value: number): number {
  return clamp(value, GRIP_BOUNDS.MAX_PER_ENTITY.min, GRIP_BOUNDS.MAX_PER_ENTITY.max);
}

/**
 * Clamp shadow blur to valid range (0-20)
 */
export function clampShadowBlur(value: number): number {
  return clamp(value, TEXT_BOUNDS.SHADOW_BLUR.min, TEXT_BOUNDS.SHADOW_BLUR.max);
}

/**
 * Clamp text stroke width to valid range (0-5)
 */
export function clampTextStrokeWidth(value: number): number {
  return clamp(value, TEXT_BOUNDS.STROKE_WIDTH.min, TEXT_BOUNDS.STROKE_WIDTH.max);
}

/**
 * Clamp background padding to valid range (0-20)
 */
export function clampBackgroundPadding(value: number): number {
  return clamp(value, TEXT_BOUNDS.BACKGROUND_PADDING.min, TEXT_BOUNDS.BACKGROUND_PADDING.max);
}
