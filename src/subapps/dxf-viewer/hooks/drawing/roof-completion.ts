/**
 * ADR-417 Φ1 — Pure builders για δημιουργία οντότητας Στέγης (Roof).
 *
 * SSoT:
 *   - Δημιουργία οντότητας μέσω `createRoof()` factory (ADR-417 Φ1).
 *   - IDs αυτόματα από factory (prefix 'roof', N.6).
 *   - Γεωμετρία μέσω `computeRoofGeometry()` — pure function.
 *   - Validation μέσω `validateRoofParams()` — hardErrors αποκλείουν δημιουργία.
 *   - Types μέσω `bim/types/roof-types.ts`.
 *
 * Polygon-drawing flow (Φ1 — mirror slab-completion.ts):
 *   - Χρήστης multi-click (Enter ή auto-close κοντά στην πρώτη κορυφή) → λίστα κορυφών.
 *   - `buildDefaultRoofParams()` τυλίγει κορυφές + εφαρμόζει defaults
 *     (dna = createDefaultRoofBuildup, thickness από dna.totalThickness,
 *      edges = buildDefaultRoofEdges = flat, slopeUnit = 'deg',
 *      basePivotZ = DEFAULT_ROOF_BASE_PIVOT_Z_MM).
 *   - `buildRoofEntity()` κάνει validation + delegate σε `createRoof()` factory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §Φ1
 * @see hooks/drawing/slab-completion.ts — το ακριβές πρότυπο (clone)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_ROOF_BASE_PIVOT_Z_MM,
  DEFAULT_ROOF_SLOPE_UNIT,
  DEFAULT_ROOF_THICKNESS_MM,
  type RoofEntity,
  type RoofParams,
} from '../../bim/types/roof-types';
import type { SlabDna } from '../../bim/types/slab-dna-types';
import { createDefaultRoofBuildup } from '../../bim/types/slab-dna-types';
import { computeRoofGeometry, validateRoofParams, buildDefaultRoofEdges } from '../../bim/geometry/roof-geometry';
import { createRoof } from '@/services/factories/roof.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultRoofParams`. Ribbon (contextual roof tab)
 * προμηθεύει thickness / basePivotZ / slopeUnit / dna options.
 */
export interface RoofParamOverrides {
  /** mm. Πάχος στέγης. Παράγεται από dna.totalThickness όταν υπάρχει dna (SSoT). */
  readonly thickness?: number;
  /** mm. Στάθμη γείσου (eaves datum). Default DEFAULT_ROOF_BASE_PIVOT_Z_MM. */
  readonly basePivotZ?: number;
  /** Μονάδα κλίσης. Default 'deg'. */
  readonly slopeUnit?: 'deg' | 'percent';
  /**
   * Composite layered build-up. Όταν δοθεί, το `thickness` παράγεται από
   * `dna.totalThickness` (SSoT — μηδέν διπλο-καταχώρηση, ίδιο με slab/wall).
   */
  readonly dna?: SlabDna;
  readonly material?: string;
  /** FK → Floor.id (storey reference). */
  readonly storeyId?: string;
  /** mm. Offset της στάθμης γείσου από τη storey reference. */
  readonly offsetFromStorey?: number;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `RoofParams` από vertex list + optional overrides.
 *
 * Algorithm (mirror buildDefaultSlabParams):
 *   1. Resolve dna (override → createDefaultRoofBuildup = concrete flat δώμα).
 *   2. Resolve thickness (dna.totalThickness → override → DEFAULT_ROOF_THICKNESS_MM).
 *   3. Resolve basePivotZ (override → DEFAULT_ROOF_BASE_PIVOT_Z_MM).
 *   4. Resolve slopeUnit (override → 'deg').
 *   5. Lift 2D vertices σε Point3D (z=0) για outline.
 *   6. Build flat edges via buildDefaultRoofEdges (user αλλάζει μέσω contextual tab).
 *
 * Vertices αναμένονται σε scene units (mm convention — caller responsible για conversion).
 */
export function buildDefaultRoofParams(
  vertices: readonly Point2D[],
  overrides: RoofParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): RoofParams {
  const dna = overrides.dna ?? createDefaultRoofBuildup();
  const thickness = dna.totalThickness ?? overrides.thickness ?? DEFAULT_ROOF_THICKNESS_MM;
  const basePivotZ = overrides.basePivotZ ?? DEFAULT_ROOF_BASE_PIVOT_Z_MM;
  const slopeUnit = overrides.slopeUnit ?? DEFAULT_ROOF_SLOPE_UNIT;

  const lifted: Point3D[] = vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
  const outline = { vertices: lifted };
  const edges = buildDefaultRoofEdges(outline);

  const params: RoofParams = {
    outline,
    edges,
    slopeUnit,
    basePivotZ,
    thickness,
    sceneUnits,
    dna,
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
    ...(overrides.storeyId !== undefined ? { storeyId: overrides.storeyId } : {}),
    ...(overrides.offsetFromStorey !== undefined
      ? { offsetFromStorey: overrides.offsetFromStorey }
      : {}),
  };
  return params;
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildRoofEntityResult =
  | { readonly ok: true; readonly entity: RoofEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `RoofEntity` από `RoofParams`. Γεωμετρία computed μέσω SSoT
 * `computeRoofGeometry()`. Hard errors short-circuit creation. Final entity
 * assembled μέσω `createRoof()` factory (ADR-417 Φ1) — auto-fills
 * ifcGuid + ifcType='IfcRoof'.
 */
export function buildRoofEntity(
  params: Readonly<RoofParams>,
  layerId: string,
): BuildRoofEntityResult {
  const validation = validateRoofParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeRoofGeometry(params);
  const entity = createRoof({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}

// ─── Polygon-click completion helper ─────────────────────────────────────────

/**
 * High-level helper που bridges το roof-tool FSM (Φ1: N-click polygon
 * + Enter ή auto-close) και το builder pipeline. Pure — no side effects.
 *
 * Caller MUST ensure `vertices.length >= 3` (FSM guard upstream) — αλλιώς
 * ο validator hard-errors και η `buildRoofEntity` επιστρέφει `ok: false`.
 */
export function completeRoofFromPolygonClicks(
  vertices: readonly Point2D[],
  layerId: string,
  overrides: RoofParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildRoofEntityResult {
  const params = buildDefaultRoofParams(vertices, overrides, sceneUnits);
  return buildRoofEntity(params, layerId);
}
