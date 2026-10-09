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
import { resolveHatchContourWidthPx } from '../../bim/hatch/hatch-properties';
import { applyEntityLinetypeDash } from './base-entity-style-helpers';
import { resolveLinetypePatternMm } from '../linetype-dash-resolver';

/**
 * Sets strokeStyle/lineWidth/dash from the contour pen (a 1px hairline / solid when unset),
 * then calls `drawPath` and strokes.
 *
 * ADR-909 Β2.6 — `color` is the **resolved** pen colour (`contour.color ?? fill colour`, already
 * through the print policy when a print pass is active). This leaf used to read `contour.color`
 * itself, so a pen colour reached the paper raw; the caller owns the policy question now.
 *
 * ADR-510 Φ2 — resolve-then-reset pairing (mirror `BaseEntityRenderer.setupStyle`): reset
 * to solid first, THEN apply the resolved pattern iff one exists. Absent/unknown/
 * `'Continuous'` `linetypeName` resolves to `[]` → `applyEntityLinetypeDash` no-ops → stays
 * solid (zero regression for every pre-existing saved hatch).
 */
export function strokeHatchContourPen(
  ctx: CanvasRenderingContext2D,
  contour: HatchContourPen | undefined,
  color: string,
  scale: number,
  drawPath: () => void,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = resolveHatchContourWidthPx(contour?.lineweightMm);
  ctx.setLineDash([]);
  applyEntityLinetypeDash(ctx, { dashMm: resolveLinetypePatternMm(contour?.linetypeName) }, scale);
  drawPath();
  ctx.stroke();
}
