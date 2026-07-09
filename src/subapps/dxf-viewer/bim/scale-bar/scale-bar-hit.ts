/**
 * ADR-583 Φ2 — Graphic scale-bar hit-test SSoT (broad-phase padding + precise pick).
 *
 * The scale-bar mixes two length spaces (ADR-583 Φ2 two-formula split): its AXIS
 * span is a *scale-invariant* real model distance (`computeScaleBarGeometry`), while
 * its drawn *thickness* is **annotative** — a paper height folded through the SAME
 * `paperHeightToModel` the dimension arrows/text use, at the live `drawingScale`. A
 * pick must therefore gate on that live model thickness, exactly like the renderer.
 *
 * This is the ONE place the three hit-test consumers agree, so the bar is never
 * drawn one size but picked at another (N.18 anti-clone):
 *   - `ScaleBarRenderer.hitTest`     — the leaf renderer's own precise pick
 *   - `performDetailedHitTest`       — the spatial-index narrow phase (hover/click)
 *   - `BoundsCalculator` broad phase — pads the thin axis bbox by the half-thickness
 *
 * `sceneUnits` defaults to `'mm'`: canvas geometry is canonical-mm
 * (`reference_dxf_units_and_viewport_ssot`), so the pure bounds/hit-test callers —
 * which have no injected unit system — stay exact for the common case. The renderer
 * passes its injected `_sceneUnits` for cm/m scenes.
 *
 * @see bim/annotation-symbols/annotation-symbol-model-size.ts — the sibling SSoT (North arrow)
 * @see bim/geometry/scale-bar-geometry.ts — `computeScaleBarGeometry` (axis span DERIVED)
 * @see utils/annotation-scale.ts — `paperHeightToModel` (annotative sizing SSoT)
 * @see state/drawing-scale-store.ts — the live `drawingScale` SSoT (Revit annotation scale)
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { paperHeightToModel } from '../../utils/annotation-scale';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { computeScaleBarGeometry } from '../geometry/scale-bar-geometry';
import { pointToSegmentDistance } from '../../systems/guides/guide-types';
import { type ScaleBarEntity, DEFAULT_SCALE_BAR_HEIGHT_MM } from '../../types/scale-bar';

/**
 * Model-space HALF thickness (scene units) of the bar body at a given drawing scale.
 * Pure — no store read (testable / renderer fast-path). The band the pick gates on
 * is `±halfThickness` around the axis, mirroring `ScaleBarRenderer`'s drawn body.
 */
export function scaleBarModelHalfThickness(
  entity: ScaleBarEntity,
  drawingScale: number,
  sceneUnits: SceneUnits = 'mm',
): number {
  return paperHeightToModel(entity.barHeightMm ?? DEFAULT_SCALE_BAR_HEIGHT_MM, drawingScale, sceneUnits) / 2;
}

/**
 * Convenience: model-space half thickness using the LIVE `drawingScale` SSoT
 * (frame-time getter, ADR-040 — no subscription). Used by the pure bounds/hit-test
 * paths that only know the paper `barHeightMm`.
 */
export function scaleBarModelHalfThicknessLive(
  entity: ScaleBarEntity,
  sceneUnits: SceneUnits = 'mm',
): number {
  return scaleBarModelHalfThickness(entity, useDrawingScaleStore.getState().drawingScale, sceneUnits);
}

/**
 * Precise pick: distance from `point` to the bar AXIS segment (position → derived
 * `endPosition`), gated by the live annotative half-thickness + `tolerance`. All
 * world-space (broad-phase already filtered by `BoundsCalculator`). This IS the
 * narrow-phase the renderer + spatial index share.
 */
export function hitTestScaleBarAxis(
  entity: ScaleBarEntity,
  point: Point2D,
  tolerance: number,
  sceneUnits: SceneUnits = 'mm',
): boolean {
  // `drawingScale`/`sceneUnits` are ignored by the span (scale-invariant) — pass (1, unit).
  const { endPosition } = computeScaleBarGeometry(entity, 1, sceneUnits);
  const band = scaleBarModelHalfThicknessLive(entity, sceneUnits) + tolerance;
  return pointToSegmentDistance(point, entity.position, endPosition) <= band;
}
