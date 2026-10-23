/**
 * ADR-920 Β2 — choose the contour interval from the relief, the way a cartographer does. Pure.
 *
 * A fixed 0.5 m interval draws nothing on a flat plot and a black smear on a hillside. The builder
 * takes the finest interval of the cartographic ladder that keeps the minor contours readable, and
 * hands the result to the SAME contour generator the viewer uses (`ContourConfig`).
 *
 * @module lib/terrain/publication/contour-interval
 */

import type { ContourConfig } from '@/lib/terrain/contour-config';
import {
  LISTING_TERRAIN_CONTOUR_LADDER_M,
  LISTING_TERRAIN_MAJOR_EVERY_DEFAULT,
  LISTING_TERRAIN_MAJOR_EVERY_QUARTER,
  LISTING_TERRAIN_MAX_MINOR_LEVELS,
} from './listing-terrain-config';

/** Contour parameters for a surface whose elevations span `reliefMm`. */
export function chooseContourConfig(reliefMm: number): ContourConfig {
  const ladder = LISTING_TERRAIN_CONTOUR_LADDER_M;
  const fits = (intervalM: number) => reliefMm / (intervalM * 1000) <= LISTING_TERRAIN_MAX_MINOR_LEVELS;
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
