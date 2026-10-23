/**
 * ADR-920 Β2 — the snapshot frame: WORLD canonical mm in, metres relative to the surface centre out.
 *
 * This is the ONE place a world coordinate is turned into a published one (ADR-920 Δ3). Everything
 * the snapshot carries in plan goes through {@link SnapshotFrame.planM}; nothing else subtracts the
 * centre or divides by 1000, so no field can leak the plot's position by taking a different road.
 *
 * @module lib/terrain/publication/listing-terrain-frame
 */

import { polygonArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { createTinSampler } from '@/lib/terrain/tin-sampler';
import type { TinSurface } from '@/lib/terrain/terrain-types';
import { LISTING_TERRAIN_DECIMALS } from './listing-terrain-config';
import type { ListingTerrainEnvelope, ListingTerrainEnvelopeOmission } from './listing-terrain-types';

/** Round to the published precision (centimetres). `-0` normalised to `0` for byte-stable JSON. */
export function roundPublished(value: number): number {
  const f = 10 ** LISTING_TERRAIN_DECIMALS;
  const r = Math.round(value * f) / f;
  return r === 0 ? 0 : r;
}

export interface SnapshotFrame {
  /** WORLD mm plan point → flat `[x, y]` metres from the centre, rounded. */
  readonly planM: (worldXMm: number, worldYMm: number) => readonly [number, number];
  /** Elevation mm → absolute metres, rounded. */
  readonly elevationM: (zMm: number) => number;
}

/** The frame centred on the plan bounds of `tin` (its bounds are LOCAL, `origin` lifts them to world). */
export function frameOf(tin: TinSurface): SnapshotFrame {
  const cx = tin.origin.x + (tin.bounds.minX + tin.bounds.maxX) / 2;
  const cy = tin.origin.y + (tin.bounds.minY + tin.bounds.maxY) / 2;
  return {
    planM: (x, y) => [roundPublished((x - cx) / 1000), roundPublished((y - cy) / 1000)],
    elevationM: (z) => roundPublished(z / 1000),
  };
}

/** A WORLD mm ring → flat `[x, y, …]` in the frame. */
export function ringToFrame(frame: SnapshotFrame, ring: readonly PlanarPoint[]): number[] {
  return ring.flatMap((p) => frame.planM(p.x, p.y));
}

/** Mesh positions `[x, y, z, …]`: TIN LOCAL mm + origin = WORLD mm → frame. */
export function meshPositions(tin: TinSurface, frame: SnapshotFrame): number[] {
  const out: number[] = [];
  tin.positions.forEach(([lx, ly], i) => {
    const [x, y] = frame.planM(tin.origin.x + lx, tin.origin.y + ly);
    out.push(x, y, frame.elevationM(tin.elevations[i]));
  });
  return out;
}

export type EnvelopeOutcome =
  | { readonly envelope: ListingTerrainEnvelope; readonly omission: null }
  | { readonly envelope: null; readonly omission: ListingTerrainEnvelopeOmission };

/**
 * Stand the buildable footprint on the ground. Every vertex must land on the published surface:
 * a footprint vertex with no ground under it would need an invented elevation, so the envelope is
 * omitted (and says why) instead.
 */
export function placeEnvelope(
  tin: TinSurface,
  frame: SnapshotFrame,
  footprintWorldMm: readonly PlanarPoint[],
  maxHeightM: number | null,
): EnvelopeOutcome {
  if (footprintWorldMm.length < 3 || polygonArea(footprintWorldMm) <= 0) {
    return { envelope: null, omission: 'degenerate-footprint' };
  }
  const sampler = createTinSampler(tin);
  const groundM: number[] = [];
  for (const p of footprintWorldMm) {
    const z = sampler.zAtMm(p.x, p.y);
    if (z === null) return { envelope: null, omission: 'outside-surface' };
    groundM.push(frame.elevationM(z));
  }
  return {
    envelope: {
      footprint: ringToFrame(frame, footprintWorldMm),
      groundM,
      maxHeightM: maxHeightM !== null && Number.isFinite(maxHeightM) && maxHeightM > 0 ? maxHeightM : null,
    },
    omission: null,
  };
}
