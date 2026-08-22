/**
 * Heating radiator 2D symbol SSoT (ADR-408 Εύρος Β #1).
 *
 * Single source of truth for the *vector* symbol of a radiator (καλοριφέρ), shared
 * by the 2D renderer and the placement ghost. Pure + geometry-driven: it reads the
 * already-computed (rotated) footprint and emits the panel outline plus a fin
 * pattern (parallel bars across the body — the architectural radiator convention)
 * and two connector stubs (supply −X end, return +X end).
 *
 * All coordinates are in world canvas units (same space as the footprint), so the
 * renderer just strokes them after applying its transform.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { BimPoint } from '../types/bim-base';
import type {
  MepRadiatorGeometry,
  MepRadiatorParams,
} from '../types/mep-radiator-types';
import { buildLateralStubStrokes } from '../geometry/shared/rectangular-body-geometry';
import { lerpPlanPoint } from '../geometry/shared/plan-frame';

/** A polyline of world-space points (canvas units). */
export type RadiatorStroke = readonly BimPoint[];

export interface RadiatorSymbolGeometry {
  /** Closed outline polygon (= the footprint). */
  readonly outline: readonly BimPoint[];
  /** Connector stub strokes — supply (first) + return (second). */
  readonly strokes: readonly RadiatorStroke[];
  /** Fin bars across the body (the radiator hatching), drawn with a thin line. */
  readonly finStrokes: readonly RadiatorStroke[];
}

/** Number of parallel fin bars drawn across the radiator body. */
const FIN_BAR_COUNT = 10;

/** Fractional inset of each fin bar from the long (−Y/+Y) edges. */
const FIN_INSET = 0.12;

/**
 * `FIN_BAR_COUNT` parallel bars across the radiator body — each runs the depth
 * (bottom edge `v0→v3` to top edge `v1→v2`), distributed along the width, inset
 * from the long edges so they stay inside the outline. Rotation-aware for free (the
 * verts are already rotated into world space).
 */
function buildFinStrokes(v0: BimPoint, v1: BimPoint, v2: BimPoint, v3: BimPoint): RadiatorStroke[] {
  const bars: RadiatorStroke[] = [];
  for (let i = 0; i < FIN_BAR_COUNT; i++) {
    const frac = (i + 1) / (FIN_BAR_COUNT + 1);
    const bottom = lerpPlanPoint(v0, v1, frac); // point along the −Y edge (across width)
    const top = lerpPlanPoint(v3, v2, frac); // matching point along the +Y edge
    bars.push([lerpPlanPoint(bottom, top, FIN_INSET), lerpPlanPoint(bottom, top, 1 - FIN_INSET)]);
  }
  return bars;
}

/**
 * Build the radiator symbol geometry from params + computed geometry. Rectangular
 * panel → a fin pattern across the body plus a supply stub off the −X end and a
 * return stub off the +X end, all rotation-aware because the footprint is rotated.
 */
export function buildMepRadiatorSymbol(
  params: MepRadiatorParams,
  geometry: MepRadiatorGeometry,
): RadiatorSymbolGeometry {
  const outline = geometry.footprint.vertices;
  const stubs = buildLateralStubStrokes(outline, params.length, params.sceneUnits);
  if (!stubs) {
    return { outline, strokes: [], finStrokes: [] };
  }

  // v0=(-hw,-hl) v1=(hw,-hl) v2=(hw,hl) v3=(-hw,hl) — rotated to world.
  const [v0, v1, v2, v3] = outline;

  // Supply = midpoint of the −X edge (outward −X); return = +X edge (outward +X).
  const strokes: RadiatorStroke[] = [...stubs];

  return { outline, strokes, finStrokes: buildFinStrokes(v0, v1, v2, v3) };
}
