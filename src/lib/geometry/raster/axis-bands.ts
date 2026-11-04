/**
 * =============================================================================
 * ΖΩΝΕΣ ΑΞΟΝΩΝ — ΕΥΘΕΙΕΣ ΜΕΛΑΝΙΟΥ ΣΤΟΥΣ ΚΥΡΙΑΡΧΟΥΣ ΑΞΟΝΕΣ, ΜΕ ΠΑΧΟΣ ΚΑΤΩ ΑΠΟ ΤΟ PIXEL (SSoT)
 * =============================================================================
 *
 * Μετά την ευθυγράμμιση (ADR-929 Φ1) οι τοίχοι μιας κάτοψης είναι οριζόντιοι ή κατακόρυφοι. Μια ευθεία μελανιού
 * είναι τότε μια **ζώνη**: διαδοχικές γραμμές σάρωσης με μακριές διαδρομές **παρόμοιας έκτασης**. Η ζώνη δίνει:
 *   · **κέντρο** κάθετα στον άξονα = μέσος των γραμμών σταθμισμένος με το μήκος τους·
 *   · **πάχος** = εμβαδόν / μήκος. Υπο-pixel, και ανεπηρέαστο από μεμονωμένες οδοντώσεις του ορίου·
 *   · **άκρα** = διάμεσος των αρχών/τελών των γραμμών (μία τραχιά γραμμή δεν μετακινεί το άκρο)·
 *   · **πλήρωση** = εμβαδόν / (γραμμές × μήκος): πόσο συμπαγής είναι.
 *
 * Λεπτή ζώνη ⇒ πινελιά. Παχιά, συμπαγής ζώνη ⇒ γεμάτος τοίχος (poché). Την κρίση την κάνει ο καταναλωτής.
 *
 * Πολυπλοκότητα: O(κελιά) για τη σάρωση + O(διαδρομές × ανοιχτές ζώνες) για τη σύνδεση.
 *
 * @module lib/geometry/raster/axis-bands
 * @see ./run-length-filter.ts (ο ένας σαρωτής διαδρομών)
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.3
 */

import { forEachRun, type RunAxis } from './run-length-filter';

/** Ζώνη σε **συνεχή** χώρο pixel: το κελί `i` καλύπτει το `[i, i + 1)`. */
export interface AxisBand {
  readonly axis: RunAxis;
  /** Κέντρο κάθετα στον άξονα (y για οριζόντια, x για κατακόρυφη). */
  readonly center: number;
  /** Εμβαδόν / μήκος, σε px. */
  readonly thickness: number;
  /** Άκρα κατά μήκος του άξονα, `start < end`. */
  readonly start: number;
  readonly end: number;
  /** Εμβαδόν / (γραμμές σάρωσης × μήκος), στο `(0, 1]`. */
  readonly fill: number;
  /** Πλήθος γραμμών σάρωσης της ζώνης. */
  readonly lines: number;
  /**
   * Η **περιβάλλουσα** κατά μήκος: η μικρότερη αρχή και το μεγαλύτερο τέλος από όλες τις γραμμές. Σε λοξή κοπή (τοίχος
   * που ακουμπά λοξά σε άλλον) τα άκρα των γραμμών αλλάζουν από παρειά σε παρειά. Ο διάμεσος (`start`/`end`) δίνει
   * τη μέση, ενώ η περιβάλλουσα κρατά τα άκρα και των δύο παρειών (`bandEdgeExposure`).
   */
  readonly envelopeStart: number;
  readonly envelopeEnd: number;
}

export interface AxisBandOptions {
  /** Ελάχιστο μήκος διαδρομής, σε px. Κοντύτερες (κείμενο, σύμβολα, κάθετες πινελιές) αγνοούνται. */
  readonly minLength: number;
  /**
   * Ελάχιστη ομοιότητα έκτασης δύο διαδοχικών γραμμών (επικάλυψη / **μακρύτερη**) για να ανήκουν στην ίδια ζώνη.
   * Ως προς τη μακρύτερη, όχι την κοντύτερη: η κοντή διαδρομή ενός κάθετου τοίχου κάτω από τον οριζόντιο δεν τον
   * «συνεχίζει» (μετρημένο στη Φ2: αλλιώς η ζώνη του βόρειου τοίχου κατέβαινε όλο τον δυτικό).
   */
  readonly minOverlap: number;
}

