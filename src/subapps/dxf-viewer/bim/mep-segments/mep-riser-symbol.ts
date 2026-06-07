/**
 * Vertical riser (κατακόρυφη στήλη) plan symbol SSoT — ADR-408 Φ15.
 *
 * A vertical drain stack is a `mep-segment` whose plan run is ~zero (it is
 * perpendicular to the plan view). In plan it must read as the Revit «pipe up /
 * pipe down» riser glyph — a circle with an inner cross and a directional arrow —
 * NOT a degenerate zero-length line. This module is the single source of truth for
 * that glyph, shared by the owning-floor renderer (`MepSegmentRenderer`) and the
 * cross-floor «riser through» overlay (Φ15 D).
 *
 * The glyph is authored in SCREEN space (fixed pixels, zoom-independent) like the
 * pipe midpoint tick / slope indicator — a plan annotation of constant size. The
 * caller supplies the screen centre (world→screen of the riser's XY) and draws the
 * circle via `ctx.arc(cx, cy, r)` plus the returned line strokes.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';

/** Fixed screen radius (px) of the riser circle glyph. */
export const RISER_SYMBOL_RADIUS_PX = 9;

/** A line stroke of the glyph (screen-space). */
export type RiserSymbolStroke = readonly [Point2D, Point2D];

export interface RiserSymbol {
  /** Circle centre (screen px) — draw via `ctx.arc(cx, cy, r, 0, 2π)`. */
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** Inner cross + directional arrow strokes (screen-space line segments). */
  readonly strokes: readonly RiserSymbolStroke[];
}

/**
 * Build the riser plan glyph at `centre` (screen px) with circle radius `radiusPx`
 * and an up/down arrow per `direction`. Pure — returns the circle params + the
 * inner-cross and arrow line strokes. The arrow points toward screen-top for
 * `'up'` (pipe rises) and screen-bottom for `'down'` (pipe drops).
 */
export function buildRiserSymbol(
  centre: Point2D,
  radiusPx: number,
  direction: 'up' | 'down',
): RiserSymbol {
  const cx = centre.x;
  const cy = centre.y;
  const r = radiusPx;
  const d = r * 0.62; // inner-cross half-extent

  // Inner cross (X) — reads as a pipe seen end-on.
  const cross: RiserSymbolStroke[] = [
    [{ x: cx - d, y: cy - d }, { x: cx + d, y: cy + d }],
    [{ x: cx - d, y: cy + d }, { x: cx + d, y: cy - d }],
  ];

  // Directional arrow: a stem from the circle edge outward + two barbs at the tip.
  const sign = direction === 'up' ? -1 : 1; // screen y grows downward
  const stemStartY = cy + sign * r;
  const tipY = cy + sign * (r + radiusPx * 1.1);
  const barb = radiusPx * 0.5;
  const arrow: RiserSymbolStroke[] = [
    [{ x: cx, y: stemStartY }, { x: cx, y: tipY }],
    [{ x: cx, y: tipY }, { x: cx - barb, y: tipY - sign * barb }],
    [{ x: cx, y: tipY }, { x: cx + barb, y: tipY - sign * barb }],
  ];

  return { cx, cy, r, strokes: [...cross, ...arrow] };
}
