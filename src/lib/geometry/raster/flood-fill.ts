/**
 * =============================================================================
 * FLOOD FILL ΣΕ ΔΥΑΔΙΚΟ ΠΛΕΓΜΑ (SSoT) — 4 ή 8 γειτονιά, επαναληπτικό
 * =============================================================================
 *
 * Πλέγμα = `Uint8Array` γραμμή-προς-γραμμή (`index = row * cols + col`), `1` = γεμάτο. Μεταφέρθηκε από το
 * `dxf-viewer/bim/mesh-library/mesh-silhouette.ts` (ADR-884 §4.14 Γ3), που το εισάγει πλέον από εδώ.
 *
 * 🔑 **Γειτονιά**: 8 για σιλουέτες (δύο διαγώνια κελιά ενός σχήματος είναι ένα σχήμα)· **4** για χώρους κάτοψης —
 * με 8 ο χώρος «διαρρέει» από κάθε διαγώνια ραφή ενός τοίχου πάχους ενός pixel.
 *
 * @module lib/geometry/raster/flood-fill
 */

/** Γείτονες: 4 (Α, Ν, Δ, Β) και 8 (δεξιόστροφα από Α). Κοινοί πίνακες για κάθε αλγόριθμο raster. */
export const NEIGHBOURS_4: ReadonlyArray<readonly [number, number]> = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const NEIGHBOURS_8: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

export type RasterConnectivity = 4 | 8;

/**
 * Καλεί το `visit` για κάθε γείτονα **μέσα στο πλέγμα** του κελιού `index` — ο ΕΝΑΣ βρόχος γειτονιάς όλων των
 * αλγορίθμων raster (flood fill · ετικέτες · αναγέννηση · αναζήτηση · union-find · ανάβαση κλίσης).
 */
export function forEachNeighbour(
  index: number, cols: number, rows: number,
  steps: ReadonlyArray<readonly [number, number]>, visit: (neighbour: number) => void,
): void {
  const c = index % cols;
  const r = (index - c) / cols;
  for (const [dc, dr] of steps) {
    const nc = c + dc, nr = r + dr;
    if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) visit(nr * cols + nc);
  }
}

export interface FloodFillOptions {
  readonly connectivity: RasterConnectivity;
  /** Κοινή μάσκα «ήδη επισκέφθηκε» ανάμεσα σε διαδοχικές κλήσεις (ετικετοποίηση συνιστωσών). */
  readonly visited?: Uint8Array;
}

/**
 * Γεμίζει τη συνιστώσα του `grid` (τιμή `1`) που περιέχει το `(sc, sr)` σε **νέα** μάσκα. Κενή μάσκα όταν το
 * αρχικό κελί είναι εκτός πλέγματος ή άδειο.
 */
export function floodFillMask(
  grid: Uint8Array, cols: number, rows: number, sc: number, sr: number, options: FloodFillOptions,
): Uint8Array {
  const mask = new Uint8Array(cols * rows);
  const visited = options.visited ?? mask;
  const steps = options.connectivity === 4 ? NEIGHBOURS_4 : NEIGHBOURS_8;
  const stack: number[] = [];
  const push = (i: number): void => {
    if (grid[i] !== 1 || visited[i]) return;
    visited[i] = 1;
    mask[i] = 1;
    stack.push(i);
  };
  if (sc < 0 || sc >= cols || sr < 0 || sr >= rows) return mask;
  push(sr * cols + sc);
  while (stack.length > 0) forEachNeighbour(stack.pop() as number, cols, rows, steps, push);
  return mask;
}

/**
 * Ετικέτα συνιστώσας ανά κελί (`0` = άδειο, `1..n` = συνιστώσα). Μία διάσχιση, O(κελιά).
 */
export function labelComponents(
  grid: Uint8Array, cols: number, rows: number, connectivity: RasterConnectivity,
): { readonly labels: Int32Array; readonly count: number } {
  const labels = new Int32Array(cols * rows);
  const steps = connectivity === 4 ? NEIGHBOURS_4 : NEIGHBOURS_8;
  const stack: number[] = [];
  let count = 0;
  const claim = (n: number): void => {
    if (grid[n] === 1 && labels[n] === 0) { labels[n] = count; stack.push(n); }
  };
  for (let start = 0; start < labels.length; start++) {
    if (grid[start] !== 1 || labels[start] !== 0) continue;
    count++;
    claim(start);
    while (stack.length > 0) forEachNeighbour(stack.pop() as number, cols, rows, steps, claim);
  }
  return { labels, count };
}
