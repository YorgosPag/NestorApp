/**
 * Polyline / polygon offset-with-mitre helpers (pure SSoT, N.0.2 / N.12).
 *
 * Extracted from `polygon-utils.ts` (N.7.1 500-line cap). Re-exported από εκεί
 * ώστε όλοι οι υπάρχοντες importers να δουλεύουν αμετάβλητοι.
 *
 * Canonical polyline-offset math, extracted from `wall-geometry.ts` and
 * `beam-geometry.ts` (verbatim duplicate before this SSoT). Consumed by walls
 * (axis → outer/inner edge), beams (axis → outline rect) and ADR-396 envelope
 * perimeter (exterior face → insulation outer loop).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type { Point3D } from '../../types/bim-base';
import { polygonArea } from './polygon-utils';

/** Below this segment length (mm/canvas) a segment is treated as degenerate. */
const DEGENERATE_LENGTH_EPS = 0.001;

/**
 * CCW 90° unit segment normal X component (rotate tangent (dx,dy) → (-dy,dx)).
 * Returns `null` for degenerate (near-zero-length) segments.
 */
export function segmentNormalX(a: Point3D, b: Point3D): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_LENGTH_EPS) return null;
  return -dy / len;
}

/** CCW 90° unit segment normal Y component. Returns `null` for degenerate. */
export function segmentNormalY(a: Point3D, b: Point3D): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_LENGTH_EPS) return null;
  return dx / len;
}

/**
 * Vertex normal X — averages the adjacent segment normals (CCW 90°).
 *
 * `closed = false` (open polyline): endpoint vertices use their single adjacent
 * segment (walls/beams — the free ends are square-cut, not mitred).
 *
 * `closed = true` (ring): EVERY vertex — including index 0 and n-1 — averages
 * BOTH adjacent segments with wrap-around. Without this, the seam vertex of a
 * closed loop is offset perpendicular to only one edge, splitting the corner into
 * a `distance`-long diagonal jog (ADR-396 insulation-loop + Z4 reveal-frame bug).
 *
 * Degenerate segments are skipped. The averaging is the mitre approximation at
 * internal corners (shared by all callers — consistent across every corner).
 */
