/**
 * =============================================================================
 * ΠΑΧΙΑ ΓΡΑΜΜΗ ΣΕ ΔΥΑΔΙΚΟ ΠΛΕΓΜΑ (SSoT)
 * =============================================================================
 *
 * Γεμίζει κάθε κελί του οποίου το **κέντρο** απέχει ≤ `halfWidth` από το τμήμα. Χρήση: νοητή διαχωριστική γραμμή
 * χώρων (Revit «Room Separation Line», ADR-884 §12 Δ8.2) που ο ανιχνευτής χώρων βλέπει ως τοίχο.
 *
 * 🔑 Ελάχιστο μισό-πλάτος **1/√2 κελιού**: μια πιο λεπτή λωρίδα αφήνει διαγώνια κενά από τα οποία περνά η
 * 4-γειτονιά σε λοξή γραμμή — το ίδιο πρόβλημα που λύνει η 4-γειτονιά στο flood fill, από την άλλη πλευρά.
 *
 * @module lib/geometry/raster/raster-segment
 */

import { distanceToSegment, type PlanarPoint } from '../planar-polygon';

/** Κάτω όριο μισού πλάτους (κελιά) ώστε η γραμμή να είναι στεγανή στην 4-γειτονιά. */
const MIN_WATERTIGHT_HALF_WIDTH = Math.SQRT1_2;

/**
 * Γράφει `value` σε κάθε κελί (συντεταγμένες κελιού: κέντρο στο `col + 0.5`, `row + 0.5`) που απέχει ≤ `halfWidth`
 * από το τμήμα `a–b`. Επί τόπου· κελιά εκτός πλέγματος αγνοούνται.
 */
export function rasterizeSegment(
  grid: Uint8Array, cols: number, rows: number,
  a: PlanarPoint, b: PlanarPoint, halfWidth: number, value: 0 | 1 = 1,
): void {
  const hw = Math.max(halfWidth, MIN_WATERTIGHT_HALF_WIDTH);
  const minC = Math.max(0, Math.floor(Math.min(a.x, b.x) - hw));
  const maxC = Math.min(cols - 1, Math.ceil(Math.max(a.x, b.x) + hw));
  const minR = Math.max(0, Math.floor(Math.min(a.y, b.y) - hw));
  const maxR = Math.min(rows - 1, Math.ceil(Math.max(a.y, b.y) + hw));
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (distanceToSegment({ x: c + 0.5, y: r + 0.5 }, a, b) <= hw) grid[r * cols + c] = value;
    }
  }
}
