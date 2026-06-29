/**
 * 🏢 ADR-084: Canvas State Helper
 * Centralized canvas state management utilities
 *
 * ENTERPRISE ARCHITECTURE:
 * Eliminates 89+ hardcoded ctx.fillStyle/strokeStyle assignments
 * across 56 files by providing centralized helpers.
 *
 * Pattern: Autodesk AutoCAD / Bentley MicroStation - Unified Symbology
 *
 * @see ADR-084: Scattered Code Centralization
 * @see text-rendering-config.ts - LINE_DASH_PATTERNS, RENDER_LINE_WIDTHS
 * @since 2026-01-31
 */

import { LINE_DASH_PATTERNS, RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import type { LineDashPattern, RenderLineWidth } from '../../config/text-rendering-config';
// 🏢 ADR-119: Centralized Opacity Constants
import { OPACITY } from '../../config/color-config';
// 🏢 SSoT device-pixel-ratio (μία πηγή για όλα τα canvas).
import { getDevicePixelRatio } from '../../systems/cursor/utils';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Canvas style options for centralized style application
 *
 * Supports both literal values and config keys for enterprise consistency.
 */
export interface CanvasStyleOptions {
  /** Fill color (hex, rgb, rgba, or named color) */
  fill?: string;
  /** Stroke color (hex, rgb, rgba, or named color) */
  stroke?: string;
  /** Line width - number or key from RENDER_LINE_WIDTHS */
  lineWidth?: number | keyof typeof RENDER_LINE_WIDTHS;
  /** Line dash pattern - array or key from LINE_DASH_PATTERNS */
  lineDash?: number[] | keyof typeof LINE_DASH_PATTERNS;
  /** Global alpha (opacity) 0.0 - 1.0 */
  opacity?: number;
  /** Font string for text rendering */
  font?: string;
  /** Text alignment */
  textAlign?: CanvasTextAlign;
  /** Text baseline */
  textBaseline?: CanvasTextBaseline;
  /** Line cap style */
  lineCap?: CanvasLineCap;
  /** Line join style */
  lineJoin?: CanvasLineJoin;
  /** Shadow blur radius */
  shadowBlur?: number;
  /** Shadow color */
  shadowColor?: string;
  /** Shadow offset X */
  shadowOffsetX?: number;
  /** Shadow offset Y */
  shadowOffsetY?: number;
}

// ============================================================================
// MAIN HELPER
// ============================================================================

/**
 * 🏢 ENTERPRISE: Execute callback with canvas state saved and restored
 *
 * This is the PRIMARY helper for canvas operations. It ensures:
 * 1. Canvas state is saved before style changes
 * 2. Styles are applied consistently
 * 3. Canvas state is restored after operation (even on errors)
 *
 * @param ctx - Canvas 2D rendering context
 * @param style - Style options to apply
 * @param callback - Drawing operations to execute
 *
 * @example
 * // Before (scattered code):
 * ctx.save();
 * ctx.fillStyle = '#ff0000';
 * ctx.globalAlpha = 0.5;
 * ctx.fillRect(0, 0, 100, 100);
 * ctx.restore();
 *
 * // After (centralized):
 * withCanvasState(ctx, { fill: '#ff0000', opacity: 0.5 }, () => {
 *   ctx.fillRect(0, 0, 100, 100);
 * });
 */
export function withCanvasState(
  ctx: CanvasRenderingContext2D,
  style: CanvasStyleOptions,
  callback: () => void
): void {
  ctx.save();
  try {
    applyCanvasStyle(ctx, style);
    callback();
  } finally {
    ctx.restore();
  }
}

/**
 * 🏢 ENTERPRISE: Async version of withCanvasState
 *
 * For async drawing operations that need state preservation.
 *
 * @param ctx - Canvas 2D rendering context
 * @param style - Style options to apply
 * @param callback - Async drawing operations to execute
 */
export async function withCanvasStateAsync(
  ctx: CanvasRenderingContext2D,
  style: CanvasStyleOptions,
  callback: () => Promise<void>
): Promise<void> {
  ctx.save();
  try {
    applyCanvasStyle(ctx, style);
    await callback();
  } finally {
    ctx.restore();
  }
}

// ============================================================================
// STYLE APPLICATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Apply style options to canvas context
 *
 * Applies all specified style options to the canvas context.
 * Supports both literal values and config keys from centralized constants.
 *
 * @param ctx - Canvas 2D rendering context
 * @param style - Style options to apply
 *
 * @example
 * // Using literal values
 * applyCanvasStyle(ctx, { fill: '#ff0000', lineWidth: 2 });
 *
 * // Using config keys
 * applyCanvasStyle(ctx, { lineWidth: 'NORMAL', lineDash: 'DASHED' });
 */
export function applyCanvasStyle(
  ctx: CanvasRenderingContext2D,
  style: CanvasStyleOptions
): void {
  // Opacity (must be set before colors for correct blending)
  if (style.opacity !== undefined) {
    ctx.globalAlpha = style.opacity;
  }

  // Colors
  if (style.fill) {
    ctx.fillStyle = style.fill;
  }
  if (style.stroke) {
    ctx.strokeStyle = style.stroke;
  }

  // Line properties
  if (style.lineWidth !== undefined) {
    ctx.lineWidth = resolveLineWidth(style.lineWidth);
  }
  if (style.lineDash !== undefined) {
    const dash = resolveLineDash(style.lineDash);
    ctx.setLineDash(dash);
  }
  if (style.lineCap) {
    ctx.lineCap = style.lineCap;
  }
  if (style.lineJoin) {
    ctx.lineJoin = style.lineJoin;
  }

  // Text properties
  if (style.font) {
    ctx.font = style.font;
  }
  if (style.textAlign) {
    ctx.textAlign = style.textAlign;
  }
  if (style.textBaseline) {
    ctx.textBaseline = style.textBaseline;
  }

  // Shadow properties
  if (style.shadowBlur !== undefined) {
    ctx.shadowBlur = style.shadowBlur;
  }
  if (style.shadowColor) {
    ctx.shadowColor = style.shadowColor;
  }
  if (style.shadowOffsetX !== undefined) {
    ctx.shadowOffsetX = style.shadowOffsetX;
  }
  if (style.shadowOffsetY !== undefined) {
    ctx.shadowOffsetY = style.shadowOffsetY;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Set fill style with optional opacity
 *
 * @param ctx - Canvas 2D rendering context
 * @param color - Fill color
 * @param opacity - Optional opacity (0.0 - 1.0)
 *
 * @example
 * setFillStyle(ctx, UI_COLORS.WHITE, 0.5);
 * ctx.fillRect(0, 0, 100, 100);
 */
export function setFillStyle(
  ctx: CanvasRenderingContext2D,
  color: string,
  opacity?: number
): void {
  if (opacity !== undefined) {
    ctx.globalAlpha = opacity;
  }
  ctx.fillStyle = color;
}

/**
 * 🏢 ENTERPRISE: Set stroke style with optional width and dash
 *
 * @param ctx - Canvas 2D rendering context
 * @param color - Stroke color
 * @param width - Optional line width (number or config key)
 * @param dash - Optional dash pattern (array or config key)
 *
 * @example
 * setStrokeStyle(ctx, UI_COLORS.WHITE, 'NORMAL', 'DASHED');
 * ctx.strokeRect(0, 0, 100, 100);
 */
export function setStrokeStyle(
  ctx: CanvasRenderingContext2D,
  color: string,
  width?: number | keyof typeof RENDER_LINE_WIDTHS,
  dash?: number[] | keyof typeof LINE_DASH_PATTERNS
): void {
  ctx.strokeStyle = color;
  if (width !== undefined) {
    ctx.lineWidth = resolveLineWidth(width);
  }
  if (dash !== undefined) {
    ctx.setLineDash(resolveLineDash(dash));
  }
}

/**
 * 🏢 ENTERPRISE: Reset canvas state to defaults
 *
 * Useful for cleaning up after complex drawing operations.
 *
 * @param ctx - Canvas 2D rendering context
 */
export function resetCanvasState(ctx: CanvasRenderingContext2D): void {
  ctx.globalAlpha = OPACITY.OPAQUE; // 🏢 ADR-119: Centralized opacity
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * 🏢 SSoT — DPR-aware full canvas clear.
 *
 * Το idiom «reset σε identity → clearRect ολόκληρου του backing store → ξανα-set
 * το DPR scale» ήταν copy-pasted σε ~7 σημεία (PreviewRenderer, dxf-bitmap-cache,
 * ProposalGhostOverlay, GuideFollowGhostOverlay, CanvasManager, + 19 ghost hooks).
 * ΜΙΑ πηγή εδώ· χρησιμοποιεί τον κανονικό `getDevicePixelRatio()` (όχι σκόρπιο
 * `window.devicePixelRatio || 1`).
 *
 * @param canvas - το canvas προς καθαρισμό
 * @param ctx - 2D context· default `canvas.getContext('2d')`
 */
export function clearCanvasDpr(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D | null = canvas.getContext('2d'),
): void {
  if (!ctx) return;
  const dpr = getDevicePixelRatio();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Size `canvas` to fill `container` at the device pixel ratio and return a 2D context ready to
 * draw in CSS px (origin pre-scaled by dpr + cleared), or null if no 2D context.
 *
 * ΜΙΑ πηγή για το «overlay canvas που καλύπτει το viewport»: backing store = clientW/H × dpr,
 * draw space = CSS px (ώστε ένα 7px grip = πραγματικά 7 CSS px). Ήταν copy-pasted verbatim στα
 * Canvas2D overlays (`BimGripOverlay2D`, `DxfHoverGlowOverlay2D`, …) με σκόρπιο
 * `window.devicePixelRatio || 1` — εδώ χρησιμοποιεί τον κανονικό `getDevicePixelRatio()`.
 *
 * @param canvas    το overlay canvas
 * @param container ο γονέας που καθορίζει το CSS μέγεθος (clientWidth/Height)
 * @param desynchronized ADR-549 Phase 5 — low-latency present hint (αποσυνδέει το cursor-layer
 *   compositing από τον vsync-locked compositor). Default `false`· true μόνο για cursor-critical
 *   overlays (π.χ. το unified 3D overlay-dispatch). Εφαρμόζεται στην ΠΡΩΤΗ δημιουργία context.
 */
export function sizeCanvasToContainerDpr(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  desynchronized = false,
): CanvasRenderingContext2D | null {
  const dpr = getDevicePixelRatio();
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const dw = Math.round(cw * dpr);
  const dh = Math.round(ch * dpr);
  if (canvas.width !== dw || canvas.height !== dh) {
    canvas.width = dw;
    canvas.height = dh;
  }
  const ctx = canvas.getContext('2d', { desynchronized });
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  return ctx;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve line width from number or config key
 */
function resolveLineWidth(width: number | keyof typeof RENDER_LINE_WIDTHS): number {
  if (typeof width === 'number') {
    return width;
  }
  return RENDER_LINE_WIDTHS[width];
}

/**
 * Resolve line dash pattern from array or config key
 */
function resolveLineDash(dash: number[] | keyof typeof LINE_DASH_PATTERNS): number[] {
  if (Array.isArray(dash)) {
    return dash;
  }
  // LINE_DASH_PATTERNS values are readonly tuples, convert to mutable array
  return [...LINE_DASH_PATTERNS[dash]];
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { LineDashPattern, RenderLineWidth };
