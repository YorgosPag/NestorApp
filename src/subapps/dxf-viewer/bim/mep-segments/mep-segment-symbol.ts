/**
 * MEP Segment 2D symbol SSoT (ADR-408 Φ8).
 *
 * Single source of truth for the *vector* symbol geometry of a linear MEP
 * segment (duct / pipe). Pure + geometry-driven: reads the already-computed
 * axis polyline (rotation-aware for free) and emits the strokes that identify
 * the segment in plan view:
 *
 *   - `'duct'`  → dashed centerline stroke the full axis length (industry
 *                 convention: hidden mechanical run above floor line).
 *   - `'pipe'`  → centerline stroke + a short perpendicular tick mark at the
 *                 axis midpoint (plumbing convention — communicates the circular
 *                 section not otherwise visible in plan).
 *
 * The **centerline** strokes are world canvas units (same space as the
 * outline), so the renderer strokes them directly after its `worldToScreen`
 * transform. The **pipe tick**, by contrast, is intentionally *screen-space*
 * (zoom- and scene-unit-independent, exactly like the home-run conductor ticks
 * in `../mep-systems/mep-wire-conductor-ticks.ts`) — see `buildPipeTickScreen`.
 *
 * Why screen-space for the tick: a world-unit length cannot stay legible across
 * scenes. A clamp like `[4, 20]` world units renders as 4–20 *mm* in an mm-scene
 * (microscopic) but 4–20 *metres* in a metre-scene (a giant slash bisecting the
 * pipe). A fixed pixel length is correct at every zoom and every `sceneUnits`.
 *
 * Zero canvas calls — pure geometry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 * @see ../mep-systems/mep-wire-conductor-ticks.ts (the screen-space tick model)
 */

import type { Point3D } from '../types/bim-base';
import type { Point2D } from '../../rendering/types/Types';
import type { MepSegmentGeometry } from '../types/mep-segment-types';

/** A polyline of world-space points (canvas units). */
export type SegmentStroke = readonly Point3D[];

export interface SegmentSymbolGeometry {
  /**
   * Centerline strokes (world canvas units). One stroke: start → end. Shared by
   * duct and pipe; the pipe tick is rendered separately in screen space via
   * {@link buildPipeTickScreen}. The renderer applies the dash style, so it is
   * NOT baked in here — the symbol is purely positional.
   */
  readonly strokes: readonly SegmentStroke[];
}

/**
 * Build the segment centerline symbol from the computed geometry. Domain-
 * agnostic: both duct and pipe get the centerline stroke; the pipe-only
 * midpoint tick is screen-space and produced by {@link buildPipeTickScreen}
 * at render time.
 */
export function buildSegmentSymbol(
  geometry: MepSegmentGeometry,
): SegmentSymbolGeometry {
  const axisPoints = geometry.axisPolyline.points;
  if (axisPoints.length < 2) {
    return { strokes: [] };
  }

  const start = axisPoints[0];
  const end = axisPoints[axisPoints.length - 1];
  const centerline: SegmentStroke = [start, end];

  return { strokes: [centerline] };
}

// ─── Pipe midpoint tick (screen-space, zoom-independent) ─────────────────────────

/**
 * Half-length (px) of the pipe midpoint tick. Screen-constant so the slash
 * looks identical at every zoom and in every scene (mm or metres). Mirrors the
 * pixel-length convention of the home-run conductor ticks (`HOT_LEN_PX` etc.).
 */
export const PIPE_TICK_HALF_PX = 7;

/** The two screen endpoints of the pipe midpoint tick. */
export interface PipeTickScreen {
  readonly a: Point2D;
  readonly b: Point2D;
}

/**
 * Build the pipe midpoint tick in SCREEN space (zoom- and scene-independent).
 *
 * The caller passes the two SCREEN endpoints of the centerline (already through
 * `worldToScreen`); the tick is a fixed-pixel perpendicular slash centred on
 * the centerline midpoint. Returns `null` for a degenerate (zero-length) run.
 *
 * Computing the perpendicular from the *screen* endpoints (rather than rotating
 * a world vector) keeps the tick a true visual perpendicular regardless of any
 * axis flip / non-uniform handling in the transform — same approach as
 * {@link file://./../mep-systems/mep-wire-conductor-ticks.ts}.
 */
export function buildPipeTickScreen(
  startScreen: Point2D,
  endScreen: Point2D,
  halfPx: number = PIPE_TICK_HALF_PX,
): PipeTickScreen | null {
  const dx = endScreen.x - startScreen.x;
  const dy = endScreen.y - startScreen.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;

  // Perpendicular unit vector in screen space.
  const px = -dy / len;
  const py = dx / len;
  const mx = (startScreen.x + endScreen.x) / 2;
  const my = (startScreen.y + endScreen.y) / 2;

  return {
    a: { x: mx - px * halfPx, y: my - py * halfPx },
    b: { x: mx + px * halfPx, y: my + py * halfPx },
  };
}
