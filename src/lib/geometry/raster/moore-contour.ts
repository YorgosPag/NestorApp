/**
 * =============================================================================
 * MOORE-NEIGHBOUR ΠΕΡΙΓΡΑΜΜΑ (SSoT) — εξωτερικό όριο γεμάτης περιοχής δυαδικού πλέγματος
 * =============================================================================
 *
 * Μεταφέρθηκε **αυτούσιο** από το `dxf-viewer/bim/mesh-library/mesh-silhouette.ts` (ADR-411 / ADR-683), που το
 * εισάγει πλέον από εδώ (ADR-884 §4.14 Γ3): η ανίχνευση χώρων της περιήγησης τρέχει τον ίδιο αλγόριθμο πάνω στην
 * κάτοψη και δεν επιτρέπεται να εισάγει από το subapp (CHECK 3.62).
 *
 * Έξοδος: κελιά `[col, row]` στη σειρά του ορίου (ένας βρόχος, δεξιόστροφα σε συντεταγμένες πλέγματος με τη γραμμή
 * προς τα κάτω). Οι τρύπες **δεν** ανιχνεύονται — ακολουθείται μόνο το εξωτερικό όριο.
 *
 * @module lib/geometry/raster/moore-contour
 */

import { floodFillMask, NEIGHBOURS_8 } from './flood-fill';

/** Αφαιρεί διαδοχικά ίδια κελιά (το ίχνος περνά δύο φορές από ισθμούς ενός κελιού). */
function dedupeConsecutive(pts: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

/** Πρώτο γεμάτο κελί σε σάρωση γραμμής (χαμηλότερη γραμμή, μετά χαμηλότερη στήλη) — ή `null`. */
function firstFilledCell(grid: Uint8Array, cols: number, rows: number): [number, number] | null {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r * cols + c] === 1) return [c, r];
    }
  }
  return null;
}

/**
 * Moore-neighbour ίχνος με ρητή τήρηση του κελιού επιστροφής (backtrack). Επιστρέφει τα κελιά του εξωτερικού
 * ορίου της περιοχής που αρχίζει στο πρώτο γεμάτο κελί (ένας βρόχος).
 */
export function traceOuterContour(grid: Uint8Array, cols: number, rows: number): Array<[number, number]> {
  const at = (c: number, r: number): boolean =>
    c >= 0 && c < cols && r >= 0 && r < rows && grid[r * cols + c] === 1;
  const start = firstFilledCell(grid, cols, rows);
  if (!start) return [];
  const [sc, sr] = start;
  const contour: Array<[number, number]> = [];
  let cc = sc, cr = sr;
  // Κελί επιστροφής = το (άδειο) κελί που εξετάστηκε πριν την αρχή — ο δυτικός γείτονας.
  let bc = sc - 1, br = sr;
  const maxSteps = cols * rows * 8;
  let steps = 0;
  do {
    contour.push([cc, cr]);
    let bIdx = NEIGHBOURS_8.findIndex((d) => d[0] === bc - cc && d[1] === br - cr);
    if (bIdx < 0) bIdx = 4;
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const dir = (bIdx + k) % 8;
      const nc = cc + NEIGHBOURS_8[dir][0];
      const nr = cr + NEIGHBOURS_8[dir][1];
      if (at(nc, nr)) {
        // Νέο κελί επιστροφής = το τελευταίο (άδειο) κελί πριν το εύρημα.
        const pdir = (dir + 7) % 8;
        bc = cc + NEIGHBOURS_8[pdir][0]; br = cr + NEIGHBOURS_8[pdir][1];
        cc = nc; cr = nr;
        found = true;
        break;
      }
    }
    if (!found) break; // απομονωμένο κελί
    if (++steps > maxSteps) break;
  } while (!(cc === sc && cr === sr));
  return dedupeConsecutive(contour);
}

/**
 * Εξωτερικό όριο **κάθε** συνιστώσας (8-γειτονιά): κάθε συνιστώσα γεμίζει πρώτα σε δική της μάσκα, ώστε το
 * {@link traceOuterContour} να ακολουθεί ακριβώς εκείνη. Βρόχοι κάτω από 4 κελιά παραλείπονται.
 */
export function traceComponentContours(
  grid: Uint8Array, cols: number, rows: number,
): Array<Array<[number, number]>> {
  const visited = new Uint8Array(cols * rows);
  const contours: Array<Array<[number, number]>> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r * cols + c] !== 1 || visited[r * cols + c]) continue;
      const mask = floodFillMask(grid, cols, rows, c, r, { connectivity: 8, visited });
      const contour = traceOuterContour(mask, cols, rows);
      if (contour.length >= 4) contours.push(contour);
    }
  }
  return contours;
}
