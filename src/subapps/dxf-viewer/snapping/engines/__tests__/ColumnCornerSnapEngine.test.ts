/**
 * ADR-370 §6.4 — ColumnCornerSnapEngine tests.
 *
 * Verifies:
 *   - Non-column entities produce no candidates.
 *   - Rectangular column: 4 diagonal corners (nw/ne/se/sw).
 *   - Candidate type = BIM_COLUMN_CORNER, description = 'bim-column-corner'.
 *   - excludeEntityId suppresses.
 *   - Cursor outside radius = no candidates.
 *   - Circular column: 4 entries at cos45°·r from center.
 */

import { ColumnCornerSnapEngine } from '../ColumnCornerSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel } from '../../../rendering/types/Types';

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

function rectAt(x: number, y: number, overrides: Partial<ColumnParams> = {}, id = 'col_test'): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 'rectangular');
  return makeColumnEntity({ ...base, ...overrides }, id);
}

function circAt(x: number, y: number, overrides: Partial<ColumnParams> = {}, id = 'col_test'): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 'circular');
  return makeColumnEntity({ ...base, ...overrides }, id);
}

function makeNonColumn(id = 'wall_1'): EntityModel {
  return { id, type: 'wall', visible: true } as EntityModel;
}

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  return { entities: [], worldRadiusAt: () => 300, worldRadiusForType: () => 300, maxCandidates: 10, ...overrides };
}

describe('ColumnCornerSnapEngine', () => {
  let engine: ColumnCornerSnapEngine;

  beforeEach(() => { engine = new ColumnCornerSnapEngine(); });
  afterEach(() => { engine.dispose(); });

  it('no candidates for non-column entities', () => {
    engine.initialize([makeNonColumn()]);
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('no candidates when list is empty', () => {
    engine.initialize([]);
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('rect column: finds corner near NE (200, 150)', () => {
    engine.initialize([rectAt(0, 0, { width: 400, depth: 300, rotation: 0, anchor: 'center' })]);
    const { candidates } = engine.findSnapCandidates({ x: 200, y: 150 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    const hit = candidates.find((c) => Math.abs(c.point.x - 200) < 1 && Math.abs(c.point.y - 150) < 1);
    expect(hit).toBeDefined();
  });

  it('candidate type = BIM_COLUMN_CORNER, description = bim-column-corner', () => {
    engine.initialize([rectAt(0, 0, { width: 400, depth: 300, rotation: 0, anchor: 'center' })]);
    const { candidates } = engine.findSnapCandidates({ x: 200, y: 150 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.type).toBe(ExtendedSnapType.BIM_COLUMN_CORNER);
    expect(candidates[0]!.description).toBe('bim-column-corner');
  });

  it('excludeEntityId suppresses', () => {
    engine.initialize([rectAt(0, 0, {}, 'col_x')]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext({ excludeEntityId: 'col_x' }));
    expect(candidates).toHaveLength(0);
  });

  it('cursor outside radius returns no candidates', () => {
    engine.initialize([rectAt(0, 0)]);
    expect(engine.findSnapCandidates({ x: 9999, y: 9999 }, makeContext({ worldRadiusForType: () => 5 })).candidates).toHaveLength(0);
  });

  it('circular column: 4 candidates, all at cos45°·radius from center', () => {
    const radius = 200;
    const col = circAt(0, 0, { width: radius * 2 });
    engine.initialize([col]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext({ worldRadiusForType: () => radius + 50 }));
    expect(candidates).toHaveLength(4);
    const expected = radius * (Math.SQRT2 / 2);
    for (const c of candidates) {
      expect(Math.hypot(c.point.x, c.point.y)).toBeCloseTo(expected, 4);
    }
  });
});
