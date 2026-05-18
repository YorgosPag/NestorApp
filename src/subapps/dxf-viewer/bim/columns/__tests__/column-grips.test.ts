/**
 * ADR-363 Phase 4.5 — `column-grips` pure-function tests.
 *
 * Verifies:
 *   - `getColumnGrips` emits the correct count + ordering per kind
 *     (rectangular / L-shape / T-shape → 4 grips, circular → 2 grips).
 *   - Grip positions correspond to centroid / rotation handle / far-edge
 *     midpoints σε mm world space.
 *   - `applyColumnGripDrag` patches the right field per kind, clamps
 *     width/depth στο MIN_COLUMN_DIMENSION_MM, preserves foreign params
 *     (height/anchor/material/lshape/tshape) και short-circuits zero delta +
 *     unknown grip kinds + circular depth/rotation στο originalParams
 *     (referential identity).
 */

import { applyColumnGripDrag, getColumnGrips } from '../column-grips';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';
import { MIN_COLUMN_DIMENSION_MM } from '../../types/column-types';

function makeColumnEntity(params: ColumnParams): ColumnEntity {
  return {
    id: 'col_test',
    type: 'column',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: undefined as never,
    validation: undefined as never,
    visible: true,
  } as unknown as ColumnEntity;
}

function makeRect(): ColumnEntity {
  return makeColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'));
}

function makeCircular(): ColumnEntity {
  return makeColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'circular'));
}

function makeLshape(): ColumnEntity {
  return makeColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape'));
}

function makeTshape(): ColumnEntity {
  return makeColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'T-shape'));
}

describe('column-grips — getColumnGrips (Phase 4.5)', () => {
  it('1. rectangular → 4 grips, stable order (center, rotation, width, depth)', () => {
    const grips = getColumnGrips(makeRect());
    expect(grips).toHaveLength(4);
    expect(grips[0].columnGripKind).toBe('column-center');
    expect(grips[1].columnGripKind).toBe('column-rotation');
    expect(grips[2].columnGripKind).toBe('column-width');
    expect(grips[3].columnGripKind).toBe('column-depth');
  });

  it('2. circular → 2 grips (center, width=radius)', () => {
    const grips = getColumnGrips(makeCircular());
    expect(grips).toHaveLength(2);
    expect(grips[0].columnGripKind).toBe('column-center');
    expect(grips[1].columnGripKind).toBe('column-width');
  });

  it('3. L-shape → 4 grips (same layout as rectangular)', () => {
    const grips = getColumnGrips(makeLshape());
    expect(grips).toHaveLength(4);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-rotation',
      'column-width',
      'column-depth',
    ]);
  });

  it('4. T-shape → 4 grips (same layout as rectangular)', () => {
    const grips = getColumnGrips(makeTshape());
    expect(grips).toHaveLength(4);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-rotation',
      'column-width',
      'column-depth',
    ]);
  });

  it('5. center grip position = position (anchor=center, rotation=0)', () => {
    const grips = getColumnGrips(makeRect());
    expect(grips[0].position.x).toBeCloseTo(0, 6);
    expect(grips[0].position.y).toBeCloseTo(0, 6);
    expect(grips[0].movesEntity).toBe(true);
  });

  it('6. width grip on rectangular sits at +width/2 along X (anchor=center, rotation=0)', () => {
    const col = makeRect();
    const grips = getColumnGrips(col);
    expect(grips[2].position.x).toBeCloseTo(col.params.width / 2, 6);
    expect(grips[2].position.y).toBeCloseTo(0, 6);
  });

  it('7. depth grip on rectangular sits at +depth/2 along Y (anchor=center, rotation=0)', () => {
    const col = makeRect();
    const grips = getColumnGrips(col);
    expect(grips[3].position.x).toBeCloseTo(0, 6);
    expect(grips[3].position.y).toBeCloseTo(col.params.depth / 2, 6);
  });
});

