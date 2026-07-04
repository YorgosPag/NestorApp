/**
 * ADR-562 Φ8 — Linetype thumbnail generator για τα ribbon combobox previews.
 *
 * Παράγει τα δεδομένα ενός μικρού preview γραμμής (AutoCAD/Figma-style «δείξε το
 * μοτίβο δίπλα στο όνομα») ΩΣ ΚΑΘΑΡΑ ΔΕΔΟΜΕΝΑ: ένα `stroke-dasharray` σε px για
 * ένα σταθερό viewBox. Το component (`RibbonComboboxThumbnail`) το ζωγραφίζει σε
 * inline `<svg>` με `stroke="currentColor"` (theme-correct, μηδέν hardcoded — N.3).
 *
 * **FULL SSoT:** το dash pattern προέρχεται από το ΙΔΙΟ Unified Linetype SSoT που
 * τρέφει τον renderer (`resolveAnyDashMm` → catalog· fallback `resolveLinetype`
 * για registry custom) + το ΙΔΙΟ mm→px (`dashMmToScreenPx`, all-positive + dot-safe).
 * Μηδέν δεύτερη dash math. Μοτίβα σταθερά → memoize ανά `name|w|h`.
 *
 * @see rendering/linetype-dash-resolver.ts (dashMmToScreenPx — mm→px SSoT)
 * @see bim/hatch/hatch-pattern-thumbnail.ts (το πρότυπο pattern-thumbnail builder)
 */

import { resolveAnyDashMm } from '../config/linetype-aliases';
import { resolveLinetype } from '../stores/LinetypeRegistry';
import { dashMmToScreenPx } from './linetype-dash-resolver';

export interface LinetypeThumbnail {
  readonly width: number;
  readonly height: number;
  /** SVG `stroke-dasharray` σε px. Κενό = συνεχής (solid) γραμμή. */
  readonly dash: readonly number[];
}

export const DEFAULT_LINETYPE_THUMB_WIDTH = 40;
export const DEFAULT_LINETYPE_THUMB_HEIGHT = 14;

/** Πόσοι κύκλοι μοτίβου να φανούν στο πλάτος (αναγνωρισιμότητα χωρίς υπερβολική πυκνότητα). */
const TARGET_REPEATS = 3;
/** Fallback μήκος κύκλου (mm) όταν το άθροισμα του μοτίβου είναι 0. */
const FALLBACK_CYCLE_MM = 20;

const cache = new Map<string, LinetypeThumbnail>();

/** mm dash pattern για ένα όνομα: ISO catalog πρώτα, μετά registry custom. */
function dashMmFor(name: string): readonly number[] {
  const iso = resolveAnyDashMm(name);
  if (iso.length > 0) return iso;
  return resolveLinetype(name)?.pattern ?? [];
}

/**
 * Thumbnail δεδομένα ενός linetype (memoized). Solid / ByLayer / άγνωστο → `dash: []`
 * (ο caller ζωγραφίζει συνεχή γραμμή).
 */
export function buildLinetypeThumbnail(
  name: string,
  width: number = DEFAULT_LINETYPE_THUMB_WIDTH,
  height: number = DEFAULT_LINETYPE_THUMB_HEIGHT,
): LinetypeThumbnail {
  const key = `${name}|${width}|${height}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const patternMm = dashMmFor(name);
  if (patternMm.length === 0) {
    const solid: LinetypeThumbnail = { width, height, dash: [] };
    cache.set(key, solid);
    return solid;
  }

  // Scale ώστε ~TARGET_REPEATS κύκλοι να γεμίζουν το πλάτος του thumbnail.
  const cycleMm = patternMm.reduce((s, v) => s + Math.abs(v), 0) || FALLBACK_CYCLE_MM;
  const scale = width / (cycleMm * TARGET_REPEATS);
  const dash = dashMmToScreenPx(patternMm, scale, 1);

  const result: LinetypeThumbnail = { width, height, dash };
  cache.set(key, result);
  return result;
}
