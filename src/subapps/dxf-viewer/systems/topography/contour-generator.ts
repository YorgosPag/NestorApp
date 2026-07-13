/**
 * ADR-650 Milestone 1 — contour generation facade.
 *
 * One entry point for the deterministic core: survey points (+breaklines) → contour lines.
 * Composes the three stages so callers (the React hook, the jest fixtures) never wire them
 * by hand:
 *
 *   buildTin (CDT)  →  generateContourSegments (marching triangles)  →  chainContours (stitch)
 *
 * Returns WORLD-coordinate {@link ContourLine}s (canonical mm), major/minor classified.
 */

import type { TopoPoint, Breakline, ContourLine, TinSurface } from './topo-types';
import type { ContourConfig } from './contour-config';
import { DEFAULT_CONTOUR_CONFIG } from './contour-config';
import { buildTin } from './tin-builder';
import { generateContourSegments } from './marching-triangles';
import { chainContours } from './contour-chainer';

/** Contour generation result: the derived surface + the finished lines (QA-friendly). */
export interface ContourResult {
  readonly tin: TinSurface;
  readonly contours: readonly ContourLine[];
}

/**
 * Generate contour lines from survey points + breaklines. Fewer than 3 distinct points
 * yields an empty contour set (with an empty TIN).
 */
export function generateContours(
  points: readonly TopoPoint[],
  breaklines: readonly Breakline[] = [],
  config: ContourConfig = DEFAULT_CONTOUR_CONFIG,
): ContourResult {
  const tin = buildTin(points, breaklines);
  const segments = generateContourSegments(tin, config);
  const contours = chainContours(segments, config, tin.origin);
  return { tin, contours };
}
