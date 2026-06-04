import * as THREE from 'three';
import { setBoxWorldUvs, setPlanarWorldUvs } from '../bim-uv-helpers';

/** Read the (u,v) of the first vertex whose normal points along `axis`. */
function uvOfFace(geo: THREE.BufferGeometry, axis: 'x' | 'y' | 'z', sign: 1 | -1) {
  const nor = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  const comp = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  for (let i = 0; i < nor.count; i++) {
    if (Math.round(nor.getComponent(i, comp)) === sign) return { u: uv.getX(i), v: uv.getY(i), i };
  }
  throw new Error(`no ${sign > 0 ? '+' : '-'}${axis} face vertex`);
}

describe('setBoxWorldUvs — per-face world-meter UVs', () => {
  it('writes uv + uv2 of the right length', () => {
    const geo = new THREE.BoxGeometry(2, 0.2, 1);
    setBoxWorldUvs(geo);
    expect(geo.getAttribute('uv').count).toBe(geo.getAttribute('position').count);
    expect(geo.getAttribute('uv2').count).toBe(geo.getAttribute('position').count);
  });

  it('uses world METERS (1 UV unit = 1 m), not normalized 0..1', () => {
    // 2m-wide box → the +Z (front) face spans u ∈ [-1, 1] (=2m), not [0, 1].
    const geo = new THREE.BoxGeometry(2, 0.2, 1);
    setBoxWorldUvs(geo);
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    let maxU = -Infinity, minU = Infinity;
    for (let i = 0; i < nor.count; i++) {
      if (Math.round(nor.getZ(i)) === 1) { // +Z face: u = world x
        maxU = Math.max(maxU, uv.getX(i));
        minU = Math.min(minU, uv.getX(i));
      }
    }
    expect(maxU - minU).toBeCloseTo(2, 5); // full 2m width, not 1.0
  });

  it('top (+Y) face maps to (x,z) — the fix that kills the stripe stretch', () => {
    // The bug: planar dominantAxis:z mapped the top face to (x,y); since y is
    // ~constant on the top face, v collapsed → a stripe. Per-face uses (x,z).
    const geo = new THREE.BoxGeometry(2, 0.2, 1);
    setBoxWorldUvs(geo);
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    let vSpan = 0, vMin = Infinity, vMax = -Infinity;
    for (let i = 0; i < nor.count; i++) {
      if (Math.round(nor.getY(i)) === 1) { vMin = Math.min(vMin, uv.getY(i)); vMax = Math.max(vMax, uv.getY(i)); }
    }
    vSpan = vMax - vMin;
    expect(vSpan).toBeCloseTo(1, 5); // = depth (z), NOT the ~0.2 thickness → no stripe
  });

  it('front (+Z) and top (+Y) faces use DIFFERENT axis pairs (per-face, not single planar)', () => {
    const geo = new THREE.BoxGeometry(2, 0.2, 1);
    const planar = geo.clone();
    setPlanarWorldUvs(planar, { dominantAxis: 'z' }); // OLD behaviour, all faces (x,y)
    setBoxWorldUvs(geo);

    // On the +Y face, old planar v = world y (~±0.1), new v = world z (~±0.5).
    const oldTop = uvOfFace(planar, 'y', 1);
    const newTop = uvOfFace(geo, 'y', 1);
    expect(Math.abs(newTop.v)).toBeGreaterThan(Math.abs(oldTop.v));
  });
});
