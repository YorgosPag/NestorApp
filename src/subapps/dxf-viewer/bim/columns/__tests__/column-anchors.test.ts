/**
 * ADR-363 Phase 5.5d — `column-anchors` pure-function tests.
 *
 * Verifies `getColumnAnchorWorldPoints`:
 *   - 9 entries (one per ColumnAnchor) σε `ANCHOR_CYCLE_ORDER` για κάθε kind.
 *   - Rect/L/T: bbox-grid anchors transform σωστά μέσω anchor offset + rotation.
 *   - Circular: cardinals στην περίμετρο (radius), diagonals στα 45°
 *     (radius·√2/2). `params.anchor` + `params.rotation` αγνοούνται.
 *   - Degenerate width = 0 → όλα συμπίπτουν στο `position` χωρίς exception.
 *
 * Pure module — zero React / canvas mocking required.
 */

import { getColumnAnchorWorldPoints } from '../column-anchors';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';
import { ANCHOR_CYCLE_ORDER } from '../../types/column-types';

const SQRT2_HALF = Math.SQRT2 / 2;
const EPS = 1e-6;

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

function rectAt(x: number, y: number, overrides: Partial<ColumnParams> = {}): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 'rectangular');
  return makeColumnEntity({ ...base, ...overrides });
}

function circAt(x: number, y: number, overrides: Partial<ColumnParams> = {}): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 'circular');
  return makeColumnEntity({ ...base, ...overrides });
}

function findAnchor(entries: ReturnType<typeof getColumnAnchorWorldPoints>, anchor: string) {
  const hit = entries.find((e) => e.anchor === anchor);
  if (!hit) throw new Error(`anchor ${anchor} missing`);
  return hit.point;
}

function expectPoint(p: { x: number; y: number }, ex: number, ey: number): void {
  expect(p.x).toBeCloseTo(ex, 6);
  expect(p.y).toBeCloseTo(ey, 6);
}

describe('getColumnAnchorWorldPoints — count + ordering', () => {
  it('1. rectangular → 9 entries in ANCHOR_CYCLE_ORDER', () => {
    const entries = getColumnAnchorWorldPoints(rectAt(0, 0));
    expect(entries).toHaveLength(9);
    expect(entries.map((e) => e.anchor)).toEqual([...ANCHOR_CYCLE_ORDER]);
  });

  it('2. circular → 9 entries in ANCHOR_CYCLE_ORDER', () => {
    const entries = getColumnAnchorWorldPoints(circAt(0, 0));
    expect(entries).toHaveLength(9);
    expect(entries.map((e) => e.anchor)).toEqual([...ANCHOR_CYCLE_ORDER]);
  });

  it('3. L-shape → 9 entries (bbox-grid mirror of rectangular)', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape');
    const entries = getColumnAnchorWorldPoints(makeColumnEntity(params));
    expect(entries).toHaveLength(9);
    expect(entries.map((e) => e.anchor)).toEqual([...ANCHOR_CYCLE_ORDER]);
  });

  it('4. T-shape → 9 entries (bbox-grid mirror of rectangular)', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'T-shape');
    const entries = getColumnAnchorWorldPoints(makeColumnEntity(params));
    expect(entries).toHaveLength(9);
    expect(entries.map((e) => e.anchor)).toEqual([...ANCHOR_CYCLE_ORDER]);
  });
});

