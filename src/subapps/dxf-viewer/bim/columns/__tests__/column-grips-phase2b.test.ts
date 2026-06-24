/**
 * ADR-363 Phase 2b — polygon-backed U-shape/composite editing grip tests.
 *
 * Verifies:
 *   - `getColumnGrips` emission: manual παραμετρικό Π → 5 grips (rotation +
 *     width + depth + leg/base thickness)· polygon-backed U/composite →
 *     rotation + ΜΙΑ per-vertex λαβή ανά κορυφή (ΟΧΙ center/width/depth).
 *     ADR-363 Φ1G.5 Slice 2: `column-center` NO LONGER emitted.
 *   - `applyColumnGripDrag`:
 *       · `column-leg-thickness` / `column-base-thickness` patch ushape.
 *       · `column-poly-vertex-${i}` σέρνει ΜΟΝΟ την κορυφή i (οι υπόλοιπες
 *         μένουν στη θέση τους), re-centers το polygon + compensates position.
 *       · out-of-range / unknown → originalParams referentially.
 */

import { applyColumnGripDrag, getColumnGrips } from '../column-grips';
import { polyVertexHandlePosition } from '../column-poly-vertex-grips';
import { materializeUshape } from '../column-variant-grips';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';
import type { Point2D } from '../../../rendering/types/Types';

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

/** Square polygon (bbox-centered, CCW) σε local mm — εύκολο για vertex-move math. */
const SQUARE: readonly Point2D[] = [
  { x: -200, y: -200 },
  { x:  200, y: -200 },
  { x:  200, y:  200 },
  { x: -200, y:  200 },
];

function makeComposite(): ColumnEntity {
  return makeColumnEntity({
    ...buildDefaultColumnParams({ x: 0, y: 0 }, 'composite'),
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    anchor: 'center',
    width: 400,
    depth: 400,
    sceneUnits: 'mm',
    composite: { polygon: SQUARE },
  });
}

function makeUparametric(): ColumnEntity {
  // Manual Π: no `ushape.polygon` → παραμετρικό.
  return makeColumnEntity({
    ...buildDefaultColumnParams({ x: 0, y: 0 }, 'U-shape'),
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    anchor: 'center',
    width: 400,
    depth: 400,
    sceneUnits: 'mm',
  });
}

describe('column-grips Phase 2b — emission', () => {
  // ADR-363 Φ1G.5 Slice 2: column-center removed → 5 grips (rotation + width + depth + leg + base)
  it('manual παραμετρικό Π → 5 grips (rotation + width + depth + leg + base thickness)', () => {
    const grips = getColumnGrips(makeUparametric());
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-rotation',
      'column-width',
      'column-depth',
      'column-leg-thickness',
      'column-base-thickness',
    ]);
  });

  // ADR-520 — free reshape: center MOVE + rotation + ΜΙΑ λαβή/κορυφή + ΜΙΑ λαβή/μέσο-πλευράς (ΟΧΙ width/depth)
  it('polygon-backed composite → center + rotation + λαβή/κορυφή + λαβή/μέσο-πλευράς', () => {
    const grips = getColumnGrips(makeComposite());
    expect(grips.map((g) => g.columnGripKind)).toEqual([
      'column-center', // ADR-520 — σταυρός μετακίνησης (4 αυτόνομα βελάκια)
      'column-rotation',
      'column-poly-vertex-0',
      'column-poly-vertex-1',
      'column-poly-vertex-2',
      'column-poly-vertex-3',
      'column-poly-edge-0',
      'column-poly-edge-1',
      'column-poly-edge-2',
      'column-poly-edge-3',
    ]);
  });

  it('polygon-backed U-shape (από-περίγραμμα) → per-vertex grips', () => {
    const u = makeColumnEntity({
      ...makeUparametric().params,
      ushape: { polygon: SQUARE },
    });
    const kinds = getColumnGrips(u).map((g) => g.columnGripKind);
    expect(kinds).toContain('column-poly-vertex-0');
    expect(kinds).not.toContain('column-width');
    expect(kinds).not.toContain('column-depth');
    expect(kinds).toContain('column-center'); // ADR-520 — ο σταυρός μετακίνησης εμφανίζεται πλέον
  });

  it('per-vertex handle position = vertex world (anchor center, rotation 0)', () => {
    const c = makeComposite();
    expect(polyVertexHandlePosition(c.params, 0)).toEqual({ x: -200, y: -200 });
    expect(polyVertexHandlePosition(c.params, 1)).toEqual({ x: 200, y: -200 });
  });
});

