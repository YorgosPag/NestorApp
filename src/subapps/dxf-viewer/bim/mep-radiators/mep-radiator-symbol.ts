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

import type { Point3D } from '../types/bim-base';
import type {
  MepRadiatorGeometry,
  MepRadiatorParams,
} from '../types/mep-radiator-types';
import { mmToSceneUnits } from '../../utils/scene-units';

/** A polyline of world-space points (canvas units). */
export type RadiatorStroke = readonly Point3D[];

export interface RadiatorSymbolGeometry {
  /** Closed outline polygon (= the footprint). */
  readonly outline: readonly Point3D[];
  /** Connector stub strokes — supply (first) + return (second). */
  readonly strokes: readonly RadiatorStroke[];
  /** Fin bars across the body (the radiator hatching), drawn with a thin line. */
  readonly finStrokes: readonly RadiatorStroke[];
}

/** Number of parallel fin bars drawn across the radiator body. */
const FIN_BAR_COUNT = 10;

/** Fractional inset of each fin bar from the long (−Y/+Y) edges. */
const FIN_INSET = 0.12;

function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

function unit(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * `FIN_BAR_COUNT` parallel bars across the radiator body — each runs the depth
 * (bottom edge `v0→v3` to top edge `v1→v2`), distributed along the width, inset
 * from the long edges so they stay inside the outline. Rotation-aware for free (the
 * verts are already rotated into world space).
 */
function buildFinStrokes(v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D): RadiatorStroke[] {
  const bars: RadiatorStroke[] = [];
  for (let i = 0; i < FIN_BAR_COUNT; i++) {
    const frac = (i + 1) / (FIN_BAR_COUNT + 1);
    const bottom = lerp(v0, v1, frac); // point along the −Y edge (across width)
    const top = lerp(v3, v2, frac); // matching point along the +Y edge
    bars.push([lerp(bottom, top, FIN_INSET), lerp(bottom, top, 1 - FIN_INSET)]);
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
  if (outline.length !== 4) {
    return { outline, strokes: [], finStrokes: [] };
  }

  // v0=(-hw,-hl) v1=(hw,-hl) v2=(hw,hl) v3=(-hw,hl) — rotated to world.
  const [v0, v1, v2, v3] = outline;
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const stubLen = Math.max(params.length * s * 0.8, 60 * s);

  // Supply stub: from the midpoint of the −X edge (v0→v3), pointing outward −X.
  const supplyRoot = lerp(v0, v3, 0.5);
  const supplyDir = unit(v0.x - v1.x, v0.y - v1.y); // −X local (world-rotated)
  // Return stub: from the midpoint of the +X edge (v1→v2), pointing outward +X.
  const returnRoot = lerp(v1, v2, 0.5);
  const returnDir = unit(v1.x - v0.x, v1.y - v0.y); // +X local (world-rotated)

  const strokes: RadiatorStroke[] = [
    [supplyRoot, { x: supplyRoot.x + supplyDir.x * stubLen, y: supplyRoot.y + supplyDir.y * stubLen, z: 0 }],
    [returnRoot, { x: returnRoot.x + returnDir.x * stubLen, y: returnRoot.y + returnDir.y * stubLen, z: 0 }],
  ];

  return { outline, strokes, finStrokes: buildFinStrokes(v0, v1, v2, v3) };
}
