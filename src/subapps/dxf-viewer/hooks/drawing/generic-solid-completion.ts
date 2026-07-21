/**
 * ADR-684 Φ3 — Pure builders for generic-solid entity creation.
 *
 * SSoT:
 *   - IDs via `generateGenericSolidId()` (createGenericSolid factory, N.6).
 *   - Geometry via `computeGenericSolidGeometry()` — pure function.
 *   - Validation via `validateGenericSolidParams()` — hardErrors block creation.
 *   - Shape defaults via `DEFAULT_GENERIC_SOLID_SHAPE` (types SSoT).
 *   - Types via `bim/entities/generic-solid/generic-solid-types.ts`.
 *
 * Single-click flow (mirror `furniture-completion`, ADR-410/629):
 *   - User picks the generic-solid tool → shape preselected (default box 500³).
 *   - Click on canvas → `buildDefaultGenericSolidParams(clickPoint, overrides)`
 *     resolves position + shape (from ribbon selector) + rotation + elevation.
 *   - `buildGenericSolidEntity()` validates + builds the entity via the shared
 *     {@link buildBimPointEntity} skeleton (zero factory/geometry duplication).
 *
 * Divergence from furniture: furniture resolves footprint from a catalog `assetId`;
 * a generic-solid instead carries the whole `GenericSolidShape` discriminated union
 * (box/sphere/cylinder/…) — the shape *is* the authored parameter set (gotcha §3.2).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md
 * @see hooks/drawing/furniture-completion.ts — the closest sibling (single-click box)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_GENERIC_SOLID_MOUNTING_ELEVATION_MM,
  DEFAULT_GENERIC_SOLID_SHAPE,
  type GenericSolidEntity,
  type GenericSolidParams,
  type GenericSolidShape,
  type GenericSolidStructuralRole,
} from '../../bim/entities/generic-solid/generic-solid-types';
import {
  computeGenericSolidGeometry,
  validateGenericSolidParams,
} from '../../bim/entities/generic-solid/generic-solid-geometry';
import { createGenericSolid } from '@/services/factories/generic-solid.factory';
import type { SceneUnits } from '../../utils/scene-units';
import type { PlacementBuildResult } from './create-single-click-placement-tool';
import { buildBimPointEntity } from './point-completion-builders';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides for `buildDefaultGenericSolidParams`. The ribbon (contextual
 * generic-solid tab) supplies the whole `shape` (kind + per-shape dims) plus
 * rotation / mounting elevation / material.
 */
export interface GenericSolidParamOverrides {
  /** The chosen shape + its dimensions. Default = `DEFAULT_GENERIC_SOLID_SHAPE` (box 500³). */
  readonly shape?: GenericSolidShape;
  /** Degrees CCW about the vertical axis. */
  readonly rotationDeg?: number;
  /** mm. Mounting elevation above FFL. */
  readonly mountingElevationMm?: number;
  readonly material?: string;
  /** ADR-684 Φ4-C — ταξινόμηση δομικό/διακοσμητικό (§4.3). Απόν → default (διακοσμητικό). */
  readonly structuralRole?: GenericSolidStructuralRole;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `GenericSolidParams` from a clicked point + optional overrides. The shape
 * defaults to `DEFAULT_GENERIC_SOLID_SHAPE`; the ribbon layers the selected shape
 * + dims on top. `position` is the clicked footprint centre at floor level.
 */
export function buildDefaultGenericSolidParams(
  clickPoint: Readonly<Point2D>,
  overrides: GenericSolidParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): GenericSolidParams {
  const shape = overrides.shape ?? DEFAULT_GENERIC_SOLID_SHAPE;
  const rotationDeg = overrides.rotationDeg ?? 0;
  const mountingElevationMm =
    overrides.mountingElevationMm ?? DEFAULT_GENERIC_SOLID_MOUNTING_ELEVATION_MM;

  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  return {
    kind: 'generic',
    shape,
    position,
    rotationDeg,
    mountingElevationMm,
    sceneUnits,
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
    ...(overrides.structuralRole !== undefined ? { structuralRole: overrides.structuralRole } : {}),
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildGenericSolidEntityResult = PlacementBuildResult<GenericSolidEntity>;

/**
 * Build a `GenericSolidEntity` from `GenericSolidParams`. Geometry computed via
 * SSoT `computeGenericSolidGeometry()`. Hard errors short-circuit creation.
 */
export function buildGenericSolidEntity(
  params: Readonly<GenericSolidParams>,
  layerId: string,
): BuildGenericSolidEntityResult {
  return buildBimPointEntity(params, layerId, {
    validate: validateGenericSolidParams,
    computeGeometry: computeGenericSolidGeometry,
    createEntity: createGenericSolid,
  });
}
