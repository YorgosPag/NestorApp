/**
 * ADR-408 Εύρος Β #1 — Pure builders for heating radiator entity creation.
 *
 * SSoT:
 *   - IDs via `generateMepRadiatorId()` (createMepRadiator factory, N.6).
 *   - Geometry via `computeMepRadiatorGeometry()` — pure function.
 *   - Connectors via `buildRadiatorConnectors()` — supply + return, derived.
 *   - Validation via `validateMepRadiatorParams()` — hardErrors block creation.
 *   - Types via `bim/types/mep-radiator-types.ts`.
 *
 * Single-click flow (mirror of `mep-manifold-completion.ts`):
 *   - User picks the radiator tool.
 *   - Click on canvas → `buildDefaultMepRadiatorParams(clickPoint, overrides)`.
 *   - `buildMepRadiatorEntity()` validates + builds the entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_RADIATOR_BODY_HEIGHT_MM,
  DEFAULT_RADIATOR_CONNECTOR_DIAMETER_MM,
  DEFAULT_RADIATOR_LENGTH_MM,
  DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM,
  DEFAULT_RADIATOR_WIDTH_MM,
  type MepRadiatorEntity,
  type MepRadiatorKind,
  type MepRadiatorParams,
  type MepRadiatorShape,
} from '../../bim/types/mep-radiator-types';
import {
  buildRadiatorConnectors,
  computeMepRadiatorGeometry,
  validateMepRadiatorParams,
} from '../../bim/mep-radiators/mep-radiator-geometry';
import { createMepRadiator } from '@/services/factories/mep-radiator.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ───────────────────────────────────

/**
 * Field overrides for `buildDefaultMepRadiatorParams`. The ribbon supplies kind /
 * width / length / body height / mounting elevation / rotation / connector diameter
 * / thermal output.
 */
export interface MepRadiatorParamOverrides {
  readonly kind?: MepRadiatorKind;
  readonly shape?: MepRadiatorShape;
  /** mm. Body width (run along the wall). */
  readonly width?: number;
  /** mm. Depth. */
  readonly length?: number;
  /** mm. Panel body height. */
  readonly bodyHeightMm?: number;
  /** mm. Mounting elevation (vertical centre) above FFL. */
  readonly mountingElevationMm?: number;
  /** Degrees CCW. */
  readonly rotation?: number;
  /** mm. Supply/return connector diameter. */
  readonly connectorDiameterMm?: number;
  /** W. Catalogue thermal output. */
  readonly thermalOutputW?: number;
  readonly material?: string;
}

// ─── Defaults factory ──────────────────────────────────────────────────────────

/**
 * Build `MepRadiatorParams` from a clicked point + optional overrides. The two
 * connectors (supply inlet + return outlet) are derived from the resolved params
 * via `buildRadiatorConnectors` so a freshly drawn radiator can immediately join a
 * hydronic-supply and a hydronic-return network.
 */
export function buildDefaultMepRadiatorParams(
  clickPoint: Readonly<Point2D>,
  overrides: MepRadiatorParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): MepRadiatorParams {
  const kind: MepRadiatorKind = overrides.kind ?? 'panel-radiator';
  const shape: MepRadiatorShape = overrides.shape ?? 'rectangular';
  const width = overrides.width ?? DEFAULT_RADIATOR_WIDTH_MM;
  const length = overrides.length ?? DEFAULT_RADIATOR_LENGTH_MM;
  const bodyHeightMm = overrides.bodyHeightMm ?? DEFAULT_RADIATOR_BODY_HEIGHT_MM;
  const mountingElevationMm = overrides.mountingElevationMm ?? DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM;
  const rotation = overrides.rotation ?? 0;
  const connectorDiameterMm = overrides.connectorDiameterMm ?? DEFAULT_RADIATOR_CONNECTOR_DIAMETER_MM;

  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  const base: MepRadiatorParams = {
    kind,
    shape,
    position,
    rotation,
    width,
    length,
    bodyHeightMm,
    mountingElevationMm,
    connectorDiameterMm,
    sceneUnits,
    ...(overrides.thermalOutputW !== undefined ? { thermalOutputW: overrides.thermalOutputW } : {}),
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
  };

  // ADR-408 Εύρος Β — a radiator is a hydronic TERMINAL: carry derived supply +
  // return connectors so pipes can snap and join the supply/return networks.
  return { ...base, connectors: buildRadiatorConnectors(base) };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildMepRadiatorEntityResult =
  | { readonly ok: true; readonly entity: MepRadiatorEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `MepRadiatorEntity` from `MepRadiatorParams`. Geometry computed via SSoT
 * `computeMepRadiatorGeometry()`. Hard errors short-circuit creation.
 */
export function buildMepRadiatorEntity(
  params: Readonly<MepRadiatorParams>,
  layerId: string,
): BuildMepRadiatorEntityResult {
  const validation = validateMepRadiatorParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeMepRadiatorGeometry(params);
  const entity = createMepRadiator({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}
