/**
 * ADR-419 — Pure builders για δημιουργία οντότητας Επικάλυψης Δαπέδου (FloorFinish).
 *
 * SSoT:
 *   - Δημιουργία οντότητας μέσω `createFloorFinish()` factory (ADR-419).
 *   - IDs αυτόματα από factory (prefix 'ffl', N.6).
 *   - Γεωμετρία μέσω `computeFloorFinishGeometry()` — pure function.
 *   - Validation inline (< 3 vertices = hard error).
 *   - Types μέσω `bim/types/floor-finish-types.ts`.
 *
 * Polygon-drawing flow (mirror roof-completion.ts):
 *   - Χρήστης multi-click (Enter ή auto-close κοντά στην πρώτη κορυφή) → λίστα κορυφών.
 *   - `buildDefaultFloorFinishParams()` τυλίγει κορυφές + εφαρμόζει defaults
 *     (materialId = floor-tile-ceramic, thicknessMm = 15, finishLevel = 0).
 *   - `buildFloorFinishEntity()` validates + delegate σε `createFloorFinish()` factory.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 * @see hooks/drawing/roof-completion.ts — το πρότυπο
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_FLOOR_FINISH_THICKNESS_MM,
  DEFAULT_FLOOR_FINISH_LEVEL_MM,
  DEFAULT_FLOOR_FINISH_MATERIAL_ID,
  MIN_FLOOR_FINISH_VERTICES,
  computeFloorFinishGeometry,
  type FloorFinishEntity,
  type FloorFinishMaterialId,
  type FloorFinishParams,
} from '../../bim/types/floor-finish-types';
import { createFloorFinish } from '@/services/factories/floor-finish.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultFloorFinishParams`. Ribbon (contextual tab)
 * supplies materialId / thicknessMm / finishLevel / name.
 */
export interface FloorFinishParamOverrides {
  readonly materialId?: FloorFinishMaterialId;
  /** mm. Πάχος επικάλυψης (1–100mm). */
  readonly thicknessMm?: number;
  /** mm. Offset above slab surface (default 0 = flush with FFL). */
  readonly finishLevel?: number;
  /** User-supplied label (π.χ. «Υπνοδωμάτιο - Δρυς»). */
  readonly name?: string;
  /** FK → Floor.id (storey reference). */
  readonly floorId?: string;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `FloorFinishParams` από vertex list + optional overrides.
 *
 * Algorithm:
 *   1. Resolve materialId (override → DEFAULT_FLOOR_FINISH_MATERIAL_ID).
 *   2. Resolve thicknessMm (override → DEFAULT_FLOOR_FINISH_THICKNESS_MM).
 *   3. Resolve finishLevel (override → DEFAULT_FLOOR_FINISH_LEVEL_MM).
 *   4. Lift 2D vertices σε Point3D (z=0) για footprint.
 *
 * Vertices αναμένονται σε scene units (mm convention).
 */
export function buildDefaultFloorFinishParams(
  vertices: readonly Point2D[],
  overrides: FloorFinishParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): FloorFinishParams {
  const materialId = overrides.materialId ?? DEFAULT_FLOOR_FINISH_MATERIAL_ID;
  const thicknessMm = overrides.thicknessMm ?? DEFAULT_FLOOR_FINISH_THICKNESS_MM;
  const finishLevel = overrides.finishLevel ?? DEFAULT_FLOOR_FINISH_LEVEL_MM;

  const lifted: Point3D[] = vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));

  const params: FloorFinishParams = {
    footprint: { vertices: lifted },
    materialId,
    thicknessMm,
    finishLevel,
    sceneUnits,
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    ...(overrides.floorId !== undefined ? { floorId: overrides.floorId } : {}),
  };
  return params;
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildFloorFinishEntityResult =
  | { readonly ok: true; readonly entity: FloorFinishEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `FloorFinishEntity` από `FloorFinishParams`. Γεωμετρία computed μέσω SSoT
 * `computeFloorFinishGeometry()`. Min-vertices validation hard-errors on < 3 vertices.
 * Final entity assembled μέσω `createFloorFinish()` factory — auto-fills
 * ifcGuid + ifcType='IfcCovering'.
 */
export function buildFloorFinishEntity(
  params: Readonly<FloorFinishParams>,
  layerId: string,
): BuildFloorFinishEntityResult {
  if (params.footprint.vertices.length < MIN_FLOOR_FINISH_VERTICES) {
    return { ok: false, hardErrors: ['floor-finish.error.tooFewVertices'] };
  }
  const geometry = computeFloorFinishGeometry(params);
  const entity = createFloorFinish({ params, geometry, layerId, visible: true });
  return { ok: true, entity };
}

// ─── Polygon-click completion helper ─────────────────────────────────────────

/**
 * High-level helper που bridges το floor-finish-tool FSM (N-click polygon
 * + Enter ή auto-close) και το builder pipeline. Pure — no side effects.
 *
 * Caller MUST ensure `vertices.length >= 3` (FSM guard upstream).
 */
export function completeFloorFinishFromPolygonClicks(
  vertices: readonly Point2D[],
  layerId: string,
  overrides: FloorFinishParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildFloorFinishEntityResult {
  const params = buildDefaultFloorFinishParams(vertices, overrides, sceneUnits);
  return buildFloorFinishEntity(params, layerId);
}
