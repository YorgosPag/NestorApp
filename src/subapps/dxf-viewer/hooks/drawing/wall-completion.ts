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
import {
  DEFAULT_WALL_BASE_BINDING,
  DEFAULT_WALL_TOP_BINDING,
} from '../../bim/types/bim-binding';
import { createWall } from '@/services/factories/wall.factory';
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
 *   4. Scalars (height, thickness) stored in mm — always, regardless of sceneUnits.
 *      Boundary conversion (mm → canvas units) happens in computeWallGeometry.
 */
export function buildDefaultWallParams(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  overrides: WallParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
  alignmentPoint?: Readonly<Point2D> | null,
): WallParams {
  const category: WallCategory = overrides.category ?? 'exterior';
  const height = overrides.height ?? DEFAULT_WALL_HEIGHT_MM;
  // Thickness resolution (Revit "Generic Wall" pattern):
  //   - Explicit override → manual wall, NO DNA attached (caller owns layers).
  //   - Else → DNA preset SSoT, thickness === dna.totalThickness.
  // Resolved upfront so the alignment-offset path (below) knows the thickness.
  const overrideThickness = overrides.thickness;
  let thickness: number;
  let dna: ReturnType<typeof getDefaultDnaForCategory> | null;
  if (overrideThickness === undefined) {
    dna = getDefaultDnaForCategory(category);
    thickness = dna.totalThickness;
  } else {
    dna = null;
    thickness = overrideThickness;
  }
  // ADR-363 Phase 1F — alignment offset: shift the axis perpendicular toward
  // `alignmentPoint` so the edge AWAY from C sits on the original A→B line and
  // the wall body extends TOWARD C. `null`/`undefined` ⇒ classic centered axis.
  const offset = alignmentPoint
    ? computeWallAlignmentOffset(startPoint, endPoint, alignmentPoint, thickness, sceneUnits)
    : { x: 0, y: 0 };
  const start: Point3D = { x: startPoint.x + offset.x, y: startPoint.y + offset.y, z: 0 };
  const end: Point3D = { x: endPoint.x + offset.x, y: endPoint.y + offset.y, z: 0 };

  const base = {
    category,
    start,
    end,
    height,
    thickness,
    flip: overrides.flip ?? false,
    sceneUnits,
    baseBinding: DEFAULT_WALL_BASE_BINDING,
    topBinding: DEFAULT_WALL_TOP_BINDING,
    baseOffset: 0,
    topOffset: 0,
  };
  return dna === null ? base : { ...base, dna };
}

/**
 * Compute the perpendicular offset that shifts a wall axis (A→B) so that one
 * edge coincides with the A→B click line and the wall body extends toward
 * `alignmentPoint` (ADR-363 Phase 1F):
 *
 *   - cross > 0 (C on the +n_ccw / "left" side of A→B): axis shifts +n_ccw →
 *     wall extends LEFT; the "right" edge of the wall stays on A→B.
 *   - cross < 0 (C on the "right" side): axis shifts -n_ccw → wall extends
 *     RIGHT; the "left" edge of the wall stays on A→B.
 *   - cross = 0 (C colinear with axis) or len(A→B) ≈ 0: zero offset (centered).
 *
 * The returned offset is in canvas world units and is meant to be ADDED to
 * BOTH start and end of the original axis before constructing `WallParams`.
 */
export function computeWallAlignmentOffset(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  alignmentPoint: Readonly<Point2D>,
  thicknessMm: number,
  sceneUnits: SceneUnits = 'mm',
): Point2D {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: 0, y: 0 };

  const nx = -dy / len;
  const ny = dx / len;

  const cross = dx * (alignmentPoint.y - startPoint.y) - dy * (alignmentPoint.x - startPoint.x);
  if (cross === 0) return { x: 0, y: 0 };
  const sign = cross > 0 ? 1 : -1;

  const halfThicknessCanvas = (thicknessMm / 2) * mmToSceneUnits(sceneUnits);

  return {
    x: sign * halfThicknessCanvas * nx,
    y: sign * halfThicknessCanvas * ny,
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
  const entity: WallEntity = createWall({
    kind,
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
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
  alignmentPoint?: Readonly<Point2D> | null,
): BuildWallEntityResult {
  const params = buildDefaultWallParams(startPoint, endPoint, overrides, sceneUnits, alignmentPoint);
  return buildWallEntity(params, layerId, 'straight', sceneUnits);
}