describe('getColumnAnchorWorldPoints — rectangular bbox math', () => {
  it('5. rect at origin, anchor=center, rotation=0 → center at position, cardinals at ±halfDim', () => {
    // default rect: 400×400, anchor=center, rotation=0
    const entries = getColumnAnchorWorldPoints(rectAt(0, 0));
    expectPoint(findAnchor(entries, 'center'), 0, 0);
    expectPoint(findAnchor(entries, 'e'), 200, 0);
    expectPoint(findAnchor(entries, 'w'), -200, 0);
    expectPoint(findAnchor(entries, 'n'), 0, 200);
    expectPoint(findAnchor(entries, 's'), 0, -200);
    expectPoint(findAnchor(entries, 'ne'), 200, 200);
    expectPoint(findAnchor(entries, 'sw'), -200, -200);
  });

  it('6. rect with anchor=ne at position (0,0) → ne anchor at position, center shifted -X/-Y', () => {
    const entries = getColumnAnchorWorldPoints(rectAt(0, 0, { anchor: 'ne' }));
    // 'ne' anchor must coincide με position (clicked point)
    expectPoint(findAnchor(entries, 'ne'), 0, 0);
    // center sits at -halfWidth, -halfDepth από position
    expectPoint(findAnchor(entries, 'center'), -200, -200);
    // sw = diagonally opposite corner
    expectPoint(findAnchor(entries, 'sw'), -400, -400);
  });

  it('7. rect rotated 90° CCW (anchor=center) → e-anchor world rotates onto +Y', () => {
    const entries = getColumnAnchorWorldPoints(rectAt(0, 0, { rotation: 90 }));
    // 'e' local = (+200, 0) → rotated 90° CCW → (0, +200)
    expectPoint(findAnchor(entries, 'e'), 0, 200);
    // 'n' local = (0, +200) → rotated 90° CCW → (-200, 0)
    expectPoint(findAnchor(entries, 'n'), -200, 0);
    // center invariant
    expectPoint(findAnchor(entries, 'center'), 0, 0);
  });

  it('8. rect at non-zero position translates all anchors', () => {
    const entries = getColumnAnchorWorldPoints(rectAt(1000, 500));
    expectPoint(findAnchor(entries, 'center'), 1000, 500);
    expectPoint(findAnchor(entries, 'ne'), 1200, 700);
    expectPoint(findAnchor(entries, 'sw'), 800, 300);
  });
});

describe('getColumnAnchorWorldPoints — circular perimeter math', () => {
  it('9. circular at origin → center at (0,0), cardinals at ±r perimeter', () => {
    // default circular: Ø=400 → r=200
    const entries = getColumnAnchorWorldPoints(circAt(0, 0));
    expectPoint(findAnchor(entries, 'center'), 0, 0);
    expectPoint(findAnchor(entries, 'e'), 200, 0);
    expectPoint(findAnchor(entries, 'w'), -200, 0);
    expectPoint(findAnchor(entries, 'n'), 0, 200);
    expectPoint(findAnchor(entries, 's'), 0, -200);
  });

  it('10. circular diagonals at radius · √2/2 (perimeter @ 45°)', () => {
    const entries = getColumnAnchorWorldPoints(circAt(0, 0));
    const d = 200 * SQRT2_HALF;
    expectPoint(findAnchor(entries, 'ne'), d, d);
    expectPoint(findAnchor(entries, 'nw'), -d, d);
    expectPoint(findAnchor(entries, 'se'), d, -d);
    expectPoint(findAnchor(entries, 'sw'), -d, -d);
  });

  it('11. circular ignores rotation (rotationally symmetric)', () => {
    const rot = getColumnAnchorWorldPoints(circAt(0, 0, { rotation: 45 }));
    const noRot = getColumnAnchorWorldPoints(circAt(0, 0, { rotation: 0 }));
    for (const a of ANCHOR_CYCLE_ORDER) {
      const pRot = findAnchor(rot, a);
      const pNo = findAnchor(noRot, a);
      expect(Math.abs(pRot.x - pNo.x)).toBeLessThan(EPS);
      expect(Math.abs(pRot.y - pNo.y)).toBeLessThan(EPS);
    }
  });
});

describe('getColumnAnchorWorldPoints — variant bbox parity', () => {
  it('12. L-shape anchor=ne coincides με rectangular anchor=ne (same bbox, same anchor system)', () => {
    const lParams = buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape');
    const rParams = buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular');
    const lEntries = getColumnAnchorWorldPoints(makeColumnEntity(lParams));
    const rEntries = getColumnAnchorWorldPoints(makeColumnEntity(rParams));
    expectPoint(findAnchor(lEntries, 'ne'), findAnchor(rEntries, 'ne').x, findAnchor(rEntries, 'ne').y);
    expectPoint(findAnchor(lEntries, 'sw'), findAnchor(rEntries, 'sw').x, findAnchor(rEntries, 'sw').y);
  });

  it('13. T-shape anchor=center coincides με rectangular anchor=center (bbox-grid)', () => {
    const tParams = buildDefaultColumnParams({ x: 1000, y: 500 }, 'T-shape');
    const rParams = buildDefaultColumnParams({ x: 1000, y: 500 }, 'rectangular');
    const tEntries = getColumnAnchorWorldPoints(makeColumnEntity(tParams));
    const rEntries = getColumnAnchorWorldPoints(makeColumnEntity(rParams));
    expectPoint(findAnchor(tEntries, 'center'), findAnchor(rEntries, 'center').x, findAnchor(rEntries, 'center').y);
    expectPoint(findAnchor(tEntries, 'n'), findAnchor(rEntries, 'n').x, findAnchor(rEntries, 'n').y);
  });
});

