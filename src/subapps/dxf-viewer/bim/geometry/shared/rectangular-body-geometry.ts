/**
 * Shared rectangular-body geometry helpers (ADR-408, ADR-584 dedup).
 *
 * Pure SSoT functions — the centred-rectangle local footprint builder, the
 * world-space rotate+translate transform, the geometry orchestration (scale →
 * build → transform → bbox/area → height), and the common `validate*Params`
 * hard-error skeleton (non-positive / below-minimum width, length, body
 * height + `bimValidation` construction). Idempotent + side-effect free.
 *
 * Extracted 2026-07-16 (jscpd token-based clone check, ADR-584 N.18): the
 * exact same footprint builder + transform + orchestration + validation
 * skeleton was hand-copied across 6 point-placed MEP body geometry files
 * (electrical panel, boiler, manifold, radiator, water heater, fixture).
 * This module is now the SINGLE owner; the 6 sibling files delegate to it
 * and keep only their genuinely distinct pieces (connector layout, extra
 * validation checks, the fixture's circular-footprint branch).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation, BoundingBox3D, Point3D, Polygon3D } from '../../types/bim-base';
import { polygonArea, polygonBbox } from './polygon-utils';
import { mmToSceneUnits, type SceneUnits } from '../../../utils/scene-units';

/** mm → m scalar (area conversion applies this squared). */
export const MM_TO_M = 1 / 1000;
/** Degrees → radians for the plan-rotation transform. */
export const DEG_TO_RAD = Math.PI / 180;

// ─── Local footprint + world transform ─────────────────────────────────────

/**
 * Centred rectangular footprint in the LOCAL frame (canvas units — mm × `s`),
 * winding CCW from the −X/−Y corner. Shared by every rectangular MEP body.
 */
export function buildRectangularLocalFootprint(
  width: number,
  length: number,
  s: number,
): Point3D[] {
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
 * Rotate LOCAL-frame vertices about the origin by `rotationDeg` (plan, CCW)
 * and translate to world coords anchored at `position` (footprint centre).
 */
export function transformFootprintToWorld(
  local: readonly Point3D[],
  position: Point3D,
  rotationDeg: number,
): Point3D[] {
  const cos = Math.cos(rotationDeg * DEG_TO_RAD);
  const sin = Math.sin(rotationDeg * DEG_TO_RAD);
  return local.map((v) => {
    const rx = v.x * cos - v.y * sin;
    const ry = v.x * sin + v.y * cos;
    return { x: position.x + rx, y: position.y + ry, z: 0 };
  });
}

// ─── Geometry orchestration ─────────────────────────────────────────────────

/** Common shape of every point-placed rectangular MEP body's geometry cache. */
export interface RectangularBodyGeometry {
  /** Polygon3D — horizontal footprint at the mounting plane. Closed CCW. */
  readonly footprint: Polygon3D;
  readonly bbox: BoundingBox3D;
  /** m². Footprint area. */
  readonly area: number;
  /** mm. Mirror of `params.bodyHeightMm` for downstream convenience. */
  readonly height: number;
}

/** Minimal param shape `computeRectangularBodyGeometry` needs. */
export interface RectangularBodyGeometryParams {
  readonly width: number;
  readonly length: number;
  readonly position: Point3D;
  readonly rotation: number;
  readonly bodyHeightMm: number;
  readonly sceneUnits?: SceneUnits | null;
}

/**
 * Derive world-space bbox/area/height from an already-transformed (world)
 * footprint. Split out from {@link computeRectangularBodyGeometry} so the
 * fixture's circular branch — which builds its own local footprint and skips
 * rotation — can reuse this tail without re-deriving the area/bbox formula.
 */
export function computeFootprintBodyGeometry(
  worldVertices: readonly Point3D[],
  bodyHeightMm: number,
  s: number,
): RectangularBodyGeometry {
  const bbox = polygonBbox(worldVertices);
  const areaCanvas2 = polygonArea(worldVertices);
  const canvasToM = (1 / s) * MM_TO_M;
  const areaM2 = areaCanvas2 * canvasToM * canvasToM;

  return {
    footprint: { vertices: worldVertices },
    bbox,
    area: areaM2,
    height: Math.max(0, bodyHeightMm),
  };
}

/**
 * Compute a `RectangularBodyGeometry` from params. Pure SSoT orchestration —
 * scale → build local footprint → transform to world → bbox/area/height.
 * Caller MUST ensure positive dimensions (validator guard upstream).
 */
export function computeRectangularBodyGeometry(
  params: RectangularBodyGeometryParams,
): RectangularBodyGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const local = buildRectangularLocalFootprint(params.width, params.length, s);
  const transformed = transformFootprintToWorld(local, params.position, params.rotation);
  return computeFootprintBodyGeometry(transformed, params.bodyHeightMm, s);
}

// ─── Validation skeleton ─────────────────────────────────────────────────────

/** Common shape of every `validate*Params` result across the rectangular bodies. */
export interface RectangularBodyValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: string[];
  /** `BimValidation` payload for direct assignment to the entity's `validation` field. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate the common width/length/bodyHeight dimensions shared by every
 * rectangular MEP body. Hard errors: non-positive width / length / body
 * height, or a footprint dimension below `minDimensionMm` (degenerate
 * placement). Pass `length: null` to skip the length check entirely (the
 * fixture's circular shape, where `length` is meaningless).
 *
 * `i18nPrefix` selects the entity's i18n namespace (e.g. `'mepBoiler'` →
 * `mepBoiler.validation.hardErrors.nonPositiveWidth`). Returns MUTABLE
 * `hardErrors`/`codeViolations` arrays so callers with an extra check (e.g.
 * the manifold's outlet-count guard) can `.push()` onto them before returning.
 */
export function validateRectangularBodyDimensions(
  params: { readonly width: number; readonly length: number | null; readonly bodyHeightMm: number },
  i18nPrefix: string,
  minDimensionMm: number,
): RectangularBodyValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (params.width <= 0) {
    hardErrors.push(`${i18nPrefix}.validation.hardErrors.nonPositiveWidth`);
  } else if (params.width < minDimensionMm) {
    hardErrors.push(`${i18nPrefix}.validation.hardErrors.dimensionTooSmall`);
  }

  if (params.length !== null) {
    if (params.length <= 0) {
      hardErrors.push(`${i18nPrefix}.validation.hardErrors.nonPositiveLength`);
    } else if (params.length < minDimensionMm) {
      hardErrors.push(`${i18nPrefix}.validation.hardErrors.dimensionTooSmall`);
    }
  }

  if (params.bodyHeightMm <= 0) {
    hardErrors.push(`${i18nPrefix}.validation.hardErrors.nonPositiveBodyHeight`);
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
