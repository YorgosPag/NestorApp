/**
 * ADR-398 §3.15 / ADR-508 §rotated-column / §column-hud — RectFrame SSoT: κατασκευή από κορυφές,
 * local↔world roundtrip, dir rotation, και το `isRectFootprint` classifier (rect vs κύκλος/Γ/Τ/Π).
 */

import {
  rectFrameFromCorners,
  rectLocalToWorld,
  rectWorldToLocal,
  rectDirToWorld,
  isRectFootprint,
} from '../rect-frame';
import type { Point2D } from '../../../rendering/types/Types';

/** Τετράγωνο πλευράς `s` κεντραρισμένο στο (cx,cy), περιστραμμένο `deg` (CCW) → 4 κορυφές. */
const rotSquare = (s: number, cx: number, cy: number, deg: number): Point2D[] => {
  const h = s / 2;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const sn = Math.sin(r);
  return [
    { x: -h, y: -h }, { x: h, y: -h }, { x: h, y: h }, { x: -h, y: h },
  ].map((p) => ({ x: cx + p.x * c - p.y * sn, y: cy + p.x * sn + p.y * c }));
};

describe('rectFrameFromCorners + transforms', () => {
  it('axis-aligned τετράγωνο → u=(1,0), v=(0,1), σωστό κέντρο/ημι-εκτάσεις', () => {
    const r = rectFrameFromCorners([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 200 }, { x: 0, y: 200 }]);
    expect(r).not.toBeNull();
    expect(r!.center).toEqual({ x: 200, y: 100 });
    expect(r!.u.x).toBeCloseTo(1);
    expect(r!.v.y).toBeCloseTo(1);
    expect(r!.halfW).toBeCloseTo(200);
    expect(r!.halfV).toBeCloseTo(100);
  });

  it('rectWorldToLocal ∘ rectLocalToWorld = identity (roundtrip σε λοξό)', () => {
    const r = rectFrameFromCorners(rotSquare(200, 50, -30, 37))!;
    const local = { x: 42, y: -17 };
    const world = rectLocalToWorld(r, local.x, local.y);
    const back = rectWorldToLocal(r, world);
    expect(back.x).toBeCloseTo(local.x);
    expect(back.y).toBeCloseTo(local.y);
  });

  it('rectDirToWorld περιστρέφει κατεύθυνση κατά το πλαίσιο (45°)', () => {
    const r = rectFrameFromCorners(rotSquare(200, 0, 0, 45))!;
    const d = rectDirToWorld(r, { x: 1, y: 0 }); // τοπικό +u → world 45°
    expect(d.x).toBeCloseTo(Math.SQRT1_2);
    expect(d.y).toBeCloseTo(Math.SQRT1_2);
  });
});

describe('isRectFootprint — classifier', () => {
  it('axis-aligned ορθογώνιο (4 κορυφές) → true', () => {
    expect(isRectFootprint([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 200 }, { x: 0, y: 200 }])).toBe(true);
  });

  it('λοξό ορθογώνιο (30°) → true', () => {
    expect(isRectFootprint(rotSquare(300, 10, 20, 30))).toBe(true);
  });

  it('κλειστό 5-κορυφών ορθογώνιο (dup τελευταία) → true', () => {
    expect(isRectFootprint([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 200 }, { x: 0, y: 200 }, { x: 0, y: 0 }])).toBe(true);
  });

  it('μη-ορθογώνιο τετράπλευρο (τραπέζιο, όχι ορθές γωνίες) → false', () => {
    expect(isRectFootprint([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }])).toBe(false);
  });

  it('Γ-σχήμα (6 κορυφές) → false', () => {
    expect(isRectFootprint([
      { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 150 }, { x: 150, y: 150 }, { x: 150, y: 400 }, { x: 0, y: 400 },
    ])).toBe(false);
  });

  it('κύκλος (tessellated, πολλές κορυφές) → false', () => {
    const circle: Point2D[] = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * 2 * Math.PI;
      return { x: 200 * Math.cos(a), y: 200 * Math.sin(a) };
    });
    expect(isRectFootprint(circle)).toBe(false);
  });
});
