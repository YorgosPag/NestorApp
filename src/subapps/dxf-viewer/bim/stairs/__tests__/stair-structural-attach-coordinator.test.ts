/**
 * Tests for stair-structural-attach-coordinator (ADR-401 Phase G.3).
 *
 * Pure detection: which storey-bound stairs auto-attach their top/base to a
 * just-created beam/slab host (run-sample plan overlap + Z gate). Mirror of the
 * column coordinator test. mm scene (run samples + host footprints in mm).
 */

import {
  findStairsToAutoAttachToHost,
  findStairsToAutoAttachBaseToHost,
} from '../stair-structural-attach-coordinator';
import type { Entity } from '../../../types/entities';
import type { BeamEntity } from '../../types/beam-types';
import type { SlabEntity } from '../../types/slab-types';
import { buildDefaultStairParams } from '../../../hooks/drawing/stair-completion';

/** Beam axis (0,0)→(4000,0), width 250 → footprint band y∈[-125,125], underside = topElevation−depth. */
function beamOver(topElevation = 3000): BeamEntity {
  return {
    id: 'beam_1', type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 4000, y: 0 },
      width: 250, depth: 500, topElevation, zOffset: 0, sceneUnits: 'mm',
    },
  } as unknown as BeamEntity;
}

/** Slab footprint 5000×5000 at `levelElevation`, thickness 150. */
function slabAt(levelElevation: number): SlabEntity {
  return {
    id: 'slab_1', type: 'slab', kind: 'floor',
    params: {
      kind: 'floor',
      outline: { vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }] },
      levelElevation, heightOffsetFromLevel: 0, thickness: 150, geometryType: 'box',
    },
  } as unknown as SlabEntity;
}

/**
 * Straight stair (mm): base at (bx, by, bz), direction +X, totalRun → top edge
 * centre at (bx + run, by). Run/width small so the centre sample lands in the
 * beam band. `topBinding` defaults to 'storey-ceiling' (top-attach eligible).
 */
function stair(
  id: string,
  base: { x: number; y: number; z: number },
  overrides: Record<string, unknown> = {},
): Entity {
  const params = buildDefaultStairParams({ x: base.x, y: base.y }, 0, {
    width: 600, stepCount: 16,
  });
  return {
    id, type: 'stair', kind: 'straight',
    params: {
      ...params,
      basePoint: { x: base.x, y: base.y, z: base.z },
      totalRun: 3000,
      topBinding: 'storey-ceiling',
      ...overrides,
    },
  } as unknown as Entity;
}

describe('findStairsToAutoAttachToHost (top)', () => {
  it('attaches a storey-ceiling stair whose top edge sits under a beam (above base)', () => {
    const beam = beamOver(); // underside 2500 > base 0
    const s = stair('s1', { x: 0, y: 0, z: 0 }); // top centre (3000,0) inside band [-125,125]
    expect(findStairsToAutoAttachToHost(beam as unknown as Entity, [s])).toEqual(['s1']);
  });

  it('attaches under a CEILING slab (underside above base)', () => {
    const slab = slabAt(3000); // underside 2850 > base 0
    const s = stair('s1', { x: 1000, y: 1000, z: 0 }); // top centre (4000,1000) inside slab
    expect(findStairsToAutoAttachToHost(slab as unknown as Entity, [s])).toEqual(['s1']);
  });

  it('does NOT attach to a FLOOR slab below the stair base (Z gate)', () => {
    const slab = slabAt(0); // underside -150 <= base 0 → skip
    const s = stair('s1', { x: 1000, y: 1000, z: 0 });
    expect(findStairsToAutoAttachToHost(slab as unknown as Entity, [s])).toEqual([]);
  });

  it('does NOT attach when the top edge does not overlap the host', () => {
    const beam = beamOver();
    const s = stair('s1', { x: 0, y: 5000, z: 0 }); // top centre (3000,5000) far from band
    expect(findStairsToAutoAttachToHost(beam as unknown as Entity, [s])).toEqual([]);
  });

  it('ignores stairs whose topBinding is not "storey-ceiling" (default unconnected)', () => {
    const beam = beamOver();
    const s = stair('s1', { x: 0, y: 0, z: 0 }, { topBinding: 'unconnected' });
    expect(findStairsToAutoAttachToHost(beam as unknown as Entity, [s])).toEqual([]);
  });

  it('returns [] for a non-host entity (not beam/slab)', () => {
    const line = { id: 'l1', type: 'line' } as unknown as Entity;
    expect(findStairsToAutoAttachToHost(line, [stair('s1', { x: 0, y: 0, z: 0 })])).toEqual([]);
  });
});

describe('findStairsToAutoAttachBaseToHost (base, inverted Z gate)', () => {
  it('attaches a stair whose base edge sits over a FOUNDATION beam (topside below base)', () => {
    const beam = beamOver(-100); // topside -100 < base 0
    const s = stair('s1', { x: 0, y: 0, z: 0 }); // base centre (0,0) inside band
    expect(findStairsToAutoAttachBaseToHost(beam as unknown as Entity, [s])).toEqual(['s1']);
  });

  it('attaches over a FOUNDATION slab (topside below base)', () => {
    const slab = slabAt(-100); // topside -100 < base 0
    const s = stair('s1', { x: 1000, y: 1000, z: 0 });
    expect(findStairsToAutoAttachBaseToHost(slab as unknown as Entity, [s])).toEqual(['s1']);
  });

  it('treats undefined baseBinding as the default "storey-floor" (eligible)', () => {
    const beam = beamOver(-100);
    const s = stair('s1', { x: 0, y: 0, z: 0 }, { baseBinding: undefined });
    expect(findStairsToAutoAttachBaseToHost(beam as unknown as Entity, [s])).toEqual(['s1']);
  });

  it('does NOT attach to a CEILING slab above the base (inverted Z gate)', () => {
    const slab = slabAt(3000); // topside 3000 > base 0 → skip
    const s = stair('s1', { x: 1000, y: 1000, z: 0 });
    expect(findStairsToAutoAttachBaseToHost(slab as unknown as Entity, [s])).toEqual([]);
  });

  it('ignores stairs whose baseBinding is explicitly not "storey-floor"', () => {
    const beam = beamOver(-100);
    const s = stair('s1', { x: 0, y: 0, z: 0 }, { baseBinding: 'absolute' });
    expect(findStairsToAutoAttachBaseToHost(beam as unknown as Entity, [s])).toEqual([]);
  });

  it('returns [] for a non-host entity', () => {
    const line = { id: 'l1', type: 'line' } as unknown as Entity;
    expect(findStairsToAutoAttachBaseToHost(line, [stair('s1', { x: 0, y: 0, z: 0 })])).toEqual([]);
  });
});
