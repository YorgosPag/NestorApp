/**
 * ADR-370 §6.2 — BeamCornerSnapEngine tests.
 *
 * Verifies:
 *   - Non-beam entities silently produce no candidates.
 *   - Horizontal straight beam: corners at ±halfWidth Y.
 *   - Candidate type = BIM_BEAM_CORNER, description = 'bim-beam-corner'.
 *   - excludeEntityId suppresses.
 *   - Cursor outside radius = no candidates.
 */

import { BeamCornerSnapEngine } from '../BeamCornerSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import type { BeamEntity, BeamParams } from '../../../bim/types/beam-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel } from '../../../rendering/types/Types';

function makeBeamEntity(overrides: Partial<BeamParams> = {}, id = 'beam_test'): BeamEntity {
  const params = { kind: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 1000, y: 0 }, width: 250, depth: 500, topElevation: 3000, ...overrides } as BeamParams;
  return { id, type: 'beam', kind: params.kind, layerId: '0', params, geometry: undefined as never, validation: undefined as never, visible: true } as unknown as BeamEntity;
}

function makeNonBeam(id = 'arc_1'): EntityModel {
  return { id, type: 'arc', center: { x: 0, y: 0 }, radius: 100, visible: true } as EntityModel;
}

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  return { entities: [], worldRadiusAt: () => 300, worldRadiusForType: () => 300, maxCandidates: 10, ...overrides };
}

describe('BeamCornerSnapEngine', () => {
  let engine: BeamCornerSnapEngine;

  beforeEach(() => { engine = new BeamCornerSnapEngine(); });
  afterEach(() => { engine.dispose(); });

  it('no candidates for non-beam entities', () => {
    engine.initialize([makeNonBeam()]);
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('no candidates when list is empty', () => {
    engine.initialize([]);
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('finds start-plus corner near (0, 125) for horizontal beam', () => {
    engine.initialize([makeBeamEntity({ width: 250 })]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 125 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.point.y).toBeCloseTo(125, 4);
  });

  it('candidate type = BIM_BEAM_CORNER, description = bim-beam-corner', () => {
    engine.initialize([makeBeamEntity({ width: 250 })]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 125 }, makeContext());
    expect(candidates[0]!.type).toBe(ExtendedSnapType.BIM_BEAM_CORNER);
    expect(candidates[0]!.description).toBe('bim-beam-corner');
  });

  it('excludeEntityId suppresses', () => {
    engine.initialize([makeBeamEntity({}, 'beam_x')]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 125 }, makeContext({ excludeEntityId: 'beam_x' }));
    expect(candidates).toHaveLength(0);
  });

  it('cursor outside radius returns no candidates', () => {
    engine.initialize([makeBeamEntity()]);
    const { candidates } = engine.findSnapCandidates({ x: 9999, y: 9999 }, makeContext({ worldRadiusForType: () => 5 }));
    expect(candidates).toHaveLength(0);
  });
});
