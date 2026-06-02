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

/** Fractions across the panel where internal divider lines are drawn. */
const DIVIDER_FRACTIONS = [0.25, 0.5, 0.75] as const;

function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

/**
 * Build the panel symbol geometry from params + computed geometry.
 * Rectangular distribution board → 3 divider lines spanning the width (parallel
 * to the bottom edge), rotation-aware because the footprint is already rotated.
 */
export function buildPanelSymbol(
  _params: ElectricalPanelParams,
  geometry: ElectricalPanelGeometry,
): PanelSymbolGeometry {
  const outline = geometry.footprint.vertices;

  if (outline.length === 4) {
    // v0=(-hw,-hl) v1=(hw,-hl) v2=(hw,hl) v3=(-hw,hl). Dividers run left→right
    // edge (v0→v3 to v1→v2) at each fraction along the length.
    const [v0, v1, v2, v3] = outline;
    const strokes: PanelStroke[] = DIVIDER_FRACTIONS.map((t) => [
      lerp(v0, v3, t),
      lerp(v1, v2, t),
    ]);
    return { outline, strokes };
  }

  return { outline, strokes: [] };
}
