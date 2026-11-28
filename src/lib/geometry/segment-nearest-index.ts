/**
 * =============================================================================
 * SEGMENT NEAREST INDEX (SSoT) — «ποιο τμήμα είναι πλησιέστερο στο (x, y), και πόσο απέχει;»
 * =============================================================================
 *
 * Πλέγμα κάδων πάνω στα τμήματα (η ίδια ιδέα με το `lib/terrain/triangle-locator.ts`) + αναζήτηση σε δακτυλίους προς τα
 * έξω από το κελί του σημείου, που σταματά μόλις κανένα κελί που δεν ψάχτηκε δεν μπορεί να κρατά πιο κοντινό τμήμα.
 *
 * 🔑 Εξήχθη από το `lib/terrain/inspect/terrain-contour-index.ts` (ADR-920 §14.12 Β3): το ίδιο ερώτημα κάνει και ο
 * ψηφιδωτής υψομέτρων για την **ακμή του μετρημένου** (απόσταση ⇒ ζώνη μετάβασης). Το ευρετήριο δεν ξέρει τι είναι τα
 * τμήματα· ο καλών κρατά ό,τι σημαίνει ο δείκτης τους (ποια ισοϋψής, ποια ακμή).
 *
 * 🔑 **Το κάτω φράγμα μετρά από το ΣΗΜΕΙΟ, όχι από το κελί του** (ADR-920 §14.12 Β3.1). Κάθε τμήμα ζει μέσα στο κουτί του
 * πλέγματος· ό,τι δεν ψάχτηκε βρίσκεται πέρα από μία πλευρά του ψαγμένου μπλοκ **και** μέσα στο κουτί — άρα απέχει
 * τουλάχιστον όσο η υποτείνουσα των δύο. Η πρώτη διατύπωση μετρούσε μόνο «δακτύλιοι × κελί» και αγνοούσε πόσο έξω από
 * το πλέγμα στέκεται το σημείο: για σημείο 25 m έξω από αποτύπωση 20 m (κελί 2,2 m) το φράγμα δεν έφτανε ποτέ την
 * απόσταση, και **κάθε** ερώτηση σάρωνε ολόκληρο το πλέγμα — μετρημένα ακριβότερη από την εξαντλητική σάρωση (7,8 µs
 * έναντι 4,5 µs). Η απάντηση είναι η ίδια· αλλάζει μόνο το πότε σταματά.
 *
 * 🔑 **Επίπεδοι πίνακες, καμία δέσμευση ανά ερώτηση.** Οι συντεταγμένες σε `Float64Array`, οι κάδοι σε CSR
 * (`Int32Array`). Η προβολή πάνω στο τμήμα είναι η ΜΙΑ του `planar-polygon.ts` (`segmentParameterNearest`).
 *
 * Καθαρό, χωρίς μονάδες: οι συντεταγμένες του καλούντος μπαίνουν, η απόσταση βγαίνει στις ίδιες.
 *
 * @module lib/geometry/segment-nearest-index
 */

import { segmentParameterNearest, type PlanarPoint } from './planar-polygon';

export interface PlanarSegment {
  readonly a: PlanarPoint;
  readonly b: PlanarPoint;
}

/** Η απάντηση: ο δείκτης του τμήματος στη λίστα του καλούντος, η απόσταση του σημείου από αυτό, και πού πάνω του. */
export interface NearestSegment {
  readonly segment: number;
  readonly distance: number;
  /** Η θέση του πλησιέστερου σημείου πάνω στο τμήμα: `0` στο `a` … `1` στο `b`. */
  readonly t: number;
}

/** Επαναχρησιμοποιήσιμη απάντηση για όποιον ρωτά πολλές φορές (ένα πλακίδιο υψομέτρων: μία ανά pixel). */
export type NearestSegmentSink = { -readonly [K in keyof NearestSegment]: NearestSegment[K] };

export function createNearestSegmentSink(): NearestSegmentSink {
  return { segment: -1, distance: Infinity, t: 0 };
}

export interface SegmentNearestIndex {
  /**
   * Το πλησιέστερο τμήμα. Με `within`, η αναζήτηση σταματά μόλις κανένα τμήμα δεν μπορεί να είναι πιο κοντά από αυτό, και
   * η απάντηση είναι `null` όταν το πλησιέστερο απέχει περισσότερο — φθηνή άρνηση για σημεία μακριά από κάθε τμήμα.
   */
  readonly nearest: (x: number, y: number, within?: number) => NearestSegment | null;
  /** Η ίδια ερώτηση, γραμμένη στο `sink`: `false` (και `sink` ανέγγιχτο) εκεί όπου το {@link nearest} απαντά `null`. */
  readonly nearestInto: (sink: NearestSegmentSink, x: number, y: number, within?: number) => boolean;
}

