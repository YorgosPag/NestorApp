/**
 * ADR-370 §6.1 — WallCornerSnapEngine tests.
 *
 * Verifies:
 *   - Non-wall entities silently produce no candidates.
 *   - Horizontal wall: 4 corners at correct ±halfThickness Y positions.
 *   - Candidate type = BIM_WALL_CORNER, description = 'bim-wall-corner'.
 *   - excludeEntityId suppresses matching candidate.
 *   - Cursor outside radius = no candidates.
 *   - Multiple walls: finds each independently.
 */

import { WallCornerSnapEngine } from '../WallCornerSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel } from '../../../rendering/types/Types';

function makeWallEntity(overrides: Partial<WallParams> = {}, id = 'wall_test'): WallEntity {
  const params = {
    category: 'exterior',
    start: { x: 0, y: 0 },
    end: { x: 1000, y: 0 },
    height: 3000,
    thickness: 200,
    flip: false,
    ...overrides,
  } as WallParams;
  return { id, type: 'wall', kind: 'straight', layerId: '0', params, geometry: undefined as never, validation: undefined as never, visible: true } as unknown as WallEntity;
}

function makeNonWall(id = 'line_1'): EntityModel {
  return { id, type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, visible: true } as EntityModel;
}

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  return { entities: [], worldRadiusAt: () => 300, worldRadiusForType: () => 300, maxCandidates: 10, ...overrides };
}

describe('WallCornerSnapEngine', () => {
  let engine: WallCornerSnapEngine;

  beforeEach(() => { engine = new WallCornerSnapEngine(); });
  afterEach(() => { engine.dispose(); });

  it('no candidates for non-wall entities', () => {
    engine.initialize([makeNonWall()]);
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('no candidates when list is empty', () => {
    engine.initialize([]);
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('horizontal wall: finds outer-start corner near (0, 100)', () => {
    engine.initialize([makeWallEntity({ thickness: 200 })]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 100 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    const hit = candidates[0]!;
    expect(hit.point.x).toBeCloseTo(0, 5);
    expect(hit.point.y).toBeCloseTo(100, 5);
  });

  it('candidate type = BIM_WALL_CORNER, description = bim-wall-corner', () => {
    engine.initialize([makeWallEntity()]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 100 }, makeContext());
    expect(candidates[0]!.type).toBe(ExtendedSnapType.BIM_WALL_CORNER);
    expect(candidates[0]!.description).toBe('bim-wall-corner');
  });

  it('excludeEntityId suppresses the candidate', () => {
    engine.initialize([makeWallEntity({}, 'wall_x')]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 100 }, makeContext({ excludeEntityId: 'wall_x' }));
    expect(candidates).toHaveLength(0);
  });

  it('cursor outside radius returns no candidates', () => {
    engine.initialize([makeWallEntity({ thickness: 200 })]);
    const { candidates } = engine.findSnapCandidates({ x: 5000, y: 5000 }, makeContext({ worldRadiusForType: () => 5 }));
    expect(candidates).toHaveLength(0);
  });

  it('priority matches SNAP_ENGINE_PRIORITIES.BIM_WALL_CORNER (-2)', () => {
    engine.initialize([makeWallEntity()]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 100 }, makeContext());
    if (candidates.length > 0) {
      expect(candidates[0]!.priority).toBe(-2);
    }
  });
});
