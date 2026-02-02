/**
 * 🏢 CENTRALIZED ORIGIN MARKER UTILITIES
 * ======================================
 *
 * Single source of truth για όλες τις origin marker υλοποιήσεις.
 * Εξαλείφει duplicate κώδικα από DxfRenderer και LayerRenderer.
 *
 * @see ADR-102: Origin Markers Centralization
 * @since 2026-01-31
 *
 * USAGE:
 * ```typescript
 * import { getOriginScreenPosition, drawOriginMarker } from '../rendering/ui/origin/OriginMarkerUtils';
 *
 * const screenOrigin = getOriginScreenPosition(transform, viewport);
 * drawOriginMarker(ctx, screenOrigin, { variant: 'dxf' });
 * ```
 *
 * HISTORY:
 * - 2026-01-31: Initial creation - centralized from DxfRenderer + LayerRenderer
 */

import { CoordinateTransforms } from '../../core/CoordinateTransforms';
// 🏢 ADR-088: Centralized Pixel-Perfect Alignment
import { pixelPerfect } from '../../entities/shared/geometry-rendering-utils';
// 🏢 ADR-044: Centralized Line Widths, ADR-042: Centralized UI Fonts
import { UI_FONTS, RENDER_LINE_WIDTHS } from '../../../config/text-rendering-config';
import { UI_COLORS } from '../../../config/color-config';
import type { Point2D, ViewTransform, Viewport } from '../../types/Types';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { WORLD_ORIGIN } from '../../../config/geometry-constants';

// ===== CONFIGURATION =====

/**
 * 🏢 ENTERPRISE: Origin Marker Configuration
 *
 * Centralized constants for origin marker rendering.
 * Eliminates hardcoded values (20px, -45, etc.) scattered across renderers.
 */
export const ORIGIN_MARKER_CONFIG = {
  /** Marker arm length in pixels */
  ARM_LENGTH: 20,

  /** Line width for marker arms (using centralized constant) */
  LINE_WIDTH: RENDER_LINE_WIDTHS.THICK,

  /** Font for labels (using centralized constant) */
  FONT: UI_FONTS.MONOSPACE.BOLD,

  /** Colors per canvas type */
  COLORS: {
    /** Orange - DXF canvas origin marker */
    DXF: UI_COLORS.DRAWING_HIGHLIGHT,
    /** Blue - Layer canvas origin marker */
    LAYER: UI_COLORS.BUTTON_PRIMARY,
    /** Magenta - Debug overlay origin marker */
    DEBUG: UI_COLORS.DEBUG_ORIGIN,
  },

  /** Label text positions relative to origin (in pixels) */
  LABEL_OFFSET: {
    /** DXF label: top-left of origin */
    DXF: { x: -45, y: -10 },
    /** Layer label: bottom-right of origin */
    LAYER: { x: 5, y: 30 },
    /** Debug label: right of crosshair */
    DEBUG: { x: 25, y: 5 },
  },

  /** Label text content */
  LABELS: {
    DXF: 'DXF',
    LAYER: 'LAYER',
    DEBUG: '(0,0)',
  },
} as const;

// ===== TYPES =====

/**
 * Origin marker variant type
 * - 'dxf': Orange L-shape (RIGHT + UP) - used in DxfRenderer
 * - 'layer': Blue L-shape (RIGHT + UP) - used in LayerRenderer
 * - 'debug': Magenta crosshair (full) - used in OriginMarkersRenderer
 *
 * 🏢 ENTERPRISE (2026-02-01): DXF and LAYER now draw IDENTICAL L-shapes!
 * Only color differs. This fixes visual misalignment when panel opens/closes.
 */
export type OriginMarkerVariant = 'dxf' | 'layer' | 'debug';

/**
 * Options for drawing origin marker
 */
export interface OriginMarkerOptions {
  /** Marker variant determines shape and color */
  variant: OriginMarkerVariant;
  /** Show text label (default: true) */
  showLabel?: boolean;
  /** Override default color */
  customColor?: string;
  /** Override default arm length in pixels */
  customSize?: number;
}

// ===== CORE FUNCTIONS =====

/**
 * 🏢 ENTERPRISE: Calculate origin screen position from world coordinates
 *
 * Centralizes the world (0,0) → screen coordinate transformation.
 * Applies pixel-perfect alignment for crisp rendering.
 *
 * @param transform - Current view transform (scale, offsetX, offsetY)
 * @param viewport - Current viewport dimensions
 * @returns Screen coordinates of world origin (0,0)
 *
 * @example
 * ```typescript
 * const screenOrigin = getOriginScreenPosition(transform, viewport);
 * // screenOrigin = { x: 450.5, y: 320.5 } (pixel-perfect aligned)
 * ```
 */
export function getOriginScreenPosition(
  transform: ViewTransform,
  viewport: Viewport
): Point2D {
  // 🏢 ADR-118: Using centralized WORLD_ORIGIN constant
  const screenOrigin = CoordinateTransforms.worldToScreen(WORLD_ORIGIN, transform, viewport);

  // 🏢 ADR-088: Apply pixel-perfect alignment for crisp 1px lines
  return {
    x: pixelPerfect(screenOrigin.x),
    y: pixelPerfect(screenOrigin.y),
  };
}

