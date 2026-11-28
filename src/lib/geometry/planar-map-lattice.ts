/**
 * =============================================================================
 * PLANAR MAP LATTICE (SSoT) — an expensive smooth map `(u, v) → (x, y)`, read cheaply, with its error MEASURED
 * =============================================================================
 *
 *   exact(u, v) at the nodes of a regular lattice over a box ─▶ bilinear reading anywhere inside it
 *
 * 🔑 **The error is measured against the exact map, never assumed** (ADR-920 §14.12 Β3.1). The lattice is refined
 * (1, 2, 4, … cells per axis) until the bilinear reading agrees with the exact map to within `tolerance` at the probes
 * of every cell — its centre and the middles of its four sides, where the error of a bilinear reading of a smooth map
 * peaks (the centre when the two curvatures agree in sign, a side when they do not). It is accepted at HALF the
 * tolerance, so that what lies between the probes stays inside it. No lattice within the cap ⇒ `null`: the caller keeps
 * the exact map. It never returns a lattice it could not vouch for.
 *
 * 🔑 **Anchored to the DOMAIN, not to whoever asks.** GDAL's approximate transformer does the same trade per scanline
 * of the raster being produced, with its tolerance in pixels of that raster — so the answer at a point depends on which
 * raster asked. Here the lattice belongs to the box: two tiles, two zoom levels and a worker all read the same numbers
 * at the same point. The reading stays a pure function of the point.
 *
 * ⚠️ It is an approximation of the map, and says so (`measuredError`). Whoever needs THE value asks the exact map.
 *
 * Pure, unit-agnostic: the tolerance is in the units of (x, y).
 *
 * @module lib/geometry/planar-map-lattice
 */

import type { PlanarPoint } from './planar-polygon';

/** The box the lattice covers, in the units of the map's input. */
export interface PlanarMapDomain {
  readonly minU: number;
  readonly minV: number;
  readonly maxU: number;
  readonly maxV: number;
}

/** A reusable result for a caller that asks many times. */
export interface PlanarPointSink {
  x: number;
  y: number;
}

export interface PlanarMapLattice {
  readonly domain: PlanarMapDomain;
  readonly cellsPerAxis: number;
  /** The tolerance the lattice was built for. */
  readonly tolerance: number;
  /** The largest disagreement with the exact map found at the probes — at most half of {@link tolerance}. */
  readonly measuredError: number;
  /** The reading at (u, v), written into `sink`. Outside the domain the border cell is extended — do not ask there. */
  readonly mapInto: (sink: PlanarPointSink, u: number, v: number) => void;
}

export type ExactPlanarMap = (u: number, v: number) => PlanarPoint;

/** Probes of one cell, as fractions of it: the centre and the middles of the four sides. */
const PROBES: readonly (readonly [number, number])[] = [[0.5, 0.5], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]];

/** A lattice is accepted when its measured error is at most this share of the tolerance. */
const ACCEPTED_SHARE_OF_TOLERANCE = 0.5;

const DEFAULT_MAX_CELLS_PER_AXIS = 64;

/** `[x, y]` of the exact map at every node, row by row from (minU, minV); `cells + 1` nodes per axis. */
function nodesOf(exact: ExactPlanarMap, domain: PlanarMapDomain, cells: number): Float64Array {
  const perAxis = cells + 1;
  const nodes = new Float64Array(perAxis * perAxis * 2);
  for (let j = 0; j < perAxis; j++) {
    const v = domain.minV + ((domain.maxV - domain.minV) * j) / cells;
    for (let i = 0; i < perAxis; i++) {
      const at = exact(domain.minU + ((domain.maxU - domain.minU) * i) / cells, v);
      nodes[(j * perAxis + i) * 2] = at.x;
      nodes[(j * perAxis + i) * 2 + 1] = at.y;
    }
  }
  return nodes;
}

function readerOf(nodes: Float64Array, domain: PlanarMapDomain, cells: number): PlanarMapLattice['mapInto'] {
  const perAxis = cells + 1;
  const cellsPerU = cells / (domain.maxU - domain.minU);
  const cellsPerV = cells / (domain.maxV - domain.minV);
  return (sink, u, v) => {
    const s = (u - domain.minU) * cellsPerU;
    const t = (v - domain.minV) * cellsPerV;
    const i = Math.min(cells - 1, Math.max(0, Math.floor(s)));
    const j = Math.min(cells - 1, Math.max(0, Math.floor(t)));
    const fs = s - i;
    const ft = t - j;
    const low = (j * perAxis + i) * 2;
    const high = low + perAxis * 2;
    const w00 = (1 - fs) * (1 - ft); const w10 = fs * (1 - ft);
    const w01 = (1 - fs) * ft; const w11 = fs * ft;
    sink.x = nodes[low] * w00 + nodes[low + 2] * w10 + nodes[high] * w01 + nodes[high + 2] * w11;
    sink.y = nodes[low + 1] * w00 + nodes[low + 3] * w10 + nodes[high + 1] * w01 + nodes[high + 3] * w11;
  };
}

/** The largest distance between the reading and the exact map over the probes of every cell. */
function measuredErrorOf(exact: ExactPlanarMap, read: PlanarMapLattice['mapInto'], domain: PlanarMapDomain, cells: number): number {
  const sink: PlanarPointSink = { x: 0, y: 0 };
  const stepU = (domain.maxU - domain.minU) / cells;
  const stepV = (domain.maxV - domain.minV) / cells;
  let worst = 0;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      for (const [pu, pv] of PROBES) {
        const u = domain.minU + (i + pu) * stepU;
        const v = domain.minV + (j + pv) * stepV;
        read(sink, u, v);
        const truth = exact(u, v);
        worst = Math.max(worst, Math.hypot(sink.x - truth.x, sink.y - truth.y));
      }
    }
  }
  return worst;
}

/**
 * The coarsest lattice of `exact` over `domain` whose measured error is within half of `tolerance`, or `null` when the
 * domain is empty, the tolerance is not positive, or no lattice up to `maxCellsPerAxis` gets there.
 */
export function createPlanarMapLattice(
  exact: ExactPlanarMap,
  domain: PlanarMapDomain,
  tolerance: number,
  maxCellsPerAxis: number = DEFAULT_MAX_CELLS_PER_AXIS,
): PlanarMapLattice | null {
  if (!(domain.maxU > domain.minU) || !(domain.maxV > domain.minV) || !(tolerance > 0)) return null;
  for (let cells = 1; cells <= maxCellsPerAxis; cells *= 2) {
    const mapInto = readerOf(nodesOf(exact, domain, cells), domain, cells);
    const measuredError = measuredErrorOf(exact, mapInto, domain, cells);
    // `<=` on a finite number: a map that answers NaN anywhere never passes.
    if (measuredError <= tolerance * ACCEPTED_SHARE_OF_TOLERANCE) {
      return { domain, cellsPerAxis: cells, tolerance, measuredError, mapInto };
    }
  }
  return null;
}
