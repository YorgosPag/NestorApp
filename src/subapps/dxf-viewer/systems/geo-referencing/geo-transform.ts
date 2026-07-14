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

/** LOCAL (DXF) → WORLD (ΕΓΣΑ): `R(rot)·p + originWorld`. */
export function localToWorld(p: Point2D, geo: GeoReference): Point2D {
  const rad = geo.rotationDeg * DEG_TO_RAD;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: p.x * c - p.y * s + geo.originWorld.x,
    y: p.x * s + p.y * c + geo.originWorld.y,
  };
}

/**
 * The SOLE inverse-rigid kernel (WORLD → LOCAL) with the trig PRE-COMPUTED: `c=cos(rot)`,
 * `s=sin(rot)`, `(ox,oy)=originWorld`. Both `worldToLocal` and {@link makeWorldToDisplayProjector}
 * delegate here, so the `R⁻¹·(p−origin)` formula lives in exactly ONE place (no structural clone —
 * N.18/jscpd). Split out so a hot per-vertex loop can compute the trig once and reuse it.
 */
function worldToLocalCore(worldX: number, worldY: number, c: number, s: number, ox: number, oy: number): Point2D {
  const dx = worldX - ox;
  const dy = worldY - oy;
  // Inverse rotation is the transpose: [c s; -s c].
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

/** WORLD (ΕΓΣΑ) → LOCAL (DXF): `R(rot)⁻¹·(p − originWorld)`. */
export function worldToLocal(p: Point2D, geo: GeoReference): Point2D {
  const rad = geo.rotationDeg * DEG_TO_RAD;
  return worldToLocalCore(p.x, p.y, Math.cos(rad), Math.sin(rad), geo.originWorld.x, geo.originWorld.y);
}

/**
 * ADR-650 M10b — a PREPARED «WORLD (ΕΓΣΑ) → building-DISPLAY (DXF local)» projector, the SSoT the
 * survey→3D pipeline uses to seat the terrain under the building (mirror of the 2D contour path).
 *
 * Prepared, not point-by-point, for two reasons the callers rely on:
 *   - `isIdentity` lets a hot per-vertex loop (TIN vertices, a 2M-point cloud) skip the transform
 *     ENTIRELY when the project is not geo-referenced — byte-for-byte the previous behaviour, zero
 *     added allocation. Backward compatible: an unset/identity reference renders exactly as before.
 *   - the trig is computed ONCE here, not per vertex — `project()` then only does the shared
 *     {@link worldToLocalCore} arithmetic. One formula home, no re-inlined rotation.
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
  const rad = geo!.rotationDeg * DEG_TO_RAD;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const ox = geo!.originWorld.x;
  const oy = geo!.originWorld.y;
  return { isIdentity: false, project: (worldX, worldY) => worldToLocalCore(worldX, worldY, c, s, ox, oy) };
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
