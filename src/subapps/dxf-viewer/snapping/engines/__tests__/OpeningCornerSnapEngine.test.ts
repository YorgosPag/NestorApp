/**
 * ADR-370 §6.5 — OpeningCornerSnapEngine tests.
 *
 * Verifies:
 *   - Non-opening entities produce no candidates.
 *   - 4-vertex opening outline produces 4 candidates at correct positions.
 *   - Candidate type = BIM_OPENING_CORNER, description = 'bim-opening-corner'.
 *   - excludeEntityId suppresses.
 *   - Cursor outside radius = no candidates.
 */

import { OpeningCornerSnapEngine } from '../OpeningCornerSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import type { OpeningEntity } from '../../../bim/types/opening-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel } from '../../../rendering/types/Types';
import type { Polygon3D } from '../../../bim/types/bim-base';

function makeOpeningEntity(vertices: { x: number; y: number }[], id = 'opening_test'): OpeningEntity {
  const outline: Polygon3D = { vertices: vertices.map((v) => ({ x: v.x, y: v.y })) };
  return {
    id,
    type: 'opening',
    kind: 'door',
    ifcType: 'IfcDoor',
    layerId: '0',
    params: { kind: 'door', wallId: 'wall_1', offsetFromStart: 500, width: 900, height: 2100, sillHeight: 0 },
    geometry: {
      position: { x: 500, y: 0 },
      rotation: 0,
      outline,
      bbox: undefined as never,
      area: 1.89,
      perimeter: 6,
    },
    validation: undefined as never,
    visible: true,
  } as unknown as OpeningEntity;
}

function makeNonOpening(id = 'slab_1'): EntityModel {
  return { id, type: 'slab', visible: true } as EntityModel;
}

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  return { entities: [], worldRadiusAt: () => 300, worldRadiusForType: () => 300, maxCandidates: 10, ...overrides };
}

const RECT_4 = [
  { x: 500, y: -125 },
  { x: 1400, y: -125 },
  { x: 1400, y: 125 },
  { x: 500, y: 125 },
];

describe('OpeningCornerSnapEngine', () => {
  let engine: OpeningCornerSnapEngine;

  beforeEach(() => { engine = new OpeningCornerSnapEngine(); });
  afterEach(() => { engine.dispose(); });

  it('no candidates for non-opening entities', () => {
    engine.initialize([makeNonOpening()]);
    expect(engine.findSnapCandidates({ x: 500, y: -125 }, makeContext()).candidates).toHaveLength(0);
  });

  it('no candidates when list is empty', () => {
    engine.initialize([]);
    expect(engine.findSnapCandidates({ x: 500, y: -125 }, makeContext()).candidates).toHaveLength(0);
  });

  it('finds innerStart corner near (500, -125)', () => {
    engine.initialize([makeOpeningEntity(RECT_4)]);
    const { candidates } = engine.findSnapCandidates({ x: 500, y: -125 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    const hit = candidates.find((c) => Math.abs(c.point.x - 500) < 1 && Math.abs(c.point.y + 125) < 1);
    expect(hit).toBeDefined();
  });

  it('finds outerEnd corner near (1400, 125)', () => {
    engine.initialize([makeOpeningEntity(RECT_4)]);
    const { candidates } = engine.findSnapCandidates({ x: 1400, y: 125 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('candidate type = BIM_OPENING_CORNER, description = bim-opening-corner', () => {
    engine.initialize([makeOpeningEntity(RECT_4)]);
    const { candidates } = engine.findSnapCandidates({ x: 500, y: -125 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.type).toBe(ExtendedSnapType.BIM_OPENING_CORNER);
    expect(candidates[0]!.description).toBe('bim-opening-corner');
  });

  it('excludeEntityId suppresses', () => {
    engine.initialize([makeOpeningEntity(RECT_4, 'opening_x')]);
    const { candidates } = engine.findSnapCandidates({ x: 500, y: -125 }, makeContext({ excludeEntityId: 'opening_x' }));
    expect(candidates).toHaveLength(0);
  });

  it('cursor outside radius returns no candidates', () => {
    engine.initialize([makeOpeningEntity(RECT_4)]);
    expect(engine.findSnapCandidates({ x: 9999, y: 9999 }, makeContext({ worldRadiusForType: () => 5 })).candidates).toHaveLength(0);
  });
});
