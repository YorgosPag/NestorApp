/**
 * Hatch pattern thumbnail generator (ADR-507 Φ2 — §5β.6-7).
 *
 * Παράγει ένα μικρό preview ενός predefined PAT μοτίβου (Revit «Fill Patterns»
 * picker / AutoCAD pattern preview) ΩΣ ΚΑΘΑΡΑ ΔΕΔΟΜΕΝΑ: μια λίστα ευθύγραμμων
 * τμημάτων σε px, normalized σε ένα τετράγωνο viewBox `0..size`. Το component
 * (`HatchPatternPicker`) τα ζωγραφίζει σε inline `<svg>` με `stroke="currentColor"`
 * (theme-correct, μηδέν hardcoded χρώμα — N.3).
 *
 * **FULL SSoT:** η γεωμετρία προέρχεται από το ΙΔΙΟ `buildPredefinedHatchLines`
 * που τρέφει τον `HatchRenderer` (canvas) ΚΑΙ τον DXF writer — μηδέν δεύτερη
 * pattern math. Το thumbnail είναι «ό,τι ακριβώς θα δεις στο σχέδιο».
 *
 * Τα μοτίβα είναι σταθερά → memoize ανά `name|size` (υπολογισμός μία φορά).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §5β.6-7
 * @see bim/geometry/shared/hatch-pattern-geometry.ts (buildPredefinedHatchLines — SSoT)
 */

import {
  getHatchPattern,
  getSuggestedScale,
} from '../../data/hatch-pattern-catalog';
import { buildPredefinedHatchLines } from '../geometry/shared/hatch-pattern-geometry';

/** Μία γραμμή του thumbnail σε px (viewBox `0..size`, y προς τα κάτω = SVG). */
export interface ThumbnailLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface HatchPatternThumbnail {
  /** Πλευρά του τετράγωνου viewBox (px). */
  readonly size: number;
  /** Τα τμήματα του μοτίβου, normalized στο viewBox. */
  readonly lines: readonly ThumbnailLine[];
}

/** Προεπιλεγμένη πλευρά thumbnail (px). */
export const DEFAULT_THUMBNAIL_SIZE = 44;

/** Πόσες «σειρές» μοτίβου να φανούν στο tile (αναγνωρισιμότητα χωρίς υπερβολική πυκνότητα). */
const TARGET_REPEATS = 5;

/** Fallback πλευρά tile (world mm) όταν το μοτίβο δεν έχει χρήσιμο spacing. */
const FALLBACK_TILE_MM = 100;

const EPS = 1e-7;
const cache = new Map<string, HatchPatternThumbnail>();

/**
 * Η μικρότερη χρήσιμη κάθετη απόσταση γραμμών (world mm, στο effective scale) —
 * καθορίζει πόσο μεγάλο tile χρειάζεται ώστε να φανούν ~`TARGET_REPEATS` σειρές.
 */
function minUsefulSpacingMm(name: string, scale: number): number {
  const pattern = getHatchPattern(name);
  if (!pattern) return FALLBACK_TILE_MM;
  let min = Number.POSITIVE_INFINITY;
  for (const l of pattern.lines) {
    const dy = Math.abs(l.delta[1]) * scale;
    if (dy > EPS && dy < min) min = dy;
  }
  return Number.isFinite(min) ? min : FALLBACK_TILE_MM;
}

/**
 * Thumbnail δεδομένα ενός predefined μοτίβου (memoized).
 * Άγνωστο μοτίβο ή solid → `{ size, lines: [] }` (ο caller δείχνει κενό/solid swatch).
 */
export function buildHatchPatternThumbnail(
  name: string,
  size: number = DEFAULT_THUMBNAIL_SIZE,
): HatchPatternThumbnail {
  const key = `${name}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const pattern = getHatchPattern(name);
  if (!pattern || pattern.lines.length === 0) {
    const empty: HatchPatternThumbnail = { size, lines: [] };
    cache.set(key, empty);
    return empty;
  }

  // Effective scale = το suggested του μοτίβου (όπως φαίνεται by-default στο σχέδιο).
  const scale = getSuggestedScale(name);
  const spacing = minUsefulSpacingMm(name, scale);
  const tile = Math.max(spacing * TARGET_REPEATS, FALLBACK_TILE_MM * 0.1);

  // ΙΔΙΟ SSoT: clip σε ένα μοναδιαίο τετράγωνο boundary (0..tile).
  const square = [
    { x: 0, y: 0 },
    { x: tile, y: 0 },
    { x: tile, y: tile },
    { x: 0, y: tile },
  ];
  const segments = buildPredefinedHatchLines([square], pattern, { scale });

  // World (0..tile) → px (0..size), με flip του Y (SVG: y προς τα κάτω).
  const k = size / tile;
  const toPx = (v: number): number => v * k;
  const flipY = (v: number): number => size - v * k;
  const lines: ThumbnailLine[] = segments.map((s) => ({
    x1: toPx(s.start.x),
    y1: flipY(s.start.y),
    x2: toPx(s.end.x),
    y2: flipY(s.end.y),
  }));

  const result: HatchPatternThumbnail = { size, lines };
  cache.set(key, result);
  return result;
}
