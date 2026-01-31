/**
 * 🏢 ENTERPRISE DISTANCE LABEL UTILITIES
 *
 * Centralized distance label rendering for both PreviewCanvas and main canvas.
 * Pattern: Autodesk AutoCAD / Bentley MicroStation - Single source of truth
 *
 * @module distance-label-utils
 * @version 2.0.0 - ADR-082: Enterprise Number Formatting System
 * @since 2026-01-27
 * @updated 2026-01-31 - Added locale-aware formatting via FormatterRegistry
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
 * - 🆕 ADR-082: Locale-aware number formatting via FormatterRegistry
 *
 * @see {@link docs/centralized_systems.md#adr-041} - Distance Label Centralization
 * @see {@link docs/centralized_systems.md#adr-082} - Enterprise Number Formatting
 */

import type { Point2D } from '../../types/Types';
import { getTextPreviewStyleWithOverride, renderStyledTextWithOverride } from '../../../hooks/useTextPreviewStyle';
// 🏢 ADR-065: Centralized Distance Calculation
// 🏢 ADR-066: Centralized Angle Calculation
import { calculateDistance, calculateAngle } from './geometry-rendering-utils';
// 🏢 ADR-082: Enterprise Number Formatting
import { FormatterRegistry, type Precision } from '../../../formatting';

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
 * 🏢 ADR-065: Now delegates to centralized calculateDistance
 *
 * CRITICAL: Always use WORLD coordinates for distance calculation!
 * Screen coordinates would give zoom-dependent incorrect distances.
 *
 * @param worldP1 - First point in world coordinates
 * @param worldP2 - Second point in world coordinates
 * @returns Distance in world units
 */
export function calculateWorldDistance(worldP1: Point2D, worldP2: Point2D): number {
  return calculateDistance(worldP1, worldP2);
}

/**
 * 🏢 ENTERPRISE: Format distance value for display
 * Canonical source for distance formatting across DXF Viewer
 *
 * 🆕 ADR-082: Now supports locale-aware formatting via FormatterRegistry.
 * For locale-aware formatting, use `formatDistanceLocale()` instead.
 *
 * @param distance - Distance value in world units
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "123.45")
 *
 * @see formatDistanceLocale - For locale-aware formatting
 */
export function formatDistance(distance: number, decimals: number = 2): string {
  if (distance < Math.pow(10, -decimals)) return (0).toFixed(decimals);
  return distance.toFixed(decimals);
}

/**
 * 🏢 ADR-082: Format distance value with locale awareness
 *
 * Uses FormatterRegistry for locale-aware decimal separators:
 * - Greek (el-GR): 1.234,56
 * - English (en-US): 1,234.56
 *
 * @param distance - Distance value in world units
 * @param decimals - Number of decimal places (default: 2)
 * @returns Locale-formatted string
 *
 * @example
 * // In Greek locale:
 * formatDistanceLocale(1234.56) // → "1.234,56"
 *
 * // In English locale:
 * formatDistanceLocale(1234.56) // → "1,234.56"
 */
export function formatDistanceLocale(distance: number, decimals: number = 2): string {
  if (distance < Math.pow(10, -decimals)) {
    const registry = FormatterRegistry.getInstance();
    return registry.formatDistance(0, decimals as Precision);
  }
  const registry = FormatterRegistry.getInstance();
  return registry.formatDistance(distance, decimals as Precision);
}

/**
 * 🏢 ENTERPRISE: Format angle value for display
 * Canonical source for angle formatting across DXF Viewer
 *
 * 🏢 ADR-069: Centralized Number Formatting
 * 🆕 ADR-082: For locale-aware formatting, use `formatAngleLocale()` instead.
 *
 * @param angle - Angle value in degrees
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string with degree symbol (e.g., "45.5°")
 *
 * @see formatAngleLocale - For locale-aware formatting
 */
export function formatAngle(angle: number, decimals: number = 1): string {
  if (Math.abs(angle) < Math.pow(10, -decimals)) return `${(0).toFixed(decimals)}°`;
  return `${angle.toFixed(decimals)}°`;
}

/**
 * 🏢 ADR-082: Format angle value with locale awareness
 *
 * Uses FormatterRegistry for locale-aware decimal separators:
 * - Greek (el-GR): 45,5°
 * - English (en-US): 45.5°
 *
 * @param angle - Angle value in degrees
 * @param decimals - Number of decimal places (default: 1)
 * @returns Locale-formatted string with degree symbol
 *
 * @example
 * // In Greek locale:
 * formatAngleLocale(45.5) // → "45,5°"
 *
 * // In English locale:
 * formatAngleLocale(45.5) // → "45.5°"
 */
export function formatAngleLocale(angle: number, decimals: number = 1): string {
  if (Math.abs(angle) < Math.pow(10, -decimals)) {
    const registry = FormatterRegistry.getInstance();
    return registry.formatAngle(0, decimals as Precision);
  }
  const registry = FormatterRegistry.getInstance();
  return registry.formatAngle(angle, decimals as Precision);
}

/**
 * 🏢 ADR-081: Format decimal value as percentage
 * Canonical source for percentage formatting across DXF Viewer
 *
 * Replaces inline `Math.round(value * 100)%` patterns used for:
 * - Opacity display (0-1 → 0%-100%)
 * - Zoom display (0.5-10 → 50%-1000%)
 * - Alpha channel display
 *
 * @param value - Decimal value (0-1 range typically, but handles any)
 * @param includeSymbol - Whether to include "%" symbol (default: true)
 * @returns Formatted percentage string (e.g., "75%" or "75")
 *
 * @example
 * formatPercent(0.75)       // → "75%"
 * formatPercent(1.5)        // → "150%"
 * formatPercent(0.756)      // → "76%"
 * formatPercent(0.75, false) // → "75"
 */
export function formatPercent(value: number, includeSymbol: boolean = true): string {
  const percent = Math.round(value * 100);
  return includeSymbol ? `${percent}%` : String(percent);
}

/**
 * 🏢 ADR-082: Format coordinate value with locale awareness
 *
 * Uses FormatterRegistry for locale-aware decimal separators.
 *
 * @param value - Coordinate value (X or Y)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Locale-formatted coordinate string
 */
export function formatCoordinateLocale(value: number, decimals: number = 2): string {
  const registry = FormatterRegistry.getInstance();
  return registry.formatCoordinate(value, decimals as Precision);
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
  // 🏢 ADR-066: Use centralized angle calculation
  let angle = calculateAngle(screenP1, screenP2);

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
  // 🏢 ADR-066: Use centralized angle calculation
  let angle = calculateAngle(screenP1, screenP2);

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
 * ✅ 🆕 ADR-082: Locale-aware formatting via FormatterRegistry
 *   - formatDistanceLocale() for locale-aware distance
 *   - formatAngleLocale() for locale-aware angles
 *   - formatCoordinateLocale() for locale-aware coordinates
 */
