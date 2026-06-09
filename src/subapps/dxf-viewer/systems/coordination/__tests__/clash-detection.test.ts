/**
 * ADR-435 — Clash Detection (Slice 0): unit + integration tests.
 *
 * Pure/deterministic across all layers: AABB math, segment narrow-phase,
 * broad-phase grid, the Entity→ClashEntity normaliser, and the full
 * `detectClashes` orchestrator (hard pipe↔pipe, legit-connection skip, pipe↔beam,
 * drainage↔potable clearance, far-apart no-clash).
 */

import type { Entity } from '../../../types/entities';
import type { MepSegmentEntity } from '../../../bim/types/mep-segment-types';
import type { MepSystemEntity } from '../../../bim/types/mep-system-types';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';
import type { Aabb3, ClashEntity } from '../clash-types';
import { aabbOverlap, aabbOverlapVolumeM3, aabbFromPoints } from '../aabb';
import { closestDistanceBetweenSegments, segmentAabbHit } from '../clash-narrow-phase';
import { broadPhasePairs } from '../broad-phase';
import { entityWorldAABB } from '../entity-world-aabb';
import { detectClashes } from '../detect-clashes';

// ─── Builders ───────────────────────────────────────────────────────────────────

const box = (min: [number, number, number], max: [number, number, number]): Aabb3 => ({
  min: { x: min[0], y: min[1], z: min[2] },
  max: { x: max[0], y: max[1], z: max[2] },
});

/** Pipe in metres scene units (plan coords = metres directly). */
function pipe(
  id: string,
  a: [number, number],
  b: [number, number],
  opts: { zMm?: number; diameterMm?: number; classification?: PlumbingSystemClassification } = {},
): MepSegmentEntity {
  const z = opts.zMm ?? 1000;
  return {
    id,
    type: 'mep-segment',
    layerId: 'mep',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      diameter: opts.diameterMm ?? 50,
      startPoint: { x: a[0], y: a[1], z },
      endPoint: { x: b[0], y: b[1], z },
      centerlineElevationMm: z,
      classification: opts.classification,
      sceneUnits: 'm',
      connectors: [],
    },
  } as unknown as MepSegmentEntity;
}

function beam(id: string, bbox: Aabb3): Entity {
  return { id, type: 'beam', layerId: 'struct', params: {}, geometry: { bbox } } as unknown as Entity;
}

function system(id: string, memberIds: readonly string[]): MepSystemEntity {
  return {
    id,
    params: {
      name: id,
      sourceEntityId: memberIds[0] ?? '',
      sourceConnectorId: 'c0',
      members: memberIds.map((entityId) => ({ entityId, connectorId: 'c0' })),
    },
  } as unknown as MepSystemEntity;
}

const run = (entities: readonly Entity[], systems: readonly MepSystemEntity[] = []) =>
  detectClashes({ entities, systems, sceneUnits: 'm' });

// ─── AABB math ──────────────────────────────────────────────────────────────────

describe('aabb helpers', () => {
  it('detects overlap and disjointness', () => {
    expect(aabbOverlap(box([0, 0, 0], [1, 1, 1]), box([0.5, 0.5, 0.5], [2, 2, 2]))).toBe(true);
    expect(aabbOverlap(box([0, 0, 0], [1, 1, 1]), box([2, 0, 0], [3, 1, 1]))).toBe(false);
  });

  it('respects the inflation margin', () => {
    const a = box([0, 0, 0], [1, 1, 1]);
    const b = box([1.2, 0, 0], [2, 1, 1]);
    expect(aabbOverlap(a, b)).toBe(false);
    expect(aabbOverlap(a, b, 0.3)).toBe(true);
  });

  it('computes overlap volume', () => {
    expect(aabbOverlapVolumeM3(box([0, 0, 0], [2, 2, 2]), box([1, 1, 1], [3, 3, 3]))).toBeCloseTo(1);
    expect(aabbOverlapVolumeM3(box([0, 0, 0], [1, 1, 1]), box([5, 5, 5], [6, 6, 6]))).toBe(0);
  });

  it('normalises corners from two points', () => {
    const a = aabbFromPoints({ x: 2, y: 0, z: 3 }, { x: -1, y: 4, z: 1 });
    expect(a.min).toEqual({ x: -1, y: 0, z: 1 });
    expect(a.max).toEqual({ x: 2, y: 4, z: 3 });
  });
});

// ─── Narrow-phase ───────────────────────────────────────────────────────────────

