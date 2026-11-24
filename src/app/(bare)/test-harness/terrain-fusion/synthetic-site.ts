/**
 * ADR-920 §14.12 Β0 — το **συνθετικό** οικόπεδο της δοκιμής: περίγραμμα, «αποτύπωση» ως TIN, ανάγνωση ύψους.
 *
 * ⚠️ **Δεν είναι μέτρηση.** Τα ύψη βγαίνουν από τύπο πάνω στο ύψος του χοντρού στο κέντρο (`baseElevationM`) συν μια
 * ρυθμιζόμενη μετατόπιση — ώστε η ραφή να κρίνεται με το μάτι σε ελεγχόμενες διαφορές. Η πραγματική διαφορά
 * αποτύπωσης ⇄ GLO-30 μετριέται με αληθινή αποτύπωση (Β8).
 *
 * Το TIN διαβάζεται με **γενικό** ευρετήριο κάδων + βαρυκεντρικές (όχι με το κόλπο του κανονικού πλέγματος), ώστε ο
 * χρόνος ανά πλακίδιο να μοιάζει με εκείνον ενός ακανόνιστου TIN αποτύπωσης.
 */

import { EARTH_RADIUS_METERS } from '@/lib/geo/geo-distance';
import { closestPointOnSegment, pointInPolygon, type PlanarPoint } from '@/lib/geometry/planar-polygon';

import type { LngLat } from './fusion-math';

/** Ό,τι περνά (σειριοποιημένο) στον Worker: από αυτό ξαναχτίζεται η ίδια επιφάνεια. */
export interface ProbeSurfaceSpec {
  readonly center: LngLat;
  /** Ύψος του χοντρού στο κέντρο — το συνθετικό έδαφος «κάθεται» εκεί. */
  readonly baseElevationM: number;
  /** Κατακόρυφη μετατόπιση της «μέτρησης» ως προς το χοντρό (προσομοιώνει τη διαφορά DSM ⇄ εδάφους). */
  readonly offsetM: number;
  /** Πλάτος της ζώνης μετάβασης, **προς τα έξω** από το περίγραμμα. 0 ⇒ σκαλοπάτι. */
  readonly transitionM: number;
  /** Βήμα των σημείων της συνθετικής αποτύπωσης. */
  readonly gridStepM: number;
}

/** Το περίγραμμα, σε τοπικά μέτρα (x ανατολή, y βορράς) γύρω από το κέντρο — ακανόνιστο πεντάγωνο ~70 × 50 m. */
export const PROBE_RING: readonly PlanarPoint[] = [
  { x: -34, y: -18 },
  { x: 26, y: -24 },
  { x: 36, y: 14 },
  { x: 4, y: 26 },
  { x: -30, y: 16 },
];

interface TriangleIndex {
  readonly originX: number;
  readonly originY: number;
  readonly cell: number;
  readonly columns: number;
  readonly rows: number;
  /** `starts[b] … starts[b + 1]` = οι θέσεις του κάδου `b` μέσα στο `items`. */
  readonly starts: Uint32Array;
  readonly items: Uint32Array;
}

interface Tin {
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  readonly hs: Float64Array;
  readonly triangles: Uint32Array;
  readonly index: TriangleIndex;
}

export interface ProbeSurface {
  readonly spec: ProbeSurfaceSpec;
  readonly metresPerDegLng: number;
  readonly metresPerDegLat: number;
  /** Το πλαίσιο του περιγράμματος διογκωμένο κατά τη ζώνη μετάβασης — έξω από αυτό ισχύει μόνο το χοντρό. */
  readonly reach: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  readonly tin: Tin;
  readonly pointCount: number;
  readonly triangleCount: number;
}

