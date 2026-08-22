/**
 * ADR-407 — ΕΡΩΤΗΜΑΤΑ ΔΙΑΔΡΟΜΗΣ κιγκλιδώματος: «πού είναι το σημείο σε απόσταση d;
 * τι γωνία έχει εκεί; ποιο είναι το πλησιέστερο σημείο ΠΑΝΩ στη γραμμή;»
 *
 * Εξήχθη από το `railing-geometry.ts` (N.7.1 — 501/500 γραμμές). ⚠️ Η τομή ΔΕΝ είναι
 * «κόψε όσο χρειάζεται»: αυτές οι δέκα συναρτήσεις **δεν ξέρουν τίποτα για κάγκελα** —
 * δουλεύουν αποκλειστικά πάνω σε `RailingPath` και απαντούν γεωμετρικά ερωτήματα. Ό,τι
 * μένει πίσω απαντά το άλλο ερώτημα, «τι ΧΤΙΖΕΤΑΙ πάνω στη διαδρομή» (ορθοστάτες,
 * κάγκελα, κουπαστές). Δύο ευθύνες, δύο αρχεία.
 *
 * 🔑 Το z **δεν δειγματοληπτείται από το SSoT** και αυτό είναι σκόπιμο: το
 * `samplePolylineFrame` τρέχει στην **xy προβολή** (ρίχνει το z), οπότε το `zAtDistance`
 * παρεμβάλλει γραμμικά μέσα στο τμήμα που περιέχει το `d`. Έτσι ένα μέλος τοποθετημένο
 * κατά μήκος της διαδρομής κάθεται στην **κεκλιμένη** διαδρομή-ξενιστή (ADR-407 Φ7)
 * αντί να επιπλέει σε επίπεδο z.
 *
 * ⚠️ Το `z` εδώ είναι σε **ΧΙΛΙΟΣΤΑ** (η διαδρομή κουβαλά `baseElevationMm`), ενώ τα
 * `x`/`y` σε μονάδες καμβά — ασυμμετρία που κληρονομείται από τον τύπο `RailingPath`
 * και **δεν** την εισάγει αυτή η εξαγωγή. Δες ADR-793 §2 για την κλάση του προβλήματος.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type { BimPoint } from '../types/bim-base';
import type { RailingPath } from '../types/railing-types';
// ADR-471 Slice 6 — arc-length sampling από το ΕΝΑ SSoT (`polyline-frame`).
import { samplePolylineFrame, polylineLength } from '../geometry/shared/polyline-frame';

const RAD_TO_DEG = 180 / Math.PI;

/** Running length of a path in canvas units (SSoT `polylineLength`). */
export function pathLength(path: RailingPath): number {
  return polylineLength(path);
}

/** Plan angle (deg CCW) of the segment a→b. */
export function segmentAngleDeg(a: BimPoint, b: BimPoint): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * RAD_TO_DEG;
}

/** Point at running distance `d` (canvas units) along the path, at elevation `z`. */
function pointAtDistance(path: RailingPath, d: number, z: number): BimPoint {
  const frame = samplePolylineFrame(path, d);
  if (!frame) return { ...path[path.length - 1], z };
  return { x: frame.point.x, y: frame.point.y, z };
}

/** Angle (deg) of the path at running distance `d` (SSoT frame tangent → deg). */
export function angleAtDistance(path: RailingPath, d: number): number {
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
export function sampleRailingPath(path: RailingPath, d: number): BimPoint {
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
export function projectOntoPath(path: RailingPath, x: number, y: number): BimPoint {
  const n = nearestOnPath(path, x, y);
  if (!n) return path.length === 1 ? { x: path[0]!.x, y: path[0]!.y, z: path[0]!.z ?? 0 } : { x, y, z: 0 };
  const a = path[n.i - 1]!;
  const b = path[n.i]!;
  return { x: n.x, y: n.y, z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * n.t };
}

/** Plan angle (deg CCW) of the path segment nearest to `p` — aligns a member profile at a baked anchor. */
export function nearestSegmentAngleDeg(path: RailingPath, p: BimPoint): number {
  const n = nearestOnPath(path, p.x, p.y);
  if (!n) return 0;
  const a = path[n.i - 1]!;
  const b = path[n.i]!;
  return Math.atan2(b.y - a.y, b.x - a.x) * RAD_TO_DEG;
}


/**
 * Lift a path to a member centreline elevation, `heightMm` **above each vertex's own z**.
 * Sketch paths carry a flat z (= `baseElevationMm`), so the result is a flat rail exactly
 * as before; a hosted (stair) path carries per-vertex slope z, so the rail follows the
 * incline automatically (ADR-407 Φ7 — sloped rail, zero extra code at the render layer).
 */
export function liftPath(path: RailingPath, heightMm: number): RailingPath {
  return path.map((p) => ({ x: p.x, y: p.y, z: (p.z ?? 0) + heightMm }));
}
