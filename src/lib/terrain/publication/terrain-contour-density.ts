/**
 * ADR-920 Β6.8 — **how dense do contours fall ON SCREEN?** The ONE measure both deciders use. Pure.
 *
 *   - the builder (`contour-interval.ts`) picks the interval that keeps most of the plot un-crowded;
 *   - the map (`terrain-map-contour-thinning.ts`) drops intermediate contours where the ground is still too steep.
 *
 * On a plane of gradient `g` (rise / run), contours of interval `I` lie `I / g` metres apart on the ground; on a map
 * drawn at `p` css px per metre that is `I / g · p` px. Cartography (OS, USGS, swisstopo) states the rule as a minimum
 * distance between lines; this is that distance, in the unit a screen is judged by.
 *
 * @module lib/terrain/publication/terrain-contour-density
 */

import {
  LISTING_TERRAIN_CONTOUR_MIN_SPACING_PX,
  LISTING_TERRAIN_CONTOUR_REFERENCE_WIDTH_PX,
} from './listing-terrain-config';
import { terrainMapWidthM } from './terrain-map-furniture';

/** On-screen gap (css px) between adjacent contours of `intervalM` on ground of `gradient` (rise/run). Flat ⇒ ∞. */
export function contourSpacingPx(intervalM: number, gradient: number, pxPerM: number): number {
  return gradient > 0 ? (intervalM / gradient) * pxPerM : Infinity;
}

/** Are contours of `intervalM` crowded on ground of `gradient` at `pxPerM`? */
export function contoursCrowded(intervalM: number, gradient: number, pxPerM: number): boolean {
  return contourSpacingPx(intervalM, gradient, pxPerM) < LISTING_TERRAIN_CONTOUR_MIN_SPACING_PX;
}

/**
 * Css px per metre of the map of a surface of this plan size, shown `widthPx` wide (the SVG spans its width). Without a
 * measured width (paper, PDF, the builder) the REFERENCE width — the one the interval was chosen for.
 */
export function mapPxPerM(viewBoxWidthM: number, widthPx: number | null = null): number {
  return (widthPx ?? LISTING_TERRAIN_CONTOUR_REFERENCE_WIDTH_PX) / viewBoxWidthM;
}

/** {@link mapPxPerM} for content of this plan size, before any view box exists (the builder). */
export function referencePxPerM(contentWidthM: number, contentHeightM: number): number {
  return mapPxPerM(terrainMapWidthM(contentWidthM, contentHeightM));
}

/** One triangle's contribution to the slope distribution. */
export interface SlopeSample {
  /** rise / run (dimensionless). */
  readonly gradient: number;
  /** Plan area, any unit (only ratios matter). */
  readonly area: number;
}

/**
 * The gradient below which `quantile` of the plan AREA lies (area-weighted, so a few long slivers do not outvote the
 * ground). `0` for no area.
 */
export function areaWeightedGradientQuantile(samples: readonly SlopeSample[], quantile: number): number {
  const sorted = samples.filter((s) => s.area > 0).sort((a, b) => a.gradient - b.gradient);
  const total = sorted.reduce((sum, s) => sum + s.area, 0);
  if (total === 0) return 0;
  let cumulative = 0;
  for (const sample of sorted) {
    cumulative += sample.area;
    if (cumulative >= quantile * total) return sample.gradient;
  }
  return sorted[sorted.length - 1]!.gradient;
}
