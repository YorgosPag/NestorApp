/**
 * 🏢 ENTERPRISE DISTANCE LABEL UTILITIES
 *
 * Centralized distance label rendering for both PreviewCanvas and main canvas.
 * Pattern: Autodesk AutoCAD / Bentley MicroStation - Single source of truth
 *
 * @module distance-label-utils
 * @version 1.0.0 - ADR-041: Centralized Distance Label Rendering
 * @since 2026-01-27
 *
 * 🎯 PURPOSE:
 * - Single source of truth for distance label rendering
 * - Eliminates duplicate implementations (PreviewRenderer vs BaseEntityRenderer)
 * - Consistent styling via centralized TextStyleStore
 * - Supports both preview and final rendering phases
 *
 * 🏆 ENTERPRISE FEATURES:
 * - Full TypeScript (ZERO any)
 * - World coordinate distance calculation
 * - Optional background box rendering
 * - Rotation support for inline labels
 * - Integration with centralized TextStyleStore
 *
 * @see {@link docs/centralized_systems.md#adr-041} - Distance Label Centralization
 */

import type { Point2D } from '../../types/Types';
import { getTextPreviewStyleWithOverride, renderStyledTextWithOverride } from '../../../hooks/useTextPreviewStyle';

// ============================================================================
// TYPES - Enterprise TypeScript Standards (ZERO any)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Distance label rendering options
 */
export interface DistanceLabelOptions {
  /** Show background box behind text (default: false for main canvas, true for preview) */
  showBackground?: boolean;
  /** Background color (default: rgba(0,0,0,0.75)) */
  backgroundColor?: string;
  /** Padding around text in pixels (default: 4) */
  padding?: number;
  /** Vertical offset from midpoint (default: -10 for above line) */
  verticalOffset?: number;
  /** Rotate text to align with line (default: false for preview, true for main canvas) */
  rotateWithLine?: boolean;
  /** Number of decimal places for distance (default: 2) */
  decimals?: number;
  /** Override text color (uses centralized style if not provided) */
  textColor?: string;
  /** Override font (uses centralized style if not provided) */
  font?: string;
}

/**
 * 🏢 ENTERPRISE: Default options for preview rendering (PreviewCanvas)
 */
export const PREVIEW_LABEL_DEFAULTS: Required<DistanceLabelOptions> = {
  showBackground: true,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  padding: 4,
  verticalOffset: -10,
  rotateWithLine: false,
  decimals: 2,
  textColor: '', // Empty = use centralized style
  font: '', // Empty = use centralized style
};

/**
 * 🏢 ENTERPRISE: Default options for final rendering (main canvas)
 */
export const FINAL_LABEL_DEFAULTS: Required<DistanceLabelOptions> = {
  showBackground: false,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  padding: 4,
  verticalOffset: 0,
  rotateWithLine: true,
  decimals: 2,
  textColor: '', // Empty = use centralized style
  font: '', // Empty = use centralized style
};

// ============================================================================
// DISTANCE CALCULATION - Single source of truth
// ============================================================================

/**
 * 🏢 ENTERPRISE: Calculate distance between two world coordinate points
 *
 * CRITICAL: Always use WORLD coordinates for distance calculation!
 * Screen coordinates would give zoom-dependent incorrect distances.
 *
 * @param worldP1 - First point in world coordinates
 * @param worldP2 - Second point in world coordinates
 * @returns Distance in world units
 */
export function calculateWorldDistance(worldP1: Point2D, worldP2: Point2D): number {
  const dx = worldP2.x - worldP1.x;
  const dy = worldP2.y - worldP1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 🏢 ENTERPRISE: Format distance value for display
 *
 * @param distance - Distance value in world units
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "123.45")
 */
export function formatDistance(distance: number, decimals: number = 2): string {
  return distance.toFixed(decimals);
}

// ============================================================================
// LABEL RENDERING - Centralized implementation
// ============================================================================

/**
 * 🏢 ENTERPRISE: Render distance label with optional background box
 *
 * This is the SINGLE source of truth for distance label rendering.
 * Used by both PreviewRenderer (direct canvas) and BaseEntityRenderer (main canvas).
 *
 * @param ctx - Canvas 2D rendering context
 * @param worldP1 - First point in WORLD coordinates (for distance calculation)
 * @param worldP2 - Second point in WORLD coordinates (for distance calculation)
 * @param screenP1 - First point in SCREEN coordinates (for label positioning)
 * @param screenP2 - Second point in SCREEN coordinates (for label positioning)
 * @param options - Rendering options (defaults to PREVIEW_LABEL_DEFAULTS)
 *
 * @example
 * // For preview canvas (with background box)
 * renderDistanceLabel(ctx, worldStart, worldEnd, screenStart, screenEnd, PREVIEW_LABEL_DEFAULTS);
 *
 * // For main canvas (with rotation, no background)
 * renderDistanceLabel(ctx, worldStart, worldEnd, screenStart, screenEnd, FINAL_LABEL_DEFAULTS);
 */
