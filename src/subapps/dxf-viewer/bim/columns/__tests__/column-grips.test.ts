/**
 * ADR-363 Phase 4.5 + 4.5b — `column-grips` pure-function tests.
 *
 * Verifies:
 *   - `getColumnGrips` emits the correct count + ordering per kind
 *     (rectangular → 3 grips, L-shape / T-shape → 5 grips Phase 4.5b,
 *     circular → 5 grips (center + 4 quadrants, ADR-519), polygon → full set (ADR-518), shear-wall → 10 grips, I-shape → 6 grips).
 *     ADR-363 Φ1G.5 Slice 2: column-center grip no longer emitted (except rect/shear-wall + polygon ADR-518 + circular ADR-519).
 *   - Grip positions correspond to centroid / rotation handle / far-edge
 *     midpoints / variant edge midpoints σε mm world space.
 *   - `applyColumnGripDrag` patches the right field per kind, clamps
 *     width/depth/variant dims στο MIN_COLUMN_DIMENSION_MM, preserves foreign
 *     params (height/anchor/material/lshape/tshape) και short-circuits zero
 *     delta + unknown grip kinds + circular rotation (no-op) + cross-kind
 *     variant grips στο originalParams (referential identity).
 *   - L-shape / T-shape drag materializes defaults από width/3 + depth/3
 *     (L) ή width + depth/3 (T) όταν params.lshape / params.tshape undefined.
 */

import { applyColumnGripDrag, getColumnGrips } from '../column-grips';
import {
  armLengthHandlePosition,
  armWidthHandlePosition,
  flangeLengthHandlePosition,
  iFlangeThicknessHandlePosition,
  iWebThicknessHandlePosition,
  materializeIshape,
  materializeLshape,
  materializeTshape,
  webThicknessHandlePosition,
} from '../column-variant-grips';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { computeColumnGeometry } from '../../geometry/column-geometry';
import type { ColumnEntity, ColumnKind, ColumnParams } from '../../types/column-types';
import {
  DEFAULT_I_FLANGE_THICKNESS_MM,
  DEFAULT_I_WEB_THICKNESS_MM,
  MIN_COLUMN_DIMENSION_MM,
  MIN_I_PLATE_THICKNESS_MM,
} from '../../types/column-types';

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
  // ADR-363/449 — το L-shape παίρνει πλέον free per-corner grips (geometry-driven),
  // οπότε ο builder χρειάζεται υπολογισμένο footprint.
  const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape');
  const ent = makeColumnEntity(params);
  return { ...ent, geometry: computeColumnGeometry(params) } as ColumnEntity;
}

function makeTshape(): ColumnEntity {
  // ADR-363/449 PHASE 2 — το T-shape παίρνει πλέον free per-corner grips (geometry-driven,
  // ίδιος μηχανισμός με L-shape), οπότε ο builder χρειάζεται υπολογισμένο footprint.
  const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'T-shape');
  const ent = makeColumnEntity(params);
  return { ...ent, geometry: computeColumnGeometry(params) } as ColumnEntity;
}

function makeOfKind(kind: ColumnKind, overrides: Partial<ColumnParams> = {}): ColumnEntity {
  return makeColumnEntity({
    ...buildDefaultColumnParams({ x: 0, y: 0 }, kind),
    ...overrides,
  });
}

