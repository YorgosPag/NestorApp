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
import type { Point3D } from '../../bim/types/bim-base';
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

export type { SceneUnits };

// ─── Param overrides accepted by the builder ───────────────────────────────────

/**
 * Field overrides for `buildDefaultMepWaterHeaterParams`. The ribbon supplies kind /
 * width / length / body height / mounting elevation / rotation / connector diameter /
 * thermal output / tank capacity.
 */
export interface MepWaterHeaterParamOverrides {
  readonly kind?: MepWaterHeaterKind;
  readonly shape?: MepWaterHeaterShape;
  /** mm. Tank width. */
  readonly width?: number;
  /** mm. Tank depth. */
  readonly length?: number;
  /** mm. Body vertical height. */
  readonly bodyHeightMm?: number;
  /** mm. Mounting elevation (vertical centre) above FFL. */
  readonly mountingElevationMm?: number;
  /** Degrees CCW. */
  readonly rotation?: number;
  /** mm. Cold-inlet / hot-outlet connector diameter. */
  readonly connectorDiameterMm?: number;
  /** W. Catalogue heating element power. */
  readonly thermalOutputW?: number;
  /** L. Catalogue storage tank capacity. */
  readonly tankCapacityL?: number;
  readonly material?: string;
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
  const width = overrides.width ?? DEFAULT_WATER_HEATER_WIDTH_MM;
  const length = overrides.length ?? DEFAULT_WATER_HEATER_LENGTH_MM;
  const bodyHeightMm = overrides.bodyHeightMm ?? DEFAULT_WATER_HEATER_BODY_HEIGHT_MM;
  const mountingElevationMm = overrides.mountingElevationMm ?? DEFAULT_WATER_HEATER_MOUNTING_ELEVATION_MM;
  const rotation = overrides.rotation ?? 0;
  const connectorDiameterMm = overrides.connectorDiameterMm ?? DEFAULT_WATER_HEATER_CONNECTOR_DIAMETER_MM;

  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  const base: MepWaterHeaterParams = {
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
    ...(overrides.tankCapacityL !== undefined ? { tankCapacityL: overrides.tankCapacityL } : {}),
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
  };

  // ADR-408 DHW — a water heater is the domestic-hot-water SOURCE: carry derived cold +
  // hot connectors so pipes can snap and the heater can source/join the networks.
  return { ...base, connectors: buildWaterHeaterConnectors(base) };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildMepWaterHeaterEntityResult =
  | { readonly ok: true; readonly entity: MepWaterHeaterEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `MepWaterHeaterEntity` from `MepWaterHeaterParams`. Geometry computed via SSoT
 * `computeMepWaterHeaterGeometry()`. Hard errors short-circuit creation.
 */
export function buildMepWaterHeaterEntity(
  params: Readonly<MepWaterHeaterParams>,
  layerId: string,
): BuildMepWaterHeaterEntityResult {
  const validation = validateMepWaterHeaterParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeMepWaterHeaterGeometry(params);
  const entity = createMepWaterHeater({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}
