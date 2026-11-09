/**
 * **Διάταξη του φύλλου** (ADR-929 Φ1, Δ15 #4): πλαίσιο σχεδίου, περιοχή σχεδίου, και υποψήφιες **πινακίδες /
 * υπομνήματα** — οι περιοχές με ιδιοκτήτη, διεύθυνση, ΑΦΜ, σφραγίδες, που κόβονται στον πελάτη πριν φύγει η εικόνα.
 *
 * 🔑 **Πλαίσιο** = τέσσερις μακριές γραμμές (≥ μισό φύλλο) μέσα στη ζώνη των άκρων, που **ενώνονται**: η πάνω γραμμή
 *   καλύπτει ≥ 80% του πλάτους ανάμεσα στην αριστερή και τη δεξιά. Χωρίς αυτόν τον έλεγχο, ένας μακρύς τοίχος κοντά στην
 *   άκρη θα λεγόταν «πλαίσιο».
 * 🔑 **Πινακίδα** (ISO 7200 · οι πινακίδες των ελληνικών αδειών) = **πίνακας**: ορθογώνια κελιά από γραμμές, με κείμενο,
 *   κολλημένα στο πλαίσιο. Τα κελιά βρίσκονται ως συνιστώσες του **συμπληρώματος** των γραμμών του πίνακα, κρατιούνται όσα
 *   είναι σχεδόν τέλεια ορθογώνια, ομαδοποιούνται κατά γειτνίαση, και μια ομάδα γίνεται υποψήφια **μόνο** αν ακουμπά το
 *   πλαίσιο. Τα δωμάτια μιας κάτοψης είναι κι αυτά ορθογώνια κελιά, αλλά **δεν** ακουμπούν το πλαίσιο (η κάτοψη έχει
 *   περιθώριο): αυτό τα ξεχωρίζει.
 * 🔑 **Χωρίς πλαίσιο** (σάρωση, ADR-929 §6.10 #2): δεν υπάρχει πλαίσιο να ακουμπήσει, και το περιθώριο της σάρωσης είναι
 *   τυχαίο. Μια πλευρά του πίνακα είναι ακραία όταν **δεν ζει τίποτα πέρα από αυτήν** — μετά το δικό του περίγραμμα και
 *   πριν από την άκρη του φύλλου — με το ίδιο «τίποτα» (`FRAME_MAX_OUTSIDE_INK`) που κρίνει το έξω από το πλαίσιο.
 * ⚠️ Δεν κόβει τίποτα. Επιστρέφει υποψήφιες με βεβαιότητα και λόγο· ο άνθρωπος βλέπει και διορθώνει πριν την αποστολή.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/sheet-layout
 */

import { createDisjointSets } from '@/lib/algorithms/disjoint-sets';
import type { Homography } from '@/lib/geometry/homography';
import { componentStats, type CellBox } from '@/lib/geometry/raster/component-stats';
import { longLines, longRuns } from '@/lib/geometry/raster/run-length-filter';
import { planRegion } from './alignment-region';
import type { AlignedRectPx, AnnotationBlock, SheetLayout } from './plan-alignment-types';

type Side = AnnotationBlock['anchoredTo'][number];

/** Ζώνη των άκρων όπου ψάχνεται το πλαίσιο (κλάσμα της διάστασης). */
const FRAME_BAND = 0.12;
const FRAME_MIN_RUN = 0.5;
const FRAME_MIN_COVERAGE = 0.8;
/** Μέγιστο πάχος γραμμής πλαισίου: κλάσμα της μικρής διάστασης (με κατώτατο σε px για μικρές εικόνες). */
const FRAME_MAX_THICKNESS = 0.015;
const FRAME_MIN_THICKNESS_PX = 4;
/** Έξω από το πλαίσιο: ως 0,2% μελάνι (σκόνη σαρωτή, σημάδια κοπής) — όχι διαστάσεις ή κείμενο. */
const FRAME_MAX_OUTSIDE_INK = 0.002;
/**
 * Δίδυμη εσωτερική γραμμή (ADR-929 Φ2): ως πού μέσα από κάθε πλευρά ψάχνεται (κλάσμα της μικρής διάστασης), από
 * ποιο μήκος μετρά μια διαδρομή, και πόσο της πλευράς πρέπει να καλύπτει. Ο εξωτερικός περιγραμμένος τοίχος έχει
 * εσωτερική παρειά σε απόσταση πάχους (25–90 cm, δηλαδή λίγα % του σχεδίου) **και στις τέσσερις** πλευρές.
 */
