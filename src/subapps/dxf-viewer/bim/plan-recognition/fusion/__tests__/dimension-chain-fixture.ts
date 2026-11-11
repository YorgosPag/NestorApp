/**
 * Κοινό σενάριο δοκιμής της στρώσης «Διαστάσεις» (ADR-929 Δ20 Σ1): οριζόντια γραμμή διάστασης στο y = 100 με τέσσερις
 * κατακόρυφες επεκτάσεις (x = 10, 60, 160, 210) που πατούν στον τοίχο (y = 200) ⇒ αλυσίδα τριών ανοιγμάτων.
 * ΕΝΑΣ ορισμός για την προβολή (Σ1.1) και την εγγραφή στην έγκριση (Σ1.3) — όχι αντίγραφα (CHECK 3.28).
 */

import type { RasterPlacement } from '../../../../floorplan-background/geometry/raster-scene-mapping';
import type { RasterSegment } from '../../plan-recognition-types';
import type { DimensionEntityFusion } from '../dimension-entities';
import type { DimensionSpan, FaceLine } from '../plan-fusion-types';

/** Άνισες κλίμακες X/Y: κλειδώνεται η προβολή, όχι η απεικόνιση. */
export const CHAIN_PLACEMENT: RasterPlacement = {
  naturalBounds: { width: 300, height: 300 },
  transform: { translateX: 5, translateY: -7, scaleX: 2, scaleY: 3, rotation: 0 },
};
const CONFIDENCE = { score: 1, factors: {} };
export const EXT_X = [10, 60, 160, 210] as const;
export const RUN_Y = 100;
export const FOOT_Y = 200;

const segment = (id: string, x0: number, y0: number, x1: number, y1: number): RasterSegment => ({
  id, start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, style: 'stroke', strokeWidthPx: 1, confidence: CONFIDENCE,
});

/** Επεκτάσεις κατακόρυφες, από λίγο πάνω από τη γραμμή ως τον τοίχο από κάτω (το πόδι στο y = 200). */
export const CHAIN_SEGMENTS: readonly RasterSegment[] = [
  segment('d0', 0, RUN_Y, 220, RUN_Y),
  ...EXT_X.map((x, i) => segment(`e${i}`, x, RUN_Y - 5, x, FOOT_Y)),
];

/** Οικογένεια 1 (π/2): n = (−1, 0) ⇒ μετατόπιση = −x. */
export const offsetOfX = (x: number): number => -x;

/** Το άνοιγμα `i` (από την επέκταση `i` ως την `i+1`), με προαιρετικές παρειές στα πόδια. */
export function chainSpan(i: number, lineIds: readonly [string | null, string | null] = [null, null]): DimensionSpan {
  const [a, b] = [EXT_X[i + 1], EXT_X[i]];
  return {
    id: `ds${i}`, segmentIds: ['d0'], runFamilyId: 0, runOffsetPx: RUN_Y, familyId: 1,
    ends: [
      { extensionId: `e${i + 1}`, lineId: lineIds[0], offsetPx: offsetOfX(a) },
      { extensionId: `e${i}`, lineId: lineIds[1], offsetPx: offsetOfX(b) },
    ],
    gapPx: a - b,
  };
}

const FACE: FaceLine = { id: 'L1', familyId: 1, offsetPx: offsetOfX(10), extentMinPx: 150, extentMaxPx: 300, segmentIds: [] };

export function chainFusion(
  spans: readonly DimensionSpan[],
  adjusted: ReadonlyMap<string, number> = new Map(),
): DimensionEntityFusion {
  return {
    families: [{ id: 0, angleRad: 0 }, { id: 1, angleRad: Math.PI / 2 }],
    faceLines: [FACE],
    adjustedOffsetPx: adjusted,
    dimensionSpans: spans,
  };
}
