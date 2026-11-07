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
import type { PlanScaleReferenceSet } from '../../bim/plan-recognition/fusion/scale-references';

export type SceneSegment = readonly [Point2D, Point2D];

export type SegmentsByTier = Readonly<Record<PlanConfidenceTier, readonly SceneSegment[]>>;

/** ADR-929 Φ5.3γ — μια διάσταση της κάρτας κλίμακας στη σκηνή: γραμμή μέτρησης (χρησιμοποιημένη) ή το κείμενό της (απορριφθείσα). */
export interface SceneScaleReference {
  readonly textId: string;
  readonly segment: SceneSegment;
}

interface SceneRejectedDimension {
  readonly textId: string;
  /** Το πλαίσιο του κειμένου της διάστασης, κλειστό τετράπλευρο στη σκηνή. */
  readonly ring: readonly Point2D[];
}

interface SceneScaleReferences {
  readonly used: readonly SceneScaleReference[];
  readonly rejected: readonly SceneRejectedDimension[];
}

/** ADR-929 Φ5.3γ — οι διαστάσεις της κάρτας κλίμακας στη σκηνή (η ίδια αντιστοίχιση px → σκηνή, Δ3). */
export function sceneScaleReferences(set: PlanScaleReferenceSet, placement: RasterPlacement): SceneScaleReferences {
  const toScene = (p: Point2D): Point2D => rasterPixelToScene(p, placement);
  return {
    used: set.used.map((r) => ({ textId: r.textId, segment: [toScene(r.a), toScene(r.b)] as const })),
    rejected: set.rejected.map((r) => ({
      textId: r.textId,
      ring: [
        { x: r.rect.minX, y: r.rect.minY }, { x: r.rect.maxX, y: r.rect.minY },
        { x: r.rect.maxX, y: r.rect.maxY }, { x: r.rect.minX, y: r.rect.maxY },
      ].map(toScene),
    })),
  };
}

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
