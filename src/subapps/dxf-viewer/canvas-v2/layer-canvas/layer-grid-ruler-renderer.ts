/**
 * LAYER GRID RENDERER — Standalone grid-drawing function for LayerRenderer.
 * ADR-065: Extracted from LayerRenderer.ts for SRP compliance.
 *
 * ⚠️ Ruler rendering removed 2026-06-16 (ADR-462 Follow-up 3): the legacy
 * `renderRulers` here was DEAD (imported by LayerRenderer but never called — the
 * legacy path draws grid only, and the UI composite registers only snap/selection).
 * The single, VISIBLE ruler renderer is `rendering/ui/ruler/RulerRenderer.ts`
 * (instantiated by DxfCanvas, drawn by dxf-canvas-renderer). Keeping a second ruler
 * implementation here was a triplicate that misled two earlier display-unit wiring
 * attempts; only `renderGrid` remains (it is genuinely used by LayerRenderer).
 */

import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { GridSettings } from './layer-types';
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-042/044: Centralized rendering constants
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../../rendering/primitives/canvasPaths';

/**
 * Render grid (lines or dots style)
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
  settings: GridSettings
): void {
  ctx.save();

  ctx.strokeStyle = settings.color;
  ctx.globalAlpha = settings.opacity;
  ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;

  const gridSize = settings.size * transform.scale;

  if (gridSize < 5) {
    ctx.restore();
    return;
  }

  if (settings.style === 'lines') {
    ctx.beginPath();

    // Vertical lines
    const startX = (transform.offsetX % gridSize);
    for (let x = startX; x <= viewport.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height);
    }

    // Horizontal lines — UNIFIED WITH COORDINATETRANSFORMS
    const baseY = viewport.height - COORDINATE_LAYOUT.MARGINS.top;
    const startY = ((baseY - transform.offsetY) % gridSize);
    for (let y = startY; y <= viewport.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(viewport.width, y);
    }

    ctx.stroke();
  } else {
    // Grid dots — UNIFIED WITH COORDINATETRANSFORMS
    ctx.fillStyle = settings.color || UI_COLORS.BLACK;

    const startX = (transform.offsetX % gridSize);
    const baseY = viewport.height - COORDINATE_LAYOUT.MARGINS.top;
    const startY = ((baseY - transform.offsetY) % gridSize);

    for (let x = startX; x <= viewport.width; x += gridSize) {
      for (let y = startY; y <= viewport.height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, TAU);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}