/**
 * 🏢 ENTERPRISE: Draw origin marker on canvas
 *
 * Renders origin marker with UNIFIED shape (L-shape: RIGHT + UP).
 * All variants draw IDENTICAL geometry - only color differs.
 * This ensures the visual intersection point is EXACTLY at screenOrigin.
 *
 * @param ctx - Canvas 2D rendering context
 * @param screenOrigin - Screen position of origin (use getOriginScreenPosition)
 * @param options - Marker configuration
 *
 * 🔧 FIX (2026-02-01): Previously DXF drew UP+LEFT, LAYER drew DOWN+RIGHT
 * This caused visual misalignment when panel opened/closed because the
 * "optical center" was different even though screenOrigin was identical.
 * Now ALL variants draw the SAME L-shape (RIGHT + UP from origin).
 *
 * @example
 * ```typescript
 * // DXF canvas - Orange L-shape
 * drawOriginMarker(ctx, screenOrigin, { variant: 'dxf' });
 *
 * // Layer canvas - Blue L-shape (SAME shape as DXF, different color)
 * drawOriginMarker(ctx, screenOrigin, { variant: 'layer' });
 *
 * // Debug overlay - Magenta crosshair (full cross for debugging)
 * drawOriginMarker(ctx, screenOrigin, { variant: 'debug' });
 * ```
 */
export function drawOriginMarker(
  ctx: CanvasRenderingContext2D,
  screenOrigin: Point2D,
  options: OriginMarkerOptions
): void {
  const { variant, showLabel = true, customColor, customSize } = options;
  const { x: originX, y: originY } = screenOrigin;

  // Get configuration values (custom or default)
  const armLength = customSize ?? ORIGIN_MARKER_CONFIG.ARM_LENGTH;
  const color = customColor ?? ORIGIN_MARKER_CONFIG.COLORS[variant.toUpperCase() as keyof typeof ORIGIN_MARKER_CONFIG.COLORS];

  ctx.save();

  // Setup stroke style
  ctx.strokeStyle = color;
  ctx.lineWidth = ORIGIN_MARKER_CONFIG.LINE_WIDTH;
  ctx.lineCap = 'square'; // 🏢 Enterprise: Crisp corners at origin point
  ctx.beginPath();

  // 🏢 ENTERPRISE FIX (2026-02-01): UNIFIED L-shape for DXF and LAYER
  // PROBLEM: Different arm directions caused visual misalignment
  // SOLUTION: Both variants draw IDENTICAL L-shape (RIGHT + UP from origin)
  //           The intersection point is EXACTLY at screenOrigin for both
  switch (variant) {
    case 'dxf':
    case 'layer':
      // 🏢 UNIFIED L-shape: RIGHT + UP arms (both variants identical!)
      // Horizontal arm (RIGHT from origin)
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + armLength, originY);
      // Vertical arm (UP from origin - negative Y in canvas coords)
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX, originY - armLength);
      break;

    case 'debug':
      // Full crosshair: all 4 directions (for debugging/calibration)
      // Horizontal line (LEFT to RIGHT through origin)
      ctx.moveTo(originX - armLength, originY);
      ctx.lineTo(originX + armLength, originY);
      // Vertical line (TOP to BOTTOM through origin)
      ctx.moveTo(originX, originY - armLength);
      ctx.lineTo(originX, originY + armLength);
      break;
  }

  ctx.stroke();

  // Draw label if enabled (labels can still have different positions per variant)
  if (showLabel) {
    ctx.fillStyle = color;
    ctx.font = ORIGIN_MARKER_CONFIG.FONT;

    // Get label offset based on variant
    const labelOffset = variant === 'dxf'
      ? ORIGIN_MARKER_CONFIG.LABEL_OFFSET.DXF
      : variant === 'layer'
        ? ORIGIN_MARKER_CONFIG.LABEL_OFFSET.LAYER
        : ORIGIN_MARKER_CONFIG.LABEL_OFFSET.DEBUG;

    // Get label text
    const labelText = ORIGIN_MARKER_CONFIG.LABELS[variant.toUpperCase() as keyof typeof ORIGIN_MARKER_CONFIG.LABELS];

    ctx.fillText(labelText, originX + labelOffset.x, originY + labelOffset.y);
  }

  ctx.restore();
}

/**
 * 🏢 ENTERPRISE: Convenience function - get screen position and draw in one call
 *
 * Combines getOriginScreenPosition + drawOriginMarker for simpler usage.
 *
 * @param ctx - Canvas 2D rendering context
 * @param transform - Current view transform
 * @param viewport - Current viewport dimensions
 * @param options - Marker configuration
 *
 * @example
 * ```typescript
 * // Single call to render origin marker
 * renderOriginMarker(ctx, transform, viewport, { variant: 'dxf' });
 * ```
 */
export function renderOriginMarker(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
  options: OriginMarkerOptions
): void {
  const screenOrigin = getOriginScreenPosition(transform, viewport);
  drawOriginMarker(ctx, screenOrigin, options);
}
