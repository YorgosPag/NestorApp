/**
 * =============================================================================
 * PLANAR POLYGON OVERLAP (SSoT) — «επικαλύπτονται δύο απλά πολύγωνα, πέρα από μια ανοχή;»
 * =============================================================================
 *
 * Η ερώτηση του Revit «Room overlaps another room» για τα περιγράμματα χώρων της περιήγησης (ADR-884 §4.14 Γ3β): δύο
 * δωμάτια που ακουμπούν σε **κοινό τοίχο** ή **κοινή νοητή γραμμή** ΔΕΝ επικαλύπτονται· δύο «Σαλόνια» στο ίδιο πάτωμα ναι.
 *
 * 🔑 **Γιατί όχι `polygon-clipping`**: ζει μόνο στο `package.json` του dxf-viewer, και ο wrapper του (`safe-polygon-boolean`)
 *   σε σφάλμα επιστρέφει «κενό» — για **κριτή** αυτό σημαίνει σιωπηλή αποδοχή. Εδώ χρειαζόμαστε απάντηση που δεν πετά ποτέ.
 * 🔑 **Ο αλγόριθμος** (O(n·m), n, m ≤ 200): κάθε ακμή σπάει στα σημεία όπου τέμνει ή ακουμπά το άλλο σύνορο ⇒ κάθε υποτμήμα
 *   είναι **ολόκληρο** μέσα ή έξω από το άλλο πολύγωνο. Επικάλυψη ⇔ (α) το μέσο κάποιου υποτμήματος βρίσκεται μέσα στο άλλο
 *   **βαθύτερα από την ανοχή**, ή (β) τα δύο σύνορα συμπίπτουν σε όλο τους το μήκος (ταυτόσημοι χώροι — κανένα δείγμα δεν
 *   είναι «βαθιά», αλλά οι περιοχές είναι ίδιες). Απόδειξη του (β): συνιστώσα τομής με σύνορο **ολόκληρο** πάνω και στα δύο
 *   σύνορα = και τα δύο απλά πολύγωνα ⇒ A = B.
 * ⚠️ **Σημασιολογία ανοχής**: «επικάλυψη» = λωρίδα παχύτερη από `tolerance` σε κάποιο μέσο υποτμήματος. Το τρεμούλιασμα της
 *   ορθογώνιας έλξης/του συρσίματος (μισό pixel) περνά· δωμάτιο μετατοπισμένο 30 cm πάνω στον γείτονα όχι.
 *
 * @module lib/geometry/planar-polygon-overlap
 */

import { distanceToRing, distanceToSegment, pointInPolygon, type PlanarPoint } from './planar-polygon';

/** Κάτω από αυτό δύο κατευθύνσεις θεωρούνται παράλληλες (οι συνευθειακές επαφές πιάνονται από τις προβολές κορυφών). */
const PARALLEL_EPSILON = 1e-12;

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

/** Η παράμετρος `t ∈ [0, 1]` όπου το `p→q` διασχίζει το `r→s` — `null` αν δεν τέμνονται ή είναι παράλληλα. */
function crossingParameter(p: PlanarPoint, q: PlanarPoint, r: PlanarPoint, s: PlanarPoint): number | null {
  const dx = q.x - p.x, dy = q.y - p.y, ex = s.x - r.x, ey = s.y - r.y;
  const denom = cross(dx, dy, ex, ey);
  if (Math.abs(denom) < PARALLEL_EPSILON) return null;
  const t = cross(r.x - p.x, r.y - p.y, ex, ey) / denom;
  const u = cross(r.x - p.x, r.y - p.y, dx, dy) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/** Η παράμετρος της προβολής του `v` στο `p→q`, όταν το `v` πέφτει πάνω στο τμήμα (μέσα στην ανοχή). */
function touchParameter(p: PlanarPoint, q: PlanarPoint, v: PlanarPoint, tolerance: number): number | null {
  const dx = q.x - p.x, dy = q.y - p.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0 || distanceToSegment(v, p, q) > tolerance) return null;
  return Math.min(1, Math.max(0, ((v.x - p.x) * dx + (v.y - p.y) * dy) / lengthSq));
}

