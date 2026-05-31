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
});