interface Grid {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly axis: number;
  readonly cellW: number;
  readonly cellH: number;
  /** `[ax, ay, bx, by]` ανά τμήμα. */
  readonly coords: Float64Array;
  /** CSR: τα τμήματα του κελιού `c` είναι τα `items[starts[c] … starts[c + 1])`, με τη σειρά της λίστας. */
  readonly starts: Int32Array;
  readonly items: Int32Array;
}

const MAX_CELLS_PER_AXIS = 256;
const EPSILON = 1e-9;
const COORDS_PER_SEGMENT = 4;

function coordsOf(segments: readonly PlanarSegment[]): Float64Array {
  const coords = new Float64Array(segments.length * COORDS_PER_SEGMENT);
  segments.forEach(({ a, b }, s) => {
    coords[s * COORDS_PER_SEGMENT] = a.x;
    coords[s * COORDS_PER_SEGMENT + 1] = a.y;
    coords[s * COORDS_PER_SEGMENT + 2] = b.x;
    coords[s * COORDS_PER_SEGMENT + 3] = b.y;
  });
  return coords;
}

function gridOf(segments: readonly PlanarSegment[]): Grid {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const { a, b } of segments) {
    minX = Math.min(minX, a.x, b.x); minY = Math.min(minY, a.y, b.y);
    maxX = Math.max(maxX, a.x, b.x); maxY = Math.max(maxY, a.y, b.y);
  }
  const axis = Math.min(MAX_CELLS_PER_AXIS, Math.max(1, Math.ceil(Math.sqrt(segments.length))));
  const cellW = Math.max(maxX - minX, EPSILON) / axis;
  const cellH = Math.max(maxY - minY, EPSILON) / axis;
  const buckets: number[][] = Array.from({ length: axis * axis }, () => []);
  const clamp = (v: number): number => Math.min(axis - 1, Math.max(0, v));
  segments.forEach(({ a, b }, s) => {
    const c0 = clamp(Math.floor((Math.min(a.x, b.x) - minX) / cellW));
    const c1 = clamp(Math.floor((Math.max(a.x, b.x) - minX) / cellW));
    const r0 = clamp(Math.floor((Math.min(a.y, b.y) - minY) / cellH));
    const r1 = clamp(Math.floor((Math.max(a.y, b.y) - minY) / cellH));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) buckets[r * axis + c].push(s);
  });
  const starts = new Int32Array(axis * axis + 1);
  buckets.forEach((bucket, cell) => { starts[cell + 1] = starts[cell] + bucket.length; });
  const items = new Int32Array(starts[axis * axis]);
  buckets.forEach((bucket, cell) => items.set(bucket, starts[cell]));
  return { minX, minY, maxX, maxY, axis, cellW, cellH, coords: coordsOf(segments), starts, items };
}

/** Η μία αναζήτηση: το σημείο, πόσο έξω από το κουτί του πλέγματος στέκεται, και το καλύτερο ως τώρα. */
interface Search {
  x: number;
  y: number;
  /** Απόσταση του σημείου από το κουτί του πλέγματος ανά άξονα (`0` όταν είναι μέσα σε αυτόν τον άξονα). */
  outX: number;
  outY: number;
  col: number;
  row: number;
  segment: number;
  distanceSq: number;
  t: number;
}

function searchCell(grid: Grid, search: Search, cell: number): void {
  const { coords, starts, items } = grid;
  for (let at = starts[cell]; at < starts[cell + 1]; at++) {
    const s = items[at];
    const o = s * COORDS_PER_SEGMENT;
    const ax = coords[o]; const ay = coords[o + 1]; const bx = coords[o + 2]; const by = coords[o + 3];
    const t = segmentParameterNearest(search.x, search.y, ax, ay, bx, by);
    const dx = search.x - (ax + t * (bx - ax));
    const dy = search.y - (ay + t * (by - ay));
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < search.distanceSq) { search.distanceSq = distanceSq; search.segment = s; search.t = t; }
  }
}

/** Τα κελιά σε απόσταση Chebyshev ακριβώς `ring` από το κελί του σημείου, κομμένα στο πλέγμα — χωρίς ενδιάμεσο πίνακα. */
function searchRing(grid: Grid, search: Search, ring: number): void {
  const { axis } = grid;
  const r0 = search.row - ring; const r1 = search.row + ring;
  const c0 = search.col - ring; const c1 = search.col + ring;
  for (let r = Math.max(0, r0); r <= Math.min(axis - 1, r1); r++) {
    // Οι δύο ακραίες γραμμές του δακτυλίου είναι ολόκληρες· οι ενδιάμεσες έχουν μόνο τα δύο άκρα τους.
    const stride = r === r0 || r === r1 ? 1 : Math.max(1, c1 - c0);
    for (let c = c0; c <= c1; c += stride) {
      if (c >= 0 && c < axis) searchCell(grid, search, r * axis + c);
    }
  }
}

