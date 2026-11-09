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
 *   πριν από την άκρη του φύλλου — με το ίδιο «τίποτα» (`FRAME_MAX_OUTSIDE_INK`) που κρίνει το έξω από το πλαίσιο
 *   (`table-sides`). Επειδή αυτό ισχύει και για τα δωμάτια σπιτιού με λευκό περιθώριο, χωρίς πλαίσιο προτείνεται μόνο
 *   **πλήρης πίνακας**: πεδία + κείμενο + γωνία (`isWholeTable`).
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
import {
  FRAME_MAX_OUTSIDE_INK,
  FRAME_MIN_COVERAGE,
  columnCoverage,
  coverage,
  inkInRect,
  maxLineThickness,
  type Grid,
} from './sheet-grid';
import { readTableSides, type Side } from './table-sides';

/** Ζώνη των άκρων όπου ψάχνεται το πλαίσιο (κλάσμα της διάστασης). */
const FRAME_BAND = 0.12;
const FRAME_MIN_RUN = 0.5;
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
/** Ανοχή γειτνίασης/επαφής ως κλάσμα της μικρής διάστασης. */
const TOUCH = 0.02;
const MAX_CELLS = 500;
/** Τεκμήρια πίνακα (`tableEvidence`): πεδία, πυκνότητα κειμένου στα κελιά, πλευρές στην άκρη. */
const TABLE_MIN_CELLS = 3;
const TEXT_DENSITY_MIN = 0.01;
const TEXT_DENSITY_MAX = 0.35;
const CORNER_MIN_SIDES = 2;


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

/** Κλάσμα μελανιού **έξω** από το ορθογώνιο `[x0, x1] × [y0, y1]` (κλειστό). */
function inkOutside(g: Grid, x0: number, y0: number, x1: number, y1: number): number {
  const all = inkInRect(g, { x0: 0, y0: 0, x1: g.cols - 1, y1: g.rows - 1 });
  const inside = inkInRect(g, { x0, y0, x1, y1 });
  const outside = all.area - inside.area;
  return outside > 0 ? (all.ink - inside.ink) / outside : 0;
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

/**
 * Τα **τεκμήρια πίνακα** μιας ομάδας κελιών: (α) **πεδία** — ≥ `TABLE_MIN_CELLS` κελιά (ISO 7200: πινακίδα = πεδία, όχι
 * ένα κουτί)· (β) **κείμενο** — πυκνότητα στο `[TEXT_DENSITY_MIN, TEXT_DENSITY_MAX]`, ούτε άδειο ούτε συμπαγές·
 * (γ) **γωνία** — ≥ `CORNER_MIN_SIDES` πλευρές στην άκρη (πλαίσιο ή, χωρίς πλαίσιο, ακραίες).
 */
interface TableEvidence { readonly fields: boolean; readonly text: boolean; readonly corner: boolean }

function tableEvidence(cellCount: number, sides: readonly Side[], density: number): TableEvidence {
  return {
    fields: cellCount >= TABLE_MIN_CELLS,
    text: density >= TEXT_DENSITY_MIN && density <= TEXT_DENSITY_MAX,
    corner: sides.length >= CORNER_MIN_SIDES,
  };
}

/** Βεβαιότητα: 0,4 για το «ορθογώνια κελιά στην άκρη», +0,2 ανά τεκμήριο πίνακα. */
function blockConfidence(e: TableEvidence): number {
  return 0.4 + [e.fields, e.text, e.corner].filter(Boolean).length * 0.2;
}

/**
 * **Χωρίς πλαίσιο, πινακίδα είναι μόνο πλήρης πίνακας** (ADR-929 §6.10 #2): με πλαίσιο η επαφή μαζί του ξεχωρίζει τα
 * δωμάτια (η κάτοψη έχει περιθώριο). Χωρίς, το «τίποτα πέρα από αυτήν» ισχύει **και** για τα δωμάτια ενός σπιτιού με
 * λευκό περιθώριο — μετρημένο: 9 συνθετικά, τα δωμάτια (1–2 κελιά) έγιναν «πινακίδες» με βεβαιότητα 0,40–0,80 και οι
 * τοίχοι τους χάθηκαν· η πραγματική πινακίδα της σάρωσης έχει και τα τρία τεκμήρια (1,00).
 * ⚠️ Υπολειπόμενο: πραγματική πινακίδα χωρίς πλαίσιο με < 3 πεδία δεν προτείνεται· ο άνθρωπος τη σημειώνει στην προβολή.
 */
const isWholeTable = (e: TableEvidence): boolean => e.fields && e.text && e.corner;

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
    const evidence = tableEvidence(cluster.length, sides, textDensity(g, cluster));
    if (frame === null && !isWholeTable(evidence)) continue;
    const confidence = blockConfidence(evidence);
    annotations.push({ region: planRegion(read.region, alignedToOriginal), confidence, cellCount: cluster.length, anchoredTo: sides });
  }
  annotations.sort((a, b) => b.confidence - a.confidence);
  return {
    frame: frame === null ? null : planRegion(frame, alignedToOriginal),
    drawing: planRegion(inside, alignedToOriginal),
    annotations,
  };
}
