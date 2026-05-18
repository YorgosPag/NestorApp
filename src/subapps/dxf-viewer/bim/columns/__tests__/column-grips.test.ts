/**
 * ADR-363 Phase 4.5 + 4.5b — `column-grips` pure-function tests.
 *
 * Verifies:
 *   - `getColumnGrips` emits the correct count + ordering per kind
 *     (rectangular → 4 grips, L-shape / T-shape → 6 grips Phase 4.5b,
 *     circular → 2 grips).
 *   - Grip positions correspond to centroid / rotation handle / far-edge
 *     midpoints / variant edge midpoints σε mm world space.
 *   - `applyColumnGripDrag` patches the right field per kind, clamps
 *     width/depth/variant dims στο MIN_COLUMN_DIMENSION_MM, preserves foreign
 *     params (height/anchor/material/lshape/tshape) και short-circuits zero
 *     delta + unknown grip kinds + circular depth/rotation + cross-kind
 *     variant grips στο originalParams (referential identity).
 *   - L-shape / T-shape drag materializes defaults από width/3 + depth/3
 *     (L) ή width + depth/3 (T) όταν params.lshape / params.tshape undefined.
 */

import { applyColumnGripDrag, getColumnGrips } from '../column-grips';
import {
  armLengthHandlePosition,
  armWidthHandlePosition,
  flangeLengthHandlePosition,
  materializeLshape,
  materializeTshape,
  webThicknessHandlePosition,
} from '../column-variant-grips';
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

  it('3. L-shape → 6 grips (Phase 4.5b adds arm-length + arm-width)', () => {
    const grips = getColumnGrips(makeLshape());
    expect(grips).toHaveLength(6);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-rotation',
      'column-width',
      'column-depth',
      'column-arm-length',
      'column-arm-width',
    ]);
  });

  it('4. T-shape → 6 grips (Phase 4.5b adds flange-length + web-thickness)', () => {
    const grips = getColumnGrips(makeTshape());
    expect(grips).toHaveLength(6);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-rotation',
      'column-width',
      'column-depth',
      'column-flange-length',
      'column-web-thickness',
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

// ─── Phase 4.5b — variant-specific grip positions ────────────────────────────

describe('column-grips — variant handle positions (Phase 4.5b)', () => {
  it('20. L-shape arm-length handle at (armWidth/2, -depth/2 + armLength), rotation=0, anchor=center', () => {
    const params = makeLshape().params;
    // defaults: width=400, depth=400 → armLength=armWidth=400/3 ≈ 133.33
    const expectedX = (params.width / 3) / 2; // 66.67
    const expectedY = -params.depth / 2 + params.depth / 3; // -66.67
    const pos = armLengthHandlePosition(params);
    expect(pos.x).toBeCloseTo(expectedX, 6);
    expect(pos.y).toBeCloseTo(expectedY, 6);
  });

  it('21. L-shape arm-width handle at (-width/2 + armWidth, armLength/2), rotation=0, anchor=center', () => {
    const params = makeLshape().params;
    const expectedX = -params.width / 2 + params.width / 3; // -66.67
    const expectedY = (params.depth / 3) / 2; // 66.67
    const pos = armWidthHandlePosition(params);
    expect(pos.x).toBeCloseTo(expectedX, 6);
    expect(pos.y).toBeCloseTo(expectedY, 6);
  });

  it('22. T-shape flange-length handle at (halfFlange, depth/2 - flangeDepth/2)', () => {
    const params = makeTshape().params;
    // defaults: flangeLength=width=400 → halfFlange=min(200, 200)=200
    // flangeDepth = max(1, depth/3) = 133.33
    const expectedX = Math.min(params.width / 2, params.width / 2); // 200
    const expectedY = params.depth / 2 - (params.depth / 3) / 2; // 200 - 66.67 = 133.33
    const pos = flangeLengthHandlePosition(params);
    expect(pos.x).toBeCloseTo(expectedX, 6);
    expect(pos.y).toBeCloseTo(expectedY, 6);
  });

  it('23. T-shape web-thickness handle at (halfWeb, -flangeDepth/2)', () => {
    const params = makeTshape().params;
    // defaults: webThickness=depth/3=133.33 → halfWeb=min(200, 66.67)=66.67
    const expectedX = Math.min(params.width / 2, params.depth / 3 / 2); // 66.67
    const expectedY = -(params.depth / 3) / 2; // -66.67
    const pos = webThicknessHandlePosition(params);
    expect(pos.x).toBeCloseTo(expectedX, 6);
    expect(pos.y).toBeCloseTo(expectedY, 6);
  });

  it('24. L-shape grip positions invariant to rotation (rotate 90° → x↔y swap)', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape', { rotation: 90 });
    const armLength = armLengthHandlePosition(params);
    // Local (66.67, -66.67) rotated 90° CCW → (66.67, 66.67)
    expect(armLength.x).toBeCloseTo(66.6666, 3);
    expect(armLength.y).toBeCloseTo(66.6666, 3);
  });
});

// ─── Phase 4.5b — variant transforms (L-shape) ───────────────────────────────

describe('column-grips — applyColumnGripDrag L-shape variants (Phase 4.5b)', () => {
  function makeLshapeBig(): ColumnParams {
    // width=900, depth=900 → defaults armLength=armWidth=300 (> MIN 250)
    return buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape', {
      lshape: { armLength: 300, armWidth: 300 },
    });
  }

  it('25. arm-length drag +Y → 1× factor (asymmetric edge handle)', () => {
    const params = makeLshapeBig();
    const next = applyColumnGripDrag('column-arm-length', {
      originalParams: params,
      delta: { x: 0, y: 100 },
    });
    expect(next.lshape).toEqual({ armLength: 400, armWidth: 300 });
  });

  it('26. arm-width drag +X → 1× factor (asymmetric edge handle)', () => {
    const params = makeLshapeBig();
    const next = applyColumnGripDrag('column-arm-width', {
      originalParams: params,
      delta: { x: 75, y: 0 },
    });
    expect(next.lshape).toEqual({ armLength: 300, armWidth: 375 });
  });

  it('27. arm-length drag preserves armWidth / width / depth / rotation / anchor', () => {
    const params = makeLshapeBig();
    const next = applyColumnGripDrag('column-arm-length', {
      originalParams: params,
      delta: { x: 0, y: 50 },
    });
    expect(next.lshape?.armWidth).toBe(300);
    expect(next.width).toBe(params.width);
    expect(next.depth).toBe(params.depth);
    expect(next.rotation).toBe(params.rotation);
    expect(next.anchor).toBe(params.anchor);
  });

  it('28. arm-length drag clamps στο MIN_COLUMN_DIMENSION_MM (huge negative delta)', () => {
    const params = makeLshapeBig();
    const next = applyColumnGripDrag('column-arm-length', {
      originalParams: params,
      delta: { x: 0, y: -10000 },
    });
    expect(next.lshape?.armLength).toBe(MIN_COLUMN_DIMENSION_MM);
  });

  it('29. arm-width drag clamps στο MIN_COLUMN_DIMENSION_MM', () => {
    const params = makeLshapeBig();
    const next = applyColumnGripDrag('column-arm-width', {
      originalParams: params,
      delta: { x: -10000, y: 0 },
    });
    expect(next.lshape?.armWidth).toBe(MIN_COLUMN_DIMENSION_MM);
  });

  it('30. arm-length drag χωρίς params.lshape materializes από depth/3 default', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape', {
      width: 900,
      depth: 900,
    });
    expect(params.lshape).toBeUndefined();
    const next = applyColumnGripDrag('column-arm-length', {
      originalParams: params,
      delta: { x: 0, y: 100 },
    });
    // materialized base armLength = 900/3 = 300; armWidth default = 300; new armLength = 400
    expect(next.lshape).toEqual({ armLength: 400, armWidth: 300 });
  });

  it('31. arm-length drag on rectangular kind → no-op (referential identity)', () => {
    const params = makeRect().params;
    const next = applyColumnGripDrag('column-arm-length', {
      originalParams: params,
      delta: { x: 0, y: 100 },
    });
    expect(next).toBe(params);
  });

  it('32. arm-width drag on T-shape kind → no-op (referential identity)', () => {
    const params = makeTshape().params;
    const next = applyColumnGripDrag('column-arm-width', {
      originalParams: params,
      delta: { x: 100, y: 0 },
    });
    expect(next).toBe(params);
  });
});

