/**
 * **Οι πλευρές ενός πίνακα χωρίς πλαίσιο** (ADR-929 §6.10 #2): η περιοχή του **μαζί με το περίγραμμά του**, και ποιες
 * πλευρές του είναι **ακραίες** — πέρα από αυτές, μετά το δικό του περίγραμμα και πριν από την άκρη του φύλλου, δεν ζει
 * τίποτα. Δεν κρίνει αν το εύρημα **είναι** πίνακας: αυτό το κάνει το `sheet-layout` (τεκμήρια πίνακα).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/table-sides
 */

import type { AlignedRectPx, AnnotationBlock } from './plan-alignment-types';
import {
  FRAME_MAX_OUTSIDE_INK,
  FRAME_MIN_COVERAGE,
  columnCoverage,
  coverage,
  inkInRect,
  maxLineThickness,
  type Grid,
  type PixelRect,
} from './sheet-grid';

export type Side = AnnotationBlock['anchoredTo'][number];

/**
 * Λωρίδα πέρα από πίνακα χωρίς πλαίσιο (ADR-929 §6.10 #2): γραμμή με κάλυψη πάνω από 1% της πλευράς είναι **μελάνι**,
 * κάτω από αυτό χαρτί με σκόνη. Μετρημένο σε **μία** σάρωση: σκόνη ≤ 0,3% ανά γραμμή · σχέδιο ≥ 4,6%.
 */
const STRIP_LINE_MAX_COVER = 0.01;

/**
 * Μία πλευρά του πίνακα, κοιταγμένη **προς τα έξω**: γραμμές (στήλες ή σειρές) από `start` (η πρώτη έξω από τα κελιά)
 * ως την άκρη `edge` της εικόνας, με βήμα `step`, στο μήκος `[a0, a1]` της πλευράς.
 */
interface SideProbe {
  readonly side: Side;
  readonly rowsAreLines: boolean;
  readonly start: number;
  readonly step: 1 | -1;
  readonly edge: number;
  readonly a0: number;
  readonly a1: number;
}

function sideProbes(g: Grid, box: AlignedRectPx): SideProbe[] {
  const xs = { a0: box.minX, a1: box.maxX - 1 };
  const ys = { a0: box.minY, a1: box.maxY - 1 };
  return [
    { side: 'top', rowsAreLines: true, start: box.minY - 1, step: -1, edge: 0, ...xs },
    { side: 'right', rowsAreLines: false, start: box.maxX, step: 1, edge: g.cols - 1, ...ys },
    { side: 'bottom', rowsAreLines: true, start: box.maxY, step: 1, edge: g.rows - 1, ...xs },
    { side: 'left', rowsAreLines: false, start: box.minX - 1, step: -1, edge: 0, ...ys },
  ];
}

const inBounds = (g: Grid, p: SideProbe, line: number): boolean => line >= 0 && line < (p.rowsAreLines ? g.rows : g.cols);

/** Κάλυψη μελανιού μίας γραμμής της λωρίδας, στο μήκος της πλευράς. */
function lineCover(g: Grid, p: SideProbe, line: number): number {
  return (p.rowsAreLines ? coverage : columnCoverage)(g.ink, g, line, p.a0, p.a1);
}

/** Γραμμή της λωρίδας με **μελάνι** (όχι χαρτί με σκόνη): κάλυψη πάνω από `STRIP_LINE_MAX_COVER`. */
const isInkLine = (g: Grid, p: SideProbe, line: number): boolean =>
  inBounds(g, p, line) && lineCover(g, p, line) > STRIP_LINE_MAX_COVER;

/**
 * Κλάσμα του μήκους `[a0, a1]` (προεπιλογή: η πλευρά) που καλύπτουν **μαζί** οι γραμμές `[lo, hi]` — μια γραμμή μετά από
 * ίσιωμα απλώνεται σε λίγες. Κομμένο στο πλέγμα.
 */
function unionCover(g: Grid, p: SideProbe, lo: number, hi: number, a0 = p.a0, a1 = p.a1): number {
  const length = p.rowsAreLines ? g.cols : g.rows;
  const from = Math.max(0, a0);
  const to = Math.min(length - 1, a1);
  let on = 0;
  for (let a = from; a <= to; a++) {
    for (let line = lo; line <= hi; line++) {
      if (g.ink[p.rowsAreLines ? line * g.cols + a : a * g.cols + line]) { on++; break; }
    }
  }
  return to >= from ? on / (to - from + 1) : 0;
}

/** Κλειστό διάστημα γραμμών `[lo, hi]` (αύξουσα σειρά δεικτών). */
interface LineBand { readonly lo: number; readonly hi: number }

