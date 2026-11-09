/**
 * **Το πλέγμα μελανιού του φύλλου** (ADR-929 Φ1, §6.10 #2): η μάσκα με τις διαστάσεις της, και οι μετρήσεις που
 * μοιράζονται το πλαίσιο (`sheet-layout`) και οι πλευρές του πίνακα (`table-sides`) — κάλυψη γραμμής, μελάνι σε
 * ορθογώνιο, πάχος **λεπτής** γραμμής φύλλου (ISO 5457). Ένας ορισμός του «λεπτή γραμμή» και του «τίποτα» για όλο το φύλλο.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/sheet-grid
 */

/** Ελάχιστη κάλυψη για να είναι μια γραμμή **συνεχής** (πλαίσιο, περίγραμμα πίνακα, άκρη φύλλου). */
export const FRAME_MIN_COVERAGE = 0.8;
/** Μέγιστο πάχος γραμμής πλαισίου: κλάσμα της μικρής διάστασης (με κατώτατο σε px για μικρές εικόνες). */
const FRAME_MAX_THICKNESS = 0.015;
const FRAME_MIN_THICKNESS_PX = 4;
/** Έξω από το πλαίσιο: ως 0,2% μελάνι (σκόνη σαρωτή, σημάδια κοπής) — όχι διαστάσεις ή κείμενο. */
export const FRAME_MAX_OUTSIDE_INK = 0.002;

export interface Grid { readonly ink: Uint8Array; readonly cols: number; readonly rows: number }

export function coverage(runs: Uint8Array, g: Grid, row: number, from: number, to: number): number {
  let on = 0;
  for (let x = from; x <= to; x++) on += runs[row * g.cols + x];
  return to > from ? on / (to - from + 1) : 0;
}

export function columnCoverage(runs: Uint8Array, g: Grid, col: number, from: number, to: number): number {
  let on = 0;
  for (let y = from; y <= to; y++) on += runs[y * g.cols + col];
  return to > from ? on / (to - from + 1) : 0;
}

/** Κλειστό ορθογώνιο σε px πλέγματος: `[x0, x1] × [y0, y1]`. */
export interface PixelRect { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

/**
 * **Μελάνι σε ορθογώνιο** (κλειστό, κομμένο στο πλέγμα): πλήθος px μελανιού και εμβαδόν. Η ΜΙΑ μέτρηση πίσω από το
 * «τίποτα δεν ζει έξω από το πλαίσιο» και το «τίποτα δεν ζει πέρα από την πινακίδα» (ADR-929 §6.10 #2).
 */
export function inkInRect(g: Grid, r: PixelRect): { readonly ink: number; readonly area: number } {
  const x0 = Math.max(0, r.x0);
  const y0 = Math.max(0, r.y0);
  const x1 = Math.min(g.cols - 1, r.x1);
  const y1 = Math.min(g.rows - 1, r.y1);
  if (x1 < x0 || y1 < y0) return { ink: 0, area: 0 };
  let ink = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ink += g.ink[y * g.cols + x];
  return { ink, area: (x1 - x0 + 1) * (y1 - y0 + 1) };
}

/** Μέγιστο πάχος **λεπτής** γραμμής φύλλου (ISO 5457), όχι τοίχου: για το πλαίσιο και για το περίγραμμα του πίνακα. */
export function maxLineThickness(g: Grid): number {
  return Math.max(FRAME_MIN_THICKNESS_PX, Math.min(g.cols, g.rows) * FRAME_MAX_THICKNESS);
}
