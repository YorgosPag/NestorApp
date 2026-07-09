/**
 * ADR-583 Φ2 — Graphic scale-bar geometry computation (pure DERIVED cache).
 *
 * Derives `ScaleBarGeometry` from a `ScaleBarEntity`'s parameters (the SSoT).
 * Idempotent + side-effect free. THE correctness rule (ADR-583 Φ2, two-formula
 * split): the bar's SPAN and its division boundaries are REAL model distances —
 * routed through `realDistanceToModelMm(length, unit)`, a *scale-INVARIANT*
 * canonical-mm value that NEVER touches `drawingScale` / `paperHeightToModel`.
 * The bar's *annotative* thickness / tick length / label height are the renderer's
 * job (they fold through `paperHeightToModel` at draw time), so this function does
 * NOT need them — `drawingScale` / `sceneUnits` are accepted only to keep every
 * geometry-compute call site uniform, hence the `_` prefix.
 *
 * Units: every emitted scalar is canonical-mm along the bar axis (ADR-462).
 *
 * @see types/scale-bar.ts — `ScaleBarEntity` / `ScaleBarGeometry` (the SSoT + cache)
 * @see utils/scene-units.ts — `realDistanceToModelMm` (span, scale-invariant)
 * @see utils/scale-bar-divisions.ts — division / subdivision boundary math
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { realDistanceToModelMm } from '../../utils/scene-units';
import {
  computeDivisionBoundaries,
  computeDivisionStep,
  computeSubdivisionOffsets,
} from '../../utils/scale-bar-divisions';
import { formatLengthForDisplay } from '../../config/display-length-format';
import { DISPLAY_UNIT_LABELS } from '../../config/units';
import type {
  ScaleBarEntity,
  ScaleBarGeometry,
  ScaleBarBoundaryLabel,
} from '../../types/scale-bar';

/**
 * Compute the derived `ScaleBarGeometry` for a scale-bar entity. Pure SSoT.
 *
 * `_drawingScale` / `_sceneUnits` are intentionally unused here — the span is
 * scale-invariant (see file header). They are part of the uniform geometry-compute
 * signature the Φ2.1 renderer calls; annotative sizing happens at render time.
 */
export function computeScaleBarGeometry(
  entity: ScaleBarEntity,
  _drawingScale: number,
  _sceneUnits: SceneUnits,
): ScaleBarGeometry {
  const { position, angleRad, length, unit, divisions, subdivisions } = entity;

  // ── Span (REAL model distance, scale-invariant) ────────────────────────────
  const totalModelLengthMm = realDistanceToModelMm(length, unit);

  const dirX = Math.cos(angleRad);
  const dirY = Math.sin(angleRad);

  const endPosition: Point2D = {
    x: position.x + totalModelLengthMm * dirX,
    y: position.y + totalModelLengthMm * dirY,
  };

  // ── Major divisions + left extension (one division wide) ────────────────────
  const divisionBoundariesMm = computeDivisionBoundaries(totalModelLengthMm, divisions);
  const extensionModelLengthMm = computeDivisionStep(totalModelLengthMm, divisions);
  const subdivisionOffsetsMm = computeSubdivisionOffsets(extensionModelLengthMm, subdivisions);

  // ── Boundary numerals — real-world values via the length-format SSoT ────────
  const boundaryLabels: ScaleBarBoundaryLabel[] = divisionBoundariesMm.map((offsetMm) => ({
    offsetMm,
    text: formatLengthForDisplay(offsetMm, { unit, withUnit: false }),
  }));
  const unitText = DISPLAY_UNIT_LABELS[unit];

  // ── Length-extent bbox (canonical-mm) — thickness padded at render time ─────
  // The extension only exists when there are sub-ticks; otherwise the bar starts
  // at the '0' tick (position).
  const leftPoint: Point2D =
    subdivisions > 0
      ? { x: position.x - extensionModelLengthMm * dirX, y: position.y - extensionModelLengthMm * dirY }
      : position;

  const xs = [leftPoint.x, position.x, endPosition.x];
  const ys = [leftPoint.y, position.y, endPosition.y];
  const bbox = {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };

  return {
    endPosition,
    totalModelLengthMm,
    divisionBoundariesMm,
    extensionModelLengthMm,
    subdivisionOffsetsMm,
    boundaryLabels,
    unitText,
    bbox,
  };
}