/**
 * Η **λεπτή γραμμή** παράλληλη στην πλευρά που περνά από τη γραμμή `at` — ή `null`:
 * (1) μεγαλώνει από τον γείτονα με τη μεγαλύτερη κάλυψη ώσπου οι γραμμές της να καλύπτουν **μαζί**
 *     ≥ `FRAME_MIN_COVERAGE` της πλευράς· (2) μετά απορροφά ό,τι απομένει από αυτήν **μόνο** προς τη λωρίδα
 *     (`towardStrip`), ώστε η ουρά της να μη μετρηθεί ως μελάνι πέρα από αυτήν. Συνολικά ως `maxLineThickness`.
 * 🔴 Μετρημένο (§6.10 #2): μετά το ίσιωμα (κλίση 0,06°) το περίγραμμα του πίνακα απλώνεται σε **6** στήλες με 24–74%
 *   η καθεμία· ανά μία δεν φτάνει ποτέ το 80%, η ένωσή τους ναι. Και **δεν** απλώνεται προς τα μέσα πέρα από όσο
 *   χρειάζεται: εκεί οι στήλες κειμένου των κελιών έχουν κι αυτές μελάνι.
 */
function lineBandAt(g: Grid, p: SideProbe, at: number, towardStrip: 1 | -1): LineBand | null {
  if (!isInkLine(g, p, at)) return null;
  const max = maxLineThickness(g);
  const neighbour = (line: number) => (isInkLine(g, p, line) ? lineCover(g, p, line) : -1);
  let lo = at;
  let hi = at;
  while (unionCover(g, p, lo, hi) < FRAME_MIN_COVERAGE) {
    const below = neighbour(lo - 1);
    const above = neighbour(hi + 1);
    if (hi - lo + 1 >= max || (below < 0 && above < 0)) return null;
    if (below >= above) lo--;
    else hi++;
  }
  for (let next = towardStrip > 0 ? hi + 1 : lo - 1; isInkLine(g, p, next); next += towardStrip) {
    if (hi - lo + 1 >= max) return null;
    if (towardStrip > 0) hi = next;
    else lo = next;
  }
  return { lo, hi };
}

/** Το άκρο της ζώνης προς την κατεύθυνση `dir`. */
const bandEnd = (b: LineBand, dir: 1 | -1): number => (dir > 0 ? b.hi : b.lo);

/**
 * `true` όταν η γραμμή **συνεχίζει πέρα** από τον πίνακα: πέρα από τη γωνία (ένα `maxLineThickness`, όσο πιάνει το
 * κάθετο περίγραμμα), σε ακόμη ένα `maxLineThickness`, καλύπτει ≥ `FRAME_MIN_COVERAGE`. Έτσι ξεχωρίζει η άκρη του φύλλου
 * (μετρημένο: ~98% του ύψους του φύλλου, 45 px από την πινακίδα) από τη δεύτερη γραμμή ενός διπλού περιγράμματος
 * (μετρημένο: 6 px, τελειώνει μαζί με τον πίνακα) — δομικά, χωρίς όριο απόστασης που κανένα πρότυπο δεν δίνει
 * (ISO 5457/7200: μία συνεχής γραμμή 0,7 mm).
 */
function continuesPastTable(g: Grid, p: SideProbe, band: LineBand): boolean {
  const t = Math.ceil(maxLineThickness(g));
  return unionCover(g, p, band.lo, band.hi, p.a1 + t + 1, p.a1 + 2 * t) >= FRAME_MIN_COVERAGE
    || unionCover(g, p, band.lo, band.hi, p.a0 - 2 * t, p.a0 - t - 1) >= FRAME_MIN_COVERAGE;
}

/** Η επόμενη λεπτή γραμμή μετά το `from`, πέρα από χαρτί το πολύ ενός `maxLineThickness` — ή `null`. */
function nextLineBand(g: Grid, p: SideProbe, from: number): LineBand | null {
  const reach = maxLineThickness(g);
  let at = from;
  while (inBounds(g, p, at) && !isInkLine(g, p, at)) {
    if (Math.abs(at - from) >= reach) return null;
    at += p.step;
  }
  return inBounds(g, p, at) ? lineBandAt(g, p, at, p.step) : null;
}

/**
 * Η πρώτη γραμμή **πέρα** από το περίγραμμα του ίδιου του πίνακα. Το κουτί είναι η ένωση των κελιών, άρα το περίγραμμα
 * πέφτει πάνω στο όριό του (μετρημένο: −3…+2 px) — ψάχνεται στην πρώτη γραμμή έξω και, αν εκεί είναι χαρτί, στην
 * τελευταία μέσα. Ακολουθούν οι γραμμές **διπλού** περιγράμματος: λεπτές, παράλληλες, κοντά, που **δεν** συνεχίζουν
 * πέρα από τον πίνακα. Χωρίς περίγραμμα (πίνακας χωρίς πλαίσιο κελιών) ⇒ `start`.
 */
function pastOutline(g: Grid, p: SideProbe): number {
  const first = lineBandAt(g, p, p.start, p.step) ?? lineBandAt(g, p, p.start - p.step, p.step);
  if (first === null) return p.start;
  let past = bandEnd(first, p.step) + p.step;
  for (let band = nextLineBand(g, p, past); band !== null && !continuesPastTable(g, p, band); band = nextLineBand(g, p, past)) {
    past = bandEnd(band, p.step) + p.step;
  }
  return p.step > 0 ? Math.max(p.start, past) : Math.min(p.start, past);
}

