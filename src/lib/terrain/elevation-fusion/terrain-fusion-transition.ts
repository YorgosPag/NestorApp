/**
 * ADR-920 §14.12 Β3 — **the transition zone as a shape**: the band of interpolated ground around the survey, as rings
 * the map can draw and the legend can name («interpolation, not measurement», decisions Β-4 · Β-5).
 *
 *   distance to the measured ground (the mosaic's OWN function) ─ sampled on a lattice ─ marched at «= width» ─▶ outer line
 *   outer line(s) + the rim of the survey ─ `nestRings` (even–odd) ─▶ the band, with the survey as its hole
 *
 * 🔑 **Drawn from the definition that sets the heights.** The band is «closer to the measured ground than the width»,
 * and the distance is `distanceOutsideMeasured` — the one `groundVerdictAt` decides by. No polygon-offset library: a
 * second definition (mitred or rounded corners, its own tolerance) is how the picture and the ground come to disagree.
 *
 * 🔑 **The lattice error is declared, and harmless.** A vertex of the outer line sits on a lattice edge, where the
 * distance was interpolated linearly: it may be off the true line by up to half that edge (`step · √2 / 2`) where the
 * distance field has a crease, and by about `step² / (8 · width)` elsewhere. At the outer line the pull has already
 * faded to zero with zero slope (`3t² − 2t³`), so a few decimetres of outline are a few millimetres of ground.
 *
 * 🔑 **Even–odd does the rest.** Crossing the rim switches between «measured» and «band»; crossing the outer line
 * switches between «band» and «coarse». So the rings of both, nested by parity, fill exactly the band — also inside a
 * hole of the survey (wholly band when it is narrow, a ring of band when it is wide).
 *
 * Pure: no I/O, no MapLibre.
 *
 * @module lib/terrain/elevation-fusion/terrain-fusion-transition
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { chainSegments } from '@/lib/terrain/contour-chainer';
import { marchTriangle } from '@/lib/terrain/marching-triangles';
import {
  LISTING_TERRAIN_FUSION_OUTLINE_MAX_CELLS,
  LISTING_TERRAIN_FUSION_OUTLINE_STEPS_PER_WIDTH,
} from '@/lib/terrain/publication/listing-terrain-config';
import { regionRings } from '@/lib/terrain/publication/terrain-map-regions';

import { distanceOutsideMeasured, type TerrainFusionSurface } from './terrain-fusion-surface';

export interface TerrainTransitionZone {
  /**
   * Rings WITHOUT hierarchy, snapshot frame: the outer line(s) of the band and the rim of the survey. Filled by the
   * even–odd rule they are the band (`nestRings` gives a map the same answer as holes).
   */
  readonly rings: readonly (readonly PlanarPoint[])[];
  readonly widthM: number;
  /** The lattice step the outer line was marched on, metres — the bound of its error (see the module doc). */
  readonly stepM: number;
}

/** The plane is nudged a hair INSIDE the width, so a lattice node exactly at the width is never «on» it. */
const LEVEL_NUDGE_FRACTION = 1e-9;

/** How many lattice steps the lattice extends beyond the reach, so every outer line closes inside it. */
const LATTICE_MARGIN_STEPS = 2;

interface Lattice {
  readonly minX: number;
  readonly minY: number;
  readonly stepM: number;
  readonly columns: number;
  readonly rows: number;
}

/** The lattice over the reach of the survey, or `null` when the survey is too large for the width to be resolved. */
function latticeOf(surface: TerrainFusionSurface): Lattice | null {
  const { reach, transitionM } = surface;
  const span = Math.max(reach.maxX - reach.minX, reach.maxY - reach.minY);
  if (!Number.isFinite(span)) return null;
  const stepM = Math.max(
    transitionM / LISTING_TERRAIN_FUSION_OUTLINE_STEPS_PER_WIDTH,
    span / LISTING_TERRAIN_FUSION_OUTLINE_MAX_CELLS,
  );
  // A lattice edge (step · √2) must be shorter than the width, or the line could slip between two nodes unseen.
  if (stepM > transitionM / 2) return null;
  const margin = LATTICE_MARGIN_STEPS * stepM;
  return {
    minX: reach.minX - margin,
    minY: reach.minY - margin,
    stepM,
    columns: Math.ceil((reach.maxX - reach.minX + 2 * margin) / stepM) + 1,
    rows: Math.ceil((reach.maxY - reach.minY + 2 * margin) / stepM) + 1,
  };
}

function nodeOf(lattice: Lattice, column: number, row: number): PlanarPoint {
  return { x: lattice.minX + column * lattice.stepM, y: lattice.minY + row * lattice.stepM };
}

/** The distance to the measured ground at every node, capped just beyond the width (farther is simply «outside»). */
function distancesOf(surface: TerrainFusionSurface, lattice: Lattice, points: readonly PlanarPoint[]): Float64Array {
  const cap = surface.transitionM + LATTICE_MARGIN_STEPS * lattice.stepM;
  return Float64Array.from(points, ({ x, y }) => distanceOutsideMeasured(surface, x, y, cap) ?? cap);
}

/** The outer line of the band: the iso-line of the distance at the width, as closed rings. */
function outerLinesOf(surface: TerrainFusionSurface, lattice: Lattice): PlanarPoint[][] {
  const { columns, rows } = lattice;
  const points = Array.from({ length: columns * rows }, (_, i) => nodeOf(lattice, i % columns, Math.floor(i / columns)));
  const distance = distancesOf(surface, lattice, points);
  const plane = surface.transitionM * (1 - LEVEL_NUDGE_FRACTION);
  const segments: { a: PlanarPoint; b: PlanarPoint }[] = [];
  const march = (i: number, j: number, k: number): void => {
    const hit = marchTriangle(points[i], distance[i], points[j], distance[j], points[k], distance[k], plane);
    if (hit !== null) segments.push({ a: hit[0], b: hit[1] });
  };
  for (let row = 0; row + 1 < rows; row++) {
    for (let column = 0; column + 1 < columns; column++) {
      const i = row * columns + column;
      march(i, i + 1, i + columns + 1);
      march(i, i + columns + 1, i + columns);
    }
  }
  return chainSegments(segments)
    .filter(({ closed, points: run }) => closed && run.length > 3)
    .map(({ points: run }) => run.slice(0, -1));
}

/**
 * The transition zone of the surface, or `null` when there is none to draw: no width, or a survey so large that the
 * width cannot be resolved on the capped lattice (the heights are unaffected — only this outline is not drawn).
 */
export function transitionZoneOf(surface: TerrainFusionSurface): TerrainTransitionZone | null {
  if (surface.transitionM <= 0) return null;
  const lattice = latticeOf(surface);
  if (lattice === null) return null;
  const rim = regionRings(surface.index.snapshot.mesh, surface.index.triangles);
  return {
    rings: [...outerLinesOf(surface, lattice), ...rim],
    widthM: surface.transitionM,
    stepM: lattice.stepM,
  };
}
