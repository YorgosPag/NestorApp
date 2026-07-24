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
/** |Δz| (mm) below which a path segment counts as a FLAT landing (vs a sloped flight). */
const FLAT_SEGMENT_EPS_MM = 1;

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

/**
 * Interpolated z (mm) at running xy distance `d` along the path. The SSoT `samplePolylineFrame`
 * runs on the xy projection (dropping z); here we lerp z from the containing segment so a member
 * placed by along-path distance sits on the **sloped** host path (ADR-407 Φ7).
 */
function zAtDistance(path: RailingPath, d: number): number {
  if (path.length === 0) return 0;
  if (d <= 0) return path[0]!.z ?? 0;
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + segLen >= d) {
      const t = segLen > 0 ? (d - acc) / segLen : 0;
      return (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t;
    }
    acc += segLen;
  }
  return path[path.length - 1]!.z ?? 0;
}

/**
 * Sample a point on the railing path at running xy distance `d`, carrying the interpolated
 * slope z (mm). SSoT for along-path placement — shared by the baluster spacing pattern AND the
 * stair host builder's «Baluster Per Tread» anchor sampling (N.0.2 — one walk, no sibling clone).
 */
export function sampleRailingPath(path: RailingPath, d: number): Point3D {
  return pointAtDistance(path, d, zAtDistance(path, d));
}

/** Nearest point on the path to `(x, y)`: the containing segment index + parametric `t` + foot xy. */
function nearestOnPath(
  path: RailingPath,
  x: number,
  y: number,
): { readonly i: number; readonly t: number; readonly x: number; readonly y: number } | null {
  if (path.length < 2) return null;
  let best = Infinity;
  let out = { i: 1, t: 0, x: path[0]!.x, y: path[0]!.y };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0;
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    const dist = Math.hypot(x - cx, y - cy);
    if (dist < best) {
      best = dist;
      out = { i, t, x: cx, y: cy };
    }
  }
  return out;
}

/**
 * Project `(x, y)` onto the path and return the nearest point ON it — xy plus the z linearly
 * interpolated along the containing segment. SSoT for «where is this stair-tread point on the
 * railing line, and what is the SMOOTH walkline z there» (ADR-407 Φ7c): the host uses it to seat
 * a baluster on the railing line at each tread; the engine uses it to find the smooth rail z above
 * a baluster so the member reaches the (sloped) rail underside from its stepped tread base.
 */
export function projectOntoPath(path: RailingPath, x: number, y: number): Point3D {
  const n = nearestOnPath(path, x, y);
  if (!n) return path.length === 1 ? { x: path[0]!.x, y: path[0]!.y, z: path[0]!.z ?? 0 } : { x, y, z: 0 };
  const a = path[n.i - 1]!;
  const b = path[n.i]!;
  return { x: n.x, y: n.y, z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * n.t };
}