const FRAME_TWIN_REACH = 0.08;
const FRAME_TWIN_MIN_RUN = 0.1;
const FRAME_TWIN_COVERAGE = 0.6;
/** Γραμμές πίνακα: ελάχιστο μήκος ως κλάσμα της μικρής διάστασης. */
const TABLE_LINE = 0.04;
const CELL_RECTANGULARITY = 0.9;
const CELL_MIN_AREA = 0.0004;
const CELL_MAX_SPAN = 0.6;
/**
 * Λωρίδα πέρα από πίνακα χωρίς πλαίσιο (ADR-929 §6.10 #2): γραμμή με κάλυψη πάνω από 1% της πλευράς είναι **μελάνι**,
 * κάτω από αυτό χαρτί με σκόνη. Μετρημένο σε **μία** σάρωση: σκόνη ≤ 0,3% ανά γραμμή · σχέδιο ≥ 4,6%.
 */
const STRIP_LINE_MAX_COVER = 0.01;
/** Ανοχή γειτνίασης/επαφής ως κλάσμα της μικρής διάστασης. */
const TOUCH = 0.02;
const MAX_CELLS = 500;

interface Grid { readonly ink: Uint8Array; readonly cols: number; readonly rows: number }

/** Οι γραμμές (ή στήλες) που περιέχουν μακριά διαδρομή, ως πίνακας σημαιών. */
function linesWithRuns(runs: Uint8Array, g: Grid, axis: 'row' | 'col'): Uint8Array {
  const n = axis === 'row' ? g.rows : g.cols;
  const has = new Uint8Array(n);
  for (let i = 0; i < runs.length; i++) if (runs[i]) has[axis === 'row' ? Math.floor(i / g.cols) : i % g.cols] = 1;
  return has;
}

/** Η πρώτη ζώνη γραμμών από μία πλευρά (`step = ±1`): εξωτερική και εσωτερική άκρη — ή `null`. */
function edgeBand(has: Uint8Array, from: number, step: 1 | -1, band: number): { readonly outer: number; readonly inner: number } | null {
  let i = from;
  while (Math.abs(i - from) < band && !has[i]) i += step;
  if (Math.abs(i - from) >= band) return null;
  const outer = i;
  while (i + step >= 0 && i + step < has.length && has[i + step]) i += step;
  return { outer, inner: i };
}

function coverage(runs: Uint8Array, g: Grid, row: number, from: number, to: number): number {
  let on = 0;
  for (let x = from; x <= to; x++) on += runs[row * g.cols + x];
  return to > from ? on / (to - from + 1) : 0;
}

function columnCoverage(runs: Uint8Array, g: Grid, col: number, from: number, to: number): number {
  let on = 0;
  for (let y = from; y <= to; y++) on += runs[y * g.cols + col];
  return to > from ? on / (to - from + 1) : 0;
}

interface FrameSides {
  readonly top: { readonly inner: number };
  readonly bottom: { readonly inner: number };
  readonly left: { readonly inner: number };
  readonly right: { readonly inner: number };
}

/**
 * `true` όταν **και οι τέσσερις** πλευρές έχουν, λίγο πιο μέσα, παράλληλη γραμμή που καλύπτει το μεγαλύτερο μέρος
 * τους: είναι εξωτερικός τοίχος με την εσωτερική του παρειά, όχι πλαίσιο φύλλου.
 */
function isOuterWallOutline(g: Grid, s: FrameSides): boolean {
  const reach = Math.max(2, Math.round(Math.min(g.cols, g.rows) * FRAME_TWIN_REACH));
  const h = longRuns(g.ink, g.cols, g.rows, 'horizontal', Math.round(g.cols * FRAME_TWIN_MIN_RUN));
  const v = longRuns(g.ink, g.cols, g.rows, 'vertical', Math.round(g.rows * FRAME_TWIN_MIN_RUN));
  const twin = (cover: (line: number) => number, edge: number, step: 1 | -1, limit: number): boolean => {
    for (let k = 1; k <= reach; k++) {
      const line = edge + step * k;
      if (line < 0 || line >= limit) return false;
      if (cover(line) >= FRAME_TWIN_COVERAGE) return true;
    }
    return false;
  };
  const row = (line: number) => coverage(h, g, line, s.left.inner, s.right.inner);
  const col = (line: number) => columnCoverage(v, g, line, s.top.inner, s.bottom.inner);
  return twin(row, s.top.inner, 1, g.rows) && twin(row, s.bottom.inner, -1, g.rows)
    && twin(col, s.left.inner, 1, g.cols) && twin(col, s.right.inner, -1, g.cols);
}

