/**
 * ADR-929 Φ5 — η γεωμετρία της επικάλυψης αναγνώρισης σε **συντεταγμένες σκηνής**, ομαδοποιημένη ανά επίπεδο
 * βεβαιότητας. Υπολογίζεται μία φορά ανά (αποτέλεσμα σύντηξης, τοποθέτηση)· η προβολή στην οθόνη γίνεται στο φύλλο
 * του καμβά ανά transform (ADR-040). Η μόνη αντιστοίχιση px → σκηνή είναι το `rasterPixelToScene` (Δ3).
 *
 * ΚΑΘΑΡΟ — zero React/DOM/store.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PlanConfidence, RasterSegment } from '../../bim/plan-recognition/plan-recognition-types';
import { rasterPixelToScene, type RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import { planConfidenceTier, type PlanConfidenceTier } from './plan-confidence';

export type SceneSegment = readonly [Point2D, Point2D];

export type SegmentsByTier = Readonly<Record<PlanConfidenceTier, readonly SceneSegment[]>>;

/** Τα τμήματα της εικόνας στη σκηνή, ανά επίπεδο βεβαιότητας της σύντηξης. */
export function sceneSegmentsByTier(
  segments: readonly RasterSegment[],
  confidence: ReadonlyMap<string, PlanConfidence>,
  placement: RasterPlacement,
): SegmentsByTier {
  const out: Record<PlanConfidenceTier, SceneSegment[]> = { high: [], medium: [], low: [] };
  for (const segment of segments) {
    const tier = planConfidenceTier(confidence.get(segment.id)?.score);
    out[tier].push([rasterPixelToScene(segment.start, placement), rasterPixelToScene(segment.end, placement)]);
  }
  return out;
}
