/**
 * MEP fixture geometry + validation (ADR-406, Step 3 vertical slice).
 *
 * Pure SSoT functions — derive `MepFixtureGeometry` from `MepFixtureParams` and
 * validate params. Idempotent + side-effect free. Mirrors the column geometry /
 * validator split, but a fixture is far simpler: a centred footprint (rectangle
 * or circle) at the mounting plane, optional plan rotation (rectangular only).
 *
 * Footprint is built in canvas units (mm × `s`) so it shares the same coordinate
 * space as `params.position` (canvas units from the user click) — identical to
 * `computeColumnGeometry`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { Point3D } from '../types/bim-base';
import type { BimValidation } from '../types/bim-base';
import type { MepFixtureGeometry, MepFixtureParams } from '../types/mep-fixture-types';
import { MIN_FIXTURE_DIMENSION_MM } from '../types/mep-fixture-types';
import { polygonArea, polygonBbox } from '../geometry/shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

/** Segments used to tessellate a circular fixture footprint. */
export const CIRCULAR_FIXTURE_SEGMENTS = 32;

/**
 * Compute `MepFixtureGeometry` from `MepFixtureParams`. Pure SSoT. Caller MUST
 * ensure positive dimensions (validator guard upstream). Throws nothing.
 */
export function computeMepFixtureGeometry(params: MepFixtureParams): MepFixtureGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const local = params.shape === 'circular'
    ? buildCircularLocal(params.width, s)
    : buildRectangularLocal(params.width, params.length, s);
  const transformed = transformFootprint(local, params, s);

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

// ─── Local footprint builders ───────────────────────────────────────────────

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

function buildCircularLocal(diameter: number, s: number): Point3D[] {
  const r = (diameter * s) / 2;
  const verts: Point3D[] = [];
  const step = (2 * Math.PI) / CIRCULAR_FIXTURE_SEGMENTS;
  for (let i = 0; i < CIRCULAR_FIXTURE_SEGMENTS; i++) {
    const a = i * step;
    verts.push({ x: r * Math.cos(a), y: r * Math.sin(a), z: 0 });
  }
  return verts;
}

/**
 * Translate local-frame vertices to world coords (anchor = centre on
 * `position`) and rotate around `position`. Circular skips rotation (rotation
 * is meaningless for a circle).
 */
function transformFootprint(
  local: readonly Point3D[],
  params: MepFixtureParams,
  _s: number,
): Point3D[] {
  const { position } = params;
  if (params.shape === 'circular') {
    return local.map((v) => ({ x: position.x + v.x, y: position.y + v.y, z: 0 }));
  }
  const cos = Math.cos(params.rotation * DEG_TO_RAD);
  const sin = Math.sin(params.rotation * DEG_TO_RAD);
  return local.map((v) => {
    const rx = v.x * cos - v.y * sin;
    const ry = v.x * sin + v.y * cos;
    return { x: position.x + rx, y: position.y + ry, z: 0 };
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Result of a fixture validation pass — hard errors non-empty when invalid. */
export interface MepFixtureValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to `MepFixtureEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `MepFixtureParams`. Operates purely on params — geometry re-derivable.
 * Hard errors: non-positive width / length (rectangular) / body height, or a
 * footprint dimension below `MIN_FIXTURE_DIMENSION_MM` (degenerate placement).
 */
export function validateMepFixtureParams(params: MepFixtureParams): MepFixtureValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (params.width <= 0) {
    hardErrors.push('mepFixture.validation.hardErrors.nonPositiveWidth');
  } else if (params.width < MIN_FIXTURE_DIMENSION_MM) {
    hardErrors.push('mepFixture.validation.hardErrors.dimensionTooSmall');
  }

  if (params.shape === 'rectangular') {
    if (params.length <= 0) {
      hardErrors.push('mepFixture.validation.hardErrors.nonPositiveLength');
    } else if (params.length < MIN_FIXTURE_DIMENSION_MM) {
      hardErrors.push('mepFixture.validation.hardErrors.dimensionTooSmall');
    }
  }

  if (params.bodyHeightMm <= 0) {
    hardErrors.push('mepFixture.validation.hardErrors.nonPositiveBodyHeight');
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