export function renderDistanceLabel(
  ctx: CanvasRenderingContext2D,
  worldP1: Point2D,
  worldP2: Point2D,
  screenP1: Point2D,
  screenP2: Point2D,
  options: DistanceLabelOptions = PREVIEW_LABEL_DEFAULTS
): void {
  // Merge with defaults
  const opts = { ...PREVIEW_LABEL_DEFAULTS, ...options };

  // Calculate distance from WORLD coordinates
  const distance = calculateWorldDistance(worldP1, worldP2);
  const text = formatDistance(distance, opts.decimals);

  // Calculate midpoint for label positioning (screen coordinates)
  const midX = (screenP1.x + screenP2.x) / 2;
  const midY = (screenP1.y + screenP2.y) / 2;

  // Calculate line angle for rotation (if enabled)
  const dx = screenP2.x - screenP1.x;
  const dy = screenP2.y - screenP1.y;
  let angle = Math.atan2(dy, dx);

  // Normalize angle to keep text readable (not upside down)
  if (opts.rotateWithLine && Math.abs(angle) > Math.PI / 2) {
    angle += Math.PI;
  }

  ctx.save();

  // Move to label position
  ctx.translate(midX, midY + opts.verticalOffset);

  // Rotate if enabled
  if (opts.rotateWithLine) {
    ctx.rotate(angle);
  }

  // Get styling from centralized system
  const style = getTextPreviewStyleWithOverride();

  // Check if text rendering is enabled
  if (!style.enabled) {
    ctx.restore();
    return;
  }

  // Apply font (use override or centralized style)
  const fontSize = parseInt(style.fontSize);
  const font = opts.font || `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  ctx.font = font;

  // Render background box if enabled
  if (opts.showBackground) {
    const textMetrics = ctx.measureText(text);
    const bgWidth = textMetrics.width + opts.padding * 2;
    const bgHeight = fontSize + opts.padding;

    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(
      -bgWidth / 2,
      -bgHeight / 2,
      bgWidth,
      bgHeight
    );
  }

  // Render text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.textColor || style.color;
  ctx.globalAlpha = style.opacity;
  ctx.fillText(text, 0, 0);

  ctx.restore();
}

/**
 * 🏢 ENTERPRISE: Render distance label using centralized styled text
 *
 * This version uses the full renderStyledTextWithOverride() for text rendering,
 * which supports all TextStyleStore features (decorations, super/subscript, etc.).
 *
 * Use this for main canvas rendering where full styling features are needed.
 *
 * @param ctx - Canvas 2D rendering context
 * @param worldP1 - First point in WORLD coordinates
 * @param worldP2 - Second point in WORLD coordinates
 * @param screenP1 - First point in SCREEN coordinates
 * @param screenP2 - Second point in SCREEN coordinates
 * @param options - Rendering options
 */
export function renderDistanceLabelStyled(
  ctx: CanvasRenderingContext2D,
  worldP1: Point2D,
  worldP2: Point2D,
  screenP1: Point2D,
  screenP2: Point2D,
  options: DistanceLabelOptions = FINAL_LABEL_DEFAULTS
): void {
  const opts = { ...FINAL_LABEL_DEFAULTS, ...options };

  // Calculate distance from WORLD coordinates
  const distance = calculateWorldDistance(worldP1, worldP2);
  const text = formatDistance(distance, opts.decimals);

  // Calculate midpoint
  const midX = (screenP1.x + screenP2.x) / 2;
  const midY = (screenP1.y + screenP2.y) / 2;

  // Calculate line angle
  const dx = screenP2.x - screenP1.x;
  const dy = screenP2.y - screenP1.y;
  let angle = Math.atan2(dy, dx);

  // Normalize angle
  if (opts.rotateWithLine && Math.abs(angle) > Math.PI / 2) {
    angle += Math.PI;
  }

  ctx.save();
  ctx.translate(midX, midY + opts.verticalOffset);

  if (opts.rotateWithLine) {
    ctx.rotate(angle);
  }

  // Use centralized styled text rendering
  renderStyledTextWithOverride(ctx, text, 0, 0);

  ctx.restore();
}

/**
 * 🏢 ENTERPRISE COMPLIANCE CHECKLIST:
 *
 * ✅ Single source of truth for distance labels
 * ✅ Full TypeScript (ZERO any)
 * ✅ World coordinate distance calculation (not screen!)
 * ✅ Integration with centralized TextStyleStore
 * ✅ Support for both preview and final rendering
 * ✅ Optional background box rendering
 * ✅ Rotation support for inline labels
 * ✅ Configurable decimal precision
 * ✅ Enterprise documentation (JSDoc)
 */