/** Plan angle (deg CCW) of the path segment nearest to `p` — aligns a member profile at a baked anchor. */
function nearestSegmentAngleDeg(path: RailingPath, p: Point3D): number {
  const n = nearestOnPath(path, p.x, p.y);
  if (!n) return 0;
  const a = path[n.i - 1]!;
  const b = path[n.i]!;
  return Math.atan2(b.y - a.y, b.x - a.x) * RAD_TO_DEG;
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
      // ADR-407 Φ7 — base z from the vertex's own z (flat for sketch = baseElevationMm; sloped for a hosted stair path).
      basePoint: { x: path[i].x, y: path[i].y, z: path[i].z ?? params.baseElevationMm },
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

/** Pattern (profile + spacing) sub-shape of a baluster placement — used by the per-tread builders. */
type BalusterPattern = RailingType['balusterPlacement']['pattern'];

/**
 * Revit «Baluster Per Tread» flight balusters (ADR-407 Φ7c): ONE plumb baluster on EACH stair
 * tread. Base sits on the tread top (`anchor.z`, STEPPED — so it «πατάει στη σκάλα»), and the
 * member is exactly tall enough to reach the SMOOTH rail underside above it (`projectOntoPath`
 * gives the walkline z at the anchor xy, + `railOffsetMm`). So every top meets the sloped rail
 * («η κουπαστή ακολουθεί τις κορυφές») — impossible with even/along-path spacing on a stepped run.
 */
function treadBalusters(
  anchors: readonly Point3D[],
  path: RailingPath,
  params: RailingParams,
  pattern: BalusterPattern,
  railOffsetMm: number,
): RailMemberSolid[] {
  return anchors.map((a) => {
    const baseZ = a.z ?? params.baseElevationMm;
    const railUndersideZ = projectOntoPath(path, a.x, a.y).z + railOffsetMm;
    return {
      role: 'baluster' as const,
      basePoint: { x: a.x, y: a.y, z: baseZ },
      heightMm: Math.max(0, railUndersideZ - baseZ),
      rotationDeg: nearestSegmentAngleDeg(path, a),
      profile: pattern.profile,
      material: pattern.material,
    };
  });
}

/**
 * Landing balusters (ADR-407 Φ7c): the tread anchors cover only the sloped flights, so FLAT
 * segments (rest landings) would be bare. Fill each with the 10cm-ball-rule spacing, base on the
 * flat landing surface (segment z), height = `railOffsetMm` (flat rail directly above) — the
 * landing mirror of the flight rule. Interior only; segment ends are covered by posts.
 */
function landingBalusters(
  path: RailingPath,
  pattern: BalusterPattern,
  s: number,
  railOffsetMm: number,
): RailMemberSolid[] {
  const spacing = pattern.spacingMm * s;
  if (spacing <= 0) return [];
  const out: RailMemberSolid[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    if (Math.abs((b.z ?? 0) - (a.z ?? 0)) > FLAT_SEGMENT_EPS_MM) continue; // sloped flight → skip
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.floor(segLen / spacing);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      out.push({
        role: 'baluster',
        basePoint: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z ?? 0 },
        heightMm: railOffsetMm,
        rotationDeg: segmentAngleDeg(a, b),
        profile: pattern.profile,
        material: pattern.material,
      });
    }
  }
  return out;
}

/**
 * Balusters up to the top-rail underside. Two placement modes (Revit parity):
 *  - **Baluster Per Tread** (ADR-407 Φ7c): when the host bakes `perTreadAnchors` (one per stair
 *    tread, xy on the railing line + STEPPED tread-top z), one baluster seats on each tread and
 *    reaches the smooth rail; flat landings are filled at the ball-rule spacing. Bases «πατάνε
 *    στη σκάλα», tops meet the sloped rail — the Revit «Baluster Per Tread» guarantee.
 *  - **Along-path spacing** (Φ1 default): interior balusters at the 10cm-ball-rule spacing,
 *    each lifted to the interpolated path z so it stays plumb on a sloped host.
 */
function buildBalusters(
  path: RailingPath,
  type: RailingType,
  params: RailingParams,
  s: number,
  host?: RailingHostContext,
): RailMemberSolid[] {
  const pattern = type.balusterPlacement.pattern;
  if (path.length < 2) return [];
  const topRailHeight = type.topRail.enabled ? type.topRail.heightMm : params.totalHeightMm;
  const balHeight = Math.max(0, topRailHeight - type.topRail.profile.heightMm / 2);

  // Revit «Baluster Per Tread» — one baluster per baked tread anchor + landing infill.
  const anchors = host?.perTreadAnchors;
  if (type.balusterPlacement.perTread && anchors && anchors.length > 0) {
    return [
      ...treadBalusters(anchors, path, params, pattern, balHeight),
      ...landingBalusters(path, pattern, s, balHeight),
    ];
  }

  const spacingCanvas = pattern.spacingMm * s;
  const totalLen = pathLength(path);
  const dists = balusterDistances(totalLen, spacingCanvas, pattern.justification);
  return dists.map((d) => ({
    role: 'baluster' as const,
    basePoint: sampleRailingPath(path, d),
    heightMm: balHeight,
    rotationDeg: angleAtDistance(path, d),
    profile: pattern.profile,
    material: pattern.material,
  }));
}