describe('column-grips Phase 2b — applyColumnGripDrag', () => {
  it('column-leg-thickness patches ushape.legThickness (1× factor)', () => {
    const p = applyColumnGripDrag('column-leg-thickness', {
      originalParams: makeUparametric().params,
      delta: { x: 40, y: 0 },
    });
    const base = materializeUshape(makeUparametric().params);
    expect(p.ushape?.legThickness).toBeCloseTo(base.legThickness + 40, 3);
  });

  it('column-base-thickness patches ushape.baseThickness (1× factor)', () => {
    const p = applyColumnGripDrag('column-base-thickness', {
      originalParams: makeUparametric().params,
      delta: { x: 0, y: 30 },
    });
    const base = materializeUshape(makeUparametric().params);
    expect(p.ushape?.baseThickness).toBeCloseTo(base.baseThickness + 30, 3);
  });

  it('column-poly-vertex-0 inward move (δεν αλλάζει bbox) → position σταθερό, WYSIWYG', () => {
    // SQUARE: v3 κρατάει minX=-200 ακόμη κι αν το v0 πάει δεξιά → bbox center 0.
    const c = makeComposite();
    const moved = applyColumnGripDrag('column-poly-vertex-0', {
      originalParams: c.params,
      delta: { x: 50, y: 0 },
    });
    expect(polyVertexHandlePosition(moved, 0)).toEqual({ x: -150, y: -200 });
    expect(polyVertexHandlePosition(moved, 1)).toEqual({ x: 200, y: -200 });
    expect(moved.position.x).toBeCloseTo(0, 3);
    expect(moved.width).toBeCloseTo(400, 3);
  });

  it('column-poly-vertex-0 outward move (μεγαλώνει bbox) → re-center + position compensation', () => {
    // Move v0 αριστερά κατά 50 → minX=-250 → cx=-25 → polygon re-centered,
    // position μετατοπίζεται ώστε οι άλλες κορυφές να μένουν στη θέση τους.
    const c = makeComposite();
    const moved = applyColumnGripDrag('column-poly-vertex-0', {
      originalParams: c.params,
      delta: { x: -50, y: 0 },
    });
    // Vertex 0 ακολουθεί τον cursor· vertices 1/2/3 μένουν στη θέση τους.
    expect(polyVertexHandlePosition(moved, 0)).toEqual({ x: -250, y: -200 });
    expect(polyVertexHandlePosition(moved, 1)).toEqual({ x: 200, y: -200 });
    expect(polyVertexHandlePosition(moved, 3)).toEqual({ x: -200, y: 200 });
    expect(moved.position.x).toBeCloseTo(-25, 3);
    expect(moved.width).toBeCloseTo(450, 3);
    expect(moved.depth).toBeCloseTo(400, 3);
  });

  it('out-of-range vertex index → originalParams referentially', () => {
    const c = makeComposite();
    expect(applyColumnGripDrag('column-poly-vertex-99', {
      originalParams: c.params,
      delta: { x: 10, y: 10 },
    })).toBe(c.params);
  });

  it('zero delta → originalParams referentially', () => {
    const c = makeComposite();
    expect(applyColumnGripDrag('column-poly-vertex-0', {
      originalParams: c.params,
      delta: { x: 0, y: 0 },
    })).toBe(c.params);
  });
});
