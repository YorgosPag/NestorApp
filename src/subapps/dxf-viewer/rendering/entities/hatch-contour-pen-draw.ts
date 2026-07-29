/**
 * ADR-507 — canvas stroke of a hatch's contour-pen boundary (ArchiCAD «περίγραμμα»).
 *
 * Extracted from `HatchRenderer.ts` (N.7.1 — that file sits at the 500-line SRP limit).
 * Pure canvas-drawing leaf: no store reads, no visibility decision (the caller has
 * already gated on `isHatchContourVisible`) — this only sets pen style and strokes.
 *
 * @see ../../bim/hatch/hatch-properties — `isHatchContourVisible` (the visibility SSoT)
 * @see ./base-entity-style-helpers — `applyEntityLinetypeDash` (every other entity's dash path)
 */

import type { HatchContourPen } from '../../types/entities';
import { resolveHatchLineWidthPx } from '../../bim/hatch/hatch-properties';
import { applyEntityLinetypeDash } from './base-entity-style-helpers';
import { resolveLinetypePatternMm } from '../linetype-dash-resolver';

/**
 * Sets strokeStyle/lineWidth/dash from the contour pen (falling back to the hatch's own
 * fill color / a 1px hairline / solid), then calls `drawPath` and strokes.
 *
 * ADR-510 Φ2 — resolve-then-reset pairing (mirror `BaseEntityRenderer.setupStyle`): reset
 * to solid first, THEN apply the resolved pattern iff one exists. Absent/unknown/
 * `'Continuous'` `linetypeName` resolves to `[]` → `applyEntityLinetypeDash` no-ops → stays
 * solid (zero regression for every pre-existing saved hatch).
 */
export function strokeHatchContourPen(
  ctx: CanvasRenderingContext2D,
  contour: HatchContourPen | undefined,
  fallbackColor: string,
  scale: number,
  drawPath: () => void,
): void {
  ctx.strokeStyle = contour?.color ?? fallbackColor;
  ctx.lineWidth = contour?.lineweightMm !== undefined ? resolveHatchLineWidthPx(contour.lineweightMm) : 1;
  ctx.setLineDash([]);
  applyEntityLinetypeDash(ctx, { dashMm: resolveLinetypePatternMm(contour?.linetypeName) }, scale);
  drawPath();
  ctx.stroke();
}