/** Κλειστό ορθογώνιο σε px πλέγματος: `[x0, x1] × [y0, y1]`. */
interface PixelRect { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

/**
 * **Μελάνι σε ορθογώνιο** (κλειστό, κομμένο στο πλέγμα): πλήθος px μελανιού και εμβαδόν. Η ΜΙΑ μέτρηση πίσω από το
 * «τίποτα δεν ζει έξω από το πλαίσιο» και το «τίποτα δεν ζει πέρα από την πινακίδα» (ADR-929 §6.10 #2).
 */
function inkInRect(g: Grid, r: PixelRect): { readonly ink: number; readonly area: number } {
  const x0 = Math.max(0, r.x0);
  const y0 = Math.max(0, r.y0);
  const x1 = Math.min(g.cols - 1, r.x1);
  const y1 = Math.min(g.rows - 1, r.y1);
  if (x1 < x0 || y1 < y0) return { ink: 0, area: 0 };
  let ink = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ink += g.ink[y * g.cols + x];
  return { ink, area: (x1 - x0 + 1) * (y1 - y0 + 1) };
}

/** Κλάσμα μελανιού **έξω** από το ορθογώνιο `[x0, x1] × [y0, y1]` (κλειστό). */
function inkOutside(g: Grid, x0: number, y0: number, x1: number, y1: number): number {
  const all = inkInRect(g, { x0: 0, y0: 0, x1: g.cols - 1, y1: g.rows - 1 });
  const inside = inkInRect(g, { x0, y0, x1, y1 });
  const outside = all.area - inside.area;
  return outside > 0 ? (all.ink - inside.ink) / outside : 0;
}

/** Μέγιστο πάχος **λεπτής** γραμμής φύλλου (ISO 5457), όχι τοίχου: για το πλαίσιο και για το περίγραμμα του πίνακα. */
function maxLineThickness(g: Grid): number {
  return Math.max(FRAME_MIN_THICKNESS_PX, Math.min(g.cols, g.rows) * FRAME_MAX_THICKNESS);
}

/**
 * Το **εσωτερικό** του πλαισίου (ευθυγραμμισμένα px), ή `null` όταν δεν υπάρχει κλειστό πλαίσιο.
 *
 * 🔴 **Μετρημένο σφάλμα που αυτοί οι έλεγχοι κλείνουν**: σε κάτοψη **χωρίς** πλαίσιο, με μικρό περιθώριο, οι εξωτερικοί
 *   τοίχοι του σπιτιού είναι τέσσερις μακριές γραμμές κοντά στις άκρες που ενώνονται — και διαβάζονταν ως «πλαίσιο». Η
 *   «περιοχή σχεδίου» γινόταν το **εσωτερικό** του σπιτιού: οι τοίχοι θα κόβονταν από ό,τι στέλνεται. Ένα πλαίσιο είναι
 *   (α) **λεπτή** γραμμή (ISO 5457: ≥ 0,7 mm, όχι τοίχος 25 cm) και (β) **τίποτα** δεν ζει έξω από αυτό.
 * 🔴 **Και η περιγραμμένη εκδοχή του ίδιου σφάλματος (Φ2, μετρημένο)**: ο περιγραμμένος εξωτερικός τοίχος είναι λεπτή
 *   γραμμή χωρίς τίποτα έξω της, άρα περνούσε τα (α) και (β). Τον ξεχωρίζει (γ): έχει **δίδυμη εσωτερική παρειά** σε
 *   απόσταση πάχους, και στις τέσσερις πλευρές. Ένα πλαίσιο όχι (η πινακίδα ακουμπά το πολύ δύο πλευρές).
 *   ⚠️ Υπολειπόμενο: διπλό πλαίσιο με απόσταση < 8% της μικρής διάστασης και στις τέσσερις πλευρές διαβάζεται «τοίχος».
 *   Τότε χάνεται μόνο η ανίχνευση πινακίδας. Οι γραμμές του, σε απόσταση πολύ μεγαλύτερη από τοίχο στην κλίμακα του
 *   σχεδίου, δεν γίνονται τοίχοι.
 */
export function findFrameInterior(g: Grid): AlignedRectPx | null {
  const h = longRuns(g.ink, g.cols, g.rows, 'horizontal', Math.round(g.cols * FRAME_MIN_RUN));
  const v = longRuns(g.ink, g.cols, g.rows, 'vertical', Math.round(g.rows * FRAME_MIN_RUN));
  const rows = linesWithRuns(h, g, 'row');
  const cols = linesWithRuns(v, g, 'col');
  const top = edgeBand(rows, 0, 1, Math.round(g.rows * FRAME_BAND));
  const bottom = edgeBand(rows, g.rows - 1, -1, Math.round(g.rows * FRAME_BAND));
  const left = edgeBand(cols, 0, 1, Math.round(g.cols * FRAME_BAND));
  const right = edgeBand(cols, g.cols - 1, -1, Math.round(g.cols * FRAME_BAND));
  if (top === null || bottom === null || left === null || right === null) return null;
  if (right.inner - left.inner < 2 || bottom.inner - top.inner < 2) return null;
  const maxThickness = maxLineThickness(g);
  const thin = [top, bottom, left, right].every((b) => Math.abs(b.inner - b.outer) + 1 <= maxThickness);
  const joined = coverage(h, g, top.inner, left.inner, right.inner) >= FRAME_MIN_COVERAGE
    && coverage(h, g, bottom.inner, left.inner, right.inner) >= FRAME_MIN_COVERAGE;
  if (!thin || !joined) return null;
  if (inkOutside(g, left.outer, top.outer, right.outer, bottom.outer) > FRAME_MAX_OUTSIDE_INK) return null;
  if (isOuterWallOutline(g, { top, bottom, left, right })) return null;
  return { minX: left.inner + 1, minY: top.inner + 1, maxX: right.inner, maxY: bottom.inner };
}

interface Cell { readonly box: CellBox; readonly area: number }

/** Τα σχεδόν τέλεια ορθογώνια κελιά ενός πίνακα μέσα στο `inside`. */
function tableCells(g: Grid, inside: AlignedRectPx): Cell[] {
  const minDim = Math.min(inside.maxX - inside.minX, inside.maxY - inside.minY);
  const lines = longLines(g.ink, g.cols, g.rows, Math.max(8, Math.round(minDim * TABLE_LINE)));
  const free = new Uint8Array(g.cols * g.rows);
  for (let y = Math.ceil(inside.minY); y < inside.maxY; y++) {
    for (let x = Math.ceil(inside.minX); x < inside.maxX; x++) free[y * g.cols + x] = lines[y * g.cols + x] ? 0 : 1;
  }
  const { count, areas, boxes } = componentStats(free, g.cols, g.rows, 4);
  const insideArea = (inside.maxX - inside.minX) * (inside.maxY - inside.minY);
  const cells: Cell[] = [];
  for (let l = 1; l <= count && cells.length < MAX_CELLS; l++) {
    const b = boxes[l];
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    const fits = bw <= (inside.maxX - inside.minX) * CELL_MAX_SPAN && bh <= (inside.maxY - inside.minY) * CELL_MAX_SPAN;
    if (fits && areas[l] >= insideArea * CELL_MIN_AREA && areas[l] / (bw * bh) >= CELL_RECTANGULARITY) cells.push({ box: b, area: areas[l] });
  }
  return cells;
}

const gap = (a: CellBox, b: CellBox) => Math.max(0, a.minX - b.maxX, b.minX - a.maxX, a.minY - b.maxY, b.minY - a.maxY);

/** Ομάδες κελιών κατά γειτνίαση (SSoT union-find πάνω στα πλαίσια, ADR-929 §6.9 #20). */
function clusterCells(cells: readonly Cell[], tol: number): Cell[][] {
  const sets = createDisjointSets(cells.length);
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) if (gap(cells[i].box, cells[j].box) <= tol) sets.union(i, j);
  }
  return sets.groups().map((group) => group.map((i) => cells[i]));
}

