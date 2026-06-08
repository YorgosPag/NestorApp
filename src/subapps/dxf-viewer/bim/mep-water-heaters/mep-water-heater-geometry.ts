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
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
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
import { polygonArea, polygonBbox } from '../geometry/shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute `MepWaterHeaterGeometry` from `MepWaterHeaterParams`. Pure SSoT.
 * Caller MUST ensure positive dimensions (validator guard upstream).
 */
export function computeMepWaterHeaterGeometry(
  params: MepWaterHeaterParams,
): MepWaterHeaterGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const local = buildRectangularLocal(params.width, params.length, s);
  const transformed = transformFootprint(local, params);

  const bbox = polygonBbox(transformed);
  const areaCanvas2 = polygonArea(transformed);
  const canvasToM = (1 / s) * MM_TO_M;
  const areaM2 = areaCanvas2 * canvasToM * canvasToM;

  return {
    footprint: { vertices: transformed },
    bbox,
    area: areaM2,
    height: Math.max(0, params.bodyHeightMm),
  };
}

// ─── Local footprint builder ───────────────────────────────────────────────────

function buildRectangularLocal(width: number, length: number, s: number): Point3D[] {
  const hw = (width * s) / 2;
  const hl = (length * s) / 2;
  return [
    { x: -hw, y: -hl, z: 0 },
    { x:  hw, y: -hl, z: 0 },
    { x:  hw, y:  hl, z: 0 },
    { x: -hw, y:  hl, z: 0 },
  ];
}

/**
 * Translate local-frame vertices to world coords (anchor = centre on `position`)
 * and rotate around `position`.
 */
function transformFootprint(
  local: readonly Point3D[],
  params: MepWaterHeaterParams,
): Point3D[] {
  const { position } = params;
  const cos = Math.cos(params.rotation * DEG_TO_RAD);
  const sin = Math.sin(params.rotation * DEG_TO_RAD);
  return local.map((v) => {
    const rx = v.x * cos - v.y * sin;
    const ry = v.x * sin + v.y * cos;
    return { x: position.x + rx, y: position.y + ry, z: 0 };
  });
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
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (params.width <= 0) {
    hardErrors.push('mepWaterHeater.validation.hardErrors.nonPositiveWidth');
  } else if (params.width < MIN_WATER_HEATER_DIMENSION_MM) {
    hardErrors.push('mepWaterHeater.validation.hardErrors.dimensionTooSmall');
  }

  if (params.length <= 0) {
    hardErrors.push('mepWaterHeater.validation.hardErrors.nonPositiveLength');
  } else if (params.length < MIN_WATER_HEATER_DIMENSION_MM) {
    hardErrors.push('mepWaterHeater.validation.hardErrors.dimensionTooSmall');
  }

  if (params.bodyHeightMm <= 0) {
    hardErrors.push('mepWaterHeater.validation.hardErrors.nonPositiveBodyHeight');
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
