/**
 * ADR-402 Phase B — bim3d-snap-bridge: pure snap-resolution helpers.
 *
 * Verifies the AutoCAD-style multi-grab move snap (nearest characteristic point
 * wins, anchor shifts so it lands on the target) and the resize handle snap, with
 * a fake engine — no real snap engine / scene dependency.
 */

import { makeMoveSnapFn, makeResizeSnapFn, type SnapQueryEngine } from '../bim3d-snap-bridge';
import type { Point2D } from '../../../rendering/types/Types';

/** Fake engine: snaps a probe to the nearest target within `tol`, gated by `enabled`. */
function fakeEngine(targets: Point2D[], opts: { enabled?: boolean; tol?: number } = {}): SnapQueryEngine {
  const enabled = opts.enabled ?? true;
  const tol = opts.tol ?? 500;
  return {
    getSettings: () => ({ enabled }),
    findSnapPoint: (cursor: Point2D) => {
      let best: { point: Point2D; d: number } | null = null;
      for (const t of targets) {
        const d = Math.hypot(cursor.x - t.x, cursor.y - t.y);
        if (d <= tol && (!best || d < best.d)) best = { point: t, d };
      }
      return best ? { found: true, snapPoint: { point: best.point } } : { found: false, snapPoint: null };
    },
  };
}

describe('makeMoveSnapFn — AutoCAD-style multi-grab', () => {
  it('shifts the anchor so a characteristic point lands exactly on the target', () => {
    const engine = fakeEngine([{ x: 1120, y: 0 }]);
    const snap = makeMoveSnapFn(engine, [{ x: 1000, y: 0 }] /* one corner, +1000 in x */);
    const res = snap({ x: 100, y: 0 }); // corner probe = 1100 → snaps to 1120
    expect(res).not.toBeNull();
    // anchor corrected so corner (anchor + offset) == target: 1120 - 1000 = 120
    expect(res?.snappedMm.x).toBeCloseTo(120, 6);
    expect(res?.snappedMm.y).toBeCloseTo(0, 6);
    expect(res?.markerMm.x).toBeCloseTo(1120, 6);
  });

  it('picks the NEAREST snapping characteristic point when several are in range', () => {
    // corner A probe (offset +1000) → target 1490 (d=10 from 1480? compute below)
    // corner B probe (offset 0)    → target 60   (d=60 from 0)
    const engine = fakeEngine([{ x: 1010, y: 0 }, { x: 60, y: 0 }]);
    const snap = makeMoveSnapFn(engine, [{ x: 1000, y: 0 }, { x: 0, y: 0 }]);
    // anchor at {x:0}: cornerA probe=1000 (→1010, d=10), cornerB probe=0 (→60, d=60). A wins.
    const res = snap({ x: 0, y: 0 });
    expect(res?.markerMm.x).toBeCloseTo(1010, 6); // target of corner A
    expect(res?.snappedMm.x).toBeCloseTo(10, 6); // 1010 - 1000 offset
  });

  it('returns null when OSNAP is disabled (respects the toggle)', () => {
    const engine = fakeEngine([{ x: 1120, y: 0 }], { enabled: false });
    const snap = makeMoveSnapFn(engine, [{ x: 1000, y: 0 }]);
    expect(snap({ x: 100, y: 0 })).toBeNull();
  });

  it('returns null when nothing is within tolerance', () => {
    const engine = fakeEngine([{ x: 9000, y: 9000 }], { tol: 50 });
    const snap = makeMoveSnapFn(engine, [{ x: 1000, y: 0 }]);
    expect(snap({ x: 0, y: 0 })).toBeNull();
  });

  it('falls back to snapping the anchor itself when no characteristic points exist', () => {
    const engine = fakeEngine([{ x: 80, y: 0 }]);
    const snap = makeMoveSnapFn(engine, [] /* unknown type → [{0,0}] */);
    const res = snap({ x: 100, y: 0 }); // anchor probe 100 → 80
    expect(res?.snappedMm.x).toBeCloseTo(80, 6);
    expect(res?.markerMm.x).toBeCloseTo(80, 6);
  });
});

describe('makeResizeSnapFn — dragged handle snaps directly', () => {
  it('snaps the handle to the nearest feature (snapped == marker)', () => {
    const engine = fakeEngine([{ x: 520, y: 0 }]);
    const snap = makeResizeSnapFn(engine);
    const res = snap({ x: 500, y: 0 });
    expect(res?.snappedMm.x).toBeCloseTo(520, 6);
    expect(res?.markerMm.x).toBeCloseTo(520, 6);
  });

  it('returns null when OSNAP is disabled', () => {
    const engine = fakeEngine([{ x: 520, y: 0 }], { enabled: false });
    expect(makeResizeSnapFn(engine)({ x: 500, y: 0 })).toBeNull();
  });
});
