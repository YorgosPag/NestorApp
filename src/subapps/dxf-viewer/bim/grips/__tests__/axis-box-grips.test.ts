/**
 * ADR-363 / ADR-436 — axis-box-grips SSoT tests (shared by wall / beam / foundation strip).
 *
 * Verifies the axis ⇄ RectFrame mapping + 7-grip emission + opposite-element-fixed
 * resize + anchor-relative rotation, for the axis-anchored consumer of the shared
 * rect-grip-engine. Geometry uses a horizontal axis (rotationDeg 0) so expected
 * world positions are read directly.
 */

import {
  getAxisBoxGrips,
  applyAxisBoxGripDrag,
  axisToRectFrame,
  rectFrameToAxis,
  type AxisBoxParams,
} from '../axis-box-grips';

const MIN_W = 10; // mm — below the 20mm fixture width so resizes are not pre-clamped

/** Horizontal axis (0,0)→(100,0), width 20mm, sceneUnits mm (scale 1). */
function horizontalBox(): AxisBoxParams {
  return { start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, width: 20, sceneUnits: 'mm' };
}

describe('axisToRectFrame', () => {
  it('maps axis → centre-axis RectFrame (centre, bearing, half-extents)', () => {
    const f = axisToRectFrame(horizontalBox());
    expect(f.center).toEqual({ x: 50, y: 0 });
    expect(f.rotationDeg).toBeCloseTo(0);
    expect(f.halfWidth).toBeCloseTo(50); // ½ axis length (local +X)
    expect(f.halfLength).toBeCloseTo(10); // width/2 scene (local +Y)
  });

  it('rectFrameToAxis is the inverse of axisToRectFrame', () => {
    const p = horizontalBox();
    const back = rectFrameToAxis(axisToRectFrame(p), p.sceneUnits);
    expect(back.start).toEqual({ x: 0, y: 0 });
    expect(back.end).toEqual({ x: 100, y: 0 });
    expect(back.width).toBeCloseTo(20);
  });

  it('scales the perpendicular half-extent by scene units (metre scene)', () => {
    const f = axisToRectFrame({ start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, width: 2000, sceneUnits: 'm' });
    expect(f.halfLength).toBeCloseTo(1); // 2000mm * 0.001 / 2
  });
});

