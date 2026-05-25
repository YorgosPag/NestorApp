/**
 * ADR-370 §6.4 + ADR-363 Phase 8C — ColumnCornerSnapEngine tests.
 *
 * Verifies:
 *   - Non-column entities produce no candidates.
 *   - Rectangular column: 4 diagonal corners (nw/ne/se/sw).
 *   - Candidate type = BIM_COLUMN_CORNER, description = 'bim-column-corner'.
 *   - excludeEntityId suppresses.
 *   - Cursor outside radius = no candidates.
 *   - Circular column: 4 entries ON perimeter at 45° (distance from center = radius).
 *   - Phase 8C: polygon / shear-wall / I-shape produce 4 bbox-corner candidates.
 */

import { ColumnCornerSnapEngine } from '../ColumnCornerSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type {
  ColumnEntity,
  ColumnKind,
  ColumnParams,
} from '../../../bim/types/column-types';
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

function colAt(
  kind: ColumnKind,
  x: number,
  y: number,
  overrides: Partial<ColumnParams> = {},
  id = 'col_test',
): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, kind);
  return makeColumnEntity({ ...base, ...overrides }, id);
}

const rectAt = (x: number, y: number, o: Partial<ColumnParams> = {}, id = 'col_test') =>
  colAt('rectangular', x, y, o, id);
const circAt = (x: number, y: number, o: Partial<ColumnParams> = {}, id = 'col_test') =>
  colAt('circular', x, y, o, id);

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

  it('circular column: NE corner candidate on perimeter at 45° (distance from center = radius)', () => {
    // Spatial index uses Math.min(tolerance, cellSize/2) for snap radius — cursor
    // must sit NEAR target corner. Industry convention (Revit/ArchiCAD): perimeter
    // snap at 45° → coords (±r·√2/2, ±r·√2/2), distance from center = radius.
    const radius = 200;
    const expectedCoord = radius * (Math.SQRT2 / 2);
    const col = circAt(0, 0, { width: radius * 2 });
    engine.initialize([col]);
    const { candidates } = engine.findSnapCandidates(
      { x: expectedCoord, y: expectedCoord },
      makeContext(),
    );
    expect(candidates.length).toBeGreaterThan(0);
    const hit = candidates.find(
      (c) => Math.abs(c.point.x - expectedCoord) < 1 && Math.abs(c.point.y - expectedCoord) < 1,
    );
    expect(hit).toBeDefined();
    // Hypot of perimeter point at 45° = radius (NOT radius·√2/2 — the latter is
    // each individual coordinate, not Euclidean distance to center).
    expect(Math.hypot(hit!.point.x, hit!.point.y)).toBeCloseTo(radius, 4);
  });

  // ── ADR-363 Phase 8C — polygon / shear-wall / I-shape coverage ──────────

  it('polygon column (hexagon default): NE bbox corner candidate at (200·√3/2, 200)', () => {
    // Hexagon Ø=400 vertex-up bbox: dimX = 2·r·cos(30°) = 200·√3 ≈ 346.41, dimY = 2·r = 400.
    // NE bbox corner at (200·√3/2, 200) — outside the polygon perimeter (bbox > hexagon).
    const expectedX = 200 * Math.sqrt(3) / 2;
    const expectedY = 200;
    const col = colAt('polygon', 0, 0, { width: 400 });
    engine.initialize([col]);
    const { candidates } = engine.findSnapCandidates(
      { x: expectedX, y: expectedY },
      makeContext(),
    );
    expect(candidates.length).toBeGreaterThan(0);
    const hit = candidates.find(
      (c) => Math.abs(c.point.x - expectedX) < 1 && Math.abs(c.point.y - expectedY) < 1,
    );
    expect(hit).toBeDefined();
  });

  it('shear-wall column: NE bbox corner candidate at (length/2, thickness/2) (rect parity)', () => {
    // Shear-wall μακρόστενη ορθογωνία: bbox = width × depth → corner at (1000, 100)
    // για 2m×20cm wall. Mirror του rectangular behavior — shear-wall = rect parity.
    const col = colAt('shear-wall', 0, 0, { width: 2000, depth: 200, anchor: 'center' });
    engine.initialize([col]);
    const { candidates } = engine.findSnapCandidates(
      { x: 1000, y: 100 },
      makeContext(),
    );
    expect(candidates.length).toBeGreaterThan(0);
    const hit = candidates.find(
      (c) => Math.abs(c.point.x - 1000) < 1 && Math.abs(c.point.y - 100) < 1,
    );
    expect(hit).toBeDefined();
  });

  it('I-shape column: NE outer-bbox corner candidate at (b/2, h/2)', () => {
    // I-shape outer bbox = b (flange width) × h (section depth). NE corner at
    // (100, 150) for IPE-300-like (200×300). Inside-pocket vertices not exposed.
    const col = colAt('I-shape', 0, 0, { width: 200, depth: 300, anchor: 'center' });
    engine.initialize([col]);
    const { candidates } = engine.findSnapCandidates(
      { x: 100, y: 150 },
      makeContext(),
    );
    expect(candidates.length).toBeGreaterThan(0);
    const hit = candidates.find(
      (c) => Math.abs(c.point.x - 100) < 1 && Math.abs(c.point.y - 150) < 1,
    );
    expect(hit).toBeDefined();
  });
});
