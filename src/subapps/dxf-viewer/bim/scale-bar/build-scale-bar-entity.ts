/**
 * ADR-583 Φ2 — Scale-bar entity factory (two-click construction).
 *
 * Derives a `ScaleBarEntity` from the two drag points:
 *   - `angleRad` = atan2 of (p1 − p0) — the single angular DOF (2nd click).
 *   - `length`   = the |p1 − p0| model distance projected back into the bar's
 *     real-world `unit` (inverse of `realDistanceToModelMm`, via the `mmToSceneUnits`
 *     SSoT — no magic numbers) then SNAPPED to a nice 1-2-5 value by
 *     `snapScaleBarLength`, so the bar always reads a round number (Revit/QGIS).
 *   - `position` = p0 (the '0' tick origin), kept in canonical-mm.
 *
 * Style / divisions / unit / annotative sizes come from `opts` with the shared
 * `DEFAULT_SCALE_BAR_*` fallbacks. Pure (aside from the fresh enterprise id).
 *
 * @see bim/scale-bar/scale-bar-length-snap.ts — `snapScaleBarLength`
 * @see utils/scene-units.ts — `realDistanceToModelMm` (forward) / `mmToSceneUnits` (inverse)
 * @see types/scale-bar.ts — `ScaleBarEntity` + `DEFAULT_SCALE_BAR_*`
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { snapScaleBarLength } from './scale-bar-length-snap';
import type {
  ScaleBarEntity,
  ScaleBarStyle,
  ScaleBarLabelPlacement,
} from '../../types/scale-bar';
import {
  DEFAULT_SCALE_BAR_DIVISIONS,
  DEFAULT_SCALE_BAR_SUBDIVISIONS,
  DEFAULT_SCALE_BAR_HEIGHT_MM,
  DEFAULT_SCALE_BAR_LABEL_MM,
  DEFAULT_SCALE_BAR_UNIT,
  DEFAULT_SCALE_BAR_STYLE,
  DEFAULT_SCALE_BAR_LABEL_PLACEMENT,
} from '../../types/scale-bar';

/** Construction options for {@link buildScaleBarEntity}. Everything but `layerId` defaults. */
export interface BuildScaleBarOptions {
  /** Target layer (`lyr_<UUID>`) — required on every entity (ADR-358). */
  readonly layerId: string;
  /** Real-world unit for `length` + labels (default `'m'`). */
  readonly unit?: SceneUnits;
  /** Major segment count (default 4). */
  readonly divisions?: number;
  /** Fine sub-ticks in the left extension (default 0 = none). */
  readonly subdivisions?: number;
  /** Body style (default `'alternating'`). */
  readonly style?: ScaleBarStyle;
  /** Bar thickness, paper mm — annotative (default 4). */
  readonly barHeightMm?: number;
  /** Numeral height, paper mm — annotative (default 2.5). */
  readonly labelHeightMm?: number;
  /** Numeral side (default `'below'`). */
  readonly labelPlacement?: ScaleBarLabelPlacement;
  /** Optional display name. */
  readonly name?: string;
  /** Optional id override (tests / clone); defaults to a fresh enterprise id. */
  readonly id?: string;
}

/**
 * ADR-583 Φ2.4 — the two-click / grip-drag axis SSoT: derive `{ angleRad, length }`
 * from the '0' tick `p0` and the far point `p1` (both canonical-mm) in the bar's
 * real-world `unit`. `angleRad` = atan2(p1 − p0); `length` = |p1 − p0| projected back
 * into `unit` (inverse of `realDistanceToModelMm`, via the `mmToSceneUnits` SSoT — no
 * magic numbers) then SNAPPED to a nice 1-2-5 value. Shared by {@link buildScaleBarEntity}
 * (creation) AND the LENGTH grip drag (`applyScaleBarGripDrag`) so preview ≡ commit
 * ≡ creation cannot diverge (N.18 — one home for the span formula).
 */
export function deriveScaleBarAxis(
  p0: Point2D,
  p1: Point2D,
  unit: SceneUnits,
): { angleRad: number; length: number } {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  return {
    angleRad: Math.atan2(dy, dx),
    length: snapScaleBarLength(Math.hypot(dx, dy) * mmToSceneUnits(unit)),
  };
}

/**
 * Build a `ScaleBarEntity` from the two drag points (both canonical-mm) + options.
 * The dragged distance is quantized, so the returned `length` is a nice round span.
 */
export function buildScaleBarEntity(
  p0: Point2D,
  p1: Point2D,
  opts: BuildScaleBarOptions,
): ScaleBarEntity {
  const unit = opts.unit ?? DEFAULT_SCALE_BAR_UNIT;
  const { angleRad, length } = deriveScaleBarAxis(p0, p1, unit);

  return {
    id: opts.id ?? generateEntityId(),
    type: 'scale-bar',
    layerId: opts.layerId,
    name: opts.name,
    position: { x: p0.x, y: p0.y },
    angleRad,
    length,
    unit,
    divisions: opts.divisions ?? DEFAULT_SCALE_BAR_DIVISIONS,
    subdivisions: opts.subdivisions ?? DEFAULT_SCALE_BAR_SUBDIVISIONS,
    style: opts.style ?? DEFAULT_SCALE_BAR_STYLE,
    barHeightMm: opts.barHeightMm ?? DEFAULT_SCALE_BAR_HEIGHT_MM,
    labelHeightMm: opts.labelHeightMm ?? DEFAULT_SCALE_BAR_LABEL_MM,
    labelPlacement: opts.labelPlacement ?? DEFAULT_SCALE_BAR_LABEL_PLACEMENT,
  };
}
