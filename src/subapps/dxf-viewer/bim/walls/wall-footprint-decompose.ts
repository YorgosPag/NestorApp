/**
 * ADR-363 — αποσύνθεση ΟΡΘΟΓΩΝΙΚΟΥ αποτυπώματος τοίχων σε ΜΕΜΟΝΩΜΕΝΟΥΣ τοίχους (pure).
 *
 * ΓΙΑΤΙ ΝΕΟ (και όχι `decomposeRectilinear`): το slab-sweep του
 * `perimeter-polygon-math` κόβει έναν τοίχο σε ΛΩΡΙΔΕΣ ΚΑΤΑ ΜΗΚΟΣ του (παράγει
 * λεπτούς τοίχους που ακουμπούν παρειά-με-παρειά στη ΜΕΓΑΛΗ πλευρά) — παράλογο για
 * τοίχους. Ένας τοίχος = ΖΕΥΓΟΣ παράλληλων αντικριστών παρειών σε σταθερή απόσταση
 * (= πάχος), με άξονα (μεσογραμμή) κατά μήκος. Κόβουμε στους κόμβους (T/L/X) και στις
 * αλλαγές πάχους· κάθε τοίχος κρατά ΟΛΟ το πάχος του· οι τοίχοι ενώνονται στα ΑΚΡΑ.
 *
 * Κανόνας κυριότητας κόμβου: όπου δύο τοίχοι επικαλύπτονται σε κόμβο, ο ΜΑΚΡΥΤΕΡΟΣ
 * (κύριος/συνεχής) κερδίζει το κοινό τετράγωνο· ο κοντύτερος (απόφυση) σταματά στην
 * παρειά του μακρύτερου.
 *
 * ΠΡΟΣΕΓΓΙΣΗ: στρέφουμε στο τοπικό axis-aligned πλαίσιο (μεγαλύτερη ακμή → άξονας X),
 * χτίζουμε κάναβο από τις μοναδικές x/y των κορυφών, μαρκάρουμε συμπαγή κελιά, και για
 * κάθε κελί συγκρίνουμε το ΟΡΙΖΟΝΤΙΟ συμπαγές run με το ΚΑΤΑΚΟΡΥΦΟ → το κελί ανήκει
 * στον τοίχο με το μεγαλύτερο run (μακρύτερος κερδίζει τον κόμβο). Οριζόντιοι τοίχοι =
 * συγχώνευση κελιών κατά X· κατακόρυφοι = κατά Y. Επιστρέφει `[]` για μη-ορθογωνικό
 * πολύγωνο (γωνίες ≠ 90°).
 *
 * @see ./perimeter-polygon-math.ts (slab-sweep — ΛΑΘΟΣ για τοίχους, βλ. παραπάνω)
 * @see ./wall-in-region.ts (τύπος `DetectedRectangle`)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DetectedRectangle } from './wall-in-region';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import type { LocalRect } from './perimeter-polygon-math';
import { rotate, rectCorners, toLocalFrame, uniqueSorted } from './perimeter-polygon-math';

/** Προσανατολισμός τοίχου στον οποίο ανατέθηκε ένα κελί καννάβου. */
type Orient = 'H' | 'V' | 'none';

/** Κελλοποιημένος κάναβος από τις μοναδικές x/y των κορυφών + συμπάγεια/ανάθεση. */
interface Grid {
  readonly xs: number[];
  readonly ys: number[];
  readonly solid: boolean[][];
  readonly assign: Orient[][];
}

/** Λωρίδα προς συγχώνευση: `primary` = δείκτης σάρωσης, `[lo,hi]` = κάθετο run. */
interface Strip {
  primary: number;
  lo: number;
  hi: number;
}

// ─── Grid construction ───────────────────────────────────────────────────────

/** Κάναβος από τις μοναδικές x/y· κελί συμπαγές αν το κέντρο του είναι εντός. */
function buildGrid(local: Point2D[], tol: number): Grid {
  const xs = uniqueSorted(local.map((p) => p.x), tol);
  const ys = uniqueSorted(local.map((p) => p.y), tol);
  const cols = Math.max(0, xs.length - 1);
  const rows = Math.max(0, ys.length - 1);
  const solid: boolean[][] = [];
  const assign: Orient[][] = [];
  for (let i = 0; i < cols; i++) {
    solid[i] = [];
    assign[i] = [];
    const cx = (xs[i] + xs[i + 1]) / 2;
    for (let j = 0; j < rows; j++) {
      const cy = (ys[j] + ys[j + 1]) / 2;
      solid[i][j] = isPointInPolygon({ x: cx, y: cy }, local);
      assign[i][j] = 'none';
    }
  }
  return { xs, ys, solid, assign };
}