describe('getAxisBoxGrips', () => {
  it('emits exactly 7 grips: width edge, length edge, 4 corners, rotation', () => {
    const grips = getAxisBoxGrips(horizontalBox());
    expect(grips).toHaveLength(7);
    expect(grips.map((g) => g.role)).toEqual([
      'width-edge',
      'length-edge',
      'corner-start-pos',
      'corner-start-neg',
      'corner-end-pos',
      'corner-end-neg',
      'rotation',
    ]);
  });

  it('places handles at the expected footprint positions', () => {
    const byRole = Object.fromEntries(getAxisBoxGrips(horizontalBox()).map((g) => [g.role, g.position]));
    expect(byRole['width-edge']).toEqual({ x: 50, y: 10 }); // +perp face midpoint
    expect(byRole['length-edge']).toEqual({ x: 100, y: 0 }); // end short edge
    expect(byRole['corner-start-pos']).toEqual({ x: 0, y: 10 });
    expect(byRole['corner-start-neg']).toEqual({ x: 0, y: -10 });
    expect(byRole['corner-end-pos']).toEqual({ x: 100, y: 10 });
    expect(byRole['corner-end-neg']).toEqual({ x: 100, y: -10 });
    // rotation handle sits ON the OPPOSITE (−perp) face — clean separation from
    // width-edge. halfLength 10 + ROTATION_HANDLE_OFFSET_MM 0 → −perp → (50, −10).
    expect(byRole['rotation']).toEqual({ x: 50, y: -10 });
  });

  it('honours widthFaceSign (-1 = −perp face) for the single-handle grips', () => {
    const byRole = Object.fromEntries(
      getAxisBoxGrips({ ...horizontalBox(), widthFaceSign: -1 }).map((g) => [g.role, g.position]),
    );
    expect(byRole['width-edge']).toEqual({ x: 50, y: -10 });
    expect(byRole['rotation']).toEqual({ x: 50, y: 10 }); // sits ON the opposite (+perp) face
  });

  it('returns no grips on a degenerate (zero-length) axis', () => {
    expect(getAxisBoxGrips({ start: { x: 5, y: 5 }, end: { x: 5, y: 5 }, width: 20 })).toEqual([]);
  });

  it('emits 9 grips with extraMidEdges (the 2 OPPOSITE mid-edges, appended last)', () => {
    const grips = getAxisBoxGrips(horizontalBox(), { extraMidEdges: true });
    expect(grips).toHaveLength(9);
    expect(grips.slice(7).map((g) => g.role)).toEqual(['width-edge-far', 'length-edge-start']);
    const byRole = Object.fromEntries(grips.map((g) => [g.role, g.position]));
    expect(byRole['width-edge-far']).toEqual({ x: 50, y: -10 }); // −perp face midpoint (opposite of width-edge)
    expect(byRole['length-edge-start']).toEqual({ x: 0, y: 0 }); // START short edge (opposite of length-edge)
  });

  it('extra width-edge-far honours widthFaceSign (flip → opposite face flips too)', () => {
    const byRole = Object.fromEntries(
      getAxisBoxGrips({ ...horizontalBox(), widthFaceSign: -1 }, { extraMidEdges: true }).map((g) => [g.role, g.position]),
    );
    expect(byRole['width-edge']).toEqual({ x: 50, y: -10 }); // flipped to −perp
    expect(byRole['width-edge-far']).toEqual({ x: 50, y: 10 }); // far face is now +perp
  });

  // ADR-363 (Giorgio 2026-06-30) — wall rotation handle on the centreline at ¼ axis
  // length toward the EAST end (no longer overlapping the long-side edge midpoint).
  describe("rotationPlacement: 'axis-quarter'", () => {
    const rotationOf = (p: AxisBoxParams) =>
      getAxisBoxGrips(p, { rotationPlacement: 'axis-quarter' }).find((g) => g.role === 'rotation')!.position;

    it('places rotation on the centreline at ¼-length toward the east end (E→W axis)', () => {
      // centre (50,0), halfWidth 50 → +X end is east (x=100); ¼ length = +25 → (75,0).
      expect(rotationOf(horizontalBox())).toEqual({ x: 75, y: 0 });
    });

    it('still resolves to the east end when the axis is drawn west→east reversed', () => {
      // (100,0)→(0,0): −X end is east → axial sign flips, lands at the SAME world point.
      const pos = rotationOf({ start: { x: 100, y: 0 }, end: { x: 0, y: 0 }, width: 20, sceneUnits: 'mm' });
      expect(pos.x).toBeCloseTo(75);
      expect(pos.y).toBeCloseTo(0);
    });

    it('tie-breaks toward north for a vertical axis (no east/west bias)', () => {
      // (0,0)→(0,100): centre (0,50), ¼ length toward north → (0,75), on the centreline.
      const pos = rotationOf({ start: { x: 0, y: 0 }, end: { x: 0, y: 100 }, width: 20, sceneUnits: 'mm' });
      expect(pos.x).toBeCloseTo(0);
      expect(pos.y).toBeCloseTo(75);
    });

    it('keeps the standard 9-grip layout when combined with extraMidEdges (wall call site)', () => {
      const grips = getAxisBoxGrips(horizontalBox(), { extraMidEdges: true, rotationPlacement: 'axis-quarter' });
      expect(grips).toHaveLength(9);
      expect(grips.find((g) => g.role === 'rotation')!.position).toEqual({ x: 75, y: 0 });
    });
  });
});

