/**
 * ADR-402 — BimGizmoDragBridge: gizmo drag → DXF command inputs. Pure, no mocks.
 *
 * Verifies the world→DXF sign/scale mapping for move (axis/plane) and the
 * pivot+angle extraction for rotate-Y, with no React / scene dependency.
 */

import * as THREE from 'three';
import { BimGizmoDragBridge } from '../bim-gizmo-drag-bridge';

const down = new THREE.Vector3(0, -1, 0);
const camDir = new THREE.Vector3(0, -1, 0);
const anchor = new THREE.Vector3(0, 0, 0);

function vertRay(x: number, z: number): { o: THREE.Vector3; d: THREE.Vector3 } {
  return { o: new THREE.Vector3(x, 10, z), d: down };
}

describe('BimGizmoDragBridge — move', () => {
  it('plane-xz drag maps world (Δx, Δz) to DXF (Δx·1000, -Δz·1000)', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(1, 2);
    expect(b.start({ kind: 'plane', plane: 'xz' }, anchor, s.o, s.d, camDir)).toBe(true);
    const u = vertRay(4, 6); // world delta (+3, _, +4)
    b.update(u.o, u.d, camDir);
    const out = b.getOutcome();
    expect(out.kind).toBe('move');
    if (out.kind !== 'move') return;
    expect(out.deltaDxf.x).toBeCloseTo(3000, 3);
    expect(out.deltaDxf.y).toBeCloseTo(-4000, 3);
  });

  it('axis-x drag only moves DXF x (north component stays 0)', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(0, 0);
    b.start({ kind: 'axis', axis: 'x' }, anchor, s.o, s.d, camDir);
    const u = vertRay(5, 9); // only the X component projects onto the X axis
    b.update(u.o, u.d, camDir);
    const out = b.getOutcome();
    if (out.kind !== 'move') throw new Error('expected move');
    expect(out.deltaDxf.x).toBeCloseTo(5000, 3);
    expect(out.deltaDxf.y).toBeCloseTo(0, 3);
  });

  it('returns none when the drag did not move', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(2, 2);
    b.start({ kind: 'plane', plane: 'xz' }, anchor, s.o, s.d, camDir);
    b.update(s.o, s.d, camDir);
    expect(b.getOutcome().kind).toBe('none');
  });

  it('axis-Y drag → move outcome carries deltaUpMm (vertical elevation move; deltaDxf 0)', () => {
    // Horizontal camera so axis-Y projects onto the vertical line (not top-down).
    const camHoriz = new THREE.Vector3(0, 0, -1);
    const dir = new THREE.Vector3(-1, 0, 0); // ray perpendicular to the Y axis
    const b = new BimGizmoDragBridge();
    expect(
      b.start({ kind: 'axis', axis: 'y' }, anchor, new THREE.Vector3(10, 0, 0), dir, camHoriz),
    ).toBe(true);
    b.update(new THREE.Vector3(10, 5, 0), dir, camHoriz); // +5m world-up
    const out = b.getOutcome();
    // A purely vertical move has deltaDxf (0,0); the guard must NOT classify it none.
    expect(out.kind).toBe('move');
    if (out.kind !== 'move') return;
    expect(out.deltaUpMm).toBeCloseTo(5000, 3);
    expect(out.deltaDxf.x).toBeCloseTo(0, 3);
    expect(out.deltaDxf.y).toBeCloseTo(0, 3);
  });

  it('a horizontal move carries deltaUpMm 0', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(0, 0);
    b.start({ kind: 'plane', plane: 'xz' }, anchor, s.o, s.d, camDir);
    const u = vertRay(4, 6);
    b.update(u.o, u.d, camDir);
    const out = b.getOutcome();
    if (out.kind !== 'move') throw new Error('expected move');
    expect(out.deltaUpMm).toBeCloseTo(0, 3);
  });
});

