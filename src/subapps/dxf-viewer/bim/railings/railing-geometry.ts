/**
 * Railing geometry + validation (ADR-407, Φ1 vertical slice).
 *
 * The **pure SSoT generation engine** — `computeRailingGeometry(params, host?)`
 * derives every member (posts / balusters / rails) from the recipe. Idempotent +
 * side-effect free (PATH ⊥ TYPE: the path says *where*, the Type says *how*). All
 * downstream consumers (2Δ renderer, 3Δ converter, BOQ) read ONLY this derived
 * geometry — they never re-derive from raw mm params.
 *
 * Coordinate space mirrors `mep-fixture-geometry.ts`: path xy is in **canvas
 * units** (same as the user click); member dimensions, heights and spacing are in
 * **mm** and converted to canvas units (× `s`) for along-path placement. Member
 * `z` / rail elevation is in **mm** (datum-relative), consumed by the 3Δ converter.
 *
 * Φ1 scope: straight standalone **sketch** path → end/corner posts + a single
 * centred top rail + round balusters at the ball-rule spacing. Intermediate rails,
 * handrail separation, infill panels and hosting are later phases — the engine
 * already loops `railStructure` / `handrail` (empty in `DEFAULT_RAILING_TYPE`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../types/bim-base';
import type { Point3D } from '../types/bim-base';
import type {
  RailingGeometry,
  RailingHostContext,
  RailingParams,
  RailingPath,
  RailingType,
  RailMemberSolid,
  RailProfile,
  RailSweep,
} from '../types/railing-types';
import {
  MAX_BALUSTER_SPACING_MM,
  MIN_RAILING_DIMENSION_MM,
} from '../types/railing-types';
import { mmToSceneUnits } from '../../utils/scene-units';
// ADR-471 Slice 6 — arc-length sampling από το ΕΝΑ SSoT (`polyline-frame`)· πρώην
// private `pathLength`/`pointAtDistance`/`angleAtDistance` εδώ (ratchet item — δες
// pending-ratchet-work). Το railing δουλεύει σε Point3D (xy + datum z): ο sampler
// τρέχει στην xy προβολή (Point3D ⊂ Point2D) και ο caller ξαναβάζει το z.
import { samplePolylineFrame, polylineLength } from '../geometry/shared/polyline-frame';

const MM_TO_M = 1 / 1000;
const RAD_TO_DEG = 180 / Math.PI;

// ─── Path helpers ────────────────────────────────────────────────────────────

/** Resolve the railing path. Φ1: sketch → path lifted to the datum elevation. */
function resolveRailingPath(
  params: RailingParams,
  host?: RailingHostContext,
): RailingPath {
  if (params.pathSource.kind === 'hosted') {
    return host?.resolvedPath ?? []; // Φ2-Φ3 hosting
  }
  const z = params.baseElevationMm;
  return params.pathSource.path.map((p) => ({ x: p.x, y: p.y, z }));
}

/** Running length of a path in canvas units (SSoT `polylineLength`). */
function pathLength(path: RailingPath): number {
  return polylineLength(path);
}

/** Plan angle (deg CCW) of the segment a→b. */
function segmentAngleDeg(a: Point3D, b: Point3D): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * RAD_TO_DEG;
}

/** Point at running distance `d` (canvas units) along the path, at elevation `z`. */
function pointAtDistance(path: RailingPath, d: number, z: number): Point3D {
  const frame = samplePolylineFrame(path, d);
  if (!frame) return { ...path[path.length - 1], z };
  return { x: frame.point.x, y: frame.point.y, z };
}

/** Angle (deg) of the path at running distance `d` (SSoT frame tangent → deg). */
function angleAtDistance(path: RailingPath, d: number): number {
  const frame = samplePolylineFrame(path, d);
  if (!frame) return 0;
  return Math.atan2(frame.tangent.y, frame.tangent.x) * RAD_TO_DEG;
}

// ─── Posts ───────────────────────────────────────────────────────────────────

/** Posts at start / corners / end per the placement rule. Φ1 straight → 2 posts. */
function buildPosts(
  path: RailingPath,
  type: RailingType,
  params: RailingParams,
): RailMemberSolid[] {
  const cfg = type.balusterPlacement.posts;
  if (!cfg.enabled || path.length < 2) return [];
  const n = path.length;
  const out: RailMemberSolid[] = [];
  for (let i = 0; i < n; i++) {
    const isStart = i === 0;
    const isEnd = i === n - 1;
    const include = (isStart && cfg.atStart) || (isEnd && cfg.atEnd) || (!isStart && !isEnd && cfg.atCorners);
    if (!include) continue;
    const refA = isEnd ? path[i - 1] : path[i];
    const refB = isEnd ? path[i] : path[i + 1];
    out.push({
      role: 'post',
      basePoint: { x: path[i].x, y: path[i].y, z: params.baseElevationMm },
      heightMm: params.totalHeightMm,
      rotationDeg: segmentAngleDeg(refA, refB),
      profile: cfg.profile,
      material: cfg.material,
    });
  }
  return out;
}

// ─── Balusters ─────────────────────────────────────────────────────────────────

/** Distances (canvas units) for interior balusters; endpoints are covered by posts. */
function balusterDistances(totalLen: number, spacing: number, justification: 'start' | 'center' | 'end'): number[] {
  if (spacing <= 0 || totalLen <= 0) return [];
  const dists: number[] = [];
  if (justification === 'center') {
    const nGaps = Math.max(1, Math.ceil(totalLen / spacing));
    const actual = totalLen / nGaps;
    for (let k = 1; k < nGaps; k++) dists.push(k * actual);
    return dists;
  }
  // 'start' marches from 0, 'end' marches from the far end (mirror).
  for (let d = spacing; d < totalLen - 1e-6; d += spacing) {
    dists.push(justification === 'end' ? totalLen - d : d);
  }
  return dists;
}