/** `a² + b²` με το `a` κομμένο στο μηδέν από κάτω: το τετράγωνο της απόστασης από μια πλευρά του μπλοκ, μέσα στο κουτί. */
function beyondSq(a: number, b: number): number {
  return a > 0 ? a * a + b * b : b * b;
}

/**
 * Το **τετράγωνο** της απόστασης που απέχει το σημείο, **τουλάχιστον**, από κάθε τμήμα που δεν έχει ψαχτεί μετά τον
 * δακτύλιο `ring` — `Infinity` όταν ψάχτηκε ολόκληρο το πλέγμα. Τμήμα που δεν ψάχτηκε δεν έχει κανένα κελί του στο μπλοκ,
 * άρα βρίσκεται ολόκληρο πέρα από μία πλευρά του (και, όπως κάθε τμήμα, μέσα στο κουτί του πλέγματος). Σε τετράγωνα,
 * ώστε η ερώτηση να μην πληρώνει ρίζα ανά δακτύλιο.
 */
function unsearchedFromSq(grid: Grid, search: Search, ring: number): number {
  const { minX, minY, axis, cellW, cellH } = grid;
  const { x, y, outX, outY, col, row } = search;
  let bound = Infinity;
  if (col - ring > 0) bound = Math.min(bound, beyondSq(x - (minX + (col - ring) * cellW), outY));
  if (col + ring < axis - 1) bound = Math.min(bound, beyondSq(minX + (col + ring + 1) * cellW - x, outY));
  if (row - ring > 0) bound = Math.min(bound, beyondSq(y - (minY + (row - ring) * cellH), outX));
  if (row + ring < axis - 1) bound = Math.min(bound, beyondSq(minY + (row + ring + 1) * cellH - y, outX));
  return bound;
}

/** Απόσταση του `v` από το διάστημα `[min, max]`. */
function outside(v: number, min: number, max: number): number {
  return v < min ? min - v : v > max ? v - max : 0;
}

/** Γεμίζει το `search` με το πλησιέστερο τμήμα· `false` όταν κανένα δεν είναι μέσα στο `within`. */
function run(grid: Grid, search: Search, x: number, y: number, within: number): boolean {
  const { axis } = grid;
  search.x = x; search.y = y;
  search.outX = outside(x, grid.minX, grid.maxX);
  search.outY = outside(y, grid.minY, grid.maxY);
  // Όλα τα τμήματα ζουν μέσα στο κουτί: σημείο πιο μακριά του από το όριο δεν έχει τι να βρει.
  const withinSq = within * within;
  if (search.outX * search.outX + search.outY * search.outY > withinSq) return false;
  search.col = Math.min(axis - 1, Math.max(0, Math.floor((x - grid.minX) / grid.cellW)));
  search.row = Math.min(axis - 1, Math.max(0, Math.floor((y - grid.minY) / grid.cellH)));
  search.segment = -1; search.distanceSq = Infinity; search.t = 0;
  for (let ring = 0; ring < axis; ring++) {
    searchRing(grid, search, ring);
    const boundSq = unsearchedFromSq(grid, search, ring);
    if (search.segment >= 0 && search.distanceSq <= boundSq) break;
    if (boundSq >= withinSq) break;
  }
  return search.segment >= 0 && search.distanceSq <= withinSq;
}

/** Το ευρετήριο μιας λίστας τμημάτων. Κενή λίστα απαντά `null` παντού. */
export function createSegmentNearestIndex(segments: readonly PlanarSegment[]): SegmentNearestIndex {
  if (segments.length === 0) return { nearest: () => null, nearestInto: () => false };
  const grid = gridOf(segments);
  // Μία αναζήτηση ανά ευρετήριο: οι ερωτήσεις είναι σύγχρονες και δεν φωλιάζουν.
  const search: Search = { x: 0, y: 0, outX: 0, outY: 0, col: 0, row: 0, segment: -1, distanceSq: Infinity, t: 0 };
  const nearestInto = (sink: NearestSegmentSink, x: number, y: number, within: number = Infinity): boolean => {
    if (!run(grid, search, x, y, within)) return false;
    sink.segment = search.segment;
    sink.distance = Math.sqrt(search.distanceSq);
    sink.t = search.t;
    return true;
  };
  const nearest = (x: number, y: number, within: number = Infinity): NearestSegment | null => {
    const sink = createNearestSegmentSink();
    return nearestInto(sink, x, y, within) ? sink : null;
  };
  return { nearest, nearestInto };
}