export const DEFAULT_AXIS_BANDS: Omit<AxisBandOptions, 'minLength'> = { minOverlap: 0.6 };

interface Run {
  readonly start: number;
  readonly end: number;
}

/** Ζώνη υπό κατασκευή. */
interface OpenBand {
  readonly firstLine: number;
  lastLine: number;
  /** Η έκταση της τελευταίας γραμμής (ένωση των κομματιών της). */
  lastStart: number;
  lastEnd: number;
  area: number;
  weightedLine: number;
  readonly starts: number[];
  readonly ends: number[];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function overlapLength(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Επικάλυψη / μακρύτερη: 1 = ίδια έκταση. */
function similarity(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return overlapLength(aStart, aEnd, bStart, bEnd) / Math.max(aEnd - aStart, bEnd - bStart);
}

/** Μία γραμμή της ζώνης: ένα ή περισσότερα κομμάτια (διαδρομή σπασμένη από θόρυβο), ταξινομημένα. */
function extendLine(band: OpenBand, line: number, runs: readonly Run[]): void {
  const covered = runs.reduce((s, r) => s + r.end - r.start, 0);
  band.lastLine = line;
  band.lastStart = runs[0].start;
  band.lastEnd = runs[runs.length - 1].end;
  band.area += covered;
  band.weightedLine += (line + 0.5) * covered;
  band.starts.push(band.lastStart);
  band.ends.push(band.lastEnd);
}

function openBand(line: number, run: Run): OpenBand {
  const band: OpenBand = {
    firstLine: line, lastLine: line, lastStart: run.start, lastEnd: run.end, area: 0, weightedLine: 0, starts: [], ends: [],
  };
  extendLine(band, line, [run]);
  return band;
}

function closeBand(band: OpenBand, axis: RunAxis): AxisBand {
  const start = median(band.starts);
  const end = Math.max(start + 1, median(band.ends));
  const lines = band.lastLine - band.firstLine + 1;
  return {
    axis,
    center: band.weightedLine / band.area,
    thickness: band.area / (end - start),
    start,
    end,
    fill: Math.min(1, band.area / (lines * (end - start))),
    lines,
    envelopeStart: Math.min(...band.starts),
    envelopeEnd: Math.max(...band.ends),
  };
}

/** Κάθε διαδρομή στη ζώνη της προηγούμενης γραμμής με τη μεγαλύτερη επικάλυψη. Χωρίς καμία ⇒ ορφανή. */
function groupByBand(prev: readonly OpenBand[], runs: readonly Run[]): { groups: Map<OpenBand, Run[]>; orphans: Run[] } {
  const groups = new Map<OpenBand, Run[]>();
  const orphans: Run[] = [];
  for (const r of runs) {
    let best: OpenBand | null = null;
    let bestOverlap = 0;
    for (const b of prev) {
      const o = overlapLength(b.lastStart, b.lastEnd, r.start, r.end);
      if (o > bestOverlap) {
        best = b;
        bestOverlap = o;
      }
    }
    if (best) groups.set(best, [...(groups.get(best) ?? []), r]);
    else orphans.push(r);
  }
  return { groups, orphans };
}

/**
 * Τα κομμάτια που πέφτουν πάνω σε μία ζώνη κρίνονται **μαζί**: αν η ένωσή τους μοιάζει με την προηγούμενη γραμμή και
 * τα κενά ανάμεσα είναι μικρά, η διαδρομή απλώς έσπασε από θόρυβο. Αλλιώς συνεχίζει μόνο το ένα κομμάτι που μοιάζει
 * (αν υπάρχει), και τα υπόλοιπα επιστρέφονται για νέες ζώνες. Ένα πραγματικό άνοιγμα είναι σπασμένο σε **κάθε** γραμμή.
 */
function continueBand(band: OpenBand, line: number, runs: readonly Run[], minOverlap: number): Run[] {
  const start = runs[0].start;
  const end = runs[runs.length - 1].end;
  const covered = runs.reduce((s, r) => s + r.end - r.start, 0);
  if (similarity(band.lastStart, band.lastEnd, start, end) >= minOverlap && covered / (end - start) >= minOverlap) {
    extendLine(band, line, runs);
    return [];
  }
  const score = (r: Run): number => similarity(band.lastStart, band.lastEnd, r.start, r.end);
  const best = runs.reduce((a, b) => (score(b) > score(a) ? b : a));
  if (score(best) < minOverlap) return [...runs];
  extendLine(band, line, [best]);
  return runs.filter((r) => r !== best);
}

/**
 * Τα κομμάτια του ορίου μιας ζώνης που είναι **παρειά**: εκεί όπου, στην πλευρά `side` (`−1` = προς μικρότερο κέντρο,
 * `+1` = προς μεγαλύτερο), η γραμμή μία θέση **μέσα** από το όριο είναι μελάνι **και** η γραμμή δύο px **έξω** χαρτί.
 * Για γεμάτο τοίχο είναι η πραγματική του παρειά: διακόπτεται εκεί που ενώνεται άλλος τοίχος (Τ), σταματά στη γωνία,
 * και σε λοξή κοπή κάθε πλευρά παίρνει **το δικό της** άκρο (σάρωση σε όλη την περιβάλλουσα, όχι στον διάμεσο).
 * Δύο px έξω, όχι ένα: μετά από ίσιωμα το όριο έχει οδοντώσεις 1 px, και η γραμμή αμέσως έξω βρίσκει μελάνι
 * σποραδικά (μετρημένο στη Φ2: η παρειά έσπαγε σε θραύσματα). Σε κόμβο ο άλλος τοίχος συνεχίζει προς τα έξω.
 * Κενά ως `bridgePx` (θόρυβος) γεφυρώνονται· κομμάτια κάτω από `minLength` πετιούνται. Συνεχής χώρος px.
 * `extendPx`: η σάρωση συνεχίζει τόσο πέρα από την περιβάλλουσα, όταν η `mask` είναι **πληρέστερη** από εκείνη όπου
 * βρέθηκε η ζώνη (π.χ. ζώνη από υπόλοιπο μελάνι, παρειά πάνω στο πλήρες): η παρειά σταματά μόνη της, όπου απέξω
 * αρχίζει άλλος τοίχος ή όπου μέσα τελειώνει το σώμα.
 */
export function bandEdgeExposure(
  mask: Uint8Array, cols: number, rows: number, band: AxisBand, side: -1 | 1, minLength: number, bridgePx: number,
  extendPx = 0,
): { readonly start: number; readonly end: number }[] {
  const horizontal = band.axis === 'horizontal';
  const edge = side < 0 ? Math.round(band.center - band.thickness / 2) : Math.round(band.center + band.thickness / 2) - 1;
  // Μέσα: μία γραμμή πιο μέσα από το όριο (η οριακή γραμμή μετά από ίσιωμα είναι μερική). Έξω: δύο γραμμές έξω.
  const inner = edge - side;
  const outside = edge + 3 * side;
  const lines = horizontal ? rows : cols;
  const ink = (line: number, a: number): boolean =>
    line >= 0 && line < lines && mask[horizontal ? line * cols + a : a * cols + line] === 1;
  const out: { start: number; end: number }[] = [];
  let open = -1;
  const a0 = Math.max(0, Math.floor(band.envelopeStart - extendPx));
  const a1 = Math.min(horizontal ? cols : rows, Math.ceil(band.envelopeEnd + extendPx));
  for (let a = a0; a <= a1; a++) {
    const face = a < a1 && ink(inner, a) && !ink(outside, a);
    if (face && open < 0) open = a;
    if (face || open < 0) continue;
    const last = out[out.length - 1];
    if (last && open - last.end <= bridgePx) last.end = a;
    else out.push({ start: open, end: a });
    open = -1;
  }
  return out.filter((p) => p.end - p.start >= minLength);
}

/**
 * Η έκταση μιας **πινελιάς**: από τα άκρα-διαμέσους, κάθε γραμμή σάρωσης του πυρήνα της συνεχίζει όσο είναι
 * **συνεχές** μελάνι, μέσα στην περιβάλλουσα ± `extendPx`. Κρατιέται η μακρύτερη. Μόνο μεγαλώνει, ποτέ δεν μικραίνει.
 *
 * Γιατί όχι ο διάμεσος: σε ζώνη **δύο** γραμμών ο διάμεσος είναι ο μέσος όρος. Μετά το ίσιωμα, μια πινελιά 2 px είναι
 * μία συμπαγής γραμμή και μία μερική, σπασμένη κοντά στο άκρο. Ο μέσος όρος τραβούσε το άκρο 6–25 px μέσα, και η
 * γωνία L δεν κρινόταν (μετρημένο: ADR-929 §6.3 #6, −11° σε περιγραμμένη κάτοψη). Γιατί όχι η περιβάλλουσα σκέτη:
 * μια κουκκίδα θορύβου που ακουμπά μια γραμμή θα την επέκτεινε· εδώ μετρά μόνο το συνεχές μελάνι από το άκρο.
 *
 * `extendPx > 0`: η `mask` είναι **πληρέστερη** από εκείνη όπου βρέθηκε η ζώνη, όπως το `extendPx` του
 * {@link bandEdgeExposure}. Η ζώνη μιας λοξής πινελιάς βρίσκεται στο υπόλοιπο μελάνι, όπου ο αξονικός γείτονας έχει
 * σβηστεί με περιθώριο, και σταματούσε (πινελιά/2 + περιθώριο) / sin θ πριν από αυτόν (μετρημένο: 3–5 px σε κόμβο
 * 45°). Στο πλήρες μελάνι συνεχίζει μέσα στη γειτονική και σταματά στο **εξωτερικό** της όριο, όπως μια αξονική.
 * Συνεχής χώρος px.
 */
export function strokeExtent(
  mask: Uint8Array, cols: number, rows: number, band: AxisBand, extendPx = 0,
): { readonly start: number; readonly end: number } {
  const horizontal = band.axis === 'horizontal';
  const lines = horizontal ? rows : cols;
  const lo = Math.max(0, Math.floor(band.envelopeStart - extendPx));
  const hi = Math.min(horizontal ? cols : rows, Math.ceil(band.envelopeEnd + extendPx));
  const first = Math.max(0, Math.floor(band.center - band.thickness / 2));
  const last = Math.min(lines - 1, Math.ceil(band.center + band.thickness / 2) - 1);
  let start = band.start;
  let end = band.end;
  for (let line = first; line <= last; line++) {
    const ink = (a: number): boolean => mask[horizontal ? line * cols + a : a * cols + line] === 1;
    // Μόνο μελάνι μετρά: χωρίς αυτό η στρογγυλοποίηση του διαμέσου θα «μάκραινε» τη ζώνη ως 1 px χωρίς λόγο.
    const a0 = Math.floor(band.start);
    let a = a0;
    while (a - 1 >= lo && ink(a - 1)) a--;
    const b0 = Math.ceil(band.end);
    let b = b0;
    while (b < hi && ink(b)) b++;
    if (a < a0) start = Math.min(start, a);
    if (b > b0) end = Math.max(end, b);
  }
  return { start, end };
}

/**
 * Σβήνει (`0`) το αποτύπωμα κάθε ζώνης στη μάσκα, με περιθώριο `margin` px γύρω του: ό,τι εξήγησε μια ζώνη δεν
 * ξαναμετράει σε επόμενο πέρασμα (π.χ. στο υπόλοιπο μελάνι όπου ψάχνονται οι λοξοί τοίχοι).
 */
export function eraseBands(mask: Uint8Array, cols: number, rows: number, bands: readonly AxisBand[], margin: number): void {
  for (const b of bands) {
    const a0 = Math.max(0, Math.floor(b.start - margin));
    const a1 = Math.min(b.axis === 'horizontal' ? cols : rows, Math.ceil(b.end + margin));
    const c0 = Math.max(0, Math.floor(b.center - b.thickness / 2 - margin));
    const c1 = Math.min(b.axis === 'horizontal' ? rows : cols, Math.ceil(b.center + b.thickness / 2 + margin));
    for (let c = c0; c < c1; c++) {
      for (let a = a0; a < a1; a++) mask[b.axis === 'horizontal' ? c * cols + a : a * cols + c] = 0;
    }
  }
}

/** Λεπτή ζώνη ως τόσες γραμμές μπορεί να είναι κρόσσι παχιάς ζώνης. */
const FRINGE_MAX_LINES = 2;

/**
 * `true` όταν η `b` κάθεται πάνω στο όριο της παχιάς `a`, μέσα στην έκτασή της. Μόνο παχιές ζώνες φιλοξενούν κρόσσια:
 * δοκιμάστηκε και «σαφώς μακρύτερη» (ώστε να καθαρίζουν και οι πινελιές των 2 px) και **χειροτέρεψε** τα άκρα των
 * περιγραμμένων τοίχων κατά 3–4 px (μετρημένο στη Φ2): το κρόσσι μιας πινελιάς απέχει όσο η ίδια η πινελιά.
 */
function isFringeOf(b: AxisBand, a: AxisBand): boolean {
  if (b === a || b.lines > FRINGE_MAX_LINES || a.lines <= FRINGE_MAX_LINES) return false;
  if (b.envelopeStart < a.envelopeStart - 1 || b.envelopeEnd > a.envelopeEnd + 1) return false;
  const gap = Math.abs(b.center - a.center) - (a.thickness + b.thickness) / 2;
  return gap <= 1 && gap >= -b.thickness;
}

function absorb(a: AxisBand, fringe: readonly AxisBand[]): AxisBand {
  const length = a.end - a.start;
  let area = a.thickness * length;
  let weighted = a.center * area;
  let lines = a.lines;
  for (const b of fringe) {
    const bArea = b.thickness * (b.end - b.start);
    area += bArea;
    weighted += b.center * bArea;
    lines += b.lines;
  }
  // Η πλήρωση μένει του πυρήνα: μετρά τρύπες στο σώμα, και οι μερικές γραμμές του ορίου θα την έριχναν κάτω από το
  // κατώφλι γεμίσματος (μετρημένο στη Φ2: ο γεμάτος τοίχος διαβαζόταν ως πινελιά).
  return { ...a, center: weighted / area, thickness: area / length, lines };
}

/**
 * Μετά το ίσιωμα, οι οριακές γραμμές ενός γεμάτου τοίχου είναι **μερικές** (φάση pixel της παρεμβολής): χωρίζονται σε
 * κοντές λεπτές ζώνες δίπλα στη μεγάλη. Τότε η μεγάλη βγαίνει λειψή (μετρημένο στη Φ2: 239 αντί 250 mm) και τα
 * κρόσσια γεννούν θραύσματα παρειών. Εδώ κάθε κρόσσι επιστρέφει στη ζώνη του.
 */
function absorbFringes(bands: readonly AxisBand[]): AxisBand[] {
  const owner = new Map<AxisBand, AxisBand>();
  for (const b of bands) {
    const host = bands.find((a) => isFringeOf(b, a));
    if (host) owner.set(b, host);
  }
  return bands
    .filter((b) => !owner.has(b))
    .map((a) => {
      const fringe = bands.filter((b) => owner.get(b) === a);
      return fringe.length === 0 ? a : absorb(a, fringe);
    });
}

/**
 * Οι ζώνες ενός άξονα σε μάσκα μελανιού (`1` = μελάνι), γραμμή-γραμμή. Δύο συγγραμμικοί τοίχοι εκατέρωθεν ενός
 * ανοίγματος δίνουν δύο ζώνες· μια ζώνη που δεν συνεχίζεται στην επόμενη γραμμή κλείνει.
 */
export function axisBands(
  mask: Uint8Array, cols: number, rows: number, axis: RunAxis, options: AxisBandOptions,
): AxisBand[] {
  const done: AxisBand[] = [];
  let open: OpenBand[] = [];
  let line = -1;
  let runs: Run[] = [];
  const flush = (): void => {
    if (line < 0) return;
    const { groups, orphans } = groupByBand(open.filter((b) => b.lastLine === line - 1), runs);
    for (const [band, rs] of groups) orphans.push(...continueBand(band, line, rs, options.minOverlap));
    for (const b of open) if (b.lastLine !== line) done.push(closeBand(b, axis));
    open = [...open.filter((b) => b.lastLine === line), ...orphans.map((r) => openBand(line, r))];
    runs = [];
  };
  forEachRun(mask, cols, rows, axis, options.minLength, (l, start, end) => {
    if (l !== line) {
      flush();
      line = l;
    }
    runs.push({ start, end });
  });
  flush();
  for (const b of open) done.push(closeBand(b, axis));
  return absorbFringes(done);
}
