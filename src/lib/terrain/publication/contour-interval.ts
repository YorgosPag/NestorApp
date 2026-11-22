/**
 * ADR-920 Β2 · Β6.8 — choose the contour interval the way a cartographer does: from the relief AND from how dense the
 * lines fall on screen. Pure.
 *
 * A fixed 0.5 m interval draws nothing on a flat plot and a black smear on a hillside. The relief alone is not enough
 * either (Β6.8): 3 m of relief gives 0.1 m — fine over a 100 m field, a «barcode» over a 13 m strip at 100 %. So the
 * builder takes the FINEST interval of the cartographic ladder that
 *   1. keeps the minor levels under {@link LISTING_TERRAIN_MAX_MINOR_LEVELS} across the relief, and
 *   2. keeps {@link LISTING_TERRAIN_CONTOUR_SLOPE_QUANTILE} of the plot (by area) un-crowded on the reference screen
 *      (`terrain-contour-density.ts`) — the steepest rest is thinned locally by the map, never by a coarser interval
 *      everywhere (OS / USGS / swisstopo).
 * One interval per plot: the stats, the legend, the 3D view and the PDF all name the same number. The result goes to
 * the SAME contour generator the viewer uses (`ContourConfig`).
 *
 * @module lib/terrain/publication/contour-interval
 */

import type { ContourConfig } from '@/lib/terrain/contour-config';
import type { TinSurface } from '@/lib/terrain/terrain-types';
import {
  LISTING_TERRAIN_CONTOUR_LADDER_M,
  LISTING_TERRAIN_CONTOUR_SLOPE_QUANTILE,
  LISTING_TERRAIN_MAJOR_EVERY_DEFAULT,
  LISTING_TERRAIN_MAJOR_EVERY_QUARTER,
  LISTING_TERRAIN_MAX_MINOR_LEVELS,
} from './listing-terrain-config';
import { areaWeightedGradientQuantile, contoursCrowded, referencePxPerM, type SlopeSample } from './terrain-contour-density';
import { slopePct, triangleGradient } from './terrain-slope';

/** What the interval depends on — the surface reduced to three numbers. */
export interface ContourDensityInput {
  /** Elevation span of the surface, canonical mm. */
  readonly reliefMm: number;
  /** Gradient (rise/run) below which {@link LISTING_TERRAIN_CONTOUR_SLOPE_QUANTILE} of the plan area lies. */
  readonly steepGradient: number;
  /** Css px per metre of the plot's map at the reference width. */
  readonly pxPerM: number;
}

/** The density input of a surveyed surface (LOCAL plan mm, WORLD z mm). */
export function contourDensityInputOf(tin: TinSurface): ContourDensityInput {
  const samples: SlopeSample[] = [];
  for (let t = 0; t < tin.triangles.length; t++) {
    const g = triangleGradient(tin, t);
    if (g) samples.push({ gradient: slopePct(g.plane) / 100, area: g.areaMm2 });
  }
  const { bounds } = tin;
  return {
    reliefMm: bounds.maxZ - bounds.minZ,
    steepGradient: areaWeightedGradientQuantile(samples, LISTING_TERRAIN_CONTOUR_SLOPE_QUANTILE),
    pxPerM: referencePxPerM((bounds.maxX - bounds.minX) / 1000, (bounds.maxY - bounds.minY) / 1000),
  };
}

/** Contour parameters for a surface described by `input`. */
export function chooseContourConfig(input: ContourDensityInput): ContourConfig {
  const ladder = LISTING_TERRAIN_CONTOUR_LADDER_M;
  const fits = (intervalM: number) =>
    input.reliefMm / (intervalM * 1000) <= LISTING_TERRAIN_MAX_MINOR_LEVELS &&
    !contoursCrowded(intervalM, input.steepGradient, input.pxPerM);
  const intervalM = ladder.find(fits) ?? ladder[ladder.length - 1];
  return {
    intervalMm: intervalM * 1000,
    majorEvery: isQuarterFamily(intervalM)
      ? LISTING_TERRAIN_MAJOR_EVERY_QUARTER
      : LISTING_TERRAIN_MAJOR_EVERY_DEFAULT,
    baseElevationMm: 0,
    labelMajors: true,
    labelDecimals: decimalsOf(intervalM),
  };
}

/** 0.25 / 2.5 / 25 — every 4th of them lands on a whole unit. */
function isQuarterFamily(intervalM: number): boolean {
  const mantissa = intervalM / 10 ** Math.floor(Math.log10(intervalM));
  return Math.abs(mantissa - 2.5) < 1e-9;
}

/** Label decimals that print the interval without rounding it (0.25 → 2, 0.5 → 1, 2 → 0). */
function decimalsOf(intervalM: number): number {
  let decimals = 0;
  while (decimals < 3 && Math.abs(Math.round(intervalM * 10 ** decimals) - intervalM * 10 ** decimals) > 1e-9) {
    decimals++;
  }
  return decimals;
}
