/**
 * ADR-369 / ADR-650 M10 — Geo-referencing rigid transform SSoT.
 *
 * «Κουμπώνει» το αρχιτεκτονικό DXF (τοπικές συντεταγμένες γύρω από το 0) πάνω στο
 * τοπογραφικό (πραγματικές ΕΓΣΑ'87), όπως το **Revit Shared Coordinates** (Survey
 * Point + Project Base Point + North) / ArchiCAD Survey Point / Civil 3D real-world
 * coords. Rigid transform (μετατόπιση + στροφή, **χωρίς κλίμακα**): και το σχέδιο και
 * το έδαφος είναι ήδη σε πραγματικά μέτρα (1:1), οπότε scale θα παραμόρφωνε το κτίριο.
 *
 * ## Το μοντέλο (minimal Revit-canonical)
 * Ό,τι χρειάζεται μια rigid αντιστοίχιση local↔world συμπυκνώνεται σε ΔΥΟ αριθμούς:
 *   - `originWorld` — οι WORLD (ΕΓΣΑ, canonical mm) συντεταγμένες του project **local
 *     origin** (0,0). Είναι το Revit «Project Base Point» εκφρασμένο σε shared coords.
 *   - `rotationDeg` — η στροφή true-north → project grid (Revit «Angle to True North»).
 *
 *       world = R(rotationDeg) · local + originWorld
 *       local = R(rotationDeg)⁻¹ · (world − originWorld)
 *
 * Ο χρήστης όμως δείχνει ένα ΑΥΘΑΙΡΕΤΟ γνωστό σημείο (γωνία οικοπέδου κ.λπ.), όχι το
 * origin. Οι `fromOnePointPair` / `fromTwoPointPairs` κανονικοποιούν ένα (ή δύο)
 * ζεύγη σημείων σε αυτή τη μορφή, ώστε το αποθηκευμένο transform να είναι πάντα το
 * ελάχιστο Revit-canonical ({originWorld, rotationDeg}) — δες `geo-reference-schema`.
 *
 * ## Μονάδες
 * Το runtime transform δουλεύει ΑΠΟΚΛΕΙΣΤΙΚΑ σε **canonical mm** (όπως το TopoPoint
 * και η DXF σκηνή — ADR-462). Η μετατροπή προς/από τα ΜΕΤΡΑ του `Project.surveyPoint`
 * /`basePoint` (ADR-369) γίνεται στο schema boundary (`geo-reference-schema.ts`), ΠΟΤΕ
 * εδώ. Έτσι το ίδιο transform συνθέτει άμεσα με topo world coords + DXF scene coords.
 *
 * Pure module — zero React/DOM/Firestore/store deps. Unit-agnostic ως προς mm (δέχεται
 * ό,τι Point2D του δώσεις — απλώς local & world πρέπει να είναι στο ίδιο σύστημα mm).
 *
 * @see ./geo-reference-schema.ts — metres↔mm στα Project fields (ADR-369)
 * @see ../topography/persistence/regenerate-topo.ts — apply-at-render (world→local)
 * @see ../zoom/utils/robust-bounds.ts — computeRobustCenter (auto-align, Εύρημα #1)
 */

import type { Point2D } from '../../rendering/types/Types';

const DEG_TO_RAD = Math.PI / 180;

/**
 * The minimal rigid local↔world geo-reference (Revit-canonical).
 * `originWorld` = WORLD coords (canonical mm) of the project local origin (0,0).
 * `rotationDeg` = local→world rotation (degrees, CCW-positive in a Y-up frame).
 */
export interface GeoReference {
  readonly originWorld: Point2D;
  readonly rotationDeg: number;
}

/** The neutral (identity) reference — `local === world`. */
export const IDENTITY_GEO_REFERENCE: GeoReference = {
  originWorld: { x: 0, y: 0 },
  rotationDeg: 0,
};

/**
 * `true` when this reference is a no-op (no translation, no rotation). Callers use
 * this to short-circuit the projection so a non-geo-referenced project renders
 * EXACTLY as before (backward compatible — no coordinate churn).
 */
export function isIdentityGeoReference(geo: GeoReference | null | undefined): boolean {
  if (!geo) return true;
  return geo.originWorld.x === 0 && geo.originWorld.y === 0 && geo.rotationDeg === 0;
}

