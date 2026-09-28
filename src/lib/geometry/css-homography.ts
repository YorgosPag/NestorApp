/**
 * @fileoverview **ΤΕΤΡΑΓΩΝΟ → ΤΕΤΡΑΠΛΕΥΡΟ** — η προβολική απεικόνιση (ομογραφία) που «απλώνει» ένα στοιχείο DOM πάνω σε
 * τέσσερα σημεία της οθόνης, ως CSS `matrix3d` (ADR-884 Φ2στ-γ · §4.14). Καθαρό.
 * @related `lib/spatial-tour/viewer/tour-floor-geometry.ts` (το βελάκι και η κουκκίδα στο πάτωμα του πανοράματος)
 * @module lib/geometry/css-homography
 *
 * 🏆 **Γιατί DOM με ομογραφία και όχι υφή μέσα στο WebGL**: μια υφή σε λοξή γωνία **θολώνει** (mipmap), ενώ ένα στοιχείο
 *   DOM με `matrix3d` το ζωγραφίζει ο browser **διανυσματικά**, στην τελική του θέση — ευκρινές σεβρόν σε κάθε κλίση. Και ο
 *   browser κάνει hit-test στο **παραμορφωμένο** σχήμα, οπότε το κουμπί μένει πραγματικό `<button>` (Tab · Enter · aria).
 * 📐 Κλειστή μορφή του Heckbert («Fundamentals of Texture Mapping and Image Warping», 1989, §2.2.3): τετράγωνο μοναδιαίο
 *   → τετράπλευρο, με τις γωνίες στη σειρά **πάνω-αριστερά, πάνω-δεξιά, κάτω-δεξιά, κάτω-αριστερά** του στοιχείου.
 */

export interface PlanePoint {
  readonly x: number;
  readonly y: number;
}

/** Οι τέσσερις γωνίες-στόχοι: πάνω-αριστερά · πάνω-δεξιά · κάτω-δεξιά · κάτω-αριστερά του στοιχείου. */
export type Quad = readonly [PlanePoint, PlanePoint, PlanePoint, PlanePoint];

/** `(u, v) ↦ ((a·u + b·v + c) / w, (d·u + e·v + f) / w)` με `w = g·u + h·v + 1`. */
export interface Homography {
  readonly a: number; readonly b: number; readonly c: number;
  readonly d: number; readonly e: number; readonly f: number;
  readonly g: number; readonly h: number;
}

const DEGENERATE = 1e-12;

/** Η ομογραφία του μοναδιαίου τετραγώνου στο `quad` — `null` όταν το τετράπλευρο εκφυλίζεται (τρεις γωνίες σε ευθεία). */
export function unitSquareToQuad(quad: Quad): Homography | null {
  const [p0, p1, p2, p3] = quad;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  if (Math.abs(sx) < DEGENERATE && Math.abs(sy) < DEGENERATE) {
    return { a: p1.x - p0.x, b: p2.x - p1.x, c: p0.x, d: p1.y - p0.y, e: p2.y - p1.y, f: p0.y, g: 0, h: 0 };
  }
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) < DEGENERATE) return null;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return {
    a: p1.x - p0.x + g * p1.x, b: p3.x - p0.x + h * p3.x, c: p0.x,
    d: p1.y - p0.y + g * p1.y, e: p3.y - p0.y + h * p3.y, f: p0.y,
    g, h,
  };
}

/** Εφαρμογή της ομογραφίας σε σημείο του μοναδιαίου τετραγώνου (για τις άγκυρες και για σημεία πάνω στο στοιχείο). */
export function applyHomography(m: Homography, u: number, v: number): PlanePoint {
  const w = m.g * u + m.h * v + 1;
  return { x: (m.a * u + m.b * v + m.c) / w, y: (m.d * u + m.e * v + m.f) / w };
}

const fixed = (n: number) => (Math.abs(n) < 1e-12 ? 0 : Number(n.toPrecision(10)));

/**
 * **CSS `matrix3d`** που απλώνει ένα στοιχείο `sizePx × sizePx` (με `transform-origin: 0 0`, στη γωνία του γονέα) πάνω στο
 * `quad`. `null` ⇒ εκφυλισμένο τετράπλευρο: ο καλών το κρύβει. Σειρά στηλών, όπως τη ζητά το CSS.
 */
export function quadToMatrix3d(quad: Quad, sizePx: number): string | null {
  const m = unitSquareToQuad(quad);
  if (m === null || !(sizePx > 0)) return null;
  const s = 1 / sizePx;
  const values = [m.a * s, m.d * s, 0, m.g * s, m.b * s, m.e * s, 0, m.h * s, 0, 0, 1, 0, m.c, m.f, 0, 1];
  return `matrix3d(${values.map(fixed).join(',')})`;
}