function unionBox(cells: readonly Cell[]): AlignedRectPx {
  return {
    minX: Math.min(...cells.map((c) => c.box.minX)), minY: Math.min(...cells.map((c) => c.box.minY)),
    maxX: Math.max(...cells.map((c) => c.box.maxX)) + 1, maxY: Math.max(...cells.map((c) => c.box.maxY)) + 1,
  };
}

function touchedSides(box: AlignedRectPx, inside: AlignedRectPx, tol: number): Side[] {
  const sides: Side[] = [];
  if (box.minY - inside.minY <= tol) sides.push('top');
  if (inside.maxX - box.maxX <= tol) sides.push('right');
  if (inside.maxY - box.maxY <= tol) sides.push('bottom');
  if (box.minX - inside.minX <= tol) sides.push('left');
  return sides;
}

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
interface TableSides {
  readonly region: AlignedRectPx;
  readonly outermost: readonly Side[];
}

/**
 * Οι πλευρές του πίνακα (ADR-929 §6.10 #2). Η **περιοχή** περιλαμβάνει το δικό του περίγραμμα: η ένωση των κελιών το
 * αφήνει έξω, και μετρήθηκε ότι οι γραμμές του (20 στους 20 υποψήφιους που έμεναν) γίνονταν «τοίχοι». Οι **ακραίες**
 * πλευρές κρίνονται όχι με «πόσο απέχει από την άκρη» (ISO 5457/7200 δεν ορίζουν τίποτα για φύλλο χωρίς πλαίσιο — το
 * περιθώριο της σάρωσης είναι τυχαίο) αλλά με «**υπάρχει μελάνι πέρα από αυτόν;**».
 */
