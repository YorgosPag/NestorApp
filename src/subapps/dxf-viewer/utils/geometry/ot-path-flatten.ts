/**
 * ADR-733 — **opentype.js PathCommand[] → flat subpaths** (SSoT, pure geometry).
 *
 * Αδελφή γραμματική του `svg-path-flatten.ts` (ADR-608): εκεί η είσοδος είναι SVG `d`
 * string (M/L/H/V/C/S/Q/T/A/Z, abs+rel)· εδώ είναι ο ΗΔΗ-parsed πίνακας εντολών του
 * opentype.js (`Path.commands`: M/L/Q/C/Z, πάντα absolute, χωρίς smooth/arc variants).
 * Δεν κάνουμε round-trip μέσω `toSVG()` (string build + re-tokenize χωρίς λόγο) — αλλά
 * ΔΕΝ ξαναγράφουμε ούτε την υποδιαίρεση: οι πυρήνες `flattenCubic`/`flattenQuad`
 * (adaptive de Casteljau, chord tolerance) εισάγονται από το SVG SSoT (N.18 — κανένα
 * sibling clone).
 *
 * Συντεταγμένες: ό,τι δώσει το opentype (y-down, baseline στο y που ζητήθηκε στο
 * `font.getPath[s]`) — ο καταναλωτής (`explode-text.ts`) εφαρμόζει το δικό του
 * local→world affine στα σημεία.
 */

import type { PathCommand } from 'opentype.js';
import type { Point2D } from '../../rendering/types/Types';
import { flattenCubic, flattenQuad, type SvgSubpath } from './svg-path-flatten';

export type { SvgSubpath } from './svg-path-flatten';

const DEFAULT_MAX_DEPTH = 16;

/**
 * Δειγματοληπτεί εντολές opentype σε subpaths με έλεγχο χορδικής απόκλισης `tolerance`
 * (ίδιες μονάδες με τις συντεταγμένες των εντολών). Κενό/εκφυλισμένο input → `[]`.
 */
export function flattenOtCommands(
  commands: readonly PathCommand[],
  tolerance: number,
  maxDepth: number = DEFAULT_MAX_DEPTH,
): SvgSubpath[] {
  const subpaths: SvgSubpath[] = [];
  let points: Point2D[] = [];
  let cur: Point2D = { x: 0, y: 0 };

  const flush = (closed: boolean): void => {
    if (points.length >= 2) subpaths.push({ points, closed });
    points = [];
  };

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        flush(false);
        cur = { x: cmd.x, y: cmd.y };
        points.push(cur);
        break;
      case 'L':
        cur = { x: cmd.x, y: cmd.y };
        points.push(cur);
        break;
      case 'Q': {
        const end = { x: cmd.x, y: cmd.y };
        flattenQuad(cur, { x: cmd.x1, y: cmd.y1 }, end, tolerance, 0, maxDepth, points);
        cur = end;
        break;
      }
      case 'C': {
        const end = { x: cmd.x, y: cmd.y };
        flattenCubic(cur, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, end, tolerance, 0, maxDepth, points);
        cur = end;
        break;
      }
      case 'Z':
        flush(true);
        break;
    }
  }
  flush(false);
  return subpaths;
}