/** Ο τύπος της συνθετικής «αποτύπωσης»: κλίση + ήπιο μικροανάγλυφο + αναλημματικό σκαλοπάτι 1,2 m. */
function syntheticHeightM(spec: ProbeSurfaceSpec, x: number, y: number): number {
  const slope = 0.06 * x + 0.03 * y;
  const relief = 0.6 * Math.sin(x / 7) * Math.cos(y / 9);
  const terrace = y > 4 + 0.15 * x ? 1.2 : 0;
  return spec.baseElevationM + spec.offsetM + slope + relief + terrace;
}

function ringBounds(margin: number): ProbeSurface['reach'] {
  const xs = PROBE_RING.map((p) => p.x);
  const ys = PROBE_RING.map((p) => p.y);
  return {
    minX: Math.min(...xs) - margin,
    minY: Math.min(...ys) - margin,
    maxX: Math.max(...xs) + margin,
    maxY: Math.max(...ys) + margin,
  };
}

function buildTriangleIndex(xs: Float64Array, ys: Float64Array, triangles: Uint32Array, cell: number): TriangleIndex {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    minX = Math.min(minX, xs[i]); maxX = Math.max(maxX, xs[i]);
    minY = Math.min(minY, ys[i]); maxY = Math.max(maxY, ys[i]);
  }
  const columns = Math.max(1, Math.ceil((maxX - minX) / cell));
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell));
  const buckets: number[][] = Array.from({ length: columns * rows }, () => []);
  const column = (x: number): number => Math.min(columns - 1, Math.max(0, Math.floor((x - minX) / cell)));
  const row = (y: number): number => Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / cell)));
  for (let t = 0; t < triangles.length; t += 3) {
    const a = triangles[t], b = triangles[t + 1], c = triangles[t + 2];
    const c0 = column(Math.min(xs[a], xs[b], xs[c])), c1 = column(Math.max(xs[a], xs[b], xs[c]));
    const r0 = row(Math.min(ys[a], ys[b], ys[c])), r1 = row(Math.max(ys[a], ys[b], ys[c]));
    for (let r = r0; r <= r1; r++) for (let k = c0; k <= c1; k++) buckets[r * columns + k].push(t);
  }
  const starts = new Uint32Array(buckets.length + 1);
  buckets.forEach((bucket, i) => { starts[i + 1] = starts[i] + bucket.length; });
  const items = new Uint32Array(starts[buckets.length]);
  buckets.forEach((bucket, i) => items.set(bucket, starts[i]));
  return { originX: minX, originY: minY, cell, columns, rows, starts, items };
}

function buildTin(spec: ProbeSurfaceSpec): Tin {
  const step = spec.gridStepM;
  const box = ringBounds(step);
  const columns = Math.ceil((box.maxX - box.minX) / step) + 1;
  const rows = Math.ceil((box.maxY - box.minY) / step) + 1;
  const xs = new Float64Array(columns * rows);
  const ys = new Float64Array(columns * rows);
  const hs = new Float64Array(columns * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      xs[i] = box.minX + c * step;
      ys[i] = box.minY + r * step;
      hs[i] = syntheticHeightM(spec, xs[i], ys[i]);
    }
  }
  const triangles = new Uint32Array((columns - 1) * (rows - 1) * 6);
  let t = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < columns - 1; c++) {
      const i = r * columns + c;
      triangles.set([i, i + 1, i + columns, i + 1, i + columns + 1, i + columns], t);
      t += 6;
    }
  }
  return { xs, ys, hs, triangles, index: buildTriangleIndex(xs, ys, triangles, step * 2) };
}

export function buildProbeSurface(spec: ProbeSurfaceSpec): ProbeSurface {
  const metresPerDegLat = (Math.PI / 180) * EARTH_RADIUS_METERS;
  const tin = buildTin(spec);
  return {
    spec,
    metresPerDegLat,
    metresPerDegLng: metresPerDegLat * Math.cos((spec.center.lat * Math.PI) / 180),
    reach: ringBounds(spec.transitionM),
    tin,
    pointCount: tin.xs.length,
    triangleCount: tin.triangles.length / 3,
  };
}