/** Τα σημεία θραύσης της ακμής `p→q` πάνω στο σύνορο `other` (ταξινομημένα, με τα άκρα). */
function breakParameters(p: PlanarPoint, q: PlanarPoint, other: readonly PlanarPoint[], tolerance: number): number[] {
  const params = [0, 1];
  for (let j = 0; j < other.length; j++) {
    const r = other[j], s = other[(j + 1) % other.length];
    const t = crossingParameter(p, q, r, s);
    if (t !== null) params.push(t);
    const touch = touchParameter(p, q, r, tolerance);
    if (touch !== null) params.push(touch);
  }
  return params.sort((a, b) => a - b);
}

/** Τα μέσα των υποτμημάτων του συνόρου `ring` — ένα ανά κομμάτι που είναι ολόκληρο μέσα ή έξω από το `other`. */
function boundarySamples(ring: readonly PlanarPoint[], other: readonly PlanarPoint[], tolerance: number): PlanarPoint[] {
  const samples: PlanarPoint[] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const params = breakParameters(p, q, other, tolerance);
    for (let k = 1; k < params.length; k++) {
      if (params[k] - params[k - 1] <= 0) continue;
      const t = (params[k - 1] + params[k]) / 2;
      samples.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  }
  return samples;
}

interface SampleVerdict {
  /** Κάποιο δείγμα μέσα στο άλλο, βαθύτερα από την ανοχή. */
  readonly deep: boolean;
  /** Όλα τα δείγματα πάνω στο σύνορο του άλλου (μέσα στην ανοχή). */
  readonly allOnBoundary: boolean;
}

function judgeSamples(ring: readonly PlanarPoint[], other: readonly PlanarPoint[], tolerance: number): SampleVerdict {
  let allOnBoundary = true;
  for (const sample of boundarySamples(ring, other, tolerance)) {
    const distance = distanceToRing(sample, other);
    if (distance > tolerance) {
      allOnBoundary = false;
      if (pointInPolygon(sample, other)) return { deep: true, allOnBoundary: false };
    }
  }
  return { deep: false, allOnBoundary };
}

function boxesApart(a: readonly PlanarPoint[], b: readonly PlanarPoint[], tolerance: number): boolean {
  const box = (ring: readonly PlanarPoint[]) => ({
    minX: Math.min(...ring.map((p) => p.x)), maxX: Math.max(...ring.map((p) => p.x)),
    minY: Math.min(...ring.map((p) => p.y)), maxY: Math.max(...ring.map((p) => p.y)),
  });
  const A = box(a), B = box(b);
  return A.maxX + tolerance < B.minX || B.maxX + tolerance < A.minX || A.maxY + tolerance < B.minY || B.maxY + tolerance < A.minY;
}

/**
 * **Επικαλύπτονται τα απλά πολύγωνα `a` και `b`** κατά λωρίδα παχύτερη από `tolerance`; Κοινό σύνορο (τοίχος, νοητή γραμμή)
 * ⇒ `false`· εγκλεισμός, διασταύρωση ή ταυτόσημα ⇒ `true`. Προϋπόθεση: και τα δύο **χωρίς** αυτοτομή (τα κρίνει ο καλών).
 */
export function polygonsOverlap(a: readonly PlanarPoint[], b: readonly PlanarPoint[], tolerance: number): boolean {
  if (a.length < 3 || b.length < 3 || boxesApart(a, b, tolerance)) return false;
  const fromA = judgeSamples(a, b, tolerance);
  if (fromA.deep) return true;
  const fromB = judgeSamples(b, a, tolerance);
  if (fromB.deep) return true;
  return fromA.allOnBoundary && fromB.allOnBoundary;
}
