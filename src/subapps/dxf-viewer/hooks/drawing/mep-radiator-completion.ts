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
import type { PlacementBuildResult } from './create-single-click-placement-tool';
import {
  assembleMepApplianceBodyParams,
  buildBimPointEntity,
  resolveBodyPlacement,
  type BodyPlacementParamOverrides,
} from './point-completion-builders';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ───────────────────────────────────

/**
 * Field overrides for `buildDefaultMepRadiatorParams`. The ribbon supplies kind /
 * width / length / body height / mounting elevation / rotation / connector diameter
 * / thermal output. Footprint/pose fields are inherited from
 * {@link BodyPlacementParamOverrides}.
 */
export interface MepRadiatorParamOverrides extends BodyPlacementParamOverrides {
  readonly kind?: MepRadiatorKind;
  readonly shape?: MepRadiatorShape;
  /** mm. Supply/return connector diameter. */
  readonly connectorDiameterMm?: number;
  /** W. Catalogue thermal output. */
  readonly thermalOutputW?: number;
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
  const placement = resolveBodyPlacement(clickPoint, overrides, {
    width: DEFAULT_RADIATOR_WIDTH_MM,
    length: DEFAULT_RADIATOR_LENGTH_MM,
    bodyHeightMm: DEFAULT_RADIATOR_BODY_HEIGHT_MM,
    mountingElevationMm: DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM,
  });

  const base: MepRadiatorParams = assembleMepApplianceBodyParams(kind, shape, placement, sceneUnits, {
    connectorDiameterMm: overrides.connectorDiameterMm ?? DEFAULT_RADIATOR_CONNECTOR_DIAMETER_MM,
    thermalOutputW: overrides.thermalOutputW,
    material: overrides.material,
  });

  // ADR-408 Εύρος Β — a radiator is a hydronic TERMINAL: carry derived supply +
  // return connectors so pipes can snap and join the supply/return networks.
  return { ...base, connectors: buildRadiatorConnectors(base) };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildMepRadiatorEntityResult = PlacementBuildResult<MepRadiatorEntity>;

/**
 * Build a `MepRadiatorEntity` from `MepRadiatorParams`. Geometry computed via SSoT
 * `computeMepRadiatorGeometry()`. Hard errors short-circuit creation.
 */
export function buildMepRadiatorEntity(
  params: Readonly<MepRadiatorParams>,
  layerId: string,
): BuildMepRadiatorEntityResult {
  return buildBimPointEntity(params, layerId, {
    validate: validateMepRadiatorParams,
    computeGeometry: computeMepRadiatorGeometry,
    createEntity: createMepRadiator,
  });
}