/** Ύψος του TIN στο (x, y) με βαρυκεντρική παρεμβολή· `NaN` έξω από το TIN. */
export function tinHeightAt(tin: Tin, x: number, y: number): number {
  const { index, xs, ys, hs, triangles } = tin;
  const column = Math.floor((x - index.originX) / index.cell);
  const row = Math.floor((y - index.originY) / index.cell);
  if (column < 0 || row < 0 || column >= index.columns || row >= index.rows) return Number.NaN;
  const bucket = row * index.columns + column;
  for (let k = index.starts[bucket]; k < index.starts[bucket + 1]; k++) {
    const t = index.items[k];
    const a = triangles[t], b = triangles[t + 1], c = triangles[t + 2];
    const det = (ys[b] - ys[c]) * (xs[a] - xs[c]) + (xs[c] - xs[b]) * (ys[a] - ys[c]);
    if (det === 0) continue;
    const wa = ((ys[b] - ys[c]) * (x - xs[c]) + (xs[c] - xs[b]) * (y - ys[c])) / det;
    const wb = ((ys[c] - ys[a]) * (x - xs[c]) + (xs[a] - xs[c]) * (y - ys[c])) / det;
    const wc = 1 - wa - wb;
    if (wa >= -1e-9 && wb >= -1e-9 && wc >= -1e-9) return wa * hs[a] + wb * hs[b] + wc * hs[c];
  }
  return Number.NaN;
}

export type SurfaceVerdict =
  | { readonly kind: 'measured'; readonly heightM: number }
  /** `weight` = πόσο έλκεται το χοντρό προς το `edgeHeightM` (1 στην ακμή, 0 στο έξω όριο της ζώνης). */
  | { readonly kind: 'transition'; readonly edgeHeightM: number; readonly weight: number }
  | { readonly kind: 'coarse' };

const COARSE: SurfaceVerdict = { kind: 'coarse' };

function nearestOnRing(point: PlanarPoint): { readonly on: PlanarPoint; readonly distance: number } {
  let best = PROBE_RING[0];
  let bestDistance = Infinity;
  for (let i = 0; i < PROBE_RING.length; i++) {
    const on = closestPointOnSegment(point, PROBE_RING[i], PROBE_RING[(i + 1) % PROBE_RING.length]);
    const distance = Math.hypot(point.x - on.x, point.y - on.y);
    if (distance < bestDistance) { best = on; bestDistance = distance; }
  }
  return { on: best, distance: bestDistance };
}

/** Τι ισχύει στο τοπικό σημείο (x, y): η μέτρηση, η ζώνη μετάβασης, ή μόνο το χοντρό. */
export function classifyLocalPoint(surface: ProbeSurface, x: number, y: number, ease: (t: number) => number): SurfaceVerdict {
  const { reach, spec, tin } = surface;
  if (x < reach.minX || x > reach.maxX || y < reach.minY || y > reach.maxY) return COARSE;
  const point: PlanarPoint = { x, y };
  if (pointInPolygon(point, PROBE_RING)) {
    const heightM = tinHeightAt(tin, x, y);
    return Number.isNaN(heightM) ? COARSE : { kind: 'measured', heightM };
  }
  if (spec.transitionM <= 0) return COARSE;
  const { on, distance } = nearestOnRing(point);
  if (distance >= spec.transitionM) return COARSE;
  const edgeHeightM = tinHeightAt(tin, on.x, on.y);
  if (Number.isNaN(edgeHeightM)) return COARSE;
  return { kind: 'transition', edgeHeightM, weight: ease(1 - distance / spec.transitionM) };
}

export function lngLatOfLocal(surface: ProbeSurface, point: PlanarPoint): LngLat {
  return {
    lng: surface.spec.center.lng + point.x / surface.metresPerDegLng,
    lat: surface.spec.center.lat + point.y / surface.metresPerDegLat,
  };
}
