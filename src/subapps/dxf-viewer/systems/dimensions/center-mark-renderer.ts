/**
 * ADR-362 Phase L1 — Center mark canvas renderer.
 *
 * Renders `CenterMarkGeometry` (cross + optional extension lines) to a 2D
 * canvas context. Stroke colour is resolved from `dimclrd` via the shared
 * colour resolver (DIMSTYLE ByBlock/ByLayer/explicit ACI).
 *
 * Stateless pure function — no class, no stores, no React.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md §D13
 */

import type { CenterMarkGeometry } from './center-mark-builder';
import type { DimLineSegment } from './dim-geometry-builder';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { resolveDimColor } from '../../rendering/entities/dimension/dim-color-resolver';

/**
 * Draw center mark geometry onto `ctx`.
 *
 * @param ctx         - Canvas 2D context (must be in the correct transform state).
 * @param geometry    - Output of `computeCenterMarkGeometry`.
 * @param dimclrd     - DIMSTYLE color ACI for the dimension line.
 * @param transform   - Current view transform (world → screen).
 * @param layerColour - Layer colour for ByLayer/ByBlock resolution.
 */
export function renderCenterMark(
  ctx: CanvasRenderingContext2D,
  geometry: CenterMarkGeometry,
  dimclrd: number,
  transform: ViewTransform,
  layerColour: string | undefined,
): void {
  if (geometry.crossLines.length === 0 && geometry.extLines.length === 0) return;

  // ADR-362 Round 4.1 (2026-05-19) — CSS viewport via getBoundingClientRect (not
  // backing-store ctx.canvas.width/height). Mirror του DimensionRenderer.toScreen:
  // με DPR ≠ 1 (browser zoom / HiDPI) τα cross+extension lines έπεφταν σε λάθος
  // screen Y. SSoT canonical pattern: BaseEntityRenderer.getViewport.
  const rect = ctx.canvas.getBoundingClientRect();
  const viewport = {
    width: rect.width || ctx.canvas.width,
    height: rect.height || ctx.canvas.height,
  };
  const toScreen = (p: Point2D): Point2D =>
    CoordinateTransforms.worldToScreen(p, transform, viewport);

  ctx.save();
  ctx.strokeStyle = resolveDimColor(dimclrd, layerColour);
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';

  const strokeSeg = (seg: DimLineSegment): void => {
    const a = toScreen(seg.start);
    const b = toScreen(seg.end);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  for (const seg of geometry.crossLines) strokeSeg(seg);
  for (const seg of geometry.extLines) strokeSeg(seg);

  ctx.restore();
}
