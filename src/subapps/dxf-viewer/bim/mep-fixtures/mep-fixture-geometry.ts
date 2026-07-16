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
 * The rectangular-branch local footprint, world transform, bbox/area/height tail,
 * and the width/bodyHeight validation skeleton are the shared
 * `rectangular-body-geometry.ts` SSoT (ADR-584 dedup) — this file supplies only
 * the fixture's genuinely distinct circular-footprint branch.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import type { Point3D } from '../types/bim-base';
import type { BimValidation } from '../types/bim-base';
import type { MepFixtureGeometry, MepFixtureParams } from '../types/mep-fixture-types';
import { MIN_FIXTURE_DIMENSION_MM } from '../types/mep-fixture-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import {
  buildRectangularLocalFootprint,
  computeFootprintBodyGeometry,
  transformFootprintToWorld,
  validateRectangularBodyDimensions,
} from '../geometry/shared/rectangular-body-geometry';

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
    : buildRectangularLocalFootprint(params.width, params.length, s);
  const transformed = transformFootprint(local, params);
  return computeFootprintBodyGeometry(transformed, params.bodyHeightMm, s);
}

// ─── Local footprint builder (circular — the fixture's genuine difference) ──

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
 * is meaningless for a circle) — the rectangular branch delegates to the
 * shared `transformFootprintToWorld`.
 */
function transformFootprint(
  local: readonly Point3D[],
  params: MepFixtureParams,
): Point3D[] {
  const { position } = params;
  if (params.shape === 'circular') {
    return local.map((v) => translatePoint(position, v));
  }
  return transformFootprintToWorld(local, position, params.rotation);
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
 * Length is only checked for the rectangular shape — a circle has no `length`.
 */
export function validateMepFixtureParams(params: MepFixtureParams): MepFixtureValidationResult {
  return validateRectangularBodyDimensions(
    {
      width: params.width,
      length: params.shape === 'rectangular' ? params.length : null,
      bodyHeightMm: params.bodyHeightMm,
    },
    'mepFixture',
    MIN_FIXTURE_DIMENSION_MM,
  );
}