// ─── Solid-run measurement + orientation assignment ──────────────────────────

/** Μήκος κατακόρυφου συμπαγούς run που περνά από το κελί (i,j) — υποψήφιο μήκος. */
function vRunLen(grid: Grid, i: number, j: number): number {
  let j0 = j;
  let j1 = j;
  const maxJ = grid.ys.length - 2;
  while (j0 > 0 && grid.solid[i][j0 - 1]) j0--;
  while (j1 < maxJ && grid.solid[i][j1 + 1]) j1++;
  return grid.ys[j1 + 1] - grid.ys[j0];
}

/** Μήκος οριζόντιου συμπαγούς run που περνά από το κελί (i,j) — υποψήφιο μήκος. */
function hRunLen(grid: Grid, i: number, j: number): number {
  let i0 = i;
  let i1 = i;
  const maxI = grid.xs.length - 2;
  while (i0 > 0 && grid.solid[i0 - 1][j]) i0--;
  while (i1 < maxI && grid.solid[i1 + 1][j]) i1++;
  return grid.xs[i1 + 1] - grid.xs[i0];
}

/** Συμπαγές κελί εντός ορίων (out-of-bounds = μη-συμπαγές). */
function isSolidCell(grid: Grid, i: number, j: number): boolean {
  const cols = grid.xs.length - 1;
  const rows = grid.ys.length - 1;
  return i >= 0 && j >= 0 && i < cols && j < rows && grid.solid[i][j];
}

/**
 * Ανάθεση κάθε συμπαγούς κελιού σε H/V.
 *
 * ADR-419 §T-junction (Giorgio 2026-07-03) — **ΔΙΑΜΠΕΡΗΣ κερδίζει, ΤΕΡΜΑΤΙΖΩΝ κολλάει**
 * (Revit T-junction), ΑΝΕΞΑΡΤΗΤΑ μήκους: ένα κελί όπου ο τοίχος συνεχίζεται (συμπαγή κελιά)
 * **ΚΑΙ στις δύο** πλευρές κατά μία διεύθυνση = διαμπερής σε εκείνη· αν συνεχίζεται μόνο στη
 * ΜΙΑ πλευρά = τερματίζει εκεί. Στο junction κερδίζει ο διαμπερής → ο μεγάλος οριζόντιος
 * ΔΕΝ σπάει από έναν **ψηλότερο** κάθετο κορμό (πριν: «μακρύτερος κερδίζει» → ο ψηλός κορμός
 * διέκοπτε τον οριζόντιο, άφηνε ασχημάτιστο κομμάτι). Ισοπαλία (σταυρός/άκρο, ή κανένας
 * διαμπερής) → μακρύτερο run (η προηγούμενη συμπεριφορά, μηδέν regression για L/Τ-έκεντρα).
 */
function assignOrientations(grid: Grid): void {
  const cols = grid.xs.length - 1;
  const rows = grid.ys.length - 1;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (!grid.solid[i][j]) continue;
      const hThrough = isSolidCell(grid, i - 1, j) && isSolidCell(grid, i + 1, j);
      const vThrough = isSolidCell(grid, i, j - 1) && isSolidCell(grid, i, j + 1);
      if (hThrough && !vThrough) grid.assign[i][j] = 'H';
      else if (vThrough && !hThrough) grid.assign[i][j] = 'V';
      else grid.assign[i][j] = hRunLen(grid, i, j) >= vRunLen(grid, i, j) ? 'H' : 'V';
    }
  }
}

// ─── Strip collection + merge ────────────────────────────────────────────────

/** Λωρίδες οριζόντιων τοίχων: ανά στήλη i, μέγιστα κατακόρυφα runs H-κελιών. */
function collectHStrips(grid: Grid): Strip[] {
  const cols = grid.xs.length - 1;
  const rows = grid.ys.length - 1;
  const strips: Strip[] = [];
  for (let i = 0; i < cols; i++) {
    let j = 0;
    while (j < rows) {
      if (grid.assign[i][j] !== 'H') {
        j++;
        continue;
      }
      let hi = j;
      while (hi + 1 < rows && grid.assign[i][hi + 1] === 'H') hi++;
      strips.push({ primary: i, lo: j, hi });
      j = hi + 1;
    }
  }
  return strips;
}

