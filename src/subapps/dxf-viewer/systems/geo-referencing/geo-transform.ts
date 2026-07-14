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

/** WORLD (ΕΓΣΑ) → LOCAL (DXF): `R(rot)⁻¹·(p − originWorld)`. */
export function worldToLocal(p: Point2D, geo: GeoReference): Point2D {
  const rad = geo.rotationDeg * DEG_TO_RAD;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = p.x - geo.originWorld.x;
  const dy = p.y - geo.originWorld.y;
  // Inverse rotation is the transpose: [c s; -s c].
  return {
    x: dx * c + dy * s,
    y: -dx * s + dy * c,
  };
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