// ─── Phase 4.5b — variant transforms (T-shape) ───────────────────────────────

describe('column-grips — applyColumnGripDrag T-shape variants (Phase 4.5b)', () => {
  function makeTshapeBig(): ColumnParams {
    // width=900, depth=900 → defaults flangeLength=900, webThickness=300 (> MIN 250)
    return buildDefaultColumnParams({ x: 0, y: 0 }, 'T-shape', {
      tshape: { flangeLength: 900, webThickness: 300 },
    });
  }

  it('33. flange-length drag +X → 2× factor (symmetric γύρω από κάθετο άξονα)', () => {
    const params = makeTshapeBig();
    const next = applyColumnGripDrag('column-flange-length', {
      originalParams: params,
      delta: { x: 50, y: 0 },
    });
    expect(next.tshape).toEqual({ flangeLength: 1000, webThickness: 300 });
  });

  it('34. web-thickness drag +X → 2× factor (symmetric)', () => {
    const params = makeTshapeBig();
    const next = applyColumnGripDrag('column-web-thickness', {
      originalParams: params,
      delta: { x: 25, y: 0 },
    });
    expect(next.tshape).toEqual({ flangeLength: 900, webThickness: 350 });
  });

  it('35. flange-length drag clamps στο MIN_COLUMN_DIMENSION_MM', () => {
    const params = makeTshapeBig();
    const next = applyColumnGripDrag('column-flange-length', {
      originalParams: params,
      delta: { x: -10000, y: 0 },
    });
    expect(next.tshape?.flangeLength).toBe(MIN_COLUMN_DIMENSION_MM);
  });

  it('36. web-thickness drag clamps στο MIN_COLUMN_DIMENSION_MM', () => {
    const params = makeTshapeBig();
    const next = applyColumnGripDrag('column-web-thickness', {
      originalParams: params,
      delta: { x: -10000, y: 0 },
    });
    expect(next.tshape?.webThickness).toBe(MIN_COLUMN_DIMENSION_MM);
  });

  it('37. flange-length drag χωρίς params.tshape materializes από width default', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'T-shape', {
      width: 900,
      depth: 900,
    });
    expect(params.tshape).toBeUndefined();
    const next = applyColumnGripDrag('column-flange-length', {
      originalParams: params,
      delta: { x: 50, y: 0 },
    });
    // materialized base flangeLength = 900; webThickness = 900/3 = 300; new flange = 900 + 100
    expect(next.tshape).toEqual({ flangeLength: 1000, webThickness: 300 });
  });

  it('38. flange-length drag preserves width / depth / rotation / anchor', () => {
    const params = makeTshapeBig();
    const next = applyColumnGripDrag('column-flange-length', {
      originalParams: params,
      delta: { x: 50, y: 0 },
    });
    expect(next.width).toBe(params.width);
    expect(next.depth).toBe(params.depth);
    expect(next.rotation).toBe(params.rotation);
    expect(next.anchor).toBe(params.anchor);
  });

  it('39. flange-length drag on L-shape kind → no-op (referential identity)', () => {
    const params = makeLshape().params;
    const next = applyColumnGripDrag('column-flange-length', {
      originalParams: params,
      delta: { x: 100, y: 0 },
    });
    expect(next).toBe(params);
  });

  it('40. web-thickness drag on rectangular kind → no-op (referential identity)', () => {
    const params = makeRect().params;
    const next = applyColumnGripDrag('column-web-thickness', {
      originalParams: params,
      delta: { x: 100, y: 0 },
    });
    expect(next).toBe(params);
  });
});