describe('getColumnAnchorWorldPoints — defensive edge cases', () => {
  it('14. degenerate width=0 → όλα τα anchors collapse στο position χωρίς exception', () => {
    const entries = getColumnAnchorWorldPoints(rectAt(100, 200, { width: 0, depth: 0 }));
    expect(entries).toHaveLength(9);
    for (const e of entries) {
      expectPoint(e.point, 100, 200);
    }
  });
});

// ─── ADR-363 Phase 8C — polygon / shear-wall / I-shape coverage ─────────────

describe('getColumnAnchorWorldPoints — Phase 8C kinds', () => {
  it('15. polygon (hexagon default) → 9 entries in ANCHOR_CYCLE_ORDER', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'polygon');
    const entries = getColumnAnchorWorldPoints(makeColumnEntity(params));
    expect(entries).toHaveLength(9);
    expect(entries.map((e) => e.anchor)).toEqual([...ANCHOR_CYCLE_ORDER]);
  });

  it('16. polygon hexagon (Ø=400) ne anchor at actual bbox corner (±173.2, ±200)', () => {
    // Hexagon vertex-up Ø=400 bbox: dimX = 200·√3 ≈ 346.41, dimY = 400.
    // anchor=center, rotation=0 → ne at (+dimX/2, +dimY/2).
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'polygon', { width: 400 });
    const entries = getColumnAnchorWorldPoints(makeColumnEntity(params));
    const expectedX = 200 * Math.sqrt(3) / 2;
    expectPoint(findAnchor(entries, 'ne'), expectedX, 200);
    expectPoint(findAnchor(entries, 'sw'), -expectedX, -200);
    expectPoint(findAnchor(entries, 'center'), 0, 0);
  });

  it('17. polygon rotated 90° transforms anchors (e ↔ n axis swap)', () => {
    const params = buildDefaultColumnParams({ x: 0, y: 0 }, 'polygon', {
      width: 400,
      rotation: 90,
    });
    const entries = getColumnAnchorWorldPoints(makeColumnEntity(params));
    // Hexagon Ø=400: local 'e' at (dimX/2, 0) = (173.2, 0). Rotated 90° CCW → (0, 173.2).
    const expectedX = 200 * Math.sqrt(3) / 2;
    expectPoint(findAnchor(entries, 'e'), 0, expectedX);
    expectPoint(findAnchor(entries, 'center'), 0, 0);
  });

  it('18. shear-wall → 9 entries bbox parity με rectangular (same width × depth)', () => {
    const sParams = buildDefaultColumnParams({ x: 0, y: 0 }, 'shear-wall', { width: 2000, depth: 200 });
    const rParams = buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular', { width: 2000, depth: 200 });
    const sEntries = getColumnAnchorWorldPoints(makeColumnEntity(sParams));
    const rEntries = getColumnAnchorWorldPoints(makeColumnEntity(rParams));
    expect(sEntries).toHaveLength(9);
    for (const a of ANCHOR_CYCLE_ORDER) {
      const s = findAnchor(sEntries, a);
      const r = findAnchor(rEntries, a);
      expectPoint(s, r.x, r.y);
    }
  });

  it('19. I-shape → 9 entries bbox parity με rectangular (b × h)', () => {
    const iParams = buildDefaultColumnParams({ x: 0, y: 0 }, 'I-shape', { width: 200, depth: 300 });
    const rParams = buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular', { width: 200, depth: 300 });
    const iEntries = getColumnAnchorWorldPoints(makeColumnEntity(iParams));
    const rEntries = getColumnAnchorWorldPoints(makeColumnEntity(rParams));
    expect(iEntries).toHaveLength(9);
    for (const a of ANCHOR_CYCLE_ORDER) {
      const i = findAnchor(iEntries, a);
      const r = findAnchor(rEntries, a);
      expectPoint(i, r.x, r.y);
    }
  });

  it('20. I-shape rotated 45° → anchor positions mirror rect rotation (bbox parity)', () => {
    const iParams = buildDefaultColumnParams({ x: 0, y: 0 }, 'I-shape', {
      width: 200, depth: 300, rotation: 45,
    });
    const rParams = buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular', {
      width: 200, depth: 300, rotation: 45,
    });
    const i = findAnchor(getColumnAnchorWorldPoints(makeColumnEntity(iParams)), 'ne');
    const r = findAnchor(getColumnAnchorWorldPoints(makeColumnEntity(rParams)), 'ne');
    expectPoint(i, r.x, r.y);
  });
});