describe('column-grips — getColumnGrips (Phase 4.5)', () => {
  it('1. rectangular → 10 grips: center, rotation, 4 edges, 4 corners — ADR-363 (Giorgio 2026-06-15)', () => {
    // Giorgio 2026-06-15: rect gains a center MOVE grip + edge-midpoints on ALL 4
    // sides (E=width, N=depth, W=edge-w, S=edge-s) + rotation στο μέσο κέντρου↔κάτω.
    const grips = getColumnGrips(makeRect());
    expect(grips).toHaveLength(10);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-rotation',
      'column-width',
      'column-depth',
      'column-edge-w',
      'column-edge-s',
      'column-corner-ne',
      'column-corner-nw',
      'column-corner-sw',
      'column-corner-se',
    ]);
  });

  it('ADR-397 — grip handles stay on the column body in a metre-unit scene (mm→scene scaled)', () => {
    // position in scene units (metres), width/depth in mm. With sceneUnits='m'
    // the scale is 0.001 → handle offsets must be tiny (~0.2-0.5), NOT 200+.
    const col = makeColumnEntity({
      ...buildDefaultColumnParams({ x: 10, y: 8 }, 'rectangular'),
      sceneUnits: 'm',
      position: { x: 10, y: 8, z: 0 },
      width: 400,
      depth: 600,
      rotation: 0,
      anchor: 'center',
    });
    const grips = getColumnGrips(col);
    // ADR-363 (Giorgio 2026-06-15) rect layout: [0]=center, [1]=rotation, [2]=width, [3]=depth.
    // center sits on the centroid = (10, 8).
    expect(grips[0].columnGripKind).toBe('column-center');
    expect(grips[0].position.x).toBeCloseTo(10, 6);
    expect(grips[0].position.y).toBeCloseTo(8, 6);
    // rotation handle = midpoint centre↔south edge: y − (600/4)*0.001 = 8 − 0.15 = 7.85.
    expect(grips[1].columnGripKind).toBe('column-rotation');
    expect(grips[1].position.x).toBeCloseTo(10, 6);
    expect(grips[1].position.y).toBeCloseTo(7.85, 6);
    // width handle: x + (400/2)*0.001 = 10.2 (not 210).
    expect(grips[2].position.x).toBeCloseTo(10.2, 6);
    expect(grips[2].position.y).toBeCloseTo(8, 6);
    // depth handle: y + (600/2)*0.001 = 8.3 (not 308).
    expect(grips[3].position.y).toBeCloseTo(8.3, 6);
  });

  it('ADR-397 — width resize tracks cursor 1:1 in a metre scene (scene delta ÷ s → mm)', () => {
    const col = makeColumnEntity({
      ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'),
      sceneUnits: 'm',
      width: 400,
      anchor: 'center',
      rotation: 0,
    });
    // ADR-363 Slice C — opposite-edge-fixed: the dragged edge follows the cursor
    // 1:1. halfWidth = 0.2 scene; +0.1/2 = 0.25 → width = 0.25·2/0.001 = 500 mm.
    const next = applyColumnGripDrag('column-width', {
      originalParams: col.params,
      delta: { x: 0.1, y: 0 },
    });
    expect(next.width).toBeCloseTo(500, 3);
  });

  it('2. circular → 5 grips: center MOVE + 4 quadrants (Β/Α/Ν/Δ) — ADR-519', () => {
    // ADR-519: circular reaches full rect parity = center MOVE (4 αυτόνομα βελάκια)
    // + 4 quadrant λαβές που μεγαλώνουν την ακτίνα. ΧΩΡΙΣ rotation (κύκλος συμμετρικός).
    const grips = getColumnGrips(makeCircular());
    expect(grips).toHaveLength(5);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-width', // E
      'column-depth', // N
      'column-edge-w', // W
      'column-edge-s', // S
    ]);
    // No rotation handle for a rotationally-symmetric circle.
    expect(grips.map((g) => g.columnGripKind)).not.toContain('column-rotation');
    const center = grips.find((g) => g.columnGripKind === 'column-center')!;
    expect(center.type).toBe('center');
    expect(center.movesEntity).toBe(true);
  });

  it('2b. circular → 4 quadrant grips sit on the circumference (Β/Α/Ν/Δ) — ADR-519', () => {
    const ent = makeCircular();
    const { params } = ent;
    const r = (params.width / 2) * 1; // sceneUnits 'mm' → scale 1
    const at = (k: string) =>
      getColumnGrips(ent).find((g) => g.columnGripKind === k)!.position;
    expect(at('column-width')).toEqual({ x: params.position.x + r, y: params.position.y }); // E
    expect(at('column-depth')).toEqual({ x: params.position.x, y: params.position.y + r }); // N
    expect(at('column-edge-w')).toEqual({ x: params.position.x - r, y: params.position.y }); // W
    expect(at('column-edge-s')).toEqual({ x: params.position.x, y: params.position.y - r }); // S
  });

  it('3. L-shape → free reshape: rotation + ΜΙΑ λαβή/κορυφή + ΜΙΑ λαβή/μέσο-πλευράς — ADR-363/449', () => {
    // ADR-363/449 — το L-shape δεν χρησιμοποιεί πλέον παραμετρικά arm grips· δίνει μία λαβή ανά
    // κορυφή (corner reshape) + μία στο μέσο κάθε πλευράς (move-whole-side) του footprint.
    const ent = makeLshape();
    const verts = ent.geometry.footprint.vertices;
    const grips = getColumnGrips(ent);
    expect(grips).toHaveLength(2 + 2 * verts.length); // ADR-520: center + rotation + N corners + N edges
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center', // ADR-520 — σταυρός μετακίνησης
      'column-rotation',
      ...verts.map((_, i) => `column-poly-vertex-${i}`),
      ...verts.map((_, i) => `column-poly-edge-${i}`),
    ]);
    expect(grips.map((g) => g.columnGripKind)).not.toContain('column-arm-length');
  });

  it('4. T-shape → free reshape: rotation + ΜΙΑ λαβή/κορυφή + ΜΙΑ λαβή/μέσο-πλευράς — ADR-363/449 PHASE 2', () => {
    // ADR-363/449 PHASE 2 — το T-shape ακολουθεί πλέον τον ΙΔΙΟ μηχανισμό με το L-shape (Γ):
    // μία λαβή ανά κορυφή (corner reshape) + μία στο μέσο κάθε πλευράς, ΟΧΙ παραμετρικά flange/web grips.
    const ent = makeTshape();
    const verts = ent.geometry.footprint.vertices;
    const grips = getColumnGrips(ent);
    expect(grips).toHaveLength(2 + 2 * verts.length); // ADR-520: center + rotation + N corners + N edges
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center', // ADR-520 — σταυρός μετακίνησης
      'column-rotation',
      ...verts.map((_, i) => `column-poly-vertex-${i}`),
      ...verts.map((_, i) => `column-poly-edge-${i}`),
    ]);
    expect(grips.map((g) => g.columnGripKind)).not.toContain('column-flange-length');
    expect(grips.map((g) => g.columnGripKind)).not.toContain('column-web-thickness');
  });

  it('5. rect + circular + free-reshape(L) all emit a center MOVE grip', () => {
    // ADR-363 (Giorgio 2026-06-15): rect re-gains the center MOVE grip· ADR-519:
    // circular too· ADR-520: free-reshape (L/T/U/composite) too.
    const rect = getColumnGrips(makeRect());
    const center = rect.find((g) => g.columnGripKind === 'column-center');
    expect(center).toBeDefined();
    expect(center!.movesEntity).toBe(true);
    // ADR-519 — circular now also emits the center MOVE grip.
    const circCenter = getColumnGrips(makeCircular()).find((g) => g.columnGripKind === 'column-center');
    expect(circCenter).toBeDefined();
    expect(circCenter!.movesEntity).toBe(true);
    // ADR-520 — free-reshape (L-shape) now ALSO emits the center MOVE grip.
    const lCenter = getColumnGrips(makeLshape()).find((g) => g.columnGripKind === 'column-center');
    expect(lCenter).toBeDefined();
    expect(lCenter!.movesEntity).toBe(true);
  });

  it('6. width grip on rectangular sits at +width/2 along X (anchor=center, rotation=0)', () => {
    const col = makeRect();
    const grips = getColumnGrips(col);
    // ADR-363 (Giorgio 2026-06-15) rect layout: [0]=center, [1]=rotation, [2]=width.
    expect(grips[2].columnGripKind).toBe('column-width');
    expect(grips[2].position.x).toBeCloseTo(col.params.width / 2, 6);
    expect(grips[2].position.y).toBeCloseTo(0, 6);
  });

  it('7. depth grip on rectangular sits at +depth/2 along Y (anchor=center, rotation=0)', () => {
    const col = makeRect();
    const grips = getColumnGrips(col);
    // ADR-363 (Giorgio 2026-06-15) rect layout: [3]=depth.
    expect(grips[3].columnGripKind).toBe('column-depth');
    expect(grips[3].position.x).toBeCloseTo(0, 6);
    expect(grips[3].position.y).toBeCloseTo(col.params.depth / 2, 6);
  });

  it('7b. rect WEST/SOUTH edge grips sit at −width/2 / −depth/2· rotation at −depth/4 (Giorgio 2026-06-15)', () => {
    const col = makeRect();
    const grips = getColumnGrips(col);
    const w = grips.find((g) => g.columnGripKind === 'column-edge-w')!;
    const s = grips.find((g) => g.columnGripKind === 'column-edge-s')!;
    const rot = grips.find((g) => g.columnGripKind === 'column-rotation')!;
    expect(w.position.x).toBeCloseTo(-col.params.width / 2, 6);
    expect(w.position.y).toBeCloseTo(0, 6);
    expect(s.position.x).toBeCloseTo(0, 6);
    expect(s.position.y).toBeCloseTo(-col.params.depth / 2, 6);
    // rotation = midpoint centre↔south = (0, −depth/4).
    expect(rot.position.x).toBeCloseTo(0, 6);
    expect(rot.position.y).toBeCloseTo(-col.params.depth / 4, 6);
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

  it('9. width drag resizes width (opposite edge fixed → follows cursor) preserving depth/rotation/anchor', () => {
    const col = makeRect();
    const next = applyColumnGripDrag('column-width', {
      originalParams: col.params,
      delta: { x: 100, y: 0 },
    });
    // ADR-363 Slice C — opposite-edge-fixed → newWidth = oldWidth + 100 (handle 1:1)
    expect(next.width).toBeCloseTo(col.params.width + 100, 6);
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
    // ADR-363 Slice C — opposite-edge-fixed → newDepth = oldDepth + 50 (handle 1:1)
    expect(next.depth).toBeCloseTo(col.params.depth + 50, 6);
    expect(next.width).toBe(col.params.width);
    expect(next.rotation).toBe(col.params.rotation);
  });

  it('11. rotation drag updates rotation preserving width/depth/position', () => {
    const col = makeRect();
    // Old handle on anchor=center, rotation=0: opposite the depth handle at
    // (0, −(depth/2 + offset)) = (0, −400). Drag by (+100, 0) → new handle
    // (100, −400). The swept angle about position(0,0) changes the rotation.
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

  it('14. circular kind: depth-grip (N quadrant) → diameter resize (symmetric +Y) — ADR-519', () => {
    // ADR-519: the N quadrant grip (`column-depth`) now grows the diameter along +Y
    // (was a no-op before the circular grip parity). Symmetric factor 2, centre fixed.
    const col = makeCircular();
    const next = applyColumnGripDrag('column-depth', {
      originalParams: col.params,
      delta: { x: 0, y: 50 },
    });
    expect(next.width).toBeCloseTo(col.params.width + 100, 6);
    expect(next.position).toEqual(col.params.position); // centre stays put
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

  it('16b. circular W/S quadrants grow the diameter on the opposite (−) drag — ADR-519', () => {
    const col = makeCircular();
    // W quadrant (`column-edge-w`, −X): dragging further −X grows the radius.
    const w = applyColumnGripDrag('column-edge-w', {
      originalParams: col.params,
      delta: { x: -50, y: 0 },
    });
    expect(w.width).toBeCloseTo(col.params.width + 100, 6);
    // S quadrant (`column-edge-s`, −Y): dragging further −Y grows the radius.
    const s = applyColumnGripDrag('column-edge-s', {
      originalParams: col.params,
      delta: { x: 0, y: -50 },
    });
    expect(s.width).toBeCloseTo(col.params.width + 100, 6);
  });

  it('16c. circular diameter resize clamps to MIN_COLUMN_DIMENSION_MM — ADR-519', () => {
    const col = makeCircular();
    const next = applyColumnGripDrag('column-width', {
      originalParams: col.params,
      delta: { x: -100000, y: 0 },
    });
    expect(next.width).toBe(MIN_COLUMN_DIMENSION_MM);
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
    // ADR-496 Phase 2 — mergeTshape πλέον διατηρεί flangeThickness (default depth/3, depth=400).
    expect(next.tshape).toEqual({ flangeLength: 1000, webThickness: 300, flangeThickness: 400 / 3 });
  });

  it('34. web-thickness drag +X → 2× factor (symmetric)', () => {
    const params = makeTshapeBig();
    const next = applyColumnGripDrag('column-web-thickness', {
      originalParams: params,
      delta: { x: 25, y: 0 },
    });
    expect(next.tshape).toEqual({ flangeLength: 900, webThickness: 350, flangeThickness: 400 / 3 });
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
    // materialized base flangeLength = 900; webThickness = 900/3 = 300; new flange = 900 + 100·
    // flangeThickness default depth/3 = 300 (ADR-496 Phase 2, διατηρείται από το mergeTshape).
    expect(next.tshape).toEqual({ flangeLength: 1000, webThickness: 300, flangeThickness: 300 });
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
  it('41. rectangular column emits 10 grips (center + rotation + 4 edges + 4 corners) — ADR-363 (Giorgio 2026-06-15)', () => {
    const grips = getColumnGrips(makeRect());
    expect(grips).toHaveLength(10);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-rotation',
      'column-width',
      'column-depth',
      'column-edge-w',
      'column-edge-s',
      'column-corner-ne',
      'column-corner-nw',
      'column-corner-sw',
      'column-corner-se',
    ]);
  });

  it('42. circular column emits center MOVE + 4 quadrants (no rotation/variant) — ADR-519', () => {
    // ADR-519: circular full parity = center + 4 quadrant radius grips, no rotation.
    const grips = getColumnGrips(makeCircular());
    expect(grips).toHaveLength(5);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-width',
      'column-depth',
      'column-edge-w',
      'column-edge-s',
    ]);
  });
});

// ─── Slice C — rect/shear-wall corners (shared rect-grip-engine) ─────────────

describe('column-grips — Slice C rect corners', () => {
  it('64. corner-ne resizes width+depth and shifts position, keeping SW fixed', () => {
    const col = makeRect();
    const w0 = col.params.width;
    const d0 = col.params.depth;
    const next = applyColumnGripDrag('column-corner-ne', {
      originalParams: col.params,
      delta: { x: 100, y: 200 },
    });
    expect(next.width).toBeCloseTo(w0 + 100, 6);
    expect(next.depth).toBeCloseTo(d0 + 200, 6);
    // center anchor → position = centroid, shifted by half the corner displacement.
    expect(next.position.x).toBeCloseTo(50, 6);
    expect(next.position.y).toBeCloseTo(100, 6);
  });

  it('65. corner-sw grows toward −X/−Y and keeps NE fixed', () => {
    const col = makeRect();
    const next = applyColumnGripDrag('column-corner-sw', {
      originalParams: col.params,
      delta: { x: -100, y: -200 },
    });
    expect(next.width).toBeCloseTo(col.params.width + 100, 6);
    expect(next.depth).toBeCloseTo(col.params.depth + 200, 6);
    expect(next.position.x).toBeCloseTo(-50, 6);
    expect(next.position.y).toBeCloseTo(-100, 6);
  });

  it('66. corner drag clamps both dims at MIN_COLUMN_DIMENSION_MM', () => {
    const next = applyColumnGripDrag('column-corner-ne', {
      originalParams: makeRect().params,
      delta: { x: -100000, y: -100000 },
    });
    expect(next.width).toBe(MIN_COLUMN_DIMENSION_MM);
    expect(next.depth).toBe(MIN_COLUMN_DIMENSION_MM);
  });

  it('67. corner grip on a non-rect kind (L-shape) → no-op (referential identity)', () => {
    const params = makeLshape().params;
    const next = applyColumnGripDrag('column-corner-ne', {
      originalParams: params,
      delta: { x: 100, y: 100 },
    });
    expect(next).toBe(params);
  });

  it('68. non-rect kinds (L-shape) do NOT emit corner grips', () => {
    const kinds = getColumnGrips(makeLshape()).map((g) => g.columnGripKind);
    expect(kinds).not.toContain('column-corner-ne');
    expect(kinds).not.toContain('column-corner-sw');
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

  it('45. materializeTshape default flangeLength=width, webThickness=depth/3, flangeThickness=depth/3', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'T-shape', {
      width: 500,
      depth: 900,
    });
    // ADR-496 Phase 2 — flangeThickness default depth/3 = 300 (ΕΝΑ SSoT default με τη γεωμετρία).
    expect(materializeTshape(params)).toEqual({ flangeLength: 500, webThickness: 300, flangeThickness: 300 });
  });
});

// ─── ADR-363 Phase 8C — polygon / shear-wall / I-shape grips ────────────────

describe('column-grips — ADR-518: polygon kind full grip set (parity ορθογώνιας)', () => {
  it('46. polygon → πλήρες set: center MOVE + rotation + λαβή/κορυφή + λαβή/μέσο-πλευράς', () => {
    // ADR-518: η κανονική πολυγωνική κολόνα αποκτά parity με την ορθογώνια — center MOVE
    // (4 ξεχωριστά βελάκια) + rotation + ΜΙΑ λαβή ανά κορυφή + ΜΙΑ λαβή ανά μέσο πλευράς.
    const col = makeOfKind('polygon', { polygon: { sides: 6 }, anchor: 'center', rotation: 0 });
    const grips = getColumnGrips(col);
    expect(grips).toHaveLength(2 + 6 + 6); // center + rotation + 6 κορυφές + 6 μέσα
    expect(grips[0].columnGripKind).toBe('column-center');
    expect(grips[0].movesEntity).toBe(true);
    expect(grips[1].columnGripKind).toBe('column-rotation');
    const kinds = grips.map((g) => g.columnGripKind);
    for (let i = 0; i < 6; i++) {
      expect(kinds).toContain(`column-poly-vertex-${i}`);
      expect(kinds).toContain(`column-poly-edge-${i}`);
    }
  });

  it('47. polygon center MOVE στο centroid· rotation ΑΝΑΜΕΣΑ κέντρο↔κάτω (ΟΧΙ πάνω στο κέντρο)', () => {
    // ΚΡΙΣΙΜΟ ADR-518: για convex N-gon το interiorAnchorPoint ≈ centroid, οπότε το rotation
    // ΠΡΕΠΕΙ να μετατοπίζεται (−dimY/4) αλλιώς θα έπεφτε πάνω στο move glyph.
    const col = makeOfKind('polygon', { polygon: { sides: 6 }, width: 400, anchor: 'center', rotation: 0 });
    const grips = getColumnGrips(col);
    const center = grips.find((g) => g.columnGripKind === 'column-center')!;
    const rot = grips.find((g) => g.columnGripKind === 'column-rotation')!;
    expect(center.position.x).toBeCloseTo(0, 4);
    expect(center.position.y).toBeCloseTo(0, 4);
    expect(rot.position.x).toBeCloseTo(0, 4);
    expect(rot.position.y).toBeLessThan(0);                  // μετατοπισμένο κάτω από το κέντρο
    expect(Math.abs(rot.position.y)).toBeGreaterThan(1e-3);  // ΔΕΝ συμπίπτει με το centroid/move
  });

  it('48. polygon depth grip drag → no-op (referential identity)', () => {
    const params = makeOfKind('polygon').params;
    const next = applyColumnGripDrag('column-depth', {
      originalParams: params,
      delta: { x: 0, y: 100 },
    });
    expect(next).toBe(params);
  });

  it('49. polygon width drag → 2× factor (symmetric)', () => {
    const params = makeOfKind('polygon', { width: 400 }).params;
    const next = applyColumnGripDrag('column-width', {
      originalParams: params,
      delta: { x: 50, y: 0 },
    });
    // 2× factor → newWidth = 400 + 2·50 = 500
    expect(next.width).toBeCloseTo(500, 4);
  });
});

describe('column-grips — Phase 8C: shear-wall kind', () => {
  it('50. shear-wall → 10 grips (rect parity: center, rotation, 4 edges, 4 corners) — ADR-363 (Giorgio 2026-06-15)', () => {
    const grips = getColumnGrips(makeOfKind('shear-wall', { width: 2000, depth: 200 }));
    expect(grips).toHaveLength(10);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center',
      'column-rotation',
      'column-width',
      'column-depth',
      'column-edge-w',
      'column-edge-s',
      'column-corner-ne',
      'column-corner-nw',
      'column-corner-sw',
      'column-corner-se',
    ]);
  });

  it('51. shear-wall depth drag (thickness) preserves width (length)', () => {
    const params = makeOfKind('shear-wall', { width: 2000, depth: 200 }).params;
    const next = applyColumnGripDrag('column-depth', {
      originalParams: params,
      delta: { x: 0, y: 50 },
    });
    expect(next.width).toBe(2000);
    // ADR-363 Slice C — opposite-edge-fixed → newDepth = 200 + 50
    expect(next.depth).toBeCloseTo(250, 4);
  });
});