describe('applyAxisBoxGripDrag', () => {
  const baseInput = { delta: { x: 0, y: 0 }, minWidthMm: MIN_W };

  it('no-ops on zero delta', () => {
    expect(applyAxisBoxGripDrag('width-edge', { originalParams: horizontalBox(), ...baseInput })).toBeNull();
  });

  it('width-edge grows width perpendicular, opposite face fixed', () => {
    const patch = applyAxisBoxGripDrag('width-edge', {
      originalParams: horizontalBox(),
      delta: { x: 0, y: 5 },
      minWidthMm: MIN_W,
    });
    expect(patch).not.toBeNull();
    // +perp face moves +5, −perp face holds → width 20→25, centre +2.5.
    expect(patch!.width).toBeCloseTo(25);
    expect(patch!.start.y).toBeCloseTo(2.5);
    expect(patch!.end.y).toBeCloseTo(2.5);
  });

  it('length-edge moves the END short edge along the axis, start fixed', () => {
    const patch = applyAxisBoxGripDrag('length-edge', {
      originalParams: horizontalBox(),
      delta: { x: 40, y: 0 },
      minWidthMm: MIN_W,
    });
    expect(patch).not.toBeNull();
    expect(patch!.start).toEqual({ x: 0, y: 0 }); // start held
    expect(patch!.end.x).toBeCloseTo(140); // end +40
    expect(patch!.width).toBeCloseTo(20); // perp untouched
  });

  it('corner-end-pos resizes both length (end) and width (+perp), opposite corner fixed', () => {
    const patch = applyAxisBoxGripDrag('corner-end-pos', {
      originalParams: horizontalBox(),
      delta: { x: 20, y: 6 },
      minWidthMm: MIN_W,
    });
    expect(patch).not.toBeNull();
    // axial +20 grows length on the end side; perp +6 grows +perp face → width +6.
    expect(patch!.end.x).toBeCloseTo(120);
    expect(patch!.width).toBeCloseTo(26);
  });

  it('width clamps to minWidthMm', () => {
    const patch = applyAxisBoxGripDrag('width-edge', {
      originalParams: horizontalBox(),
      delta: { x: 0, y: -100 }, // collapse the +perp face inward past min
      minWidthMm: MIN_W,
    });
    expect(patch!.width).toBeGreaterThanOrEqual(MIN_W - 1e-6);
  });

  it('rotation rotates both endpoints about the midpoint (anchor-relative)', () => {
    // Anchor-relative swept angle: grab at (50,10) and drag so the swept angle about
    // the midpoint (50,0) is +90°. anchor = currentPos − delta = grab point (50,10).
    const anchor = { x: 50, y: 10 };
    const currentPos = { x: 40, y: 0 }; // pivot(50,0) → 90° CCW from anchor
    const patch = applyAxisBoxGripDrag('rotation', {
      originalParams: horizontalBox(),
      delta: { x: currentPos.x - anchor.x, y: currentPos.y - anchor.y },
      minWidthMm: MIN_W,
      currentPos,
    });
    expect(patch).not.toBeNull();
    // 90° CCW about (50,0): start (0,0)→(50,-50), end (100,0)→(50,50).
    expect(patch!.start.x).toBeCloseTo(50);
    expect(patch!.start.y).toBeCloseTo(-50);
    expect(patch!.end.x).toBeCloseTo(50);
    expect(patch!.end.y).toBeCloseTo(50);
    expect(patch!.width).toBeCloseTo(20);
  });

  it('width-edge-far grows width on the −perp face, +perp face fixed', () => {
    const patch = applyAxisBoxGripDrag('width-edge-far', {
      originalParams: horizontalBox(),
      delta: { x: 0, y: -5 },
      minWidthMm: MIN_W,
    });
    expect(patch).not.toBeNull();
    // −perp face moves −5, +perp face holds → width 20→25, centre −2.5.
    expect(patch!.width).toBeCloseTo(25);
    expect(patch!.start.y).toBeCloseTo(-2.5);
    expect(patch!.end.y).toBeCloseTo(-2.5);
  });

  it('length-edge-start moves the START short edge, END fixed', () => {
    const patch = applyAxisBoxGripDrag('length-edge-start', {
      originalParams: horizontalBox(),
      delta: { x: -40, y: 0 },
      minWidthMm: MIN_W,
    });
    expect(patch).not.toBeNull();
    expect(patch!.start.x).toBeCloseTo(-40); // start −40
    expect(patch!.end).toEqual({ x: 100, y: 0 }); // end held
    expect(patch!.width).toBeCloseTo(20);
  });

  it('rotation no-ops without currentPos', () => {
    expect(
      applyAxisBoxGripDrag('rotation', {
        originalParams: horizontalBox(),
        delta: { x: 5, y: 5 },
        minWidthMm: MIN_W,
      }),
    ).toBeNull();
  });
});
