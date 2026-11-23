/**
 * @fileoverview **The plot outline, placed on the published relief** (ADR-920 §14.11 Π1 · Π6 · Ζ2).
 * @related ./plot-outline-coverage (Π6 — how much of it the relief covers) ·
 *   ../publication/listing-terrain-frame (`ringToFrame` — the ONE world → published conversion, Δ3) ·
 *   ../publication/listing-terrain-frame `placeEnvelope` (the same «place it, or say why not» shape)
 *
 * The builder's one question about the outline: «can it be drawn on THIS relief, and what does the buyer read about
 * it?». It never changes the relief — mesh, contours, slopes and stats are built without looking at it (Π1).
 *
 * 🔑 Nothing is dropped silently: an outline that cannot be drawn comes back with a NAMED omission.
 * 🔑 Π6: an outline with nothing in common with the relief is a different system or a different area — omitted, never
 *    shifted to fit.
 */

import { isPolygonSelfIntersecting, polygonArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { TinSurface } from '../terrain-types';
import { ringToFrame, roundPublished, type SnapshotFrame } from '../publication/listing-terrain-frame';
import type {
  ListingTerrainPlotOutline,
  ListingTerrainPlotOutlineOmission,
} from '../publication/listing-terrain-types';
import { plotOutlineCoverage } from './plot-outline-coverage';

export type PlotOutlinePlacement =
  | { readonly plotOutline: ListingTerrainPlotOutline; readonly omission: null }
  | { readonly plotOutline: null; readonly omission: ListingTerrainPlotOutlineOmission };

/** A ring that cannot be an outline at all: under three corners, no area, or crossing itself. */
function isDegenerate(ringWorldMm: readonly PlanarPoint[]): boolean {
  return ringWorldMm.length < 3 || polygonArea(ringWorldMm) <= 0 || isPolygonSelfIntersecting(ringWorldMm);
}

/**
 * The outline (WORLD mm ring) on the published relief `tin`, in the snapshot `frame` — or why it is not drawn.
 * Area and covered share are rounded like every published number (`roundPublished`).
 */
export function placePlotOutline(
  tin: TinSurface,
  frame: SnapshotFrame,
  ringWorldMm: readonly PlanarPoint[],
): PlotOutlinePlacement {
  if (isDegenerate(ringWorldMm)) return { plotOutline: null, omission: 'degenerate-outline' };

  const coverage = plotOutlineCoverage(tin, ringWorldMm);
  if (coverage.verdict === 'disjoint') return { plotOutline: null, omission: 'outside-surface' };

  return {
    plotOutline: {
      ring: ringToFrame(frame, ringWorldMm),
      areaM2: roundPublished(coverage.outlineAreaM2),
      coverage: coverage.verdict,
      coveredFraction: roundPublished(coverage.coveredFraction),
    },
    omission: null,
  };
}
