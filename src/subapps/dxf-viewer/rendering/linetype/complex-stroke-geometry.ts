/**
 * Complex-stroke geometry — ADR-642 §6.4 (pure arc-length primitives).
 *
 * Καθαρή γεωμετρία (μηδέν canvas, μηδέν state) για τον `ComplexLineStroker`: χτίσιμο
 * τμημάτων polyline, συνολικό μήκος, δειγματοληψία υπο-διαδρομής μεταξύ δύο
 * αποστάσεων τόξου (ώστε ένα dash να «λυγίζει» σε ενδιάμεσες κορυφές), σημείο+
 * εφαπτομένη σε δεδομένη απόσταση (για dots/caps), και parallel offset (compound #9).
 *
 * Δεν αναπαράγει τα math του `linetype-dash-resolver` (εκείνο κλιμακώνει array για
 * native setLineDash· εδώ διασχίζουμε το path) — διαφορετική δουλειά, κανένα clone.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Ευθύγραμμο τμήμα με προϋπολογισμένο μήκος + μοναδιαία κατεύθυνση. */
export interface Seg {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly len: number;
  readonly ux: number;
  readonly uy: number;
}

/** Polyline points → τμήματα (μηδενικού μήκους τμήματα παραλείπονται). `closed` κλείνει τον βρόχο. */
export function buildSegments(points: readonly Point[], closed = false): Seg[] {
  const segs: Seg[] = [];
  const n = points.length;
  if (n < 2) return segs;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0) continue;
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, len, ux: dx / len, uy: dy / len });
  }
  return segs;
}

/** Cumulative arc-length στα όρια των τμημάτων: `cum[0]=0`, `cum[i]=Σ len`. Length = segs+1. */
export function cumulativeLengths(segs: readonly Seg[]): number[] {
  const cum: number[] = [0];
  for (const s of segs) cum.push(cum[cum.length - 1] + s.len);
  return cum;
}

/** Συνολικό μήκος της polyline. */
export function totalLength(segs: readonly Seg[]): number {
  let t = 0;
  for (const s of segs) t += s.len;
  return t;
}

/** Σημείο + μοναδιαία εφαπτομένη σε απόσταση τόξου `dist` (clamped στα άκρα). */
export function pointAt(
  segs: readonly Seg[],
  cum: readonly number[],
  dist: number,
): { x: number; y: number; ux: number; uy: number } {
  if (segs.length === 0) return { x: 0, y: 0, ux: 1, uy: 0 };
  const clamped = Math.min(Math.max(dist, 0), cum[cum.length - 1]);
  let i = 0;
  while (i < segs.length - 1 && cum[i + 1] < clamped) i++;
  const s = segs[i];
  const local = clamped - cum[i];
  return { x: s.x1 + s.ux * local, y: s.y1 + s.uy * local, ux: s.ux, uy: s.uy };
}

/**
 * Υπο-διαδρομή μεταξύ δύο αποστάσεων τόξου [a, b] ως λίστα σημείων — περιλαμβάνει τις
 * ενδιάμεσες κορυφές ώστε ένα dash που περνά γωνία να ζωγραφίζεται λυγισμένο (bypass).
 * `a`/`b` clamped· κενή λίστα αν `b<=a`.
 */
export function sampleSubpath(
  segs: readonly Seg[],
  cum: readonly number[],
  a: number,
  b: number,
): Point[] {
  const total = cum[cum.length - 1];
  const start = Math.min(Math.max(a, 0), total);
  const end = Math.min(Math.max(b, 0), total);
  if (end <= start || segs.length === 0) return [];
  const first = pointAt(segs, cum, start);
  const out: Point[] = [{ x: first.x, y: first.y }];
  for (let i = 1; i < cum.length - 1; i++) {
    if (cum[i] > start && cum[i] < end) out.push({ x: segs[i].x1, y: segs[i].y1 });
  }
  const lastPt = pointAt(segs, cum, end);
  out.push({ x: lastPt.x, y: lastPt.y });
  return out;
}

/**
 * Parallel offset της polyline κατά `distPx` (προσημασμένο — κάθετο +90°). Ανά κορυφή
 * miter join (μέσος όρος γειτονικών normals). Χρησιμοποιείται από τα compound layers
 * (#9): διπλή γραμμή δρόμου / σιδηρόδρομος. Degenerate normals → passthrough.
 */
export function offsetPolyline(points: readonly Point[], distPx: number): Point[] {
  if (distPx === 0 || points.length < 2) return points.map((p) => ({ x: p.x, y: p.y }));
  const segs = buildSegments(points);
  const normals = segs.map((s) => ({ nx: -s.uy, ny: s.ux }));
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const inN = normals[i - 1];
    const outN = normals[i];
    const nx = (inN?.nx ?? outN?.nx ?? 0) + (outN?.nx ?? inN?.nx ?? 0);
    const ny = (inN?.ny ?? outN?.ny ?? 0) + (outN?.ny ?? inN?.ny ?? 0);
    const mag = Math.hypot(nx, ny);
    const ax = mag > 0 ? nx / mag : 0;
    const ay = mag > 0 ? ny / mag : 0;
    out.push({ x: points[i].x + ax * distPx, y: points[i].y + ay * distPx });
  }
  return out;
}