export function vertexNormalX(vertices: readonly Point3D[], i: number, closed = false): number {
  const n = vertices.length;
  let acc = 0;
  let count = 0;
  if (i > 0 || closed) {
    const prev = i > 0 ? i - 1 : n - 1;
    const seg = segmentNormalX(vertices[prev], vertices[i]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  if (i < n - 1 || closed) {
    const next = i < n - 1 ? i + 1 : 0;
    const seg = segmentNormalX(vertices[i], vertices[next]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  return count > 0 ? acc / count : 0;
}

/** Vertex normal Y — averages adjacent segment normals (mitre at corners). See `vertexNormalX` for `closed`. */
export function vertexNormalY(vertices: readonly Point3D[], i: number, closed = false): number {
  const n = vertices.length;
  let acc = 0;
  let count = 0;
  if (i > 0 || closed) {
    const prev = i > 0 ? i - 1 : n - 1;
    const seg = segmentNormalY(vertices[prev], vertices[i]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  if (i < n - 1 || closed) {
    const next = i < n - 1 ? i + 1 : 0;
    const seg = segmentNormalY(vertices[i], vertices[next]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  return count > 0 ? acc / count : 0;
}

/**
 * Drop a trailing vertex that coincides with the first (within `eps`). A closed
 * ring is sometimes represented with its first point repeated at the end (e.g. the
 * assembled envelope face loop); that duplicate creates a zero-length wrap-around
 * segment that breaks the closed-mitre at the seam. Returns the input unchanged
 * when there is no such duplicate.
 */
export function stripClosingDuplicate(vertices: readonly Point3D[], eps = 1e-6): readonly Point3D[] {
  const n = vertices.length;
  if (n < 2) return vertices;
  const a = vertices[0];
  const b = vertices[n - 1];
  if (Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps) {
    return vertices.slice(0, n - 1);
  }
  return vertices;
}

/**
 * Offset a polyline by `distance` along the per-vertex normals, scaled by
 * `sign` (+1 = CCW outward, -1 = inward). Returns a new array of the same
 * length; corners are mitred via the averaged vertex normal. `distance` is in
 * the same unit as the vertex coordinates (caller scales mm→canvas).
 *
 * `closed = true` treats the input as a ring (vertex 0 and n-1 are corners that
 * wrap around), so a closed loop offsets without a seam jog. Callers offsetting a
 * ring MUST first drop any trailing closing-duplicate (`stripClosingDuplicate`),
 * otherwise the zero-length seam segment defeats the wrap-around.
 */
export function offsetPolyline(
  vertices: readonly Point3D[],
  distance: number,
  sign: number,
  closed = false,
): Point3D[] {
  const out: Point3D[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const nx = vertexNormalX(vertices, i, closed);
    const ny = vertexNormalY(vertices, i, closed);
    const v = vertices[i];
    out.push({
      x: v.x + sign * distance * nx,
      y: v.y + sign * distance * ny,
      z: v.z ?? 0,
    });
  }
  return out;
}

/**
 * Inset ενός κλειστού polygon κατά `distance` προς τα ΜΕΣΑ, winding-agnostic:
 * δοκιμάζει και τα δύο πρόσημα του `offsetPolyline` και κρατά αυτό με το ΜΙΚΡΟΤΕΡΟ
 * εμβαδόν (= προς τα μέσα). Επιστρέφει `null` αν το polygon είναι μη-έγκυρο
 * (< 3 κορυφές, `distance ≤ 0`) ή το inset καταρρέει (degenerate). Χρήση: ETICS
 * περβάζια (ADR-396 Z4 — frame γύρω από την τρύπα ανοίγματος, 2D + 3D).
 */
export function insetClosedPolygon(
  vertices: readonly Point3D[],
  distance: number,
): Point3D[] | null {
  if (vertices.length < 3 || distance <= 0) return null;
  // Ring offset: strip any closing-duplicate + closed-mitre so the seam vertex
  // does not produce a diagonal jog (same fix as the envelope insulation loop).
  const ring = stripClosingDuplicate(vertices);
  if (ring.length < 3) return null;
  const plus = offsetPolyline(ring, distance, 1, true);
  const minus = offsetPolyline(ring, distance, -1, true);
  const inner = polygonArea(plus) <= polygonArea(minus) ? plus : minus;
  if (inner.length < 3 || polygonArea(inner) <= 0) return null;
  return inner;
}

/**
 * **Miter inward inset** ενός κλειστού πολυγώνου κατά `d` (winding-aware, concave-safe).
 * Κάθε ακμή μετατοπίζεται κάθετα προς τα ΜΕΣΑ κατά ΑΚΡΙΒΩΣ `d` και οι κορυφές κλείνουν
 * στην τομή των μετατοπισμένων ευθειών (γνήσιο miter `m = d·(n1+n2)/(1+n1·n2)`, με
 * miter-limit clamp). Σε αντίθεση με το {@link insetClosedPolygon} (averaged-normal, που
 * υπο-εισάγει τις γωνίες ~cos45°), αυτό διατηρεί την κάθετη απόσταση `d` σε κάθε παρειά —
 * απαραίτητο για centerline στεφανιού/ράβδων (ADR-460). Reflex (εσωτερικές) γωνίες Γ/Τ/Π
 * χειρίζονται σωστά γιατί τα inward normals προκύπτουν από το CCW winding (left normal),
 * όχι από centroid. Επιστρέφει `null` αν `< 3` κορυφές ή το inset καταρρέει (≤0 εμβαδόν).
 * Έξοδος πάντα σε CCW σειρά. `d ≤ 0` → αντίγραφο (CCW).
 */
export function insetPolygonMiter(
  vertices: readonly { readonly x: number; readonly y: number }[],
  distance: number,
): { x: number; y: number }[] | null {
  const n = vertices.length;
  if (n < 3) return null;
  // CCW orientation (signed area > 0)· αν CW → reverse ώστε left-normal = inward.
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    area2 += a.x * b.y - b.x * a.y;
  }
  const ring = area2 >= 0 ? vertices.map((p) => ({ x: p.x, y: p.y })) : vertices.map((p) => ({ x: p.x, y: p.y })).reverse();
  if (distance <= 0) return ring;

  const EPS = 1e-9;
  const MITER_LIMIT = 4;
  // Inward unit normal κάθε ακμής i (CCW left normal = rotate dir +90°: (-dy,dx)).
  const nrm = ring.map((a, i) => {
    const b = ring[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
  const out: { x: number; y: number }[] = [];
  for (let k = 0; k < n; k++) {
    const v = ring[k];
    const n1 = nrm[(k - 1 + n) % n];
    const n2 = nrm[k];
    const denom = 1 + (n1.x * n2.x + n1.y * n2.y);
    let mx: number;
    let my: number;
    if (denom < EPS) {
      mx = distance * n2.x;
      my = distance * n2.y;
    } else {
      mx = (distance * (n1.x + n2.x)) / denom;
      my = (distance * (n1.y + n2.y)) / denom;
      const mag = Math.hypot(mx, my);
      if (mag > MITER_LIMIT * distance) {
        const s = (MITER_LIMIT * distance) / mag;
        mx *= s;
        my *= s;
      }
    }
    out.push({ x: v.x + mx, y: v.y + my });
  }
  return polygonArea(out.map((p) => ({ ...p, z: 0 }))) > 0 ? out : null;
}
