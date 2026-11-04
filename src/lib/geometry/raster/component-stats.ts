/**
 * =============================================================================
 * ΣΤΑΤΙΣΤΙΚΑ ΣΥΝΕΚΤΙΚΩΝ ΣΥΝΙΣΤΩΣΩΝ ΚΑΙ ΚΑΘΑΡΙΣΜΟΣ ΚΗΛΙΔΩΝ (SSoT)
 * =============================================================================
 *
 * Πάνω στις ετικέτες του {@link labelComponents} (flood-fill.ts — **ο** ετικετοποιητής, κανένας δεύτερος): εμβαδόν και
 * πλαίσιο ανά συνιστώσα, και αφαίρεση όσων είναι μικρότερες από ένα εμβαδόν. Είναι το `pixSelectBySize` της Leptonica: ο
 * θόρυβος «αλάτι» μιας σάρωσης είναι κουκκίδες λίγων pixel, ενώ κάθε σύμβολο κάτοψης (γράμμα, βέλος, γραμμή) είναι
 * μεγαλύτερο.
 *
 * @module lib/geometry/raster/component-stats
 */

import { labelComponents, type RasterConnectivity } from './flood-fill';

/** Πλαίσιο σε κελιά, **κλειστό** (`maxX`/`maxY` είναι το τελευταίο κελί που ανήκει). */
export interface CellBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface ComponentStats {
  readonly labels: Int32Array;
  readonly count: number;
  /** Δείκτης `label` (1..count)· η θέση 0 μένει αχρησιμοποίητη. */
  readonly areas: Uint32Array;
  readonly boxes: readonly CellBox[];
}

export function componentStats(grid: Uint8Array, cols: number, rows: number, connectivity: RasterConnectivity): ComponentStats {
  const { labels, count } = labelComponents(grid, cols, rows, connectivity);
  const areas = new Uint32Array(count + 1);
  const minX = new Int32Array(count + 1).fill(cols);
  const minY = new Int32Array(count + 1).fill(rows);
  const maxX = new Int32Array(count + 1).fill(-1);
  const maxY = new Int32Array(count + 1).fill(-1);
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    if (l === 0) continue;
    const x = i % cols;
    const y = (i - x) / cols;
    areas[l]++;
    if (x < minX[l]) minX[l] = x;
    if (x > maxX[l]) maxX[l] = x;
    if (y < minY[l]) minY[l] = y;
    if (y > maxY[l]) maxY[l] = y;
  }
  const boxes: CellBox[] = [{ minX: 0, minY: 0, maxX: -1, maxY: -1 }];
  for (let l = 1; l <= count; l++) boxes.push({ minX: minX[l], minY: minY[l], maxX: maxX[l], maxY: maxY[l] });
  return { labels, count, areas, boxes };
}

/** Νέα μάσκα χωρίς τις συνιστώσες με εμβαδόν **< `minArea`** κελιά (8-γειτονιά: μια διαγώνια γραμμή είναι μία). */
export function removeSmallComponents(grid: Uint8Array, cols: number, rows: number, minArea: number): Uint8Array {
  const out = new Uint8Array(grid.length);
  if (minArea <= 1) { out.set(grid); return out; }
  const { labels, areas } = componentStats(grid, cols, rows, 8);
  for (let i = 0; i < labels.length; i++) out[i] = labels[i] !== 0 && areas[labels[i]] >= minArea ? 1 : 0;
  return out;
}