// ─── Phase 4.5b — non-regression of unaffected kinds ─────────────────────────

describe('column-grips — Phase 4.5b non-regression (rectangular + circular)', () => {
  it('41. rectangular column STILL emits 4 grips (no variant grips)', () => {
    const grips = getColumnGrips(makeRect());
    expect(grips).toHaveLength(4);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-rotation',
      'column-width',
      'column-depth',
    ]);
  });

  it('42. circular column STILL emits 2 grips (no variant grips)', () => {
    const grips = getColumnGrips(makeCircular());
    expect(grips).toHaveLength(2);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-width',
    ]);
  });
});

// ─── Phase 4.5b — materialize helpers (default derivation) ───────────────────

describe('column-grips — materialize helpers (Phase 4.5b)', () => {
  it('43. materializeLshape default armLength=depth/3, armWidth=width/3', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape', {
      width: 600,
      depth: 900,
    });
    expect(materializeLshape(params)).toEqual({ armLength: 300, armWidth: 200 });
  });

  it('44. materializeLshape respects existing partial override', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape', {
      lshape: { armLength: 350 },
    });
    expect(materializeLshape(params)).toEqual({
      armLength: 350,
      armWidth: params.width / 3,
    });
  });

  it('45. materializeTshape default flangeLength=width, webThickness=depth/3', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'T-shape', {
      width: 500,
      depth: 900,
    });
    expect(materializeTshape(params)).toEqual({ flangeLength: 500, webThickness: 300 });
  });
});
