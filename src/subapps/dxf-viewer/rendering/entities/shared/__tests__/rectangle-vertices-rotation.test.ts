/**
 * Unit tests — createRectangleVertices rotation-aware (ADR rotated-rectangle):
 * identity fast-path, περιστροφή γύρω από corner1, και round-trip με τον διορθωμένο
 * `rotateRectangleLike` (ROTATE tool) ώστε το ΓΡΑΦΟΜΕΝΟ σχήμα να ταιριάζει με πλήρη
 * περιστροφή των αρχικών κορυφών (κλείνει το double-rotation bug).
 */

import { createRectangleVertices } from '../geometry-utils';
import { rotatePoint } from '../geometry-vector-utils';
import { degToRad } from '../geometry-angle-utils';
import { rotateEntity } from '../../../../utils/rotation-math';
import type { Entity, RectangleEntity } from '../../../../types/entities';

const C1 = { x: 0, y: 0 };
const C2 = { x: 10, y: 5 };

describe('createRectangleVertices (rotation-aware)', () => {
  it('rotation = 0 → axis-aligned CCW κορυφές (identity fast-path)', () => {
    expect(createRectangleVertices(C1, C2)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ]);
  });

  it('rotation absent === rotation 0 (μηδέν regression)', () => {
    expect(createRectangleVertices(C1, C2, 0)).toEqual(createRectangleVertices(C1, C2));
  });

  it('rotation = 90 περιστρέφει γύρω από corner1 (corner1 σταθερό)', () => {
    const v = createRectangleVertices(C1, C2, 90);
    expect(v[0].x).toBeCloseTo(0); // corner1 = pivot, μένει
    expect(v[0].y).toBeCloseTo(0);
    // (10,0) γύρω από (0,0) κατά 90° → (0,10)
    expect(v[1].x).toBeCloseTo(0);
    expect(v[1].y).toBeCloseTo(10);
    // (10,5) → (-5,10)
    expect(v[2].x).toBeCloseTo(-5);
    expect(v[2].y).toBeCloseTo(10);
  });
});

describe('round-trip με rotateRectangleLike (ROTATE tool)', () => {
  it('το ΓΡΑΦΟΜΕΝΟ rotated-rect ταιριάζει με πλήρη περιστροφή των αρχικών κορυφών περί pivot', () => {
    const original = createRectangleVertices(C1, C2); // axis-aligned
    const pivot = { x: 5, y: 5 };
    const deg = 30;

    const rect: RectangleEntity = {
      id: 'r', type: 'rectangle', visible: true, layerId: 'l',
      x: 0, y: 0, width: 10, height: 5, rotation: 0, corner1: C1, corner2: C2,
    };
    const upd = rotateEntity(rect as Entity, pivot, deg) as {
      corner1: { x: number; y: number }; corner2: { x: number; y: number }; rotation: number;
    };

    const rendered = createRectangleVertices(upd.corner1, upd.corner2, upd.rotation);
    const expected = original.map((p) => rotatePoint(p, pivot, degToRad(deg)));

    rendered.forEach((v, i) => {
      expect(v.x).toBeCloseTo(expected[i].x);
      expect(v.y).toBeCloseTo(expected[i].y);
    });
    expect(upd.rotation).toBeCloseTo(30);
  });
});
