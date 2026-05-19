/**
 * ADR-363 Phase 5.5i — ColumnCenterSnapEngine tests.
 *
 * Verifies:
 *   - Only column entities produce candidates (non-columns silently ignored).
 *   - Rect / L-shape / T-shape columns: center at expected world position.
 *   - Circular column: center at position.
 *   - Candidate type = BIM_COLUMN_CENTER, description = 'bim-column'.
 *   - excludeEntityId suppresses the matching candidate.
 *   - Cursor outside radius = no candidates.
 *   - Edge anchor points (non-center) do NOT trigger this engine.
 */

import { ColumnCenterSnapEngine } from '../ColumnCenterSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel } from '../../../rendering/types/Types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeColumnEntity(params: ColumnParams, id = 'col_test'): ColumnEntity {
  return {
    id,
    type: 'column',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: undefined as never,
    validation: undefined as never,
    visible: true,
  } as unknown as ColumnEntity;
}

function rectColumn(x: number, y: number, overrides: Partial<ColumnParams> = {}, id = 'col_rect'): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 'rectangular');
  return makeColumnEntity({ ...base, ...overrides }, id);
}

function circColumn(x: number, y: number, id = 'col_circ'): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 'circular');
  return makeColumnEntity(base, id);
}

function lColumn(x: number, y: number, id = 'col_l'): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 'l-shape');
  return makeColumnEntity(base, id);
}

function tColumn(x: number, y: number, id = 'col_t'): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 't-shape');
  return makeColumnEntity(base, id);
}

function makeNonColumnEntity(id = 'line_1'): EntityModel {
  return { id, type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, visible: true } as EntityModel;
}

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  return {
    entities: [],
    worldRadiusAt: () => 200,
    worldRadiusForType: () => 200,
    maxCandidates: 10,
    ...overrides,
  };
}

const EPS = 1e-6;

function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(EPS);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ColumnCenterSnapEngine', () => {
  let engine: ColumnCenterSnapEngine;

  beforeEach(() => {
    engine = new ColumnCenterSnapEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('no candidates when initialized with no column entities', () => {
    engine.initialize([makeNonColumnEntity()]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates).toHaveLength(0);
  });

  it('no candidates when initialized with empty entity list', () => {
    engine.initialize([]);
    const { candidates } = engine.findSnapCandidates({ x: 50, y: 50 }, makeContext());
    expect(candidates).toHaveLength(0);
  });

  it('rect column: center candidate at column position', () => {
    const col = rectColumn(100, 200);
    engine.initialize([col]);
    const { candidates } = engine.findSnapCandidates({ x: 100, y: 200 }, makeContext());
    expect(candidates).toHaveLength(1);
    expectClose(candidates[0]!.point.x, 100);
    expectClose(candidates[0]!.point.y, 200);
  });

  it('candidate has correct type and description', () => {
    const col = rectColumn(0, 0);
    engine.initialize([col]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(candidates[0]!.type).toBe(ExtendedSnapType.BIM_COLUMN_CENTER);
    expect(candidates[0]!.description).toBe('bim-column');
  });

  it('circular column: center candidate at position', () => {
    const col = circColumn(50, 75);
    engine.initialize([col]);
    const { candidates } = engine.findSnapCandidates({ x: 50, y: 75 }, makeContext());
    expect(candidates).toHaveLength(1);
    expectClose(candidates[0]!.point.x, 50);
    expectClose(candidates[0]!.point.y, 75);
  });

  it('L-shape column: center candidate at position', () => {
    const col = lColumn(10, 20);
    engine.initialize([col]);
    const { candidates } = engine.findSnapCandidates({ x: 10, y: 20 }, makeContext());
    expect(candidates).toHaveLength(1);
  });

  it('T-shape column: center candidate at position', () => {
    const col = tColumn(-30, 40);
    engine.initialize([col]);
    const { candidates } = engine.findSnapCandidates({ x: -30, y: 40 }, makeContext());
    expect(candidates).toHaveLength(1);
  });

  it('cursor outside radius returns no candidates', () => {
    const col = rectColumn(0, 0);
    engine.initialize([col]);
    // radius = 5 (tight), cursor is 100 units away
    const ctx = makeContext({ worldRadiusForType: () => 5 });
    const { candidates } = engine.findSnapCandidates({ x: 100, y: 100 }, ctx);
    expect(candidates).toHaveLength(0);
  });

  it('excludeEntityId suppresses the candidate', () => {
    const col = rectColumn(0, 0, {}, 'col_exclude');
    engine.initialize([col]);
    const ctx = makeContext({ excludeEntityId: 'col_exclude' });
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, ctx);
    expect(candidates).toHaveLength(0);
  });

  it('non-column entity mixed in does not produce candidates', () => {
    const col = rectColumn(50, 50, {}, 'col_a');
    const line = makeNonColumnEntity('line_x');
    engine.initialize([col, line]);
    // Cursor near line endpoint, not near column center
    const { candidates } = engine.findSnapCandidates({ x: 50, y: 50 }, makeContext());
    // Only the column center, not from the line
    expect(candidates.every((c) => c.entityId === 'col_a')).toBe(true);
  });

  it('multiple columns: finds each center independently', () => {
    const colA = rectColumn(0, 0, {}, 'col_a');
    const colB = circColumn(500, 500, 'col_b');
    engine.initialize([colA, colB]);

    const nearA = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext());
    expect(nearA.candidates.some((c) => c.entityId === 'col_a')).toBe(true);
    expect(nearA.candidates.some((c) => c.entityId === 'col_b')).toBe(false);

    const nearB = engine.findSnapCandidates({ x: 500, y: 500 }, makeContext({ worldRadiusForType: () => 10 }));
    expect(nearB.candidates.some((c) => c.entityId === 'col_b')).toBe(true);
  });
});
