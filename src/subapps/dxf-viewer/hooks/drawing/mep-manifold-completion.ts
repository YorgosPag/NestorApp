/**
 * ADR-408 Φ12 — Pure builders for plumbing manifold entity creation.
 *
 * SSoT:
 *   - IDs via `generateMepManifoldId()` (createMepManifold factory, N.6).
 *   - Geometry via `computeMepManifoldGeometry()` — pure function.
 *   - Connectors via `buildMepManifoldConnectors()` — derived from outletCount.
 *   - Validation via `validateMepManifoldParams()` — hardErrors block creation.
 *   - Types via `bim/types/mep-manifold-types.ts`.
 *
 * Single-click flow (mirror of `electrical-panel-completion.ts`):
 *   - User picks the manifold tool.
 *   - Click on canvas → `buildDefaultMepManifoldParams(clickPoint, overrides)`.
 *   - `buildMepManifoldEntity()` validates + builds the entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_MANIFOLD_BODY_HEIGHT_MM,
  DEFAULT_MANIFOLD_INLET_DIAMETER_MM,
  DEFAULT_MANIFOLD_LENGTH_MM,
  DEFAULT_MANIFOLD_MOUNTING_ELEVATION_MM,
  DEFAULT_MANIFOLD_OUTLET_COUNT,
  DEFAULT_MANIFOLD_OUTLET_DIAMETER_MM,
  DEFAULT_MANIFOLD_WIDTH_MM,
  type MepManifoldEntity,
  type MepManifoldKind,
  type MepManifoldParams,
  type MepManifoldShape,
} from '../../bim/types/mep-manifold-types';
import {
  buildMepManifoldConnectors,
  computeMepManifoldGeometry,
  validateMepManifoldParams,
} from '../../bim/mep-manifolds/mep-manifold-geometry';
import { createMepManifold } from '@/services/factories/mep-manifold.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ───────────────────────────────────

/**
 * Field overrides for `buildDefaultMepManifoldParams`. The ribbon supplies kind /
 * width / length / body height / mounting elevation / rotation / outlet count.
 */
export interface MepManifoldParamOverrides {
  readonly kind?: MepManifoldKind;
  readonly shape?: MepManifoldShape;
  /** mm. Bar width (outlet run). */
  readonly width?: number;
  /** mm. Depth. */
  readonly length?: number;
  /** mm. Body height. */
  readonly bodyHeightMm?: number;
  /** mm. Mounting elevation (vertical centre) above FFL. */
  readonly mountingElevationMm?: number;
  /** Degrees CCW. */
  readonly rotation?: number;
  /** Number of outlet connectors. */
  readonly outletCount?: number;
  /** mm. Inlet diameter. */
  readonly inletDiameterMm?: number;
  /** mm. Outlet diameter. */
  readonly outletDiameterMm?: number;
  readonly material?: string;
}

// ─── Defaults factory ──────────────────────────────────────────────────────────

/**
 * Build `MepManifoldParams` from a clicked point + optional overrides. The
 * connector set (1 inlet + N outlets) is derived from the resolved params via
 * `buildMepManifoldConnectors` so a freshly drawn manifold is immediately a valid
 * pipe-network source.
 */
export function buildDefaultMepManifoldParams(
  clickPoint: Readonly<Point2D>,
  overrides: MepManifoldParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): MepManifoldParams {
  const kind: MepManifoldKind = overrides.kind ?? 'floor-manifold';
  const shape: MepManifoldShape = overrides.shape ?? 'rectangular';
  const width = overrides.width ?? DEFAULT_MANIFOLD_WIDTH_MM;
  const length = overrides.length ?? DEFAULT_MANIFOLD_LENGTH_MM;
  const bodyHeightMm = overrides.bodyHeightMm ?? DEFAULT_MANIFOLD_BODY_HEIGHT_MM;
  const mountingElevationMm = overrides.mountingElevationMm ?? DEFAULT_MANIFOLD_MOUNTING_ELEVATION_MM;
  const rotation = overrides.rotation ?? 0;
  const outletCount = overrides.outletCount ?? DEFAULT_MANIFOLD_OUTLET_COUNT;
  const inletDiameterMm = overrides.inletDiameterMm ?? DEFAULT_MANIFOLD_INLET_DIAMETER_MM;
  const outletDiameterMm = overrides.outletDiameterMm ?? DEFAULT_MANIFOLD_OUTLET_DIAMETER_MM;

  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  const base: MepManifoldParams = {
    kind,
    shape,
    position,
    rotation,
    width,
    length,
    bodyHeightMm,
    mountingElevationMm,
    outletCount,
    inletDiameterMm,
    outletDiameterMm,
    sceneUnits,
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
  };

  // ADR-408 — a manifold is a pipe-network SOURCE: carry derived inlet + outlet
  // connectors so a MepSystem can reference its outlets, and pipes can snap.
  return { ...base, connectors: buildMepManifoldConnectors(base) };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildMepManifoldEntityResult =
  | { readonly ok: true; readonly entity: MepManifoldEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `MepManifoldEntity` from `MepManifoldParams`. Geometry computed via
 * SSoT `computeMepManifoldGeometry()`. Hard errors short-circuit creation.
 */
export function buildMepManifoldEntity(
  params: Readonly<MepManifoldParams>,
  layerId: string,
): BuildMepManifoldEntityResult {
  const validation = validateMepManifoldParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeMepManifoldGeometry(params);
  const entity = createMepManifold({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}
