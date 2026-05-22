/**
 * ADR-370 §6.3 — SlabCornerSnapEngine tests.
 *
 * Verifies:
 *   - Non-slab entities produce no candidates.
 *   - Slab vertices produce candidates at correct positions.
 *   - Candidate type = BIM_SLAB_CORNER, description = 'bim-slab-corner'.
 *   - excludeEntityId suppresses.
 *   - Cursor outside radius = no candidates.
 */

import { SlabCornerSnapEngine } from '../SlabCornerSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import type { SlabEntity } from '../../../bim/types/slab-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel } from '../../../rendering/types/Types';
import type { Polygon3D } from '../../../bim/types/bim-base';

function makeSlabEntity(vertices: { x: number; y: number }[], id = 'slab_test'): SlabEntity {
  const polygon: Polygon3D = { vertices: vertices.map(v => ({ x: v.x, y: v.y })) };
  return {
    id, type: 'slab', kind: 'floor', layerId: '0',
    params: undefined as never,
    geometry: { polygon, bbox: undefined as never, area: 0, netArea: 0, volume: 0, perimeter: 0 },
    validation: undefined as never, visible: true,
  } as unknown as SlabEntity;
}

function makeNonSlab(id = 'circle_1'): EntityModel {
  return { id, type: 'circle', center: { x: 0, y: 0 }, radius: 50, visible: true } as EntityModel;
}

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  return { entities: [], worldRadiusAt: () => 300, worldRadiusForType: () => 300, maxCandidates: 10, ...overrides };
}

const SLAB_VERTS = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }];

describe('SlabCornerSnapEngine', () => {
  let engine: SlabCornerSnapEngine;

  beforeEach(() => { engine = new SlabCornerSnapEngine(); });
  afterEach(() => { engine.dispose(); });

  it('no candidates for non-slab entities', () => {
    engine.initialize([makeNonSlab()]);
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('finds slab vertex at (0, 0)', () => {
    engine.initialize([makeSlabEntity(SLAB_VERTS)]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    const hit = candidates.find((c) => Math.abs(c.point.x) < 1 && Math.abs(c.point.y) < 1);
    expect(hit).toBeDefined();
  });

  it('finds slab vertex at (1000, 800)', () => {
    engine.initialize([makeSlabEntity(SLAB_VERTS)]);
    const { candidates } = engine.findSnapCandidates({ x: 1000, y: 800 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('candidate type = BIM_SLAB_CORNER, description = bim-slab-corner', () => {
    engine.initialize([makeSlabEntity(SLAB_VERTS)]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates[0]!.type).toBe(ExtendedSnapType.BIM_SLAB_CORNER);
    expect(candidates[0]!.description).toBe('bim-slab-corner');
  });

  it('excludeEntityId suppresses', () => {
    engine.initialize([makeSlabEntity(SLAB_VERTS, 'slab_x')]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext({ excludeEntityId: 'slab_x' }));
    expect(candidates).toHaveLength(0);
  });

  it('cursor outside radius returns no candidates', () => {
    engine.initialize([makeSlabEntity(SLAB_VERTS)]);
    expect(engine.findSnapCandidates({ x: 9999, y: 9999 }, makeContext({ worldRadiusForType: () => 5 })).candidates).toHaveLength(0);
  });
});