/** Λωρίδες κατακόρυφων τοίχων: ανά γραμμή j, μέγιστα οριζόντια runs V-κελιών. */
function collectVStrips(grid: Grid): Strip[] {
  const cols = grid.xs.length - 1;
  const rows = grid.ys.length - 1;
  const strips: Strip[] = [];
  for (let j = 0; j < rows; j++) {
    let i = 0;
    while (i < cols) {
      if (grid.assign[i][j] !== 'V') {
        i++;
        continue;
      }
      let hi = i;
      while (hi + 1 < cols && grid.assign[hi + 1][j] === 'V') hi++;
      strips.push({ primary: j, lo: i, hi });
      i = hi + 1;
    }
  }
  return strips;
}

/** Συγχώνευση λωρίδων με ίδιο κάθετο run [lo,hi] και διαδοχικό `primary` → rects. */
function mergeStrips(
  strips: readonly Strip[],
  build: (pStart: number, pEnd: number, lo: number, hi: number) => LocalRect,
): LocalRect[] {
  const groups = new Map<string, Strip[]>();
  for (const s of strips) {
    const key = `${s.lo}:${s.hi}`;
    const bucket = groups.get(key) ?? groups.set(key, []).get(key)!;
    bucket.push(s);
  }
  const out: LocalRect[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.primary - b.primary);
    let start = g[0].primary;
    let end = g[0].primary;
    for (let k = 1; k < g.length; k++) {
      if (g[k].primary === end + 1) end = g[k].primary;
      else {
        out.push(build(start, end, g[0].lo, g[0].hi));
        start = g[k].primary;
        end = g[k].primary;
      }
    }
    out.push(build(start, end, g[0].lo, g[0].hi));
  }
  return out;
}

// ─── LocalRect → DetectedRectangle ───────────────────────────────────────────

function toDetectedRect(r: LocalRect, ang: number, orient: 'H' | 'V'): DetectedRectangle {
  // ADR-419 §T-junction — ΡΗΤΟΣ άξονας από τον γνωστό προσανατολισμό: H → κατά X (μεσοκάθετο
  // στο y-κέντρο), V → κατά Y (στο x-κέντρο). Κρίσιμο για κοντό-χοντρό stub (μήκος < πάχος):
  // ο άξονας μένει ΚΑΘΕΤΟΣ στον γείτονα ανεξάρτητα ποια πλευρά είναι μεγαλύτερη.
  const yc = (r.y0 + r.y1) / 2;
  const xc = (r.xa + r.xb) / 2;
  const axis: [Point2D, Point2D] =
    orient === 'H'
      ? [rotate({ x: r.xa, y: yc }, ang), rotate({ x: r.xb, y: yc }, ang)]
      : [rotate({ x: xc, y: r.y0 }, ang), rotate({ x: xc, y: r.y1 }, ang)];
  return { ...rectCorners(r, ang), axis };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Αποσυνθέτει ΟΡΘΟΓΩΝΙΚΟ αποτύπωμα τοίχων σε μεμονωμένους τοίχους — κάθε
 * `DetectedRectangle` είναι ΕΝΑΣ τοίχος: `longSide` = μήκος (κατά τον άξονα),
 * `shortSide` = πάχος (απόσταση των δύο παράλληλων παρειών), `polygon` = 4 κορυφές.
 * Κόβει σε κόμβους (T/L/X) και αλλαγές πάχους· ο μακρύτερος τοίχος κερδίζει τον κόμβο.
 * Επιστρέφει `[]` αν το πολύγωνο δεν είναι ορθογωνικό (γωνίες ≠ 90°).
 */
export function decomposeWallsFromFootprint(
  polygon: readonly Point2D[],
  tol: number,
): DetectedRectangle[] {
  const frame = toLocalFrame(polygon, tol);
  if (!frame) return [];
  const { local, ang } = frame;
  const grid = buildGrid(local, tol);
  assignOrientations(grid);
  const { xs, ys } = grid;
  const hRects = mergeStrips(collectHStrips(grid), (iS, iE, j0, j1) => ({
    xa: xs[iS],
    xb: xs[iE + 1],
    y0: ys[j0],
    y1: ys[j1 + 1],
  }));
  const vRects = mergeStrips(collectVStrips(grid), (jS, jE, i0, i1) => ({
    xa: xs[i0],
    xb: xs[i1 + 1],
    y0: ys[jS],
    y1: ys[jE + 1],
  }));
  const keep = (r: LocalRect): boolean => r.xb - r.xa > tol && r.y1 - r.y0 > tol;
  return [
    ...hRects.filter(keep).map((r) => toDetectedRect(r, ang, 'H')),
    ...vRects.filter(keep).map((r) => toDetectedRect(r, ang, 'V')),
  ];
}
