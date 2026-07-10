/**
 * ADR-408 DHW — Pure builders for domestic hot water heater entity creation.
 *
 * SSoT:
 *   - IDs via `generateMepWaterHeaterId()` (createMepWaterHeater factory, N.6).
 *   - Geometry via `computeMepWaterHeaterGeometry()` — pure function.
 *   - Connectors via `buildWaterHeaterConnectors()` — cold inlet + hot outlet, derived.
 *   - Validation via `validateMepWaterHeaterParams()` — hardErrors block creation.
 *   - Types via `bim/types/mep-water-heater-types.ts`.
 *
 * Single-click flow (mirror of `mep-boiler-completion.ts`):
 *   - User picks the water-heater tool.
 *   - Click on canvas → `buildDefaultMepWaterHeaterParams(clickPoint, overrides)`.
 *   - `buildMepWaterHeaterEntity()` validates + builds the entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  DEFAULT_WATER_HEATER_BODY_HEIGHT_MM,
  DEFAULT_WATER_HEATER_CONNECTOR_DIAMETER_MM,
  DEFAULT_WATER_HEATER_LENGTH_MM,
  DEFAULT_WATER_HEATER_MOUNTING_ELEVATION_MM,
  DEFAULT_WATER_HEATER_WIDTH_MM,
  type MepWaterHeaterEntity,
  type MepWaterHeaterKind,
  type MepWaterHeaterParams,
  type MepWaterHeaterShape,
} from '../../bim/types/mep-water-heater-types';
import {
  buildWaterHeaterConnectors,
  computeMepWaterHeaterGeometry,
  validateMepWaterHeaterParams,
} from '../../bim/mep-water-heaters/mep-water-heater-geometry';
import { createMepWaterHeater } from '@/services/factories/mep-water-heater.factory';
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
 * Field overrides for `buildDefaultMepWaterHeaterParams`. The ribbon supplies kind /
 * width / length / body height / mounting elevation / rotation / connector diameter /
 * thermal output / tank capacity. Footprint/pose fields are inherited from
 * {@link BodyPlacementParamOverrides}.
 */
export interface MepWaterHeaterParamOverrides extends BodyPlacementParamOverrides {
  readonly kind?: MepWaterHeaterKind;
  readonly shape?: MepWaterHeaterShape;
  /** mm. Cold-inlet / hot-outlet connector diameter. */
  readonly connectorDiameterMm?: number;
  /** W. Catalogue heating element power. */
  readonly thermalOutputW?: number;
  /** L. Catalogue storage tank capacity. */
  readonly tankCapacityL?: number;
}

// ─── Defaults factory ──────────────────────────────────────────────────────────

/**
 * Build `MepWaterHeaterParams` from a clicked point + optional overrides. The two
 * connectors (cold inlet + hot outlet) are derived from the resolved params via
 * `buildWaterHeaterConnectors` so a freshly drawn heater can immediately source the
 * domestic-hot-water network and join the cold-water network.
 */
export function buildDefaultMepWaterHeaterParams(
  clickPoint: Readonly<Point2D>,
  overrides: MepWaterHeaterParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): MepWaterHeaterParams {
  const kind: MepWaterHeaterKind = overrides.kind ?? 'electric-water-heater';
  const shape: MepWaterHeaterShape = overrides.shape ?? 'rectangular';
  const placement = resolveBodyPlacement(clickPoint, overrides, {
    width: DEFAULT_WATER_HEATER_WIDTH_MM,
    length: DEFAULT_WATER_HEATER_LENGTH_MM,
    bodyHeightMm: DEFAULT_WATER_HEATER_BODY_HEIGHT_MM,
    mountingElevationMm: DEFAULT_WATER_HEATER_MOUNTING_ELEVATION_MM,
  });

  const base: MepWaterHeaterParams = assembleMepApplianceBodyParams(kind, shape, placement, sceneUnits, {
    connectorDiameterMm: overrides.connectorDiameterMm ?? DEFAULT_WATER_HEATER_CONNECTOR_DIAMETER_MM,
    thermalOutputW: overrides.thermalOutputW,
    tankCapacityL: overrides.tankCapacityL,
    material: overrides.material,
  });

  // ADR-408 DHW — a water heater is the domestic-hot-water SOURCE: carry derived cold +
  // hot connectors so pipes can snap and the heater can source/join the networks.
  return { ...base, connectors: buildWaterHeaterConnectors(base) };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildMepWaterHeaterEntityResult = PlacementBuildResult<MepWaterHeaterEntity>;

/**
 * Build a `MepWaterHeaterEntity` from `MepWaterHeaterParams`. Geometry computed via SSoT
 * `computeMepWaterHeaterGeometry()`. Hard errors short-circuit creation.
 */
export function buildMepWaterHeaterEntity(
  params: Readonly<MepWaterHeaterParams>,
  layerId: string,
): BuildMepWaterHeaterEntityResult {
  return buildBimPointEntity(params, layerId, {
    validate: validateMepWaterHeaterParams,
    computeGeometry: computeMepWaterHeaterGeometry,
    createEntity: createMepWaterHeater,
  });
}
