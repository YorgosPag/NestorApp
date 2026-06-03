/**
 * ADR-408 Φ9 — MepConnectorSnapEngine tests.
 *
 * Verifies:
 *   - A duct/pipe segment exposes its two endpoint connectors (start + end).
 *   - A fixture exposes its embedded connector at the rotated world position.
 *   - Candidate type = BIM_MEP_CONNECTOR, description = 'bim-mep-connector'.
 *   - excludeEntityId suppresses the candidate; cursor outside radius = none.
 *   - Non-MEP entities silently produce no candidates.
 */

import { MepConnectorSnapEngine } from '../MepConnectorSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel } from '../../../rendering/types/Types';

function makeSegment(id = 'seg_1'): EntityModel {
  return {
    id,
    type: 'mep-segment',
    visible: true,
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 1000, y: 0, z: 0 },
      centerlineElevationMm: 2500,
    },
  } as unknown as EntityModel;
}

function makeFixture(id = 'fx_1'): EntityModel {
  return {
    id,
    type: 'mep-fixture',
    visible: true,
    params: {
      position: { x: 500, y: 500, z: 0 },
      rotation: 0,
      connectors: [{ connectorId: 'c1', domain: 'electrical', flow: 'in', localPosition: { x: 0, y: 0, z: 0 } }],
    },
  } as unknown as EntityModel;
}

function makeNonMep(id = 'line_1'): EntityModel {
  return { id, type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, visible: true } as EntityModel;
}

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  return { entities: [], worldRadiusAt: () => 300, worldRadiusForType: () => 300, maxCandidates: 10, ...overrides };
}

describe('MepConnectorSnapEngine', () => {
  let engine: MepConnectorSnapEngine;

  beforeEach(() => { engine = new MepConnectorSnapEngine(); });
  afterEach(() => { engine.dispose(); });

  it('no candidates for non-MEP entities', () => {
    engine.initialize([makeNonMep()]);
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('segment: snaps to the start endpoint near (0,0)', () => {
    engine.initialize([makeSegment()]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.point.x).toBeCloseTo(0, 5);
    expect(candidates[0]!.point.y).toBeCloseTo(0, 5);
  });

  it('segment: snaps to the end endpoint near (1000,0)', () => {
    engine.initialize([makeSegment()]);
    const { candidates } = engine.findSnapCandidates({ x: 1000, y: 0 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.point.x).toBeCloseTo(1000, 5);
  });

  it('fixture: snaps to the connector at the host origin (500,500)', () => {
    engine.initialize([makeFixture()]);
    const { candidates } = engine.findSnapCandidates({ x: 500, y: 500 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.point.x).toBeCloseTo(500, 5);
    expect(candidates[0]!.point.y).toBeCloseTo(500, 5);
  });

  it('candidate type = BIM_MEP_CONNECTOR, description = bim-mep-connector', () => {
    engine.initialize([makeSegment()]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates[0]!.type).toBe(ExtendedSnapType.BIM_MEP_CONNECTOR);
    expect(candidates[0]!.description).toBe('bim-mep-connector');
  });

  it('priority is -1.5 (above endpoint, below face corners)', () => {
    engine.initialize([makeSegment()]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates[0]!.priority).toBe(-1.5);
  });

  it('excludeEntityId suppresses the candidate', () => {
    engine.initialize([makeSegment('seg_x')]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext({ excludeEntityId: 'seg_x' }));
    expect(candidates).toHaveLength(0);
  });

  it('cursor outside radius returns no candidates', () => {
    engine.initialize([makeSegment()]);
    const { candidates } = engine.findSnapCandidates({ x: 5000, y: 5000 }, makeContext({ worldRadiusForType: () => 5 }));
    expect(candidates).toHaveLength(0);
  });
});