/** Η λωρίδα των γραμμών `[from, to]` (σε όποια σειρά) στο μήκος της πλευράς. */
function stripRect(p: SideProbe, from: number, to: number): PixelRect {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return p.rowsAreLines ? { x0: p.a0, x1: p.a1, y0: lo, y1: hi } : { x0: lo, x1: hi, y0: p.a0, y1: p.a1 };
}

function inkFraction(g: Grid, r: PixelRect): number {
  const { ink, area } = inkInRect(g, r);
  return area > 0 ? ink / area : 0;
}

/**
 * Πού τελειώνει η λωρίδα που κρίνεται: **πριν** από τη γραμμή-άκρη του φύλλου (άκρη χαρτιού / μονόπλευρο πλαίσιο) —
 * η πρώτη λεπτή γραμμή που συναντά κανείς ερχόμενος **από την άκρη** της εικόνας, με μόνο χαρτί έξω της· αλλιώς η άκρη.
 * Ψάχνεται **τοπικά**, στο μήκος της πλευράς: μετρημένο ότι μετά το ίσιωμα η γραμμή-άκρη μοιράζεται σε 4 στήλες
 * (18–68% η καθεμία), οπότε οι μακριές διαδρομές του πλαισίου (`longRuns`) δεν τη βλέπουν.
 */
function stripEnd(g: Grid, p: SideProbe, from: number): number {
  let e = p.edge;
  while ((e - from) * p.step > 0 && !isInkLine(g, p, e)) e -= p.step;
  if ((e - from) * p.step <= 0) return p.edge;
  const band = lineBandAt(g, p, e, p.step > 0 ? -1 : 1);
  // Ερχόμενοι από την άκρη, το εσωτερικό άκρο της γραμμής είναι το `lo` δεξιά/κάτω και το `hi` αριστερά/πάνω.
  return band === null ? p.edge : (p.step > 0 ? band.lo : band.hi) - p.step;
}

/**
 * `true` όταν **πέρα** από αυτή την πλευρά του πίνακα δεν ζει τίποτα (ADR-929 §6.10 #2): στη λωρίδα από το περίγραμμα του
 * πίνακα ως τη γραμμή-άκρη του φύλλου (ή την άκρη της εικόνας)
 * (α) καμία γραμμή δεν έχει μελάνι (`STRIP_LINE_MAX_COVER`) — πιάνει τις **παράλληλες** γραμμές σχεδίου, που σε βαθιά
 *     λωρίδα αραιώνουν: μετρημένο σχέδιο 939 px πάνω από την πινακίδα, 4,6–8,2% ανά γραμμή, <0,2% του εμβαδού· και
 * (β) το συνολικό μελάνι είναι ως `FRAME_MAX_OUTSIDE_INK` — πιάνει τις **κάθετες**, που ανά γραμμή μοιάζουν με σκόνη.
 */
function isOutermost(g: Grid, p: SideProbe, from: number): boolean {
  if (!inBounds(g, p, from)) return true;
  const end = stripEnd(g, p, from);
  if ((end - from) * p.step < 0) return true;
  for (let line = from; line !== end + p.step; line += p.step) if (isInkLine(g, p, line)) return false;
  return inkFraction(g, stripRect(p, from, end)) <= FRAME_MAX_OUTSIDE_INK;
}

/** Η ανάγνωση των τεσσάρων πλευρών ενός πίνακα: η περιοχή του **μαζί με το περίγραμμά του**, και οι ακραίες πλευρές. */
export interface TableSides {
  readonly region: AlignedRectPx;
  readonly outermost: readonly Side[];
}

/**
 * Οι πλευρές του πίνακα (ADR-929 §6.10 #2). Η **περιοχή** περιλαμβάνει το δικό του περίγραμμα: η ένωση των κελιών το
 * αφήνει έξω, και μετρήθηκε ότι οι γραμμές του (20 στους 20 υποψήφιους που έμεναν) γίνονταν «τοίχοι». Οι **ακραίες**
 * πλευρές κρίνονται όχι με «πόσο απέχει από την άκρη» (ISO 5457/7200 δεν ορίζουν τίποτα για φύλλο χωρίς πλαίσιο — το
 * περιθώριο της σάρωσης είναι τυχαίο) αλλά με «**υπάρχει μελάνι πέρα από αυτόν;**».
 */
export function readTableSides(g: Grid, box: AlignedRectPx): TableSides {
  const outermost: Side[] = [];
  let { minX, minY, maxX, maxY } = box;
  for (const p of sideProbes(g, box)) {
    const from = pastOutline(g, p);
    if (isOutermost(g, p, from)) outermost.push(p.side);
    if (p.side === 'top') minY = from + 1;
    else if (p.side === 'left') minX = from + 1;
    else if (p.side === 'right') maxX = from;
    else maxY = from;
  }
  return { region: { minX, minY, maxX, maxY }, outermost };
}