function readTableSides(g: Grid, box: AlignedRectPx): TableSides {
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

/** Κλάσμα μελανιού μέσα στα κελιά (το κείμενο της πινακίδας): ούτε άδειο ούτε συμπαγές. */
function textDensity(g: Grid, cells: readonly Cell[]): number {
  let ink = 0;
  let area = 0;
  for (const { box } of cells) {
    for (let y = box.minY; y <= box.maxY; y++) for (let x = box.minX; x <= box.maxX; x++) ink += g.ink[y * g.cols + x];
    area += (box.maxX - box.minX + 1) * (box.maxY - box.minY + 1);
  }
  return area > 0 ? ink / area : 0;
}

function blockConfidence(cellCount: number, sides: readonly Side[], density: number): number {
  let score = 0.4;
  if (cellCount >= 3) score += 0.2;
  if (density >= 0.01 && density <= 0.35) score += 0.2;
  if (sides.length >= 2) score += 0.2;
  return Math.min(1, score);
}

/** **Η διάταξη του φύλλου** πάνω στη μάσκα μελανιού της ευθυγραμμισμένης εικόνας. */
export function detectSheetLayout(ink: Uint8Array, cols: number, rows: number, alignedToOriginal: Homography): SheetLayout {
  const g: Grid = { ink, cols, rows };
  const frame = findFrameInterior(g);
  const inside = frame ?? { minX: 0, minY: 0, maxX: cols, maxY: rows };
  const tol = Math.max(4, Math.round(Math.min(inside.maxX - inside.minX, inside.maxY - inside.minY) * TOUCH));
  const annotations: AnnotationBlock[] = [];
  for (const cluster of clusterCells(tableCells(g, inside), tol)) {
    const box = unionBox(cluster);
    const read = readTableSides(g, box);
    // Με πλαίσιο: η πινακίδα ακουμπά το πλαίσιο (ISO 7200). Χωρίς: «τίποτα πέρα από αυτήν» (§6.10 #2).
    const sides = frame === null ? read.outermost : touchedSides(box, inside, tol);
    if (sides.length === 0) continue;
    const confidence = blockConfidence(cluster.length, sides, textDensity(g, cluster));
    annotations.push({ region: planRegion(read.region, alignedToOriginal), confidence, cellCount: cluster.length, anchoredTo: sides });
  }
  annotations.sort((a, b) => b.confidence - a.confidence);
  return {
    frame: frame === null ? null : planRegion(frame, alignedToOriginal),
    drawing: planRegion(inside, alignedToOriginal),
    annotations,
  };
}