describe('column-grips — rect WEST/SOUTH edge drag (Giorgio 2026-06-15, shared rect-grip-engine)', () => {
  it('column-edge-w resize μεγαλώνει width κρατώντας την ανατολική παρειά σταθερή', () => {
    const col = makeRect(); // width=depth=400, anchor=center
    // drag west edge κατά −100 (προς τα αριστερά) → width = 400 + 100 = 500· east edge (+200) σταθερή.
    const next = applyColumnGripDrag('column-edge-w', { originalParams: col.params, delta: { x: -100, y: 0 } });
    expect(next.width).toBeCloseTo(500, 4);
    expect(next.depth).toBeCloseTo(400, 4); // perpendicular dimension untouched
  });

  it('column-edge-s resize μεγαλώνει depth κρατώντας τη βόρεια παρειά σταθερή', () => {
    const col = makeRect();
    const next = applyColumnGripDrag('column-edge-s', { originalParams: col.params, delta: { x: 0, y: -100 } });
    expect(next.depth).toBeCloseTo(500, 4);
    expect(next.width).toBeCloseTo(400, 4);
  });
});

describe('column-grips — Phase 8C: I-shape kind', () => {
  function makeIshape(overrides: Partial<ColumnParams> = {}): ColumnEntity {
    return makeOfKind('I-shape', { width: 200, depth: 300, ...overrides });
  }

  it('52. I-shape → 5 grips (base 3 + i-flange-thickness + i-web-thickness) — ADR-363 Φ1G.5 Slice 2', () => {
    // ADR-363 Φ1G.5 Slice 2: column-center removed; count drops from 6 to 5
    const grips = getColumnGrips(makeIshape());
    expect(grips).toHaveLength(5);
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-rotation',
      'column-width',
      'column-depth',
      'column-i-flange-thickness',
      'column-i-web-thickness',
    ]);
  });

  it('53. I-shape i-flange-thickness handle at (0, depth/2 - tf) world (anchor=center, rotation=0)', () => {
    const params = makeIshape().params;
    const expectedY = params.depth / 2 - DEFAULT_I_FLANGE_THICKNESS_MM; // 150 - 20 = 130
    const pos = iFlangeThicknessHandlePosition(params);
    expect(pos.x).toBeCloseTo(0, 4);
    expect(pos.y).toBeCloseTo(expectedY, 4);
  });

  it('54. I-shape i-web-thickness handle at (-tw/2, 0) world (anchor=center, rotation=0)', () => {
    const params = makeIshape().params;
    const expectedX = -DEFAULT_I_WEB_THICKNESS_MM / 2; // -7.5
    const pos = iWebThicknessHandlePosition(params);
    expect(pos.x).toBeCloseTo(expectedX, 4);
    expect(pos.y).toBeCloseTo(0, 4);
  });

  it('55. resizeIFlangeThickness drag +Y → 1× factor (tf decreases by dy)', () => {
    const params = makeIshape({ ishape: { flangeThickness: 30, webThickness: 20 } }).params;
    const next = applyColumnGripDrag('column-i-flange-thickness', {
      originalParams: params,
      delta: { x: 0, y: 5 },
    });
    // 1× factor: drag +Y by 5 → tf = 30 - 5 = 25
    expect(next.ishape?.flangeThickness).toBeCloseTo(25, 4);
    expect(next.ishape?.webThickness).toBe(20); // preserved
  });

  it('56. resizeIWebThickness drag +X → 2× factor (tw decreases by 2·dx)', () => {
    const params = makeIshape({ ishape: { flangeThickness: 30, webThickness: 20 } }).params;
    const next = applyColumnGripDrag('column-i-web-thickness', {
      originalParams: params,
      delta: { x: 5, y: 0 },
    });
    // 2× factor: drag +X by 5 → tw = 20 - 10 = 10
    expect(next.ishape?.webThickness).toBeCloseTo(10, 4);
    expect(next.ishape?.flangeThickness).toBe(30); // preserved
  });

  it('57. I-shape flange-thickness clamps στο MIN_I_PLATE_THICKNESS_MM (huge +Y delta)', () => {
    const params = makeIshape().params;
    const next = applyColumnGripDrag('column-i-flange-thickness', {
      originalParams: params,
      delta: { x: 0, y: 10000 },
    });
    expect(next.ishape?.flangeThickness).toBe(MIN_I_PLATE_THICKNESS_MM);
  });

  it('58. I-shape web-thickness clamps στο MIN_I_PLATE_THICKNESS_MM (huge +X delta)', () => {
    const params = makeIshape().params;
    const next = applyColumnGripDrag('column-i-web-thickness', {
      originalParams: params,
      delta: { x: 10000, y: 0 },
    });
    expect(next.ishape?.webThickness).toBe(MIN_I_PLATE_THICKNESS_MM);
  });

  it('59. resizeIFlangeThickness on rectangular → no-op (referential identity)', () => {
    const params = makeRect().params;
    const next = applyColumnGripDrag('column-i-flange-thickness', {
      originalParams: params,
      delta: { x: 0, y: 5 },
    });
    expect(next).toBe(params);
  });

  it('60. resizeIWebThickness on T-shape → no-op (referential identity)', () => {
    const params = makeTshape().params;
    const next = applyColumnGripDrag('column-i-web-thickness', {
      originalParams: params,
      delta: { x: 5, y: 0 },
    });
    expect(next).toBe(params);
  });

  it('61. materializeIshape defaults from DEFAULT_I_*_THICKNESS_MM', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'I-shape', { width: 200, depth: 300 });
    expect(params.ishape).toBeUndefined();
    expect(materializeIshape(params)).toEqual({
      flangeThickness: DEFAULT_I_FLANGE_THICKNESS_MM,
      webThickness: DEFAULT_I_WEB_THICKNESS_MM,
    });
  });

  it('62. materializeIshape respects partial override', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'I-shape', {
      width: 200, depth: 300,
      ishape: { flangeThickness: 25 },
    });
    expect(materializeIshape(params)).toEqual({
      flangeThickness: 25,
      webThickness: DEFAULT_I_WEB_THICKNESS_MM,
    });
  });

  it('63. I-shape i-flange-thickness drag χωρίς params.ishape materializes defaults', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'I-shape', { width: 200, depth: 300 });
    expect(params.ishape).toBeUndefined();
    const next = applyColumnGripDrag('column-i-flange-thickness', {
      originalParams: params,
      delta: { x: 0, y: 5 },
    });
    // base tf = 20 (default), drag +Y 5 → tf = 15. webThickness preserved at default 15.
    expect(next.ishape).toEqual({
      flangeThickness: DEFAULT_I_FLANGE_THICKNESS_MM - 5,
      webThickness: DEFAULT_I_WEB_THICKNESS_MM,
    });
  });
});

