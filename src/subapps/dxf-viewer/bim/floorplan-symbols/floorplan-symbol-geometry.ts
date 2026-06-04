/**
 * Floorplan symbol geometry + validation (ADR-415 Φ1, vertical slice).
 *
 * Pure SSoT functions — derive `FloorplanSymbolGeometry` from
 * `FloorplanSymbolParams` and validate params. Idempotent + side-effect free.
 * Mirrors `furniture-geometry.ts`; the footprint is a centred rectangle
 * (`widthMm` × `depthMm`) with optional plan rotation, built in canvas units
 * (mm × `s`) so it shares the same coordinate space as `params.position`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation, Point3D } from '../types/bim-base';
import type {
  FloorplanSymbolGeometry,
  FloorplanSymbolParams,
} from '../types/floorplan-symbol-types';
import { MIN_FLOORPLAN_SYMBOL_DIMENSION_MM } from '../types/floorplan-symbol-types';
import { polygonArea, polygonBbox } from '../geometry/shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute `FloorplanSymbolGeometry` from `FloorplanSymbolParams`. Pure SSoT.
 * Caller MUST ensure positive dimensions (validator guard upstream). Throws
 * nothing.
 */
export function computeFloorplanSymbolGeometry(
  params: FloorplanSymbolParams,
): FloorplanSymbolGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const local = buildRectangularLocal(params.widthMm, params.depthMm, s);
  const transformed = transformFootprint(local, params);

  const bbox = polygonBbox(transformed);
  const areaCanvas2 = polygonArea(transformed);
  const canvasToM = (1 / s) * MM_TO_M;
  const areaM2 = areaCanvas2 * canvasToM * canvasToM;

  return {
    footprint: { vertices: transformed },
    bbox,
    area: areaM2,
  };
}

// ─── Local footprint builder ──────────────────────────────────────────────────

function buildRectangularLocal(widthMm: number, depthMm: number, s: number): Point3D[] {
  const hw = (widthMm * s) / 2;
  const hd = (depthMm * s) / 2;
  return [
    { x: -hw, y: -hd, z: 0 },
    { x: hw, y: -hd, z: 0 },
    { x: hw, y: hd, z: 0 },
    { x: -hw, y: hd, z: 0 },
  ];
}

/**
 * Translate local-frame vertices to world coords (anchor = centre on
 * `position`) and rotate around `position` by `rotationDeg`.
 */
function transformFootprint(local: readonly Point3D[], params: FloorplanSymbolParams): Point3D[] {
  const { position } = params;
  const cos = Math.cos(params.rotationDeg * DEG_TO_RAD);
  const sin = Math.sin(params.rotationDeg * DEG_TO_RAD);
  return local.map((v) => {
    const rx = v.x * cos - v.y * sin;
    const ry = v.x * sin + v.y * cos;
    return { x: position.x + rx, y: position.y + ry, z: 0 };
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Result of a validation pass — hard errors non-empty when invalid. */
export interface FloorplanSymbolValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to the entity. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `FloorplanSymbolParams`. Operates purely on params — geometry
 * re-derivable. Hard errors: non-positive / degenerate footprint dimensions, or
 * a missing `assetId`.
 */
export function validateFloorplanSymbolParams(
  params: FloorplanSymbolParams,
): FloorplanSymbolValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (!params.assetId) {
    hardErrors.push('floorplanSymbol.validation.hardErrors.missingAsset');
  }

  for (const dim of [params.widthMm, params.depthMm] as const) {
    if (dim <= 0) {
      hardErrors.push('floorplanSymbol.validation.hardErrors.nonPositiveDimension');
      break;
    }
    if (dim < MIN_FLOORPLAN_SYMBOL_DIMENSION_MM) {
      hardErrors.push('floorplanSymbol.validation.hardErrors.dimensionTooSmall');
      break;
    }
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
