/**
 * ADR-396 (gating) — Column-bridge helpers για το envelope perimeter SSoT.
 *
 * Όταν δύο τοίχοι ΔΕΝ ενώνονται απευθείας αλλά μια ΚΟΛΩΝΑ γεμίζει το κενό στη
 * γωνία, η κολώνα γίνεται «κόμβος-γέφυρα» στο adjacency graph (ίδια λογική με μια
 * γωνία τοίχων) ΚΑΙ οι εξωτερικές της όψεις μπαίνουν στο `exteriorFaceLoop` — η
 * μόνωση τυλίγει την κολώνα ακολουθώντας το πραγματικό της σχήμα (Επιλογή Α,
 * αποφάσεις Giorgio 2026-05-30, ADR-396 §3.1).
 *
 * Καθαρές συναρτήσεις (canvas-unit χώρος, ίδιος με `WallGeometry.outerEdge` και
 * `ColumnGeometry.footprint`). Μηδέν globals / React / Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1
 * @see ./envelope-perimeter (consumer — computeEnvelopePerimeter)
 */

import type { Point3D } from '../types/bim-base';
import type { ColumnParams } from '../types/column-types';
import { computeColumnGeometry } from './column-geometry';
import { pointInPolygon, polygonCentroid } from './shared/polygon-utils';
import { pointToSegmentDistance } from '../../systems/guides';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/** Ελάχιστη μορφή κολώνας για το perimeter (καλύπτει `ColumnEntity` / `DxfColumn`). */
export interface ColumnForEnvelope {
  readonly id: string;
  readonly params: ColumnParams;
}

/** Προ-υπολογισμένη κολώνα: footprint (canvas units, CCW) + κέντρο. */
export interface PreparedColumn {
  readonly id: string;
  readonly footprint: readonly Point3D[];
  readonly center: { readonly x: number; readonly y: number };
}

// ============================================================================
// NODE-KEY HELPERS (column node = `col:<id>`, distinct from corner `x,y` keys)
// ============================================================================

const COLUMN_KEY_PREFIX = 'col:';

export function columnNodeKey(id: string): string {
  return COLUMN_KEY_PREFIX + id;
}

export function isColumnNodeKey(key: string): boolean {
  return key.startsWith(COLUMN_KEY_PREFIX);
}

export function columnIdFromNodeKey(key: string): string {
  return key.slice(COLUMN_KEY_PREFIX.length);
}

// ============================================================================
// PREPARE + CAPTURE
// ============================================================================

/**
 * Προ-υπολογίζει footprint + κέντρο κάθε κολώνας (SSoT `computeColumnGeometry`).
 * Αν η `geometry.footprint` είναι ήδη cached (π.χ. ColumnEntity) → χρησιμοποιεί
 * αυτήν (zero re-compute). Fallback σε `computeColumnGeometry` μόνο για plain
 * `ColumnForEnvelope` χωρίς pre-computed geometry. Σε degenerate params (π.χ.
 * test stubs χωρίς anchor/kind) → skip gracefully (empty footprint = δεν γεφυρώνει).
 */
export function prepareColumns(
  columns: readonly (ColumnForEnvelope & { geometry?: { footprint?: { vertices?: readonly Point3D[] } } })[],
): PreparedColumn[] {
  const result: PreparedColumn[] = [];
  for (const c of columns) {
    let footprint: readonly Point3D[] | undefined = c.geometry?.footprint?.vertices;
    if (!footprint || footprint.length < 3) {
      if (!c.params.anchor || !c.params.kind || !c.params.position) continue;
      try {
        footprint = computeColumnGeometry(c.params).footprint.vertices;
      } catch {
        continue;
      }
    }
    if (footprint.length >= 3) {
      result.push({ id: c.id, footprint, center: polygonCentroid(footprint) });
    }
  }
  return result;
}

/** Απόσταση σημείου από footprint (0 αν είναι μέσα). */
function distanceToFootprint(point: Point3D, footprint: readonly Point3D[]): number {
  const n = footprint.length;
  if (n < 3) return Number.POSITIVE_INFINITY;
  if (pointInPolygon(point, footprint)) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    const d = pointToSegmentDistance(point, footprint[i], footprint[(i + 1) % n]);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Επιστρέφει το id της κοντινότερης κολώνας που «πιάνει» το `point` εντός
 * `tolCanvas` (ή το περικλείει), αλλιώς `null`.
 */
export function captureColumnId(
  point: Point3D,
  columns: readonly PreparedColumn[],
  tolCanvas: number,
): string | null {
  let best: string | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const c of columns) {
    const d = distanceToFootprint(point, c.footprint);
    if (d <= tolCanvas && d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

// ============================================================================
// EXTERIOR ARC (Επιλογή Α — η μόνωση ακολουθεί τις όψεις της κολώνας)
// ============================================================================

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function nearestVertexIdx(footprint: readonly Point3D[], target: { x: number; y: number }): number {
  let idx = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < footprint.length; i++) {
    const d = dist2(footprint[i], target);
    if (d < best) { best = d; idx = i; }
  }
  return idx;
}

/** Δείκτες κατά μήκος του polygon από `from` έως `to` (inclusive) με βήμα `dir`. */
function pathIndices(from: number, to: number, n: number, dir: 1 | -1): number[] {
  const out = [from];
  let i = from;
  let guard = 0;
  while (i !== to && guard++ <= n) {
    i = (i + dir + n) % n;
    out.push(i);
  }
  return out;
}

function meanDistToCentroid(pts: readonly Point3D[], c: { x: number; y: number }): number {
  if (pts.length === 0) return 0;
  let sum = 0;
  for (const p of pts) sum += Math.sqrt(dist2(p, c));
  return sum / pts.length;
}

/**
 * Το ΕΞΩΤΕΡΙΚΟ τόξο του column outline που συνδέει το άκρο της όψης του ενός
 * τοίχου (`fromPoint`) με την αρχή της όψης του επόμενου (`toPoint`). Από τις δύο
 * διαδρομές γύρω από το polygon κρατά εκείνη που είναι μακρύτερα από το
 * `centroid` (= η εξωτερική). Επιστρέφει τις κορυφές του τόξου (inclusive).
 */
export function columnExteriorArc(
  footprint: readonly Point3D[],
  fromPoint: { x: number; y: number },
  toPoint: { x: number; y: number },
  centroid: { x: number; y: number },
): Point3D[] {
  const n = footprint.length;
  if (n < 3) return [];
  const entry = nearestVertexIdx(footprint, fromPoint);
  const exit = nearestVertexIdx(footprint, toPoint);
  const fwd = pathIndices(entry, exit, n, 1).map((i) => footprint[i]);
  const bwd = pathIndices(entry, exit, n, -1).map((i) => footprint[i]);
  return meanDistToCentroid(fwd, centroid) >= meanDistToCentroid(bwd, centroid) ? fwd : bwd;
}
