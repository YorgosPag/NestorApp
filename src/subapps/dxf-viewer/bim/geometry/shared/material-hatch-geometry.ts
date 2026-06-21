/**
 * Material poché geometry (ADR-507 Φ7) — BIM υλικό → pattern segments.
 *
 * **SSoT γεωμετρίας για τα structural poché.** Γεφυρώνει το `MATERIAL_HATCH_MAP`
 * (υλικό→pattern name) με τον PAT catalog geometry engine (`buildPredefinedHatchLines`).
 * Αντικαθιστά τους 4 bespoke engines (ADR-363 column/beam/wall/foundation) — ΕΝΑ
 * geometry σύστημα για user hatch ΚΑΙ material poché.
 *
 * Τα segments είναι σε **world coords** (transform-independent) → memoized ανά
 * (signature ορίων + υλικό + cutState)· ο renderer απλώς κάνει `worldToScreen` +
 * stroke (μηδέν per-frame recompute, mirror `HatchRenderer.segCache`).
 *
 * @see bim/hatch/material-hatch-map.ts (resolveAutoHatch)
 * @see bim/geometry/shared/hatch-pattern-geometry.ts (buildPredefinedHatchLines — engine)
 */

import type { CutState } from '../../../config/bim-view-range';
import { getHatchPattern, resolveEffectiveHatchScale } from '../../../data/hatch-pattern-catalog';
import { resolveAutoHatch } from '../../hatch/material-hatch-map';
import { buildPredefinedHatchLines, type HatchLineSegment, type HatchPoint2D } from './hatch-pattern-geometry';

type BoundaryPaths = ReadonlyArray<ReadonlyArray<HatchPoint2D>>;

/** Όριο εγγραφών cache (αποφυγή ανεξέλεγκτης μεγέθυνσης· σπάνιο reset). */
const CACHE_MAX = 512;
const cache = new Map<string, readonly HatchLineSegment[]>();

/** Φθηνό signature των ορίων (πιάνει αλλαγές γεωμετρίας χωρίς JSON.stringify). */
function pathsSignature(paths: BoundaryPaths): string {
  let cs = 0;
  let counts = '';
  for (const p of paths) {
    counts += `${p.length},`;
    for (const v of p) cs += v.x * 31.1 + v.y * 7.3;
  }
  return `${counts}|${cs.toFixed(2)}`;
}

/**
 * Τα pattern segments (world mm) ενός BIM υλικού μέσα στα `boundaryPaths`, με
 * even-odd island clip (annulus τοίχου, νησίδες). `null` pattern (solid/none) ή
 * άδεια όρια → `[]`. Memoized.
 */
export function computeMaterialHatchSegments(
  boundaryPaths: BoundaryPaths,
  material: string | undefined,
  cutState: CutState,
): readonly HatchLineSegment[] {
  const patternName = resolveAutoHatch(material, cutState);
  if (!patternName) return [];
  const usable = boundaryPaths.filter((p) => p.length >= 3);
  if (!usable.length) return [];

  const pattern = getHatchPattern(patternName);
  if (!pattern) return [];

  const key = `${patternName}|${cutState}|${pathsSignature(usable)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const segs = buildPredefinedHatchLines(usable, pattern, {
    scale: resolveEffectiveHatchScale(patternName, undefined),
    islandStyle: 'normal',
  });

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, segs);
  return segs;
}