/**
 * A rigid map in its EXECUTABLE form — the four numbers a loop needs, with the trig already
 * paid for:
 *
 *     x′ = c·x − s·y + tx
 *     y′ = s·x + c·y + ty
 *
 * ## Why this type exists (ADR-650 §M10e v24)
 * BOTH directions of a `GeoReference` are instances of this one shape — the inverse of a
 * rigid map is just another rigid map. Naming that fact buys two things that were previously
 * paid for over and over:
 *   1. **One formula home.** The `cos/sin` rotation algebra is written ONCE. Before this,
 *      forward and inverse each carried their own copy of it — the structural clone N.18 is
 *      about, hidden behind a sign.
 *   2. **The trig leaves the loop.** `localToWorld(p, geo)` recomputed `cos` and `sin` on
 *      EVERY call. Measured on the M10e matcher: 3.7 M calls, 1.33 ms per 1 500 points versus
 *      **0.076 ms** with the map prepared once — a 17× difference doing identical arithmetic.
 *      The inverse direction already knew this (`makeWorldToDisplayProjector` prepares its
 *      trig); the forward direction did not. The asymmetry was the defect.
 *
 * Immutable and allocation-light: build once, apply many times via {@link mapX}/{@link mapY}.
 */
export interface RigidMap {
  readonly c: number;
  readonly s: number;
  readonly tx: number;
  readonly ty: number;
}

/** LOCAL (DXF) → WORLD (ΕΓΣΑ) as a prepared map: `R(rot)·p + originWorld`. */
export function forwardRigidMap(geo: GeoReference): RigidMap {
  const rad = geo.rotationDeg * DEG_TO_RAD;
  return { c: Math.cos(rad), s: Math.sin(rad), tx: geo.originWorld.x, ty: geo.originWorld.y };
}

/**
 * WORLD (ΕΓΣΑ) → LOCAL (DXF) as a prepared map: `R(rot)⁻¹·(p − originWorld)`.
 *
 * Expanding that expression collapses it back into the same four numbers: the rotation
 * transposes (`s ↦ −s`, since `R⁻¹ = Rᵀ` for a rotation) and the translation becomes
 * `−R⁻¹·originWorld`. So the inverse needs no separate kernel — it IS a {@link RigidMap}.
 */
export function inverseRigidMap(geo: GeoReference): RigidMap {
  const rad = geo.rotationDeg * DEG_TO_RAD;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const ox = geo.originWorld.x;
  const oy = geo.originWorld.y;
  return { c, s: -s, tx: -(c * ox + s * oy), ty: s * ox - c * oy };
}

/** X of `(x, y)` under `m`. Scalar in, scalar out — a hot loop allocates nothing. */
export function mapX(m: RigidMap, x: number, y: number): number {
  return m.c * x - m.s * y + m.tx;
}

/** Y of `(x, y)` under `m`. Scalar in, scalar out — a hot loop allocates nothing. */
export function mapY(m: RigidMap, x: number, y: number): number {
  return m.s * x + m.c * y + m.ty;
}

/**
 * `p` under `m`, as a point. Allocates, so a per-vertex loop uses {@link mapX}/{@link mapY}
 * instead — which is why this stays module-private: nothing outside needs the allocating form.
 */
function applyRigidMap(m: RigidMap, p: Point2D): Point2D {
  return { x: mapX(m, p.x, p.y), y: mapY(m, p.x, p.y) };
}

/**
 * LOCAL (DXF) → WORLD (ΕΓΣΑ): `R(rot)·p + originWorld`.
 *
 * ⚠️ Builds a {@link RigidMap} per call, i.e. `cos` + `sin` per point. Correct and convenient
 * for a handful of points; **wrong for a loop** — hoist `forwardRigidMap(geo)` out of it.
 */
export function localToWorld(p: Point2D, geo: GeoReference): Point2D {
  return applyRigidMap(forwardRigidMap(geo), p);
}

/**
 * WORLD (ΕΓΣΑ) → LOCAL (DXF): `R(rot)⁻¹·(p − originWorld)`.
 *
 * ⚠️ Same caveat as {@link localToWorld} — hoist {@link inverseRigidMap} out of any loop.
 */
export function worldToLocal(p: Point2D, geo: GeoReference): Point2D {
  return applyRigidMap(inverseRigidMap(geo), p);
}

