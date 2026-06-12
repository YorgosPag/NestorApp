/**
 * Segment ∩ Polygon coverage — SSoT (ADR-401 Phase B extraction · ADR-449 reuse).
 *
 * Προβάλλει ένα ευθύγραμμο τμήμα `a→b` πάνω σε ένα κλειστό πολύγωνο και επιστρέφει
 * τα **καλυμμένα** διαστήματα `[t0,t1]` (0..1) όπου το τμήμα βρίσκεται ΜΕΣΑ στο
 * πολύγωνο. Robust για convex + concave (σπάμε στα crossings + midpoint ray-cast,
 * merge συνεχόμενων).
 *
 * Unit-agnostic: το `t` είναι αδιάστατο 0..1, ώστε ο caller να δουλεύει σε canvas
 * units ή mm αδιάφορα (αρκεί άξονας + πολύγωνο να είναι στο ΙΔΙΟ plan space).
 *
 * Πρώην private στο `wall-host-plan-builder.ts` (ADR-401 wall top/base attach).
 * Εξήχθη εδώ ως ΕΝΑ SSoT (N.0.2 Boy Scout) ώστε να το μοιράζονται ΚΑΙ ο wall
 * host-plan builder ΚΑΙ ο `structural-finish-resolver` (ADR-449 σοβάς κολόνας/
 * δοκαριού — ποια κομμάτια παρειάς καλύπτονται από τοίχο).
 */

/** Ελάχιστο 2D σημείο (plan space). */
export interface Pt2 {
  readonly x: number;
  readonly y: number;
}

/** Αριθμητικό όριο για μη-εκφυλισμένο t / non-parallel cross product. */
const T_EPS = 1e-9;

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * t-τιμές (0..1, clamped) όπου ο άξονας a→b τέμνει ακμές του πολυγώνου. Standard
 * segment-segment intersection: άξονας `a+t·(b−a)`, ακμή `p+u·(q−p)`· κρατάμε
 * όσα έχουν 0≤u≤1 (η τομή πέφτει πάνω στην ακμή) και 0≤t≤1 (μέσα στον άξονα).
 */
function axisPolygonCrossings(a: Pt2, b: Pt2, poly: readonly Pt2[]): number[] {
  const ts: number[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const denom = dx * ey - dy * ex; // (b−a) × (q−p)
    if (Math.abs(denom) < T_EPS) continue; // parallel / collinear → αγνόησε
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const t = (apx * ey - apy * ex) / denom; // κατά μήκος άξονα
    const u = (apx * dy - apy * dx) / denom; // κατά μήκος ακμής
    if (t >= -T_EPS && t <= 1 + T_EPS && u >= -T_EPS && u <= 1 + T_EPS) {
      ts.push(clamp01(t));
    }
  }
  return ts;
}

/**
 * Σημείο μέσα σε πολύγωνο (ray-cast, even-odd). Inline εδώ ώστε το module να
 * μένει αυτόνομο (μηδέν dep σε GeometryUtils → reusable από geometry + finishes).
 */
function pointInPolygon(pt: Pt2, poly: readonly Pt2[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = poly[i];
    const pj = poly[j];
    const intersects =
      pi.y > pt.y !== pj.y > pt.y &&
      pt.x < ((pj.x - pi.x) * (pt.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Τα [t0,t1] διαστήματα του άξονα a→b που βρίσκονται **μέσα** στο πολύγωνο.
 * Robust για convex + concave: σπάμε στο {0,1}+crossings, κρατάμε όσα sub-spans
 * έχουν midpoint inside, merge-άρουμε τα συνεχόμενα.
 */
export function coveredIntervals(a: Pt2, b: Pt2, poly: readonly Pt2[]): Array<[number, number]> {
  if (poly.length < 3) return [];
  const polyArr = poly.map((p) => ({ x: p.x, y: p.y }));
  const bps = new Set<number>([0, 1]);
  for (const t of axisPolygonCrossings(a, b, polyArr)) bps.add(t);
  const sorted = [...bps].sort((x, y) => x - y);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const t0 = sorted[i];
    const t1 = sorted[i + 1];
    if (t1 - t0 < T_EPS) continue;
    const mid = (t0 + t1) / 2;
    const mx = a.x + mid * (b.x - a.x);
    const my = a.y + mid * (b.y - a.y);
    if (!pointInPolygon({ x: mx, y: my }, polyArr)) continue;
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev[1] - t0) < T_EPS) prev[1] = t1;
    else out.push([t0, t1]);
  }
  return out;
}

/**
 * Ένωση (merge) επικαλυπτόμενων `[t0,t1]` διαστημάτων σε διακριτά μη-επικαλυπτόμενα,
 * ταξινομημένα. Χρήσιμο όταν ΠΟΛΛΑ πολύγωνα (π.χ. ≥2 τοίχοι) καλύπτουν την ίδια
 * ακμή — αθροίζεις τα coverage τους πριν βρεις το εκτεθειμένο συμπλήρωμα.
 */
function mergeIntervals(intervals: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
  const sorted = [...intervals].filter(([a, b]) => b - a > T_EPS).sort((x, y) => x[0] - y[0]);
  const out: Array<[number, number]> = [];
  for (const [a, b] of sorted) {
    const prev = out[out.length - 1];
    if (prev && a <= prev[1] + T_EPS) prev[1] = Math.max(prev[1], b);
    else out.push([a, b]);
  }
  return out;
}

/**
 * Συμπλήρωμα: τα εκτεθειμένα (μη-καλυμμένα) `[t0,t1]` διαστήματα εντός [0,1] δοθέντων
 * των καλυμμένων. Τα `covered` ΔΕΝ χρειάζεται να είναι merged — γίνεται εσωτερικά.
 * Διαστήματα μικρότερα από `minLen` παραλείπονται (αριθμητικό noise).
 */
export function exposedComplement(
  covered: ReadonlyArray<readonly [number, number]>,
  minLen = T_EPS,
): Array<[number, number]> {
  const merged = mergeIntervals(covered);
  const out: Array<[number, number]> = [];
  let cursor = 0;
  for (const [a, b] of merged) {
    if (a - cursor > minLen) out.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (1 - cursor > minLen) out.push([cursor, 1]);
  return out;
}
