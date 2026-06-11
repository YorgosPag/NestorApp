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
    // rotation handle mirrors the wall — coincident with the +perp edge midpoint.
    expect(byRole['rotation']).toEqual({ x: 50, y: 10 });
  });

  it('honours widthFaceSign (-1 = −perp face) for the single-handle grips', () => {
    const byRole = Object.fromEntries(
      getAxisBoxGrips({ ...horizontalBox(), widthFaceSign: -1 }).map((g) => [g.role, g.position]),
    );
    expect(byRole['width-edge']).toEqual({ x: 50, y: -10 });
    expect(byRole['rotation']).toEqual({ x: 50, y: -10 });
  });

  it('returns no grips on a degenerate (zero-length) axis', () => {
    expect(getAxisBoxGrips({ start: { x: 5, y: 5 }, end: { x: 5, y: 5 }, width: 20 })).toEqual([]);
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
    // Grab the +perp handle at (50,10); drag so the swept angle about the midpoint
    // (50,0) is +90°. anchor = currentPos − delta = handle position (50,10).
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
