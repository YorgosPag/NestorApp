/**
 * Heating radiator geometry + validation + connector layout (ADR-408 Εύρος Β #1).
 *
 * Pure SSoT functions — derive `MepRadiatorGeometry` from `MepRadiatorParams`,
 * validate params, and lay out the fixed supply + return connectors. Idempotent +
 * side-effect free. Mirrors `mep-manifold-geometry.ts`; a radiator is a centred
 * rectangular panel footprint at the mounting plane with an optional plan rotation.
 *
 * Footprint + connector local positions are built in canvas units (mm × `s`) so
 * they share the same coordinate space as `params.position` — identical to the
 * manifold / panel / fixture geometry. Connector `localPosition` is therefore
 * consumed directly by `connectorWorldPosition` (which translates without
 * re-scaling).
 *
 * The footprint builder, world transform, geometry orchestration, and the
 * validation skeleton are the shared `rectangular-body-geometry.ts` SSoT
 * (ADR-584 dedup) — this file supplies only the radiator's own connector layout.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { BimValidation, Point3D } from '../types/bim-base';
import type {
  MepRadiatorGeometry,
  MepRadiatorParams,
} from '../types/mep-radiator-types';
import { MIN_RADIATOR_DIMENSION_MM } from '../types/mep-radiator-types';
import type { MepConnector } from '../types/mep-connector-types';
import {
  buildRadiatorSupplyConnector,
  buildRadiatorReturnConnector,
} from '../types/mep-connector-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  computeRectangularBodyGeometry,
  validateRectangularBodyDimensions,
} from '../geometry/shared/rectangular-body-geometry';

/**
 * Compute `MepRadiatorGeometry` from `MepRadiatorParams`. Pure SSoT.
 * Caller MUST ensure positive dimensions (validator guard upstream).
 */
export function computeMepRadiatorGeometry(
  params: MepRadiatorParams,
): MepRadiatorGeometry {
  return computeRectangularBodyGeometry(params);
}

// ─── Connector layout (pure SSoT) ──────────────────────────────────────────────

/**
 * Build the radiator's two embedded connectors (supply inlet + return outlet),
 * derived from `params`. SSoT consumed by both the completion builder (creation)
 * and `seedDefaultConnectors` (load-time re-materialisation).
 *
 * The supply inlet sits at the −X end and the return outlet at the +X end, both on
 * the body centreline (host-local, scene units, pre-rotation). `connectorWorldPosition`
 * applies the host rotation/translation for free.
 */
export function buildRadiatorConnectors(params: MepRadiatorParams): MepConnector[] {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const hw = (params.width * s) / 2;
  const supply: Point3D = { x: -hw, y: 0, z: 0 };
  const ret: Point3D = { x: hw, y: 0, z: 0 };
  return [
    buildRadiatorSupplyConnector(supply, params.connectorDiameterMm),
    buildRadiatorReturnConnector(ret, params.connectorDiameterMm),
  ];
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/** Result of a radiator validation pass — hard errors non-empty when invalid. */
export interface MepRadiatorValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to `MepRadiatorEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `MepRadiatorParams`. Operates purely on params — geometry re-derivable.
 * Hard errors: non-positive width / length / body height, or a footprint dimension
 * below `MIN_RADIATOR_DIMENSION_MM`.
 */
export function validateMepRadiatorParams(
  params: MepRadiatorParams,
): MepRadiatorValidationResult {
  return validateRectangularBodyDimensions(
    { width: params.width, length: params.length, bodyHeightMm: params.bodyHeightMm },
    'mepRadiator',
    MIN_RADIATOR_DIMENSION_MM,
  );
}
