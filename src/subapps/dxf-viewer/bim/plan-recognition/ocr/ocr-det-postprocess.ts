/**
 * =============================================================================
 * ΜΕΤΑ-ΕΠΕΞΕΡΓΑΣΙΑ ΑΝΙΧΝΕΥΣΗΣ DB — ΧΑΡΤΗΣ ΠΙΘΑΝΟΤΗΤΑΣ → ΚΟΥΤΙΑ ΚΕΙΜΕΝΟΥ (ADR-929 Φ0.3)
 * =============================================================================
 *
 * Η ίδια ροή με το μετρημένο `det_tile` του `ocr_onnx.py` (Φ0.1), όπου η μέτρηση έδωσε 19/32 διαστάσεις στην Παλαιολόγου:
 * δυαδική μάσκα `p > thresh` → συνεκτικές συνιστώσες (8-γειτονιά, **ο** ετικετοποιητής `labelComponents`) → απόρριψη
 * συνιστωσών κάτω από 4 pixel ή με μέση πιθανότητα `< boxThresh` → ελάχιστο περιστραμμένο ορθογώνιο → διεύρυνση κατά
 * `off = w·h·unclipRatio / (2·(w + h))` σε κάθε πλευρά (DB, Liao et al. 2020).
 *
 * 🔑 Το περίβλημα μιας συνιστώσας pixel ισούται με το περίβλημα των **ακραίων pixel κάθε γραμμής** — αρκούν 2 σημεία ανά
 *   γραμμή αντί για όλα (ίδιο αποτέλεσμα, λιγότερη δουλειά).
 * 📏 Συντεταγμένες: δείκτες pixel του πλακιδίου (στήλη, γραμμή), όπως τα `np.where` του Python.
 *
 * @module bim/plan-recognition/ocr/ocr-det-postprocess
 */

import { labelComponents } from '@/lib/geometry/raster/flood-fill';
import { minAreaRect, type Pt, type RotatedRect } from './min-area-rect';
import type { DbThresholds } from './ocr-model-config';

/** Ελάχιστο πλήθος pixel μιας συνιστώσας για να γίνει κουτί (όπως το `len(xs) < 4` του μετρημένου Python). */
const MIN_COMPONENT_PIXELS = 4;

/** Ο χάρτης πιθανότητας της εξόδου του ανιχνευτή, γραμμή-προς-γραμμή, με βήμα γραμμής `stride` ≥ `width`. */
export interface ProbabilityMap {
  readonly data: Float32Array;
  readonly width: number;
  readonly height: number;
  readonly stride: number;
}

/** Κουτί κειμένου: διευρυμένο περιστραμμένο ορθογώνιο + μέση πιθανότητα της συνιστώσας. */
export interface DetectedBox {
  readonly rect: RotatedRect;
  readonly score: number;
}

interface ComponentAccumulator {
  pixels: number;
  sum: number;
  /** Ακραίο αριστερό/δεξί pixel ανά γραμμή: `[γραμμή, ελάχιστη στήλη, μέγιστη στήλη]`. */
  rows: number[][];
}

function binarize(map: ProbabilityMap, thresh: number): Uint8Array {
  const grid = new Uint8Array(map.width * map.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) grid[y * map.width + x] = map.data[y * map.stride + x] > thresh ? 1 : 0;
  }
  return grid;
}

function accumulate(map: ProbabilityMap, labels: Int32Array, count: number): ComponentAccumulator[] {
  const acc: ComponentAccumulator[] = Array.from({ length: count + 1 }, () => ({ pixels: 0, sum: 0, rows: [] }));
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const l = labels[y * map.width + x];
      if (l === 0) continue;
      const a = acc[l];
      a.pixels++;
      a.sum += map.data[y * map.stride + x];
      const last = a.rows[a.rows.length - 1];
      if (last !== undefined && last[0] === y) last[2] = x;
      else a.rows.push([y, x, x]);
    }
  }
  return acc;
}

function hullCandidates(rows: readonly number[][]): Pt[] {
  const pts: Pt[] = [];
  for (const [y, x0, x1] of rows) {
    pts.push({ x: x0, y });
    if (x1 !== x0) pts.push({ x: x1, y });
  }
  return pts;
}

/** Διεύρυνση DB: κάθε πλευρά μεγαλώνει κατά `2·off`, όπου `off = εμβαδόν · λόγος / περίμετρος`. */
export function unclipRect(rect: RotatedRect, unclipRatio: number): RotatedRect {
  const off = (rect.width * rect.height * unclipRatio) / Math.max(2 * (rect.width + rect.height), 1e-6);
  return { ...rect, width: rect.width + 2 * off, height: rect.height + 2 * off };
}

/** Τα κουτιά κειμένου ενός πλακιδίου από τον χάρτη πιθανότητας του ανιχνευτή. */
export function detectBoxes(map: ProbabilityMap, db: DbThresholds): DetectedBox[] {
  const { labels, count } = labelComponents(binarize(map, db.thresh), map.width, map.height, 8);
  const boxes: DetectedBox[] = [];
  for (const a of accumulate(map, labels, count)) {
    if (a.pixels < MIN_COMPONENT_PIXELS) continue;
    const score = a.sum / a.pixels;
    if (score < db.boxThresh) continue;
    const rect = minAreaRect(hullCandidates(a.rows));
    if (rect !== null) boxes.push({ rect: unclipRect(rect, db.unclipRatio), score });
  }
  return boxes;
}
