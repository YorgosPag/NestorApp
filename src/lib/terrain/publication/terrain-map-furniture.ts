/**
 * ADR-920 Β4.8 — the map FURNITURE: frame (view box + margin), north arrow, scale bar. A map a buyer may measure off
 * carries all three; without a scale a contour map is a picture, not a drawing. Both live in the MARGIN, never over
 * the ground.
 *
 * - **North arrow**: the snapshot is ALWAYS north-up (Β2 keeps north), so the arrow never rotates. Same outline as the
 *   DXF and the listing floor plans (`northArrowSvgPath`).
 * - **Scale bar**: the 1-2-5 length nearest to a quarter of the map width (`snapScaleBarLength`, the DXF scale bar's
 *   quantizer), split so every PART is a 1-2-5 number too (Esri: 2 / 4 / 5 parts): 1·10ⁿ → 5 × 2·10ⁿ⁻¹,
 *   2·10ⁿ → 4 × 5·10ⁿ⁻¹, 5·10ⁿ → 5 × 1·10ⁿ.
 *
 * @module lib/terrain/publication/terrain-map-furniture
 */

import { northArrowSvgPath } from '@/lib/geometry/north-arrow';
import { snapScaleBarLength } from '@/lib/geometry/scale-bar-length-snap';
import {
  LISTING_TERRAIN_MAP_NORTH_ARROW_FRACTION,
  LISTING_TERRAIN_MAP_PADDING_FRACTION,
  LISTING_TERRAIN_MAP_SCALE_BAR_FRACTION,
} from './listing-terrain-config';
import { roundPublished } from './listing-terrain-frame';
import type { SvgPoint } from './terrain-map-svg';

/** The SVG `viewBox`, metres, and the margin around the ground inside it. */
export interface TerrainMapViewBox {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
  readonly margin: number;
}

export interface TerrainMapNorthArrow {
  readonly pathData: string;
  /** Baseline centre of the «Β» / «N» letter, just above the tip. */
  readonly letter: SvgPoint;
}

export interface TerrainMapScaleBar {
  /** Left end of the bar, on its top edge. */
  readonly x: number;
  readonly y: number;
  /** Whole length, metres (a 1-2-5 number) — also its width in SVG units. */
  readonly lengthM: number;
  readonly parts: number;
  /** Thickness of the bar, SVG units. */
  readonly heightM: number;
}

/** The content bounds plus the margin the furniture lives in. */
export function viewBoxOf(points: readonly SvgPoint[]): TerrainMapViewBox {
  // A loop, not Math.min(...xs): tens of thousands of vertices would exceed the engine's argument limit.
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const margin = roundPublished(Math.max(width, height) * LISTING_TERRAIN_MAP_PADDING_FRACTION);
  return {
    minX: roundPublished(minX - margin),
    minY: roundPublished(minY - margin),
    width: roundPublished(width + 2 * margin),
    height: roundPublished(height + 2 * margin),
    margin,
  };
}

/** Top-right corner, inside the margin. */
export function northArrowOf(box: TerrainMapViewBox): TerrainMapNorthArrow {
  const size = roundPublished(box.margin * LISTING_TERRAIN_MAP_NORTH_ARROW_FRACTION);
  const cx = roundPublished(box.minX + box.width - box.margin * 0.5);
  const cy = roundPublished(box.minY + box.margin * 0.62);
  return { pathData: northArrowSvgPath(cx, cy, size), letter: { x: cx, y: roundPublished(cy - size * 0.55) } };
}

/** How many parts keep every part a 1-2-5 number. */
export function scaleBarParts(lengthM: number): number {
  const mantissa = Math.round(lengthM / 10 ** Math.floor(Math.log10(lengthM)));
  return mantissa === 2 ? 4 : 5;
}

/** Bottom-left corner, inside the margin (the view writes the numbers under the bar). */
export function scaleBarOf(box: TerrainMapViewBox): TerrainMapScaleBar {
  const lengthM = snapScaleBarLength(box.width * LISTING_TERRAIN_MAP_SCALE_BAR_FRACTION);
  return {
    x: roundPublished(box.minX + box.margin * 0.5),
    y: roundPublished(box.minY + box.height - box.margin * 0.55),
    lengthM,
    parts: scaleBarParts(lengthM),
    heightM: roundPublished(box.margin * 0.15),
  };
}
