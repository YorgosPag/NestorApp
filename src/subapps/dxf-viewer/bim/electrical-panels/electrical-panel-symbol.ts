/**
 * Electrical panel 2D symbol SSoT (ADR-408 Φ3).
 *
 * Single source of truth for the *vector* symbol of a distribution board,
 * shared by the 2D renderer and the placement ghost. Pure + geometry-driven: it
 * reads the already-computed footprint (rotation-aware for free) and emits the
 * outline plus internal divider strokes that read as a panelboard (the
 * architectural convention for a distribution board — a rectangle split into
 * breaker rows, distinct from a fixture's luminaire "X").
 *
 * All coordinates are in world canvas units (same space as the footprint), so
 * the renderer just strokes them after applying its transform.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point3D } from '../types/bim-base';
import type {
  ElectricalPanelGeometry,
  ElectricalPanelParams,
} from '../types/electrical-panel-types';

/** A polyline of world-space points (canvas units). */
export type PanelStroke = readonly Point3D[];

export interface PanelSymbolGeometry {
  /** Closed outline polygon (= the footprint). */
  readonly outline: readonly Point3D[];
  /** Internal divider strokes (breaker rows) identifying the panel. */
  readonly strokes: readonly PanelStroke[];
}

/** Fractions across the panel where internal divider lines are drawn (distribution board). */
const DIVIDER_FRACTIONS = [0.25, 0.5, 0.75] as const;

/** Width-fractions of the comms-rack patch-panel port ticks (ADR-431). */
const RACK_PORT_FRACTIONS = [0.2, 0.35, 0.5, 0.65, 0.8] as const;
/** Length-band the comms-rack port ticks span (lower patch-panel row). */
const RACK_PORT_BAND: readonly [number, number] = [0.55, 0.85];
/** Length-fraction of the comms-rack mid divider (separates the rack header row). */
const RACK_DIVIDER_FRACTION = 0.4;

function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

/**
 * Distribution-board glyph: 3 divider lines spanning the width (parallel to the
 * bottom edge) — the panelboard breaker-rows convention. v0=(-hw,-hl) v1=(hw,-hl)
 * v2=(hw,hl) v3=(-hw,hl); dividers run left→right edge (v0→v3 to v1→v2).
 */
function buildBoardStrokes(corners: readonly Point3D[]): PanelStroke[] {
  const [v0, v1, v2, v3] = corners;
  return DIVIDER_FRACTIONS.map((t) => [lerp(v0, v3, t), lerp(v1, v2, t)]);
}

/**
 * Comms-rack glyph (ADR-431): a header divider + a row of short vertical port ticks
 * — the structured-cabling patch-panel convention, visually distinct from the
 * board's breaker rows. Rotation-aware (built on the already-rotated footprint).
 */
function buildRackStrokes(corners: readonly Point3D[]): PanelStroke[] {
  const [v0, v1, v2, v3] = corners;
  const strokes: PanelStroke[] = [[lerp(v0, v3, RACK_DIVIDER_FRACTION), lerp(v1, v2, RACK_DIVIDER_FRACTION)]];
  const [t0, t1] = RACK_PORT_BAND;
  for (const u of RACK_PORT_FRACTIONS) {
    const bottom = lerp(v0, v1, u);
    const top = lerp(v3, v2, u);
    strokes.push([lerp(bottom, top, t0), lerp(bottom, top, t1)]);
  }
  return strokes;
}

/**
 * Build the panel symbol geometry from params + computed geometry, kind-aware: a
 * distribution board reads as breaker rows, a comms-rack as a patch panel.
 * Rotation-aware because the footprint is already rotated.
 */
export function buildPanelSymbol(
  params: ElectricalPanelParams,
  geometry: ElectricalPanelGeometry,
): PanelSymbolGeometry {
  const outline = geometry.footprint.vertices;

  if (outline.length === 4) {
    const strokes =
      params.kind === 'comms-rack' ? buildRackStrokes(outline) : buildBoardStrokes(outline);
    return { outline, strokes };
  }

  return { outline, strokes: [] };
}
