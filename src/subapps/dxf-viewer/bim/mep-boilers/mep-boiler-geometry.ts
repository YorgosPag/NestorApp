/**
 * Heating boiler geometry + validation + connector layout (ADR-408 Εύρος Β #2).
 *
 * Pure SSoT functions — derive `MepBoilerGeometry` from `MepBoilerParams`,
 * validate params, and lay out the fixed supply + return connectors. Idempotent +
 * side-effect free. Mirrors `mep-radiator-geometry.ts`; a boiler is a centred
 * rectangular cabinet footprint at the mounting plane with an optional plan rotation.
 *
 * Footprint + connector local positions are built in canvas units (mm × `s`) so
 * they share the same coordinate space as `params.position`. Connector
 * `localPosition` is consumed directly by `connectorWorldPosition`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation, Point3D } from '../types/bim-base';
import type {
  MepBoilerGeometry,
  MepBoilerParams,
} from '../types/mep-boiler-types';
import { MIN_BOILER_DIMENSION_MM } from '../types/mep-boiler-types';
import type { MepConnector } from '../types/mep-connector-types';
import {
  buildBoilerSupplyConnector,
  buildBoilerReturnConnector,
} from '../types/mep-connector-types';
import { polygonArea, polygonBbox } from '../geometry/shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute `MepBoilerGeometry` from `MepBoilerParams`. Pure SSoT.
 * Caller MUST ensure positive dimensions (validator guard upstream).
 */
export function computeMepBoilerGeometry(
  params: MepBoilerParams,
): MepBoilerGeometry {
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
  params: MepBoilerParams,
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
 * Build the boiler's two embedded connectors (supply outlet + return inlet),
 * derived from `params`. SSoT consumed by both the completion builder (creation)
 * and `seedDefaultConnectors` (load-time re-materialisation).
 *
 * The supply outlet sits at the +X end (`flow:'out'` → sources the supply network)
 * and the return inlet at the −X end (`flow:'in'`), both on the body centreline
 * (host-local, scene units, pre-rotation). `connectorWorldPosition` applies the host
 * rotation/translation for free.
 */
export function buildBoilerConnectors(params: MepBoilerParams): MepConnector[] {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const hw = (params.width * s) / 2;
  const supply: Point3D = { x: hw, y: 0, z: 0 };
  const ret: Point3D = { x: -hw, y: 0, z: 0 };
  return [
    buildBoilerSupplyConnector(supply, params.connectorDiameterMm),
    buildBoilerReturnConnector(ret, params.connectorDiameterMm),
  ];
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/** Result of a boiler validation pass — hard errors non-empty when invalid. */
export interface MepBoilerValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to `MepBoilerEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `MepBoilerParams`. Operates purely on params — geometry re-derivable.
 * Hard errors: non-positive width / length / body height, or a footprint dimension
 * below `MIN_BOILER_DIMENSION_MM`.
 */
export function validateMepBoilerParams(
  params: MepBoilerParams,
): MepBoilerValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (params.width <= 0) {
    hardErrors.push('mepBoiler.validation.hardErrors.nonPositiveWidth');
  } else if (params.width < MIN_BOILER_DIMENSION_MM) {
    hardErrors.push('mepBoiler.validation.hardErrors.dimensionTooSmall');
  }

  if (params.length <= 0) {
    hardErrors.push('mepBoiler.validation.hardErrors.nonPositiveLength');
  } else if (params.length < MIN_BOILER_DIMENSION_MM) {
    hardErrors.push('mepBoiler.validation.hardErrors.dimensionTooSmall');
  }

  if (params.bodyHeightMm <= 0) {
    hardErrors.push('mepBoiler.validation.hardErrors.nonPositiveBodyHeight');
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
