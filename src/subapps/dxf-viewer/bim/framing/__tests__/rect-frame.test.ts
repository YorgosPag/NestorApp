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
  orientedRectFrame,
  footprintEdges,
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

/** Γ-σχήμα CCW (ίδιο vertex order με το buildLshapeLocal): width=600, depth=600, arm=200. */
const L_CCW: Point2D[] = [
  { x: -300, y: -300 }, { x: 300, y: -300 }, { x: 300, y: -100 },
  { x: -100, y: -100 }, { x: -100, y: 300 }, { x: -300, y: 300 },
];

describe('orientedRectFrame — oriented bbox οποιουδήποτε footprint', () => {
  it('Γ-σχήμα @0° → κέντρο (0,0), ημι-εκτάσεις 300×300, u=(1,0)/v=(0,1)', () => {
    const f = orientedRectFrame(L_CCW, 0)!;
    expect(f).not.toBeNull();
    expect(f.center.x).toBeCloseTo(0);
    expect(f.center.y).toBeCloseTo(0);
    expect(f.halfW).toBeCloseTo(300);
    expect(f.halfV).toBeCloseTo(300);
    expect(f.u.x).toBeCloseTo(1);
    expect(f.v.y).toBeCloseTo(1);
  });

  it('λοξό τετράγωνο @30° → tight oriented bbox (ημι = s/2, όχι διεσταλμένο axis-aligned)', () => {
    const f = orientedRectFrame(rotSquare(200, 5, -7, 30), 30)!;
    expect(f.halfW).toBeCloseTo(100);
    expect(f.halfV).toBeCloseTo(100);
    expect(f.center.x).toBeCloseTo(5);
    expect(f.center.y).toBeCloseTo(-7);
  });

  it('εκφυλισμένο (<3 κορυφές) → null', () => {
    expect(orientedRectFrame([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0)).toBeNull();
  });
});

describe('footprintEdges — per-edge outward normals (winding-aware)', () => {
  it('Γ-σχήμα CCW → 6 ακμές, σωστά μήκη + εξωτερικά κάθετα', () => {
    const edges = footprintEdges(L_CCW);
    expect(edges.map((e) => Math.round(e.lengthScene))).toEqual([600, 200, 400, 400, 200, 600]);
    // κάτω ακμή (v0→v1) → κάθετο προς −y (έξω = κάτω)
    expect(edges[0].nx).toBeCloseTo(0);
    expect(edges[0].ny).toBeCloseTo(-1);
    // αριστερή ακμή (v5→v0) → κάθετο προς −x
    expect(edges[5].nx).toBeCloseTo(-1);
    expect(edges[5].ny).toBeCloseTo(0);
  });

  it('αντεστραμμένο winding (CW) → ΙΔΙΑ εξωτερικά κάθετα (κάτω ακμή πάντα −y)', () => {
    const cw = [...L_CCW].reverse();
    const edges = footprintEdges(cw);
    const bottom = edges.find((e) => Math.abs(e.p1.y + 300) < 1e-6 && Math.abs(e.p2.y + 300) < 1e-6)!;
    expect(bottom.ny).toBeCloseTo(-1); // εξωτερικό κάτω, ανεξάρτητα winding
  });

  it('εκφυλισμένο (<3) → []', () => {
    expect(footprintEdges([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toEqual([]);
  });
});
