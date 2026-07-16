/**
 * Domestic hot water heater geometry + validation + connector layout (ADR-408 DHW).
 *
 * Pure SSoT functions — derive `MepWaterHeaterGeometry` from `MepWaterHeaterParams`,
 * validate params, and lay out the fixed cold inlet + hot outlet connectors. Idempotent
 * + side-effect free. Mirrors `mep-boiler-geometry.ts`; a water heater is a centred
 * rectangular cabinet footprint at the mounting plane with an optional plan rotation.
 *
 * Footprint + connector local positions are built in canvas units (mm × `s`) so they
 * share the same coordinate space as `params.position`. Connector `localPosition` is
 * consumed directly by `connectorWorldPosition`.
 *
 * The footprint builder, world transform, geometry orchestration, and the
 * validation skeleton are the shared `rectangular-body-geometry.ts` SSoT
 * (ADR-584 dedup) — this file supplies only the water heater's own connector
 * layout.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { BimValidation, Point3D } from '../types/bim-base';
import type {
  MepWaterHeaterGeometry,
  MepWaterHeaterParams,
} from '../types/mep-water-heater-types';
import { MIN_WATER_HEATER_DIMENSION_MM } from '../types/mep-water-heater-types';
import type { MepConnector } from '../types/mep-connector-types';
import {
  buildWaterHeaterColdInletConnector,
  buildWaterHeaterHotOutletConnector,
} from '../types/mep-connector-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  computeRectangularBodyGeometry,
  validateRectangularBodyDimensions,
} from '../geometry/shared/rectangular-body-geometry';

/**
 * Compute `MepWaterHeaterGeometry` from `MepWaterHeaterParams`. Pure SSoT.
 * Caller MUST ensure positive dimensions (validator guard upstream).
 */
export function computeMepWaterHeaterGeometry(
  params: MepWaterHeaterParams,
): MepWaterHeaterGeometry {
  return computeRectangularBodyGeometry(params);
}

// ─── Connector layout (pure SSoT) ──────────────────────────────────────────────

/**
 * Build the water heater's two embedded connectors (cold inlet + hot outlet), derived
 * from `params`. SSoT consumed by both the completion builder (creation) and
 * `seedDefaultConnectors` (load-time re-materialisation).
 *
 * The cold inlet sits at the −X end (`flow:'in'` → member of the cold network) and the
 * hot outlet at the +X end (`flow:'out'` → sources the domestic-hot-water network), both
 * on the body centreline (host-local, scene units, pre-rotation). `connectorWorldPosition`
 * applies the host rotation/translation for free.
 */
export function buildWaterHeaterConnectors(params: MepWaterHeaterParams): MepConnector[] {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const hw = (params.width * s) / 2;
  const cold: Point3D = { x: -hw, y: 0, z: 0 };
  const hot: Point3D = { x: hw, y: 0, z: 0 };
  return [
    buildWaterHeaterColdInletConnector(cold, params.connectorDiameterMm),
    buildWaterHeaterHotOutletConnector(hot, params.connectorDiameterMm),
  ];
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/** Result of a water-heater validation pass — hard errors non-empty when invalid. */
export interface MepWaterHeaterValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to `MepWaterHeaterEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `MepWaterHeaterParams`. Operates purely on params — geometry re-derivable.
 * Hard errors: non-positive width / length / body height, or a footprint dimension
 * below `MIN_WATER_HEATER_DIMENSION_MM`.
 */
export function validateMepWaterHeaterParams(
  params: MepWaterHeaterParams,
): MepWaterHeaterValidationResult {
  return validateRectangularBodyDimensions(
    { width: params.width, length: params.length, bodyHeightMm: params.bodyHeightMm },
    'mepWaterHeater',
    MIN_WATER_HEATER_DIMENSION_MM,
  );
}
