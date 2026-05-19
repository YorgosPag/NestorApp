/**
 * ADR-363 Phase 1 — Pure builders for wall entity creation.
 *
 * SSoT:
 *   - IDs via `generateWallId()` (N.6 enterprise-id, ADR-017/210/294).
 *   - Geometry via `computeWallGeometry()` — pure function, single source of
 *     truth για axisPolyline / outer / inner / bbox / length / area / volume.
 *   - DNA via `getDefaultDnaForCategory()` — preset per category.
 *   - Validation via `validateWallParams()` — hardErrors block creation;
 *     codeViolations surface στο property panel ως red badge.
 *   - Types via `bim/types/wall-types.ts`.
 *
 * Phase 1 default `kind = 'straight'`. Curved + polyline land Phase 1.5.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §5.9
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type {
  WallCategory,
  WallEntity,
  WallGeometry,
  WallKind,
  WallParams,
} from '../../bim/types/wall-types';
import { DEFAULT_WALL_HEIGHT_MM } from '../../bim/types/wall-types';
import { getDefaultDnaForCategory } from '../../bim/types/wall-dna-types';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../bim/validators/wall-validator';
import { generateWallId } from '@/services/enterprise-id-convenience';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides for `buildDefaultWallParams`. The ribbon (contextual wall tab)
 * supplies `category` + `height`; advanced overrides (`thickness`, custom `dna`,
 * `flip`) land Phase 1.5 via the WallDna editor.
 */
export interface WallParamOverrides {
  readonly category?: WallCategory;
  /** mm. */
  readonly height?: number;
  /** mm. Overrides DNA-derived thickness (advanced use only). */
  readonly thickness?: number;
  readonly flip?: boolean;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `WallParams` from 2 click points + optional overrides.
 *
 * Algorithm:
 *   1. Resolve category (override → 'exterior' default).
 *   2. Resolve DNA from category (SSoT preset).
 *   3. Resolve thickness from DNA totalThickness (or explicit override).
 *   4. Convert mm-baked defaults to scene units (height).
 *
 * Scene-unit semantics mirror stair (`buildDefaultStairParams`): values arriving
 * through Dynamic Input/ribbon are already in user units; mm defaults convert
 * to match.
 */
export function buildDefaultWallParams(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  overrides: WallParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): WallParams {
  const s = mmToSceneUnits(sceneUnits);
  const category: WallCategory = overrides.category ?? 'exterior';
  const height = overrides.height ?? DEFAULT_WALL_HEIGHT_MM * s;
  const start: Point3D = { x: startPoint.x, y: startPoint.y, z: 0 };
  const end: Point3D = { x: endPoint.x, y: endPoint.y, z: 0 };
  // Thickness resolution (Revit "Generic Wall" pattern):
  //   - Explicit override → manual wall, NO DNA attached (caller owns layers).
  //   - Else → DNA preset SSoT, thickness === dna.totalThickness.
  if (overrides.thickness !== undefined) {
    return {
      category,
      start,
      end,
      height,
      thickness: overrides.thickness,
      flip: overrides.flip ?? false,
    };
  }
  const dna = getDefaultDnaForCategory(category);
  // When using scene-unit thickness, the DNA layer thicknesses ALSO need
  // scaling so the SSoT (`thickness === dna.totalThickness`) holds.
  const scaledDna =
    s === 1
      ? dna
      : {
          layers: dna.layers.map((l) => ({ ...l, thickness: l.thickness * s })),
          totalThickness: dna.totalThickness * s,
        };
  return {
    category,
    start,
    end,
    height,
    thickness: scaledDna.totalThickness,
    flip: overrides.flip ?? false,
    dna: scaledDna,
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

/**
 * Result από `buildWallEntity`: είτε επιτυχία (entity + geometry valid) είτε
 * αποτυχία λόγω hard errors (validator-returned i18n keys). Mirrors stair
 * pattern — hardErrors are non-empty only when the wall is geometrically
 * invalid (e.g. zero-length, thickness 0).
 */
export type BuildWallEntityResult =
  | { readonly ok: true; readonly entity: WallEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `WallEntity` from `WallParams`. Geometry computed via the SSoT
 * `computeWallGeometry()` — Phase 1 NEVER duplicates that math here.
 * Hard errors from the validator short-circuit creation; non-blocking code
 * violations are baked into `entity.validation`.
 */
export function buildWallEntity(
  params: Readonly<WallParams>,
  layerId: string,
  kind: WallKind = 'straight',
  sceneUnits: SceneUnits = 'mm',
): BuildWallEntityResult {
  const validation = validateWallParams(params, sceneUnits);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry: WallGeometry = computeWallGeometry(params, kind);
  const entity: WallEntity = {
    id: generateWallId(),
    type: 'wall',
    kind,
    layerId,
    params,
    geometry,
    validation: validation.bimValidation,
    visible: true,
  };
  return { ok: true, entity };
}

// ─── Two-click completion helper ─────────────────────────────────────────────

/**
 * High-level helper bridging the wall tool state machine (Phase 1: 2 clicks =
 * start → end) and the builder pipeline. Returns a fully-formed entity or a
 * validator error list. Pure — no side effects, no Firestore writes.
 */
export function completeWallFromTwoClicks(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  layerId: string,
  overrides: WallParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildWallEntityResult {
  const params = buildDefaultWallParams(startPoint, endPoint, overrides, sceneUnits);
  return buildWallEntity(params, layerId, 'straight');
}
