/**
 * =============================================================================
 * ΠΑΧΟΣ ΠΙΝΕΛΙΑΣ ΑΠΟ ΤΗΝ ΚΑΛΥΨΗ ΤΟΥ ΓΚΡΙ — ΥΠΟ-PIXEL, ΑΝΕΞΑΡΤΗΤΟ ΑΠΟ ΤΗ ΦΑΣΗ (SSoT)
 * =============================================================================
 *
 * Μια δυαδική μάσκα μετρά το πάχος σε **ακέραια** pixel, και το αποτέλεσμα εξαρτάται από το πού πέφτει η γραμμή μέσα στο
 * pixel. Μετρημένο στο ΤΕΣΤ2 (ADR-929 §6.21.3): πινελιά 1,13 px βγαίνει 1 px στο Chrome και 2 px στο Node, και βοηθητική
 * 1,00 px βγαίνει 2 px όταν πέσει πάνω στο όριο δύο στηλών. Αλλάζει έτσι η απάντηση «είναι λεπτή;».
 *
 * 🔑 **Μοντέλο μερικής επιφάνειας** (partial area effect, Trujillo-Pino 2013): σε εξομαλυμένη απόδοση η τιμή ενός pixel
 *   είναι η **κάλυψή** του από το μελάνι. Άρα το ολοκλήρωμα της κάλυψης κάθετα στη γραμμή **είναι** το πάχος της, όποια
 *   κι αν είναι η φάση. Και η θόλωση του σαρωτή μοιράζει την ίδια μάζα σε περισσότερα pixel: το ολοκλήρωμα δεν αλλάζει
 *   όσο μένει μέσα στο παράθυρο. Ο Steger (1998) λύνει άλλο πρόβλημα (θολό προφίλ με γνωστό σ, όρια από παραγώγους)·
 *   σε πινελιές 1 px δεν εφαρμόζεται.
 * 🔑 **Το παράθυρο είναι της μάσκας ±1,5 px**: η εξομάλυνση απλώνει το μελάνι το πολύ ένα pixel έξω από το γεωμετρικό
 *   όριο, και η διγραμμική παρεμβολή φτάνει στο μηδέν μισό pixel μετά το κέντρο εκείνου του pixel.
 * 🔑 **Διάμεσος κατά μήκος**: μια διασταύρωση ή ένα γράμμα δίπλα στη γραμμή αλλάζει λίγα δείγματα, όχι τον διάμεσο.
 *
 * Το κανάλι είναι «σκοτεινότητα» 0–255 (0 = μαύρο), το **ίδιο** που όρισε τη μάσκα (`plan-ink.ts`).
 *
 * @module lib/geometry/raster/coverage-width
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.21.4
 */

import { histogramPercentile } from './otsu-threshold';

/** Η στάθμη του χαρτιού και του πλήρους μελανιού στο κανάλι σκοτεινότητας. */
export interface InkLevels {
  readonly paper: number;
  readonly ink: number;
}

/** Το κανάλι σκοτεινότητας, μαζί με τις στάθμες του. */
export interface CoverageRaster {
  readonly gray: Uint8Array;
  readonly cols: number;
  readonly rows: number;
  readonly levels: InkLevels;
}

export interface CoveragePoint {
  readonly x: number;
  readonly y: number;
}

/** Το φωτεινό εκατοστημόριο ολόκληρης της εικόνας που λέγεται «χαρτί». */
const PAPER_PERCENTILE = 0.9;
/**
 * Το σκοτεινό εκατοστημόριο των pixel της μάσκας που λέγεται «πλήρες μελάνι»: σχεδόν το **σκουρότερο**.
 * 🔑 Η αναφορά πρέπει να μην είναι **ποτέ φωτεινότερη** από το πραγματικό μελάνι: τότε η κάλυψη κορεννύεται στο 1 και το
 *   πάχος ξαναγίνεται ακέραιο ανάλογα με τη φάση (μετρημένο: λωρίδα 1,13 px σε μισή φάση ⇒ 2,00 με το p5 μιας εικόνας
 *   χωρίς κανένα πλήρως καλυμμένο pixel). Σκουρότερη αναφορά (θόρυβος) πολλαπλασιάζει **όλα** τα πάχη με τον ίδιο
 *   συντελεστή: η λεπτότητα και το εκατοστημόριο είναι λόγοι και δεν αλλάζουν.
 */
