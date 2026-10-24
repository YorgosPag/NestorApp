/**
 * ADR-444 §Icons — icon-space geometry for the MEP ribbon icons (pure, zero React).
 *
 * The MEP icons are drawn by the SAME pure 2D plan-symbol drawers the canvas uses
 * (`socketDrawer`, `buildBoardStrokes`, `buildFinStrokes`, …). Those drawers take the
 * four rotated footprint corners; this module supplies a canonical footprint in the
 * 24×24 icon viewBox instead of world space, so the ribbon icon IS the plan symbol —
 * no second, hand-drawn copy that could drift from what lands on the drawing.
 *
 * Orientation: the plan convention is `v0 = front-left` with the front edge at the
 * BOTTOM of the screen — exactly how the canvas shows an un-rotated element. SVG y
 * grows downward, so `v0/v1` sit at the larger y.
 */

import type { PlanarPoint } from '../../../../bim/types/bim-base';

/** A polyline in icon space (24×24 viewBox units). */
export type IconStroke = readonly PlanarPoint[];

/** The four footprint corners `[v0, v1, v2, v3]` (front-left, front-right, back-right, back-left). */
export type IconFootprint = readonly [PlanarPoint, PlanarPoint, PlanarPoint, PlanarPoint];

/**
 * The geometry one MEP icon subject resolves to. Two stroke weights, mirroring how
 * the canvas draws these symbols: the element BODY (outline + identifying glyph) at
 * the regular icon weight, fine repetitive DETAIL (grating bars, radiator fins,
 * patch-panel ports) thinner — as the plan renderer draws gratings/fins thinner.
 */
export interface MepIconGeometry {
  readonly body: readonly IconStroke[];
  readonly detail?: readonly IconStroke[];
}

/** Icon viewBox side (all ribbon icons share the 0 0 24 24 box). */
export const ICON_VIEWBOX = 24;

/** Centre of the icon viewBox. */
export const ICON_CENTRE: PlanarPoint = { x: ICON_VIEWBOX / 2, y: ICON_VIEWBOX / 2 };

/** Longest side a subject footprint may occupy (keeps a 2-unit margin per side). */
export const ICON_FIT = 20;

/**
 * Legibility floor for the short side (fraction of the long side). Wall-hung bodies
 * are authored very slender (radiator 1000×100, panel 600×150); at 28 px their true
 * aspect would collapse the inner glyph into a smear, so the short side is widened
 * to at least this fraction. The glyph itself is unchanged — it is fraction-based.
 */
export const ICON_MIN_ASPECT = 0.5;

/**
 * A `width × depth` body in its AUTHORED units (only the aspect ratio matters),
 * scaled so its longest side is `fit`, centred on `centre`, front edge at the bottom.
 * The short side is clamped to {@link ICON_MIN_ASPECT} of the long side.
 */
export function iconFootprint(
  width: number,
  depth: number,
  centre: PlanarPoint = ICON_CENTRE,
  fit: number = ICON_FIT,
): IconFootprint {
  const long = Math.max(width, depth);
  const w = Math.max(width, long * ICON_MIN_ASPECT);
  const d = Math.max(depth, long * ICON_MIN_ASPECT);
  const scale = fit / long;
  const hw = (w * scale) / 2;
  const hd = (d * scale) / 2;
  return [
    { x: centre.x - hw, y: centre.y + hd },
    { x: centre.x + hw, y: centre.y + hd },
    { x: centre.x + hw, y: centre.y - hd },
    { x: centre.x - hw, y: centre.y - hd },
  ];
}

/** The closed outline polyline of a footprint (the element body, as the plan draws it). */
export function footprintOutline(fp: IconFootprint): IconStroke {
  return [fp[0], fp[1], fp[2], fp[3], fp[0]];
}

/** Centroid of a footprint. */
export function footprintCentre(fp: IconFootprint): PlanarPoint {
  return {
    x: (fp[0].x + fp[1].x + fp[2].x + fp[3].x) / 4,
    y: (fp[0].y + fp[1].y + fp[2].y + fp[3].y) / 4,
  };
}

/** Round to 2 decimals — keeps the SVG `d` compact and the markup deterministic. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Serialize polylines into one SVG path `d` (one `M…L…` sub-path per stroke). */
export function strokesToPathD(strokes: readonly IconStroke[]): string {
  return strokes
    .filter((s) => s.length >= 2)
    .map((s) => s.map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(p.x)} ${r2(p.y)}`).join(''))
    .join('');
}