describe('BimGizmoDragBridge — resize (ADR-402 Phase B)', () => {
  it('resize-x slides along world X → resize outcome with DXF-mm delta + cursor', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(0, 0);
    expect(b.start({ kind: 'resize', axis: 'x', mode: 'normal' }, anchor, s.o, s.d, camDir)).toBe(true);
    const u = vertRay(5, 9); // only the X component projects onto the X axis
    b.update(u.o, u.d, camDir);
    const out = b.getOutcome();
    expect(out.kind).toBe('resize');
    if (out.kind !== 'resize') return;
    expect(out.axis).toBe('x');
    expect(out.mode).toBe('normal');
    expect(out.deltaMm.x).toBeCloseTo(5000, 3);
    expect(out.deltaMm.y).toBeCloseTo(0, 3);
    expect(out.cursorMm.x).toBeCloseTo(5000, 3);
    expect(out.cursorMm.y).toBeCloseTo(0, 3);
  });

  it('resize-z slides along world Z → DXF y = -Δz·1000', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(0, 0);
    b.start({ kind: 'resize', axis: 'z', mode: 'normal' }, anchor, s.o, s.d, camDir);
    const u = vertRay(7, 4); // only the Z component projects onto the Z axis
    b.update(u.o, u.d, camDir);
    const out = b.getOutcome();
    if (out.kind !== 'resize') throw new Error('expected resize');
    expect(out.axis).toBe('z');
    expect(out.deltaMm.x).toBeCloseTo(0, 3);
    expect(out.deltaMm.y).toBeCloseTo(-4000, 3);
  });

  it('returns none when the resize drag did not move', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(2, 2);
    b.start({ kind: 'resize', axis: 'x', mode: 'normal' }, anchor, s.o, s.d, camDir);
    b.update(s.o, s.d, camDir);
    expect(b.getOutcome().kind).toBe('none');
  });

  it('resize-y slides along world Y → resize outcome carries deltaUpMm (deltaMm 0)', () => {
    // Horizontal camera so axis-Y projects onto the vertical line (not top-down).
    const camHoriz = new THREE.Vector3(0, 0, -1);
    const dir = new THREE.Vector3(-1, 0, 0); // ray perpendicular to the Y axis
    const b = new BimGizmoDragBridge();
    expect(
      b.start({ kind: 'resize', axis: 'y', mode: 'normal' }, anchor, new THREE.Vector3(10, 0, 0), dir, camHoriz),
    ).toBe(true);
    b.update(new THREE.Vector3(10, 5, 0), dir, camHoriz); // +5m world-up
    const out = b.getOutcome();
    // A purely vertical resize has deltaMm (0,0); the guard must NOT classify it none.
    expect(out.kind).toBe('resize');
    if (out.kind !== 'resize') return;
    expect(out.axis).toBe('y');
    expect(out.deltaUpMm).toBeCloseTo(5000, 3);
    expect(out.deltaMm.x).toBeCloseTo(0, 3);
    expect(out.deltaMm.y).toBeCloseTo(0, 3);
  });
});

