/**
 * ADR-539 — buildFacedPrism unit tests: group ranges, faceKey↔materialIndex SSoT,
 * determinism. Pure geometry (no WebGL) → runs headless under jest.
 */

import * as THREE from 'three';
import { buildFacedPrism, buildFacedSolidBody } from '../bim-three-faced-prism';

/** CCW unit square top ring at Y=1 (world z = −plan y). */
function squareTopRing(): THREE.Vector3[] {
  return [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 1, 0),
    new THREE.Vector3(1, 1, -1),
    new THREE.Vector3(0, 1, -1),
  ];
}

describe('buildFacedPrism', () => {
  it('returns null for a degenerate outline (<3 vertices)', () => {
    expect(buildFacedPrism([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], 0.2)).toBeNull();
  });

  it('maps materialIndex → FaceKey: 0=bottom, 1=top, 2+i=side:i', () => {
    const prism = buildFacedPrism(squareTopRing(), 0.2);
    expect(prism).not.toBeNull();
    expect(prism!.faceKeyByMaterialIndex).toEqual([
      'bottom', 'top', 'side:0', 'side:1', 'side:2', 'side:3',
    ]);
  });

  it('emits one geometry group per face with the correct materialIndex', () => {
    const { geometry } = buildFacedPrism(squareTopRing(), 0.2)!;
    // 2 caps + 4 sides = 6 groups; each side group is exactly 2 triangles (6 verts).
    expect(geometry.groups).toHaveLength(6);
    const byMat = new Map(geometry.groups.map((g) => [g.materialIndex, g]));
    expect(byMat.get(0)).toMatchObject({ start: 0, count: 6 });   // bottom cap (2 tris)
    expect(byMat.get(1)).toMatchObject({ start: 6, count: 6 });   // top cap (2 tris)
    for (let i = 0; i < 4; i++) {
      expect(byMat.get(2 + i)).toMatchObject({ count: 6 });        // each side quad
    }
  });

  it('produces a non-indexed geometry with position count = total triangle verts', () => {
    const { geometry } = buildFacedPrism(squareTopRing(), 0.2)!;
    expect(geometry.getIndex()).toBeNull(); // toNonIndexed
    // 2 caps × 2 tris + 4 sides × 2 tris = 12 tris × 3 = 36 verts.
    expect(geometry.getAttribute('position').count).toBe(36);
  });

  it('offsets the bottom ring DOWN by depthM from the top ring', () => {
    const { geometry } = buildFacedPrism(squareTopRing(), 0.2)!;
    const pos = geometry.getAttribute('position');
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
    }
    expect(maxY).toBeCloseTo(1);   // top ring
    expect(minY).toBeCloseTo(0.8); // 1 − depth(0.2)
  });

  it('is deterministic (same faceKey ordering across builds)', () => {
    const a = buildFacedPrism(squareTopRing(), 0.2)!;
    const b = buildFacedPrism(squareTopRing(), 0.2)!;
    expect(a.faceKeyByMaterialIndex).toEqual(b.faceKeyByMaterialIndex);
  });
});

// ADR-539 Φ1.5 — shared faced-solid-body SSoT (slab + foundation both delegate here).
describe('buildFacedSolidBody', () => {
  const squareVerts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

  it('returns null for a degenerate outline (<3 vertices)', () => {
    const base = new THREE.MeshStandardMaterial();
    expect(buildFacedSolidBody([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0.2, {}, base)).toBeNull();
  });

  it('uses the base material on every UNPAINTED face (byte-for-byte legacy look)', () => {
    const base = new THREE.MeshStandardMaterial({ color: 0x123456 });
    const mesh = buildFacedSolidBody(squareVerts, 0.2, {}, base)!;
    const mats = mesh.material as THREE.Material[];
    expect(mats).toHaveLength(6); // bottom, top, side:0..3
    expect(mats.every((m) => m === base)).toBe(true);
  });

  it('overrides ONLY the painted face, keeps base instance elsewhere', () => {
    const base = new THREE.MeshStandardMaterial({ color: 0x123456 });
    const mesh = buildFacedSolidBody(squareVerts, 0.2, { top: { colorHex: '#ff0000' } }, base)!;
    const mats = mesh.material as THREE.MeshStandardMaterial[];
    expect(mats[0]).toBe(base);                                  // bottom unpainted → base
    expect(mats[1]).not.toBe(base);                              // top painted → fresh material
    expect(mats[1].color.getHexString()).toBe('ff0000');
    expect(mats[2]).toBe(base);                                  // side:0 unpainted → base
  });

  it('stamps faceKeyByMaterialIndex onto userData for raycast + highlight', () => {
    const mesh = buildFacedSolidBody(squareVerts, 0.2, {}, new THREE.MeshStandardMaterial())!;
    expect(mesh.userData['faceKeyByMaterialIndex']).toEqual([
      'bottom', 'top', 'side:0', 'side:1', 'side:2', 'side:3',
    ]);
  });
});

// ADR-539 Φ2 — holes (slab-openings) in the faced prism: cap cut-outs + hole-wall faces.
describe('buildFacedPrism — holes (Φ2)', () => {
  const bigSquareTopRing = (): THREE.Vector3[] => [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(4, 1, 0),
    new THREE.Vector3(4, 1, -4),
    new THREE.Vector3(0, 1, -4),
  ];
  // Hole = inner square, plan (x, z) Vector2 ring (CW, same as the contour → gets normalised).
  const hole = (): THREE.Vector2[] => [
    new THREE.Vector2(1, -1),
    new THREE.Vector2(2, -1),
    new THREE.Vector2(2, -2),
    new THREE.Vector2(1, -2),
  ];

  it('emits a hole-wall group + deterministic faceKey per hole edge', () => {
    const prism = buildFacedPrism(bigSquareTopRing(), 0.2, [hole()])!;
    // 2 caps + 4 outer sides + 4 hole walls = 10 material groups.
    expect(prism.geometry.groups).toHaveLength(10);
    expect(prism.faceKeyByMaterialIndex).toContain('hole:0:0');
    expect(prism.faceKeyByMaterialIndex).toContain('hole:0:3');
  });

  it('cuts the hole out of the caps (more cap triangles than a plain prism)', () => {
    const withHole = buildFacedPrism(bigSquareTopRing(), 0.2, [hole()])!;
    const noHole = buildFacedPrism(bigSquareTopRing(), 0.2)!;
    const capCount = (p: { geometry: THREE.BufferGeometry }): number =>
      p.geometry.groups.find((g) => g.materialIndex === 0)!.count;
    expect(capCount(withHole)).toBeGreaterThan(capCount(noHole));
  });

  it('ignores a degenerate hole (<3 vertices) — no hole walls', () => {
    const prism = buildFacedPrism(bigSquareTopRing(), 0.2, [[new THREE.Vector2(1, -1), new THREE.Vector2(2, -1)]])!;
    expect(prism.faceKeyByMaterialIndex.some((k) => k.startsWith('hole:'))).toBe(false);
    expect(prism.geometry.groups).toHaveLength(6); // 2 caps + 4 outer sides only
  });

  it('normalises hole winding regardless of input order (caps still cut)', () => {
    const cw = hole();
    const ccw = [...hole()].reverse();
    const a = buildFacedPrism(bigSquareTopRing(), 0.2, [cw])!;
    const b = buildFacedPrism(bigSquareTopRing(), 0.2, [ccw])!;
    const capCount = (p: { geometry: THREE.BufferGeometry }): number =>
      p.geometry.groups.find((g) => g.materialIndex === 0)!.count;
    expect(capCount(a)).toBe(capCount(b)); // winding-agnostic triangulation
  });
});
