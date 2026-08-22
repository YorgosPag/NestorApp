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
import type { BimPoint, SolidBounds } from '../types/bim-base';
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
// ADR-407 — ΕΡΩΤΗΜΑΤΑ ΔΙΑΔΡΟΜΗΣ από το αδελφό module (N.7.1 split): εκείνο ξέρει «πού
// είναι το σημείο και τι γωνία έχει», αυτό ξέρει «τι χτίζεται εκεί». Το arc-length
// sampling παραμένει στο ΕΝΑ SSoT (`polyline-frame`) — το `railing-path` το καταναλώνει.
import {
  angleAtDistance,
  liftPath,
  nearestSegmentAngleDeg,
  pathLength,
  projectOntoPath,
  sampleRailingPath,
  segmentAngleDeg,
} from './railing-path';
import { bboxOf } from '../geometry/shared/xy-bounds';

const MM_TO_M = 1 / 1000;
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
  anchors: readonly BimPoint[],
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

/**
 * 🔴 **ADR-793 — ΔΙΟΡΘΩΣΗ ΜΟΝΑΔΑΣ, ΟΧΙ ΚΑΘΑΡΙΣΜΑ.** Μέχρι 2026-08-22 αυτή η συνάρτηση
 * έγραφε το `z` σε **ωμά χιλιοστά** (`params.baseElevationMm`, `+ totalHeightMm`) στον
 * **ΙΔΙΟ** τύπο όπου τοίχος · πλάκα · δοκός · άνοιγμα · στέγη · MEP γράφουν **μέτρα** —
 * σφάλμα **1000×**. Ήταν αόρατο για έναν μόνο λόγο: **κανείς δεν διάβαζε** το z του
 * κιγκλιδώματος (ο μοναδικός αναγνώστης, `entity-world-aabb`, δεν χειρίζεται `railing`).
 * Θα γινόταν ζωντανό τη στιγμή που κάποιος πρόσθετε το `railing` στον πρώτο κλάδο του —
 * που **μοιάζει** με τον γενικό. Το `minZm`/`maxZm` κάνει την επανάληψη **αδύνατη**.
 */
function computeBbox(path: RailingPath, params: RailingParams): SolidBounds {
  const baseZm = params.baseElevationMm * MM_TO_M;
  if (path.length === 0) {
    const o = { x: 0, y: 0 };
    return { min: o, max: o, minZm: baseZm, maxZm: baseZm };
  }
  // ADR-793 — ο βρόχος min/max του XY ζει ΜΙΑ φορά, στο `xy-bounds` (ADR-583/CHECK 3.28).
  const { minX, minY, maxX, maxY } = bboxOf(path);
  let minZmm = Infinity, maxZmm = -Infinity;
  for (const p of path) {
    // ADR-407 Φ7 — z spans the (possibly sloped) host path, not a single flat datum.
    const z = p.z ?? params.baseElevationMm;
    if (z < minZmm) minZmm = z;
    if (z > maxZmm) maxZmm = z;
  }
  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
    minZm: minZmm * MM_TO_M,
    maxZm: (maxZmm + params.totalHeightMm) * MM_TO_M,
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