const INK_PERCENTILE = 0.01;
/**
 * Κάτω όριο της αντίθεσης χαρτί−μελάνι. Σε τόσο θαμπή εικόνα η μάσκα σχεδόν δεν έχει μελάνι· το όριο μόνο εμποδίζει τη
 * διαίρεση με ~0.
 */
const MIN_CONTRAST = 32;
/** Πόσο απλώνει το παράθυρο έξω από το όριο της μάσκας (εξομάλυνση 1 px + μισό px διγραμμικής παρεμβολής). */
const FRINGE_PX = 1.5;
/** Βήμα ολοκλήρωσης κάθετα στη γραμμή. */
const STEP_PX = 0.25;
/** Τα δείγματα κατά μήκος μένουν στο εσωτερικό `[EDGE, 1 − EDGE]`, μακριά από γωνίες και απολήξεις. */
const EDGE_FRACTION = 0.15;
const MAX_SAMPLES = 33;
const MIN_SAMPLES = 5;

/**
 * Οι στάθμες μιας εικόνας: **χαρτί** = p90 όλης της εικόνας (το χαρτί είναι η πλειονότητα), **μελάνι** = p1 των pixel
 * της μάσκας (`1` = μελάνι). Η αντίθεση φράσσεται κάτω στο {@link MIN_CONTRAST}.
 */
export function inkLevels(gray: Uint8Array, ink: Uint8Array): InkLevels {
  const all = new Uint32Array(256);
  const inked = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    all[gray[i]]++;
    if (ink[i] === 1) inked[gray[i]]++;
  }
  const paper = histogramPercentile(all, PAPER_PERCENTILE) ?? 255;
  const darkest = histogramPercentile(inked, INK_PERCENTILE) ?? 0;
  return { paper, ink: Math.min(darkest, paper - MIN_CONTRAST) };
}

/** Διγραμμική τιμή στο συνεχές σημείο (κέντρο του κελιού `i` στο `i + 0,5`). Έξω από την εικόνα ⇒ χαρτί. */
function grayAt(r: CoverageRaster, x: number, y: number): number {
  const fx = x - 0.5;
  const fy = y - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (cx: number, cy: number): number =>
    cx < 0 || cy < 0 || cx >= r.cols || cy >= r.rows ? r.levels.paper : r.gray[cy * r.cols + cx];
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Η κάλυψη `[0, 1]` μιας τιμής σκοτεινότητας. */
function coverageOf(r: CoverageRaster, v: number): number {
  const c = (r.levels.paper - v) / (r.levels.paper - r.levels.ink);
  return c <= 0 ? 0 : c >= 1 ? 1 : c;
}

/** Το ολοκλήρωμα της κάλυψης στο `p + t·n`, `t ∈ [−half, half]` (κανόνας μέσου σημείου). */
function coverageAcross(r: CoverageRaster, p: CoveragePoint, n: CoveragePoint, half: number): number {
  let sum = 0;
  for (let t = -half + STEP_PX / 2; t < half; t += STEP_PX) sum += coverageOf(r, grayAt(r, p.x + n.x * t, p.y + n.y * t));
  return sum * STEP_PX;
}

/**
 * Το πάχος (px) της πινελιάς με κεντρική γραμμή `a → b`: διάμεσος, κατά μήκος του εσωτερικού της, του ολοκληρώματος της
 * κάλυψης κάθετα. `maskThickness` = το πάχος της στη δυαδική μάσκα: ορίζει μόνο το παράθυρο. Εκφυλισμένο τμήμα ⇒ `0`.
 */
export function coverageWidth(r: CoverageRaster, a: CoveragePoint, b: CoveragePoint, maskThickness: number): number {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(length > 0)) return 0;
  const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const n = { x: -u.y, y: u.x };
  const half = maskThickness / 2 + FRINGE_PX;
  const count = Math.max(MIN_SAMPLES, Math.min(MAX_SAMPLES, Math.floor(length)));
  const widths: number[] = [];
  for (let i = 0; i < count; i++) {
    const f = EDGE_FRACTION + ((1 - 2 * EDGE_FRACTION) * (i + 0.5)) / count;
    widths.push(coverageAcross(r, { x: a.x + u.x * f * length, y: a.y + u.y * f * length }, n, half));
  }
  widths.sort((x, y) => x - y);
  const mid = widths.length >> 1;
  return widths.length % 2 === 1 ? widths[mid] : (widths[mid - 1] + widths[mid]) / 2;
}
