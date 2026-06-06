import * as THREE from 'three';
import { setBoxWorldUvs, setPlanarWorldUvs, setSlopeAlignedTileUvs } from '../bim-uv-helpers';

/**
 * One pitched «νερό» quad: ridge along world X, slope rising toward −Z (+Y).
 * Eave vertices at y=0,z=0; ridge vertices at y=2,z=−3 → real up-slope length 3.6m.
 */
function slopedFaceGeo(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  // prettier-ignore
  const positions = new Float32Array([
    0, 0, 0,   4, 0, 0,   4, 2, -3,   0, 2, -3,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/** All (u,v) pairs whose world position ≈ (x,y,z). */
function uvAt(geo: THREE.BufferGeometry, x: number, y: number, z: number) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i) - x) < 1e-4 && Math.abs(pos.getY(i) - y) < 1e-4 && Math.abs(pos.getZ(i) - z) < 1e-4) {
      return { u: uv.getX(i), v: uv.getY(i) };
    }
  }
  throw new Error(`no vertex at (${x},${y},${z})`);
}

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

describe('setSlopeAlignedTileUvs — ADR-417 #5 slope-aligned roof tile UVs', () => {
  it('writes uv + uv2 of the right length', () => {
    const geo = slopedFaceGeo();
    setSlopeAlignedTileUvs(geo, { scaleU: 1, scaleV: 1 });
    expect(geo.getAttribute('uv').count).toBe(geo.getAttribute('position').count);
    expect(geo.getAttribute('uv2').count).toBe(geo.getAttribute('position').count);
  });

  it('U = across-slope (along ridge): the two eave vertices share v, differ in u by 4m', () => {
    const geo = slopedFaceGeo();
    setSlopeAlignedTileUvs(geo, { scaleU: 1, scaleV: 1 });
    const a = uvAt(geo, 0, 0, 0);
    const b = uvAt(geo, 4, 0, 0);
    expect(b.v).toBeCloseTo(a.v, 5);            // same up-slope position → same v
    expect(Math.abs(b.u - a.u)).toBeCloseTo(4, 5); // ridge span = 4m
  });

  it('V = up-slope: span equals the REAL sloped length (3.6m), not the 3m plan run', () => {
    const geo = slopedFaceGeo();
    setSlopeAlignedTileUvs(geo, { scaleU: 1, scaleV: 1 });
    const eave = uvAt(geo, 0, 0, 0);
    const ridge = uvAt(geo, 0, 2, -3);
    expect(Math.abs(ridge.v - eave.v)).toBeCloseTo(Math.hypot(2, 3), 4); // √(2²+3²)=3.606
  });

  it('scaleV halves the tile count down-slope (physical sizing)', () => {
    const geo = slopedFaceGeo();
    setSlopeAlignedTileUvs(geo, { scaleU: 1, scaleV: 0.5 });
    const eave = uvAt(geo, 0, 0, 0);
    const ridge = uvAt(geo, 0, 2, -3);
    expect(Math.abs(ridge.v - eave.v)).toBeCloseTo(Math.hypot(2, 3) * 0.5, 4);
  });

  it('rotate90 swaps the U/V axes (Revit texture rotation)', () => {
    const base = slopedFaceGeo();
    setSlopeAlignedTileUvs(base, { scaleU: 1, scaleV: 1 });
    const rot = slopedFaceGeo();
    setSlopeAlignedTileUvs(rot, { scaleU: 1, scaleV: 1, rotate90: true });
    const b = uvAt(base, 4, 0, 0);
    const r = uvAt(rot, 4, 0, 0);
    expect(r.u).toBeCloseTo(b.v, 5);
    expect(r.v).toBeCloseTo(b.u, 5);
  });

  it('near-horizontal face falls back to world (x,z) like setBoxWorldUvs', () => {
    const geo = new THREE.PlaneGeometry(3, 5).rotateX(-Math.PI / 2); // normal = +Y
    setSlopeAlignedTileUvs(geo, { scaleU: 1, scaleV: 1 });
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    // v should track world z (the plane's depth), not collapse.
    let vMin = Infinity, vMax = -Infinity;
    for (let i = 0; i < pos.count; i++) { vMin = Math.min(vMin, uv.getY(i)); vMax = Math.max(vMax, uv.getY(i)); }
    expect(vMax - vMin).toBeGreaterThan(0.5);
  });
});