describe('column-grips — applyColumnGripDrag rotate-around-pivot (ADR-397 6-click)', () => {
  it('orbits position around an external pivot AND adds the swept angle (90° CCW)', () => {
    // Column at (50,0). Pivot at origin. Reference arm anchor at (100,0) → 0°,
    // current cursor at (0,100) → 90°. swept = +90°. delta = current − anchor.
    const col = makeOfKind('rectangular', { position: { x: 50, y: 0, z: 0 }, rotation: 0 });
    const pivot = { x: 0, y: 0 };
    const currentPos = { x: 0, y: 100 };
    const delta = { x: currentPos.x - 100, y: currentPos.y - 0 }; // anchor = (100,0)
    const next = applyColumnGripDrag('column-rotation', {
      originalParams: col.params,
      delta,
      currentPos,
      pivot,
    });
    // position (50,0) rotated 90° CCW about origin → (0,50).
    expect(next.position.x).toBeCloseTo(0, 6);
    expect(next.position.y).toBeCloseTo(50, 6);
    expect(next.rotation).toBeCloseTo(90, 6);
    expect(next.width).toBe(col.params.width);
    expect(next.depth).toBe(col.params.depth);
  });

  it('without pivot → legacy handle-delta rotation about own position (no orbit)', () => {
    const col = makeRect(); // position (0,0)
    const next = applyColumnGripDrag('column-rotation', {
      originalParams: col.params,
      delta: { x: 100, y: 0 },
    });
    // legacy path: position unchanged, rotation changes.
    expect(next.position.x).toBe(0);
    expect(next.position.y).toBe(0);
    expect(next.rotation).not.toBe(col.params.rotation);
  });

  it('degenerate reference arm (zero-length) → params unchanged', () => {
    const col = makeOfKind('rectangular', { position: { x: 50, y: 0, z: 0 } });
    const pivot = { x: 0, y: 0 };
    // currentPos == pivot → current arm degenerate.
    const next = applyColumnGripDrag('column-rotation', {
      originalParams: col.params,
      delta: { x: 5, y: 5 },
      currentPos: { x: 0, y: 0 },
      pivot,
    });
    expect(next).toBe(col.params);
  });
});
