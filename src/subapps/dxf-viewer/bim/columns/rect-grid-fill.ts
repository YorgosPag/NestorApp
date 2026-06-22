/**
 * ADR-398 §3.16 — **Auto-grid fill** (pure SSoT): θέσεις κολωνών για πλέγμα m×n μέσα σε ορθογώνιο,
 * με **ίσες αποστάσεις + ίσα περιθώρια** (cover). Αδελφό του symmetry detector του δίσκου (§3.14).
 *
 * «m×n» = m στήλες (κατά τον άξονα u) × n σειρές (κατά v). Οι ακριανές κολώνες κάθονται σε απόσταση
 * `clearance` (cover) από τις ακμές· οι ενδιάμεσες ισοκατανέμονται. Δουλεύει σε **λοξά** ορθογώνια
 * (θέσεις μέσω u/v). Pure — zero React/DOM/store· δίνει ΜΟΝΟ σημεία (το build/commit κολωνών γίνεται
 * στον caller με `buildColumnEntity` + `appendEntitiesToScene` = ΕΝΑ undo).
 *
 * @see ./rect-cartesian-snap.ts — `RectFrame` (ίδιο πλαίσιο)
 * @see ./polar-symmetry-detector.ts — το πολικό αδελφό (pure πρόβλεψη θέσεων)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.16
 */

import type { Point2D } from '../../rendering/types/Types';
import { rectLocalToWorld, type RectFrame } from '../framing/rect-frame';

/** Local θέσεις ενός άξονα: n≤1 → [0] (κέντρο)· αλλιώς ισοκατανεμημένες σε [−maxHalf, +maxHalf]. */
function axisGridPositions(n: number, maxHalf: number): number[] {
  if (n <= 1) return [0];
  const step = (2 * maxHalf) / (n - 1);
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(-maxHalf + k * step);
  return out;
}

/**
 * Οι θέσεις (world) ενός πλέγματος `cols×rows` μέσα στο ορθογώνιο, ίσες αποστάσεις + ίσα περιθώρια
 * `clearanceScene` (cover) από τις ακμές. Σειρά: row-major (σειρές εξωτερικά, στήλες εσωτερικά).
 */
export function rectGridPositions(
  rect: Readonly<RectFrame>,
  cols: number,
  rows: number,
  clearanceScene = 0,
): Point2D[] {
  const maxW = Math.max(rect.halfW - clearanceScene, 0);
  const maxV = Math.max(rect.halfV - clearanceScene, 0);
  const xs = axisGridPositions(cols, maxW);
  const ys = axisGridPositions(rows, maxV);
  const out: Point2D[] = [];
  for (const y of ys) {
    for (const x of xs) out.push(rectLocalToWorld(rect, x, y));
  }
  return out;
}