describe('BimGizmoDragBridge — snap injection (ADR-402 Phase B)', () => {
  it('snaps the move outcome + exposes the snap marker world point', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(0, 0);
    b.start({ kind: 'plane', plane: 'xz' }, anchor, s.o, s.d, camDir);
    // Free end would be DXF (4000, -6000); snap forces (5000, -7000).
    b.setSnapFn(() => ({ snappedMm: { x: 5000, y: -7000 }, markerMm: { x: 5000, y: -7000 } }));
    const u = vertRay(4, 6);
    b.update(u.o, u.d, camDir);
    const out = b.getOutcome();
    if (out.kind !== 'move') throw new Error('expected move');
    expect(out.deltaDxf.x).toBeCloseTo(5000, 3);
    expect(out.deltaDxf.y).toBeCloseTo(-7000, 3);
    const m = b.getActiveSnapWorld();
    expect(m).not.toBeNull();
    expect(m?.x).toBeCloseTo(5, 6); // 5000mm → 5m
    expect(m?.y).toBeCloseTo(0, 6); // elevation preserved
    expect(m?.z).toBeCloseTo(7, 6); // DXF y -7000 → world z +7
  });

  it('keeps the free drag (no marker) when the snap callback returns null', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(0, 0);
    b.start({ kind: 'plane', plane: 'xz' }, anchor, s.o, s.d, camDir);
    b.setSnapFn(() => null); // OSNAP off / nothing in range
    const u = vertRay(4, 6);
    b.update(u.o, u.d, camDir);
    const out = b.getOutcome();
    if (out.kind !== 'move') throw new Error('expected move');
    expect(out.deltaDxf.x).toBeCloseTo(4000, 3);
    expect(out.deltaDxf.y).toBeCloseTo(-6000, 3);
    expect(b.getActiveSnapWorld()).toBeNull();
  });

  it('snaps a horizontal resize handle (deltaMm + cursorMm follow the snap)', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(0, 0);
    b.start({ kind: 'resize', axis: 'x', mode: 'normal' }, anchor, s.o, s.d, camDir);
    b.setSnapFn(() => ({ snappedMm: { x: 5200, y: 0 }, markerMm: { x: 5200, y: 0 } }));
    const u = vertRay(5, 9); // free X end = 5000mm
    b.update(u.o, u.d, camDir);
    const out = b.getOutcome();
    if (out.kind !== 'resize') throw new Error('expected resize');
    expect(out.deltaMm.x).toBeCloseTo(5200, 3);
    expect(out.cursorMm.x).toBeCloseTo(5200, 3);
    expect(b.getActiveSnapWorld()).not.toBeNull();
  });

  it('does NOT snap a vertical (axis-Y) resize — dimension edit stays free', () => {
    const camHoriz = new THREE.Vector3(0, 0, -1);
    const dir = new THREE.Vector3(-1, 0, 0);
    const b = new BimGizmoDragBridge();
    b.start({ kind: 'resize', axis: 'y', mode: 'normal' }, anchor, new THREE.Vector3(10, 0, 0), dir, camHoriz);
    b.setSnapFn(() => ({ snappedMm: { x: 9999, y: 9999 }, markerMm: { x: 9999, y: 9999 } }));
    b.update(new THREE.Vector3(10, 5, 0), dir, camHoriz); // +5m world-up
    const out = b.getOutcome();
    if (out.kind !== 'resize') throw new Error('expected resize');
    expect(out.deltaUpMm).toBeCloseTo(5000, 3); // unaffected by the (skipped) snap
    expect(b.getActiveSnapWorld()).toBeNull();
  });
});

describe('BimGizmoDragBridge — rotate-Y', () => {
  it('extracts pivot (anchor in DXF plan) and a signed angle about world Y', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(1, 0); // start vector (1,0,0)
    expect(b.start({ kind: 'rotate', axis: 'y' }, anchor, s.o, s.d, camDir)).toBe(true);
    const u = vertRay(0, 1); // current vector (0,0,1) → -90° about +Y
    b.update(u.o, u.d, camDir);
    const out = b.getOutcome();
    expect(out.kind).toBe('rotate');
    if (out.kind !== 'rotate') return;
    expect(out.pivotDxf.x).toBeCloseTo(0, 6);
    expect(out.pivotDxf.y).toBeCloseTo(0, 6);
    expect(out.angleDeg).toBeCloseTo(-90, 3);
  });

  it('getLiveRotationRad tracks the in-progress rotate angle (live preview, ADR-402)', () => {
    const b = new BimGizmoDragBridge();
    expect(b.getLiveRotationRad()).toBe(0);
    const s = vertRay(1, 0); // start vector (1,0,0)
    b.start({ kind: 'rotate', axis: 'y' }, anchor, s.o, s.d, camDir);
    const u = vertRay(0, 1); // current vector (0,0,1) → -90° (-π/2) about +Y
    b.update(u.o, u.d, camDir);
    expect(b.getLiveRotationRad()).toBeCloseTo(-Math.PI / 2, 6);
    expect(THREE.MathUtils.radToDeg(b.getLiveRotationRad())).toBeCloseTo(-90, 3);
  });

  it('a move drag carries no live rotation (getLiveRotationRad stays 0)', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(0, 0);
    b.start({ kind: 'plane', plane: 'xz' }, anchor, s.o, s.d, camDir);
    b.update(vertRay(4, 6).o, s.d, camDir);
    expect(b.getLiveRotationRad()).toBe(0);
  });
});