/**
 * ADR-650 M10b — a PREPARED «WORLD (ΕΓΣΑ) → building-DISPLAY (DXF local)» projector, the SSoT the
 * survey→3D pipeline uses to seat the terrain under the building (mirror of the 2D contour path).
 *
 * Prepared, not point-by-point, for two reasons the callers rely on:
 *   - `isIdentity` lets a hot per-vertex loop (TIN vertices, a 2M-point cloud) skip the transform
 *     ENTIRELY when the project is not geo-referenced — byte-for-byte the previous behaviour, zero
 *     added allocation. Backward compatible: an unset/identity reference renders exactly as before.
 *   - the trig is computed ONCE here, not per vertex — `project()` then only applies the shared
 *     {@link RigidMap} arithmetic. One formula home, no re-inlined rotation.
 *
 * Deliberately takes the reference as an argument (does NOT read the store): the pure 3D converters
 * (`tin-to-three`, `cloud-to-three`) receive the projector so they stay store-free and unit-testable.
 * The single store-reading entry is `getActiveWorldToDisplayProjector()` in `geo-reference-store`.
 */
export interface WorldToDisplayProjector {
  /** `true` when the project is not geo-referenced — callers short-circuit to the world coords. */
  readonly isIdentity: boolean;
  /** Planimetric WORLD (ΕΓΣΑ, mm) → building-DISPLAY (DXF local, mm). Z/elevation is never touched. */
  readonly project: (worldX: number, worldY: number) => Point2D;
}

/** Build a {@link WorldToDisplayProjector} for `geo` (`null`/identity → a no-op projector). */
export function makeWorldToDisplayProjector(geo: GeoReference | null | undefined): WorldToDisplayProjector {
  if (isIdentityGeoReference(geo)) {
    return { isIdentity: true, project: (worldX, worldY) => ({ x: worldX, y: worldY }) };
  }
  const map = inverseRigidMap(geo!);
  return { isIdentity: false, project: (worldX, worldY) => ({ x: mapX(map, worldX, worldY), y: mapY(map, worldX, worldY) }) };
}

/**
 * TRANSLATION-ONLY reference from ONE common point pair (Revit «Specify Coordinates
 * at Point» με 1 σημείο): the picked `local` point IS the `world` point, no rotation.
 *
 * Normalises to the canonical {originWorld, rotationDeg=0}: since `world = local +
 * originWorld` with zero rotation, `originWorld = world − local`.
 */
export function fromOnePointPair(local: Point2D, world: Point2D): GeoReference {
  return {
    originWorld: { x: world.x - local.x, y: world.y - local.y },
    rotationDeg: 0,
  };
}

/**
 * TRANSLATION + ROTATION reference from TWO common point pairs (Revit 2-point align):
 * the segment A→B in local maps to A'→B' in world. **No scale** — the world length is
 * ignored (rigid); any length mismatch is surfaced by {@link pointPairScaleRatio} so
 * the UI can warn ("τα δύο σημεία δεν απέχουν το ίδιο — έλεγξε τις μονάδες").
 *
 * rotation = atan2(worldB − worldA) − atan2(localB − localA); then normalise so
 * `originWorld = worldA − R(rot)·localA`.
 */
export function fromTwoPointPairs(
  localA: Point2D,
  localB: Point2D,
  worldA: Point2D,
  worldB: Point2D,
): GeoReference {
  const localAngle = Math.atan2(localB.y - localA.y, localB.x - localA.x);
  const worldAngle = Math.atan2(worldB.y - worldA.y, worldB.x - worldA.x);
  const rotationDeg = (worldAngle - localAngle) / DEG_TO_RAD;
  const rad = rotationDeg * DEG_TO_RAD;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  // originWorld = worldA − R(rot)·localA
  return {
    originWorld: {
      x: worldA.x - (localA.x * c - localA.y * s),
      y: worldA.y - (localA.x * s + localA.y * c),
    },
    rotationDeg,
  };
}

/**
 * The ratio (world segment length ÷ local segment length) for a 2-point pick. In a
 * correct rigid setup this is ~1 (both are real metres). A value far from 1 means the
 * two drawings are in different units/scale — the UI warns instead of silently
 * distorting (big players NEVER auto-scale a geo-reference). Returns 1 for a
 * degenerate (zero-length) local segment.
 */
export function pointPairScaleRatio(
  localA: Point2D,
  localB: Point2D,
  worldA: Point2D,
  worldB: Point2D,
): number {
  const localLen = Math.hypot(localB.x - localA.x, localB.y - localA.y);
  if (localLen === 0) return 1;
  const worldLen = Math.hypot(worldB.x - worldA.x, worldB.y - worldA.y);
  return worldLen / localLen;
}
