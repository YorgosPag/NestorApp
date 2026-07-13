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

/** Ρόλος μιας κορυφής κατά μήκος της polyline (ADR-642 Φ4 corner-role placement). */
export type PolylineVertexRole = 'start' | 'end' | 'interior';

/**
 * Μια κορυφή της polyline με προσανατολισμό + ταξινόμηση στροφής — για την τοποθέτηση
 * corner-role συμβόλων (#4). `ux/uy` = μοναδιαία εφαπτομένη προσανατολισμού (διχοτόμος
 * στις εσωτερικές κορυφές, γειτονικό τμήμα στα άκρα) στο screen-space (y-DOWN), ώστε το
 * `drawSymbolElement` (που κάνει το δικό του Y-flip) να το δεχτεί όπως τα side symbols.
 *
 * `turn` = προσημασμένο cross-product `din × dout` στο screen frame:
 *   - `turn < 0` → αριστερή/CCW στροφή στην οθόνη → **outerCorner** (κυρτή· εξωτερική γωνία).
 *   - `turn > 0` → δεξιά/CW στροφή στην οθόνη → **innerCorner** (κοίλη/reflex· εσωτερική γωνία).
 *   - `|turn| ~ 0` (συγγραμμικό) → ούτε inner ούτε outer (καμία γωνία).
 * `start`/`end` κορυφές έχουν `turn = 0` (δεν ταξινομούνται ως inner/outer).
 */
export interface PolylineVertex {
  readonly x: number;
  readonly y: number;
  readonly ux: number;
  readonly uy: number;
  readonly turn: number;
  readonly role: PolylineVertexRole;
}

/** Μοναδιαία κατεύθυνση a→b (μηδενικό διάνυσμα αν συμπίπτουν). */
function unitDir(a: Point, b: Point): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
}

/**
 * Κορυφές της polyline με προσανατολισμό + ταξινόμηση inner/outer (ADR-642 Φ4). Οι
 * διαδοχικές ταυτόσημες κορυφές συγχωνεύονται (κανένα ψευδο-corner μηδενικού μήκους)· σε
 * `closed`, το διπλό σημείο κλεισίματος αφαιρείται και ΟΛΕΣ οι κορυφές είναι `interior`.
 * Καθαρή γεωμετρία — καμία επανάληψη dash math (reuse από τον stroker για corner symbols).
 */
export function polylineVertices(points: readonly Point[], closed = false): PolylineVertex[] {
  const pts: Point[] = [];
  for (const p of points) {
    const last = pts[pts.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) pts.push({ x: p.x, y: p.y });
  }
  if (closed && pts.length > 1) {
    const f = pts[0];
    const l = pts[pts.length - 1];
    if (f.x === l.x && f.y === l.y) pts.pop();
  }
  const n = pts.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: pts[0].x, y: pts[0].y, ux: 1, uy: 0, turn: 0, role: 'start' }];

  const out: PolylineVertex[] = [];
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    if (!closed && i === 0) {
      const d = unitDir(cur, pts[1]);
      out.push({ x: cur.x, y: cur.y, ux: d.x, uy: d.y, turn: 0, role: 'start' });
      continue;
    }
    if (!closed && i === n - 1) {
      const d = unitDir(pts[n - 2], cur);
      out.push({ x: cur.x, y: cur.y, ux: d.x, uy: d.y, turn: 0, role: 'end' });
      continue;
    }
    const din = unitDir(pts[(i - 1 + n) % n], cur);
    const dout = unitDir(cur, pts[(i + 1) % n]);
    let bx = din.x + dout.x;
    let by = din.y + dout.y;
    const blen = Math.hypot(bx, by);
    if (blen > 1e-9) {
      bx /= blen;
      by /= blen;
    } else {
      bx = din.x;
      by = din.y; // 180° spike → orient along the incoming tangent
    }
    const turn = din.x * dout.y - din.y * dout.x;
    out.push({ x: cur.x, y: cur.y, ux: bx, uy: by, turn, role: 'interior' });
  }
  return out;
}

/** Θετικό modulo (για shift φάσης με αρνητικό phase). SSoT — stroker & snap sampler. */
export function posMod(v: number, m: number): number {
  return m > 0 ? ((v % m) + m) % m : 0;
}

/** Μία τοποθέτηση ενός στοιχείου του κύκλου κατά μήκος του path: ποιο στοιχείο + arc-length έναρξης. */
export interface CyclePlacement {
  /** Δείκτης στον κύκλο στοιχείων (`i % cycle.length`). */
  readonly index: number;
  /** Arc-length όπου ξεκινά το στοιχείο (πριν το clamp στα [0,total]). */
  readonly dist: number;
}

/**
 * Διασχίζει τον κύκλο μηκών στοιχείων κατά μήκος συνολικού arc-length `totalLen`,
 * επιστρέφοντας κάθε εμφάνιση στοιχείου με σειρά + την arc-length στην έναρξή του.
 * Τα μηδενικού μήκους στοιχεία (dot/text/symbol → length 0) καταλαμβάνουν slot χωρίς
 * να προωθούν τον κέρσορα (ο ίδιος ομοιόμορφος `dist += length`, με 0 για αυτά).
 *
 * ΜΟΝΑΔΙΚΗ SSoT walk (ADR-642 §6.4): την καταναλώνει ΚΑΙ ο `ComplexLineStroker.walkPath`
 * (ζωγραφίζει κάθε placement) ΚΑΙ ο `complex-linetype-snap-geometry` sampler (διαβάζει τα
 * symbol placements για τους στρωτήρες) — μηδέν clone (N.18).
 */
export function walkCyclePlacements(
  totalLen: number,
  cycleElementLengths: readonly number[],
  cycleLen: number,
  phase: number,
): CyclePlacement[] {
  const out: CyclePlacement[] = [];
  const n = cycleElementLengths.length;
  if (totalLen <= 0 || cycleLen <= 0 || n === 0) return out;
  // Ίδιο άνω όριο ασφαλείας με τον stroker (αποτρέπει runaway σε degenerate cycle).
  const maxMarks = Math.ceil((totalLen / cycleLen + 2) * n) + 8;
  let dist = -posMod(phase, cycleLen);
  for (let guard = 0, i = 0; dist < totalLen && guard < maxMarks; guard++, i++) {
    const index = i % n;
    out.push({ index, dist });
    dist += cycleElementLengths[index];
  }
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
