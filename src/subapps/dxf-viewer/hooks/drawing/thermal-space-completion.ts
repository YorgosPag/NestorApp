/**
 * ADR-422 L0 — Pure builders για δημιουργία οντότητας Θερμικού Χώρου (ThermalSpace).
 *
 * SSoT:
 *   - Δημιουργία οντότητας μέσω `createThermalSpace()` factory.
 *   - IDs αυτόματα από factory (prefix 'tsp', N.6).
 *   - Γεωμετρία μέσω `computeThermalSpaceGeometry()` — pure function.
 *   - Validation inline (< 3 vertices = hard error).
 *
 * Click-in-region flow (Revit «Place Space»):
 *   - Ο χρήστης κλικάρει ΜΕΣΑ σε δωμάτιο → ο tool παράγει το footprint πολύγωνο
 *     από τον κλειστό βρόχο τοίχων (perimeter-from-faces SSoT).
 *   - `buildDefaultThermalSpaceParams()` τυλίγει το πολύγωνο + εφαρμόζει defaults
 *     (useType=generic, ceilingHeightMm=storey/3000).
 *   - `buildThermalSpaceEntity()` validates + delegate σε `createThermalSpace()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 * @see hooks/drawing/floor-finish-completion.ts — το area-entity πρότυπο
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_THERMAL_SPACE_USE_TYPE,
  DEFAULT_THERMAL_SPACE_CEILING_HEIGHT_MM,
  MIN_THERMAL_SPACE_VERTICES,
  computeThermalSpaceGeometry,
  type ThermalSpaceEntity,
  type ThermalSpaceParams,
  type ThermalSpaceUseType,
} from '../../bim/types/thermal-space-types';
import { createThermalSpace } from '@/services/factories/thermal-space.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultThermalSpaceParams`. Ribbon (contextual tab)
 * supplies useType / setpoint / ACH / ceilingHeight / name.
 */
export interface ThermalSpaceParamOverrides {
  readonly useType?: ThermalSpaceUseType;
  /** °C — override θερμοκρασίας σχεδιασμού (absent ⇒ default χρήσης). */
  readonly setpointTempC?: number;
  /** 1/h — override εναλλαγών αέρα (absent ⇒ default χρήσης). */
  readonly airChangesPerHour?: number;
  /** mm — καθαρό ύψος χώρου. */
  readonly ceilingHeightMm?: number;
  /** User-supplied label (π.χ. «Υπνοδωμάτιο 1»). */
  readonly name?: string;
  /** FK → Floor.id (storey reference). */
  readonly floorId?: string;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `ThermalSpaceParams` από vertex list (κλειστός βρόχος δωματίου) + optional
 * overrides. `ceilingHeightMm` resolution: override → caller storey height → default.
 * Vertices αναμένονται σε scene units (mm convention).
 */
export function buildDefaultThermalSpaceParams(
  vertices: readonly Point2D[],
  overrides: ThermalSpaceParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
  ceilingHeightMm: number = DEFAULT_THERMAL_SPACE_CEILING_HEIGHT_MM,
): ThermalSpaceParams {
  const useType = overrides.useType ?? DEFAULT_THERMAL_SPACE_USE_TYPE;
  const resolvedHeight = overrides.ceilingHeightMm ?? ceilingHeightMm;

  const lifted: Point3D[] = vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));

  const params: ThermalSpaceParams = {
    footprint: { vertices: lifted },
    useType,
    ceilingHeightMm: resolvedHeight,
    sceneUnits,
    ...(overrides.setpointTempC !== undefined ? { setpointTempC: overrides.setpointTempC } : {}),
    ...(overrides.airChangesPerHour !== undefined
      ? { airChangesPerHour: overrides.airChangesPerHour }
      : {}),
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    ...(overrides.floorId !== undefined ? { floorId: overrides.floorId } : {}),
  };
  return params;
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildThermalSpaceEntityResult =
  | { readonly ok: true; readonly entity: ThermalSpaceEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `ThermalSpaceEntity` από `ThermalSpaceParams`. Γεωμετρία computed μέσω
 * SSoT `computeThermalSpaceGeometry()`. Min-vertices validation hard-errors on
 * < 3 vertices. Final entity μέσω `createThermalSpace()` factory (ifcGuid +
 * ifcType='IfcSpace').
 */
export function buildThermalSpaceEntity(
  params: Readonly<ThermalSpaceParams>,
  layerId: string,
): BuildThermalSpaceEntityResult {
  if (params.footprint.vertices.length < MIN_THERMAL_SPACE_VERTICES) {
    return { ok: false, hardErrors: ['thermal-space.error.tooFewVertices'] };
  }
  const geometry = computeThermalSpaceGeometry(params);
  const entity = createThermalSpace({ params, geometry, layerId, visible: true });
  return { ok: true, entity };
}

// ─── Click-in-region completion helper ───────────────────────────────────────

/**
 * High-level helper που bridges το click-in-region gesture (perimeter polygon)
 * και το builder pipeline. Pure — no side effects. Caller MUST ensure
 * `polygon.length >= 3` (region pick guard upstream).
 */
export function completeThermalSpaceFromPerimeterPolygon(
  polygon: readonly Point2D[],
  layerId: string,
  overrides: ThermalSpaceParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
  ceilingHeightMm: number = DEFAULT_THERMAL_SPACE_CEILING_HEIGHT_MM,
): BuildThermalSpaceEntityResult {
  const params = buildDefaultThermalSpaceParams(polygon, overrides, sceneUnits, ceilingHeightMm);
  return buildThermalSpaceEntity(params, layerId);
}