// ─── Rails ─────────────────────────────────────────────────────────────────────

/**
 * Lift a path to a member centreline elevation, `heightMm` **above each vertex's own z**.
 * Sketch paths carry a flat z (= `baseElevationMm`), so the result is a flat rail exactly
 * as before; a hosted (stair) path carries per-vertex slope z, so the rail follows the
 * incline automatically (ADR-407 Φ7 — sloped rail, zero extra code at the render layer).
 */
function liftPath(path: RailingPath, heightMm: number): RailingPath {
  return path.map((p) => ({ x: p.x, y: p.y, z: (p.z ?? 0) + heightMm }));
}

/** Top rail + (Φ4) intermediate rails + handrail. Φ1: one centred top rail. */
function buildRails(path: RailingPath, type: RailingType): RailSweep[] {
  const rails: RailSweep[] = [];
  if (type.topRail.enabled) {
    rails.push({
      role: 'top-rail',
      path: liftPath(path, type.topRail.heightMm),
      profile: type.topRail.profile,
      material: type.topRail.material,
    });
  }
  for (const rs of type.railStructure) {
    rails.push({ role: 'intermediate', path: liftPath(path, rs.heightMm), profile: rs.profile, material: rs.material });
  }
  if (type.handrail.enabled) {
    rails.push({ role: 'handrail', path: liftPath(path, type.handrail.heightMm), profile: type.handrail.profile, material: type.handrail.material });
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
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of path) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    // ADR-407 Φ7 — z spans the (possibly sloped) host path, not a single flat datum.
    const z = p.z ?? params.baseElevationMm;
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ + params.totalHeightMm },
  };
}

// ─── Engine ────────────────────────────────────────────────────────────────────

/**
 * Synthesize a `RailingHostContext` from a hosted path source's **baked snapshot** (ADR-407 Φ7).
 * This is what lets a persisted hosted railing hydrate with NO live host — `railingDocToEntity`
 * calls `computeRailingGeometry(params)` with no `host`, and the baked `resolvedPath` /
 * `treadCount` carry it through. `undefined` for sketch sources or an un-baked hosted source.
 */
function hostFromSnapshot(source: RailingParams['pathSource']): RailingHostContext | undefined {
  if (source.kind !== 'hosted' || !source.resolvedPath) return undefined;
  return {
    hostId: source.hostId,
    hostType: source.hostType,
    resolvedPath: source.resolvedPath,
    ...(source.slopeRatio !== undefined ? { slopeRatio: source.slopeRatio } : {}),
    ...(source.perTreadAnchors ? { perTreadAnchors: source.perTreadAnchors } : {}),
  };
}

/**
 * Compute `RailingGeometry` from `RailingParams` (+ resolved host context). Pure
 * SSoT. Returns a degenerate (empty-member) geometry for a sub-2-point path —
 * the validator guards this upstream. Throws nothing.
 *
 * A live `host` (passed by the stair→railing cascade after a stair edit) always wins; when
 * absent (hydrate) the baked snapshot on a hosted `pathSource` is used instead (ADR-407 Φ7).
 */
export function computeRailingGeometry(
  params: RailingParams,
  host?: RailingHostContext,
): RailingGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const effectiveHost = host ?? hostFromSnapshot(params.pathSource);
  const resolvedPath = resolveRailingPath(params, effectiveHost);
  const lengthM = (pathLength(resolvedPath) / s) * MM_TO_M;
  return {
    resolvedPath,
    posts: buildPosts(resolvedPath, params.type, params),
    balusters: buildBalusters(resolvedPath, params.type, params, s, effectiveHost),
    rails: buildRails(resolvedPath, params.type),
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
