/**
 * =============================================================================
 * ΜΑΚΡΙΕΣ ΔΙΑΔΡΟΜΕΣ — ΑΝΟΙΓΜΑ ΜΕ ΓΡΑΜΜΙΚΟ ΔΟΜΙΚΟ ΣΤΟΙΧΕΙΟ, ΣΕ O(κελιά) (SSoT)
 * =============================================================================
 *
 * Κρατά μόνο τις οριζόντιες (ή κατακόρυφες) **συνεχείς διαδρομές** μελανιού μήκους ≥ `minLength`. Είναι ακριβώς το
 * μορφολογικό **άνοιγμα με ευθύγραμμο στοιχείο** `1 × L` (η κλασική εξαγωγή γραμμών πλαισίου/πίνακα στη Leptonica και
 * στο OpenCV `morphologyEx(MORPH_OPEN, getStructuringElement(MORPH_RECT, (L, 1)))`), χωρίς δομικό στοιχείο: μία
 * σάρωση ανά γραμμή, O(κελιά) για **κάθε** `L`.
 *
 * Χρήσεις: το πλαίσιο του φύλλου και οι γραμμές της πινακίδας (ADR-929 Φ1, Δ15 #4) · το πλέγμα τετραγωνισμένου
 * χαρτιού (Φ1, σκίτσο) · οι τοίχοι ως μακριές ευθείες (Φ2). Το δίσκου `open` του `morphology.ts` απαντά άλλη ερώτηση
 * («είναι παχύ;»), όχι αυτή («είναι μακρύ;»).
 *
 * @module lib/geometry/raster/run-length-filter
 */

export type RunAxis = 'horizontal' | 'vertical';

/** Μία συνεχής διαδρομή μελανιού: γραμμή σάρωσης `line`, κελιά `[start, end)` κατά μήκος του άξονα. */
export type RunVisitor = (line: number, start: number, end: number) => void;

/** Δείκτης κελιού για (γραμμή σάρωσης, θέση κατά μήκος) στον άξονα που ζητήθηκε. */
function runIndexer(cols: number, axis: RunAxis): (line: number, at: number) => number {
  return axis === 'horizontal' ? (line, at) => line * cols + at : (line, at) => at * cols + line;
}

/**
 * Επισκέπτεται κάθε διαδρομή `≥ minLength` του `axis`, γραμμή-γραμμή, από την αρχή προς το τέλος. Ο **ένας** σαρωτής
 * διαδρομών: τον χρησιμοποιούν το {@link longRuns} και οι ζώνες αξόνων (`axis-bands.ts`).
 */
export function forEachRun(
  mask: Uint8Array, cols: number, rows: number, axis: RunAxis, minLength: number, visit: RunVisitor,
): void {
  const lines = axis === 'horizontal' ? rows : cols;
  const length = axis === 'horizontal' ? cols : rows;
  const index = runIndexer(cols, axis);
  for (let line = 0; line < lines; line++) {
    let start = -1;
    for (let at = 0; at <= length; at++) {
      const on = at < length && mask[index(line, at)] === 1;
      if (on && start < 0) start = at;
      if (on || start < 0) continue;
      if (at - start >= minLength) visit(line, start, at);
      start = -1;
    }
  }
}

/** Νέα μάσκα με μόνο τις διαδρομές `≥ minLength` του `axis`. */
export function longRuns(mask: Uint8Array, cols: number, rows: number, axis: RunAxis, minLength: number): Uint8Array {
  const out = new Uint8Array(cols * rows);
  const index = runIndexer(cols, axis);
  forEachRun(mask, cols, rows, axis, minLength, (line, start, end) => {
    for (let k = start; k < end; k++) out[index(line, k)] = 1;
  });
  return out;
}

/** Ένωση οριζόντιων **και** κατακόρυφων μακριών διαδρομών — οι «γραμμές» ενός πλαισίου ή πίνακα. */
export function longLines(mask: Uint8Array, cols: number, rows: number, minLength: number): Uint8Array {
  const out = longRuns(mask, cols, rows, 'horizontal', minLength);
  const vertical = longRuns(mask, cols, rows, 'vertical', minLength);
  for (let i = 0; i < out.length; i++) out[i] |= vertical[i];
  return out;
}