describe('column-grips — applyColumnGripDrag (Phase 4.5)', () => {
  it('8. center drag translates position only', () => {
    const col = makeRect();
    const next = applyColumnGripDrag('column-center', {
      originalParams: col.params,
      delta: { x: 100, y: 50 },
    });
    expect(next.position.x).toBe(100);
    expect(next.position.y).toBe(50);
    expect(next.width).toBe(col.params.width);
    expect(next.depth).toBe(col.params.depth);
    expect(next.rotation).toBe(col.params.rotation);
  });

  it('9. width drag resizes width preserving depth/rotation/anchor (anchor=center → ×2 factor)', () => {
    const col = makeRect();
    const next = applyColumnGripDrag('column-width', {
      originalParams: col.params,
      delta: { x: 100, y: 0 },
    });
    // anchor=center → coefX=0.5 → newWidth = oldWidth + 100/0.5 = oldWidth + 200
    expect(next.width).toBeCloseTo(col.params.width + 200, 6);
    expect(next.depth).toBe(col.params.depth);
    expect(next.rotation).toBe(col.params.rotation);
    expect(next.anchor).toBe(col.params.anchor);
  });

  it('10. depth drag resizes depth preserving width/rotation/anchor', () => {
    const col = makeRect();
    const next = applyColumnGripDrag('column-depth', {
      originalParams: col.params,
      delta: { x: 0, y: 50 },
    });
    // anchor=center → coefY=0.5 → newDepth = oldDepth + 100
    expect(next.depth).toBeCloseTo(col.params.depth + 100, 6);
    expect(next.width).toBe(col.params.width);
    expect(next.rotation).toBe(col.params.rotation);
  });

  it('11. rotation drag updates rotation preserving width/depth/position', () => {
    const col = makeRect();
    // Old handle on anchor=center, rotation=0: at (0, depth/2 + offset) = (0, 400)
    // Drag by (+100, 0) → new handle (100, 400). New angle from position(0,0):
    // atan2(400, 100) ≈ 75.96°. Old angle = 90° → delta = -14.04°.
    const next = applyColumnGripDrag('column-rotation', {
      originalParams: col.params,
      delta: { x: 100, y: 0 },
    });
    expect(next.rotation).not.toBe(col.params.rotation);
    expect(next.width).toBe(col.params.width);
    expect(next.depth).toBe(col.params.depth);
    expect(next.position.x).toBe(col.params.position.x);
    expect(next.position.y).toBe(col.params.position.y);
  });

  it('12. width drag clamps at MIN_COLUMN_DIMENSION_MM', () => {
    const col = makeRect();
    const next = applyColumnGripDrag('column-width', {
      originalParams: col.params,
      delta: { x: -10000, y: 0 },
    });
    expect(next.width).toBe(MIN_COLUMN_DIMENSION_MM);
  });

  it('13. depth drag clamps at MIN_COLUMN_DIMENSION_MM', () => {
    const col = makeRect();
    const next = applyColumnGripDrag('column-depth', {
      originalParams: col.params,
      delta: { x: 0, y: -10000 },
    });
    expect(next.depth).toBe(MIN_COLUMN_DIMENSION_MM);
  });

  it('14. circular kind: depth-grip drag → no-op (referentially equal)', () => {
    const col = makeCircular();
    const next = applyColumnGripDrag('column-depth', {
      originalParams: col.params,
      delta: { x: 100, y: 100 },
    });
    expect(next).toBe(col.params);
  });

  it('15. circular kind: rotation-grip drag → no-op (referentially equal)', () => {
    const col = makeCircular();
    const next = applyColumnGripDrag('column-rotation', {
      originalParams: col.params,
      delta: { x: 100, y: 100 },
    });
    expect(next).toBe(col.params);
  });

  it('16. circular kind: width-grip → diameter resize (symmetric, factor 2)', () => {
    const col = makeCircular();
    const next = applyColumnGripDrag('column-width', {
      originalParams: col.params,
      delta: { x: 50, y: 0 },
    });
    expect(next.width).toBeCloseTo(col.params.width + 100, 6);
  });

  it('17. zero delta → returns originalParams referentially', () => {
    const col = makeRect();
    const same = applyColumnGripDrag('column-width', {
      originalParams: col.params,
      delta: { x: 0, y: 0 },
    });
    expect(same).toBe(col.params);
  });

  it('18. unknown grip kind → returns originalParams referentially', () => {
    const col = makeRect();
    const same = applyColumnGripDrag('column-foo' as never, {
      originalParams: col.params,
      delta: { x: 100, y: 100 },
    });
    expect(same).toBe(col.params);
  });

  it('19. foreign params preserved (height / anchor / material / lshape / tshape)', () => {
    const base = buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape', {
      anchor: 'nw',
      material: 'mat_concrete_c25',
      lshape: { armLength: 200, armWidth: 150 },
      tshape: { flangeLength: 300, webThickness: 100 },
      height: 3500,
    });
    const next = applyColumnGripDrag('column-width', {
      originalParams: base,
      delta: { x: 50, y: 0 },
    });
    expect(next.height).toBe(3500);
    expect(next.anchor).toBe('nw');
    expect(next.material).toBe('mat_concrete_c25');
    expect(next.lshape).toEqual({ armLength: 200, armWidth: 150 });
    expect(next.tshape).toEqual({ flangeLength: 300, webThickness: 100 });
  });
});
