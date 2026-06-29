/**
 * view-cube-scissor.ts — pure rect math for the ViewCube scissored sub-viewport (ADR-553).
 *
 * The ViewCube no longer owns a second WebGLRenderer/GPU context. Instead the MAIN renderer
 * draws it as a scissored sub-viewport in the corner, at the END of the frame (after all
 * post-FX / outline — AO-immune by construction, like `renderOutlineOverlayToScreen`).
 *
 * The corner rectangle is DERIVED from the transparent DOM hit-layer's bounding box relative
 * to the main canvas, so the gizmo position lives in ONE place (CSS on the hit-layer) and the
 * scissor follows it — no duplicated `top:12px; 160px` constants.
 *
 * WebGL viewport/scissor origin is BOTTOM-left; CSS rects are TOP-left → the Y axis is flipped
 * here. Values are returned in CSS pixels: Three.js `setViewport`/`setScissor` multiply by the
 * renderer pixel-ratio internally, so callers must NOT pre-multiply by DPR.
 */

/** Minimal DOMRect-like shape (left/top/width/height) — keeps the helper unit-testable in jsdom. */
export interface ScissorSourceRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Scissor/viewport box in CSS pixels, WebGL bottom-left origin. */
export interface ScissorRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Map the hit-layer rect into a WebGL scissor box relative to the main canvas.
 *
 * @param hitRect      hit-layer `getBoundingClientRect()` (viewport coords).
 * @param canvasRect   main canvas `getBoundingClientRect()` (viewport coords).
 * @param canvasCssHeight  main canvas CSS height (`renderer.getSize().y` — DPR-independent).
 * @returns scissor box in CSS px (bottom-left origin), or `null` when degenerate (zero/negative
 *          size, e.g. the hit-layer is `display:none` on a narrow viewport).
 */
export function computeViewCubeScissorRect(
  hitRect: ScissorSourceRect,
  canvasRect: ScissorSourceRect,
  canvasCssHeight: number,
): ScissorRect | null {
  const w = hitRect.width;
  const h = hitRect.height;
  if (w <= 0 || h <= 0 || canvasCssHeight <= 0) return null;

  const x = hitRect.left - canvasRect.left;
  const topOffset = hitRect.top - canvasRect.top;
  // Flip: WebGL y grows upward from the bottom edge of the canvas.
  const y = canvasCssHeight - topOffset - h;

  return { x, y, w, h };
}