/** Round balusters along the path at the ball-rule spacing, up to the top-rail underside. */
function buildBalusters(
  path: RailingPath,
  type: RailingType,
  params: RailingParams,
  s: number,
): RailMemberSolid[] {
  const pattern = type.balusterPlacement.pattern;
  if (path.length < 2) return [];
  const spacingCanvas = pattern.spacingMm * s;
  const totalLen = pathLength(path);
  const topRailHeight = type.topRail.enabled ? type.topRail.heightMm : params.totalHeightMm;
  const balHeight = Math.max(0, topRailHeight - type.topRail.profile.heightMm / 2);
  const dists = balusterDistances(totalLen, spacingCanvas, pattern.justification);
  return dists.map((d) => ({
    role: 'baluster' as const,
    basePoint: pointAtDistance(path, d, params.baseElevationMm),
    heightMm: balHeight,
    rotationDeg: angleAtDistance(path, d),
    profile: pattern.profile,
    material: pattern.material,
  }));
}

// ─── Rails ─────────────────────────────────────────────────────────────────────

/** Lift a path to a member centreline elevation (datum + heightMm). */
function liftPath(path: RailingPath, baseElevationMm: number, heightMm: number): RailingPath {
  const z = baseElevationMm + heightMm;
  return path.map((p) => ({ x: p.x, y: p.y, z }));
}

/** Top rail + (Φ4) intermediate rails + handrail. Φ1: one centred top rail. */
function buildRails(path: RailingPath, type: RailingType, params: RailingParams): RailSweep[] {
  const rails: RailSweep[] = [];
  if (type.topRail.enabled) {
    rails.push({
      role: 'top-rail',
      path: liftPath(path, params.baseElevationMm, type.topRail.heightMm),
      profile: type.topRail.profile,
      material: type.topRail.material,
    });
  }
  for (const rs of type.railStructure) {
    rails.push({ role: 'intermediate', path: liftPath(path, params.baseElevationMm, rs.heightMm), profile: rs.profile, material: rs.material });
  }
  if (type.handrail.enabled) {
    rails.push({ role: 'handrail', path: liftPath(path, params.baseElevationMm, type.handrail.heightMm), profile: type.handrail.profile, material: type.handrail.material });
  }
  return rails;
}

// ─── Bbox ──────────────────────────────────────────────────────────────────────

function computeBbox(path: RailingPath, params: RailingParams) {
  if (path.length === 0) {
    const o = { x: 0, y: 0, z: params.baseElevationMm };
    return { min: o, max: o };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of path) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return {
    min: { x: minX, y: minY, z: params.baseElevationMm },
    max: { x: maxX, y: maxY, z: params.baseElevationMm + params.totalHeightMm },
  };
}

// ─── Engine ────────────────────────────────────────────────────────────────────

/**
 * Compute `RailingGeometry` from `RailingParams` (+ resolved host context). Pure
 * SSoT. Returns a degenerate (empty-member) geometry for a sub-2-point path —
 * the validator guards this upstream. Throws nothing.
 */
export function computeRailingGeometry(
  params: RailingParams,
  host?: RailingHostContext,
): RailingGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const resolvedPath = resolveRailingPath(params, host);
  const lengthM = (pathLength(resolvedPath) / s) * MM_TO_M;
  return {
    resolvedPath,
    posts: buildPosts(resolvedPath, params.type, params),
    balusters: buildBalusters(resolvedPath, params.type, params, s),
    rails: buildRails(resolvedPath, params.type, params),
    panels: [],
    bbox: computeBbox(resolvedPath, params),
    lengthM,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Result of a railing validation pass — hard errors non-empty when invalid. */
export interface RailingValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking code violations (Revit pattern: warn, don't block). i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to `RailingEntity.validation`. */
  readonly bimValidation: BimValidation;
}

function profileTooSmall(p: RailProfile): boolean {
  return p.widthMm < MIN_RAILING_DIMENSION_MM || p.heightMm < MIN_RAILING_DIMENSION_MM;
}

/**
 * Validate `RailingParams`. Pure (geometry re-derivable). Hard errors: degenerate
 * path / non-positive height / non-positive spacing / degenerate profile. Code
 * violations (warnings): guardrail height outside 1000–1100mm, baluster clear gap
 * above the 10cm ball rule.
 */
export function validateRailingParams(params: RailingParams): RailingValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];
  const { type } = params;

  if (params.pathSource.kind === 'sketch' && params.pathSource.path.length < 2) {
    hardErrors.push('railing.validation.hardErrors.pathTooShort');
  }
  if (params.totalHeightMm <= 0) {
    hardErrors.push('railing.validation.hardErrors.nonPositiveHeight');
  }
  if (type.balusterPlacement.pattern.spacingMm <= 0) {
    hardErrors.push('railing.validation.hardErrors.nonPositiveSpacing');
  }
  if (profileTooSmall(type.balusterPlacement.pattern.profile) || profileTooSmall(type.topRail.profile)) {
    hardErrors.push('railing.validation.hardErrors.dimensionTooSmall');
  }

  if (params.totalHeightMm < 1000 || params.totalHeightMm > 1100) {
    codeViolations.push('railing.validation.codeViolations.guardrailHeight');
  }
  if (type.balusterPlacement.pattern.spacingMm > MAX_BALUSTER_SPACING_MM) {
    codeViolations.push('railing.validation.codeViolations.balusterGap');
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