describe('closestDistanceBetweenSegments', () => {
  it('returns 0 for crossing segments', () => {
    const r = closestDistanceBetweenSegments(
      { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
      { x: 1, y: -1, z: 0 }, { x: 1, y: 1, z: 0 },
    );
    expect(r.distM).toBeCloseTo(0);
    expect(r.point.x).toBeCloseTo(1);
  });

  it('measures the gap of parallel segments', () => {
    const r = closestDistanceBetweenSegments(
      { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
      { x: 0, y: 0.3, z: 0 }, { x: 2, y: 0.3, z: 0 },
    );
    expect(r.distM).toBeCloseTo(0.3);
  });
});

describe('segmentAabbHit', () => {
  const b = box([0.9, -0.1, 0.5], [1.1, 0.1, 1.5]);
  it('hits a segment passing through the box', () => {
    expect(segmentAabbHit({ x: 0, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }, b, 0.025)).not.toBeNull();
  });
  it('misses a segment clear of the box', () => {
    expect(segmentAabbHit({ x: 0, y: 5, z: 1 }, { x: 2, y: 5, z: 1 }, b, 0.025)).toBeNull();
  });
});

// ─── Broad-phase ────────────────────────────────────────────────────────────────

describe('broadPhasePairs', () => {
  const ce = (id: string, b: Aabb3): ClashEntity => ({ id, kind: 'mep-segment', aabb: b, systemIds: [] });
  it('pairs overlapping boxes and skips distant ones', () => {
    const near = broadPhasePairs([ce('a', box([0, 0, 0], [1, 1, 1])), ce('b', box([0.5, 0, 0], [1.5, 1, 1]))]);
    expect(near.pairs.length).toBe(1);
    const far = broadPhasePairs([ce('a', box([0, 0, 0], [1, 1, 1])), ce('b', box([50, 50, 50], [51, 51, 51]))]);
    expect(far.pairs.length).toBe(0);
  });
});

// ─── Normaliser ─────────────────────────────────────────────────────────────────

describe('entityWorldAABB', () => {
  it('builds a capsule + radius for a pipe', () => {
    const ce = entityWorldAABB(pipe('p', [0, 0], [2, 0], { diameterMm: 50 }), 'm', []);
    expect(ce?.kind).toBe('mep-segment');
    expect(ce?.capsule?.radiusM).toBeCloseTo(0.025);
    expect(ce?.capsule?.a.z).toBeCloseTo(1); // 1000mm → 1m
  });

  it('applies column height to the z=0 footprint bbox', () => {
    const column = {
      id: 'col', type: 'column', layerId: 's', params: { height: 3000 },
      geometry: { bbox: box([0, 0, 0], [0.3, 0.3, 0]) },
    } as unknown as Entity;
    const ce = entityWorldAABB(column, 'm', []);
    expect(ce?.aabb.min.z).toBeCloseTo(0);
    expect(ce?.aabb.max.z).toBeCloseTo(3);
  });

  it('spans mounted equipment around its mounting elevation', () => {
    const radiator = {
      id: 'rad', type: 'mep-radiator', layerId: 'm',
      params: { mountingElevationMm: 1000, bodyHeightMm: 600 },
      geometry: { bbox: box([0, 0, 0], [1, 0.1, 0]) },
    } as unknown as Entity;
    const ce = entityWorldAABB(radiator, 'm', []);
    expect(ce?.aabb.min.z).toBeCloseTo(0.7);
    expect(ce?.aabb.max.z).toBeCloseTo(1.3);
  });
});

// ─── Orchestrator ───────────────────────────────────────────────────────────────

describe('detectClashes', () => {
  it('flags two crossing pipes at the same elevation as a hard clash', () => {
    const report = run([pipe('a', [0, 0], [2, 0]), pipe('b', [1, -1], [1, 1])]);
    expect(report.clashes).toHaveLength(1);
    expect(report.clashes[0].type).toBe('hard');
    expect(report.clashes[0].severity).toBe('medium');
  });

  it('does NOT flag crossing pipes that share a MepSystem (legit connection)', () => {
    const report = run([pipe('a', [0, 0], [2, 0]), pipe('b', [1, -1], [1, 1])], [system('sys', ['a', 'b'])]);
    expect(report.clashes).toHaveLength(0);
  });

  it('flags a pipe passing through a beam as a high-severity hard clash', () => {
    const report = run([pipe('p', [0, 0], [2, 0]), beam('bm', box([0.9, -0.1, 0.5], [1.1, 0.1, 1.5]))]);
    expect(report.clashes).toHaveLength(1);
    expect(report.clashes[0].severity).toBe('high');
  });

  it('flags drainage running too close to potable water as a clearance clash', () => {
    const report = run([
      pipe('d', [0, 0], [2, 0], { classification: 'sanitary-drainage' }),
      pipe('w', [0, 0.07], [2, 0.07], { classification: 'domestic-cold-water' }),
    ]);
    expect(report.clashes).toHaveLength(1);
    expect(report.clashes[0].type).toBe('clearance');
    expect(report.clashes[0].ruleId).toBe('drainage-potable-separation');
  });

  it('finds no clash between distant pipes', () => {
    const report = run([pipe('a', [0, 0], [2, 0]), pipe('b', [0, 10], [2, 10])]);
    expect(report.clashes).toHaveLength(0);
    expect(report.scannedEntities).toBe(2);
  });
});