describe('BimGizmoDragBridge — tilt (X/Z rotate rings, ADR-404 Phase 2)', () => {
  // Ray that hits the plane (normal X, through origin) at (0, y, z): travels along -X.
  function rayInYZ(y: number, z: number): { o: THREE.Vector3; d: THREE.Vector3 } {
    return { o: new THREE.Vector3(5, y, z), d: new THREE.Vector3(-1, 0, 0) };
  }
  // Ray that hits the plane (normal Z, through origin) at (x, y, 0): travels along -Z.
  function rayInXY(x: number, y: number): { o: THREE.Vector3; d: THREE.Vector3 } {
    return { o: new THREE.Vector3(x, y, 5), d: new THREE.Vector3(0, 0, -1) };
  }
  const camHoriz = new THREE.Vector3(0, 0, -1);

  it('rotate-x ring → tilt outcome (axis x), signed angle about +X', () => {
    const b = new BimGizmoDragBridge();
    const s = rayInYZ(1, 0); // start vector +Y
    expect(b.start({ kind: 'rotate', axis: 'x' }, anchor, s.o, s.d, camHoriz)).toBe(true);
    const u = rayInYZ(0, 1); // current vector +Z → +90° about +X
    b.update(u.o, u.d, camHoriz);
    const out = b.getOutcome();
    expect(out.kind).toBe('tilt');
    if (out.kind !== 'tilt') return;
    expect(out.axis).toBe('x');
    expect(out.angleDeg).toBeCloseTo(90, 3);
  });

  it('rotate-z ring → tilt outcome (axis z)', () => {
    const b = new BimGizmoDragBridge();
    const s = rayInXY(1, 0); // start vector +X
    b.start({ kind: 'rotate', axis: 'z' }, anchor, s.o, s.d, camHoriz);
    const u = rayInXY(0, 1); // current vector +Y → +90° about +Z
    b.update(u.o, u.d, camHoriz);
    const out = b.getOutcome();
    if (out.kind !== 'tilt') throw new Error('expected tilt');
    expect(out.axis).toBe('z');
    expect(out.angleDeg).toBeCloseTo(90, 3);
  });

  it('getLiveTiltDeg tracks the in-progress (snapped) tilt angle', () => {
    const b = new BimGizmoDragBridge();
    expect(b.getLiveTiltDeg()).toBe(0);
    const s = rayInYZ(1, 0);
    b.start({ kind: 'rotate', axis: 'x' }, anchor, s.o, s.d, camHoriz);
    b.update(rayInYZ(0, 1).o, rayInYZ(0, 1).d, camHoriz);
    expect(b.getLiveTiltDeg()).toBeCloseTo(90, 3);
  });

  it('the Y rotate ring stays a plan rotation (NOT a tilt) — regression', () => {
    const b = new BimGizmoDragBridge();
    const s = vertRay(1, 0);
    b.start({ kind: 'rotate', axis: 'y' }, anchor, s.o, s.d, camDir);
    b.update(vertRay(0, 1).o, vertRay(0, 1).d, camDir);
    expect(b.getOutcome().kind).toBe('rotate');
  });
});
