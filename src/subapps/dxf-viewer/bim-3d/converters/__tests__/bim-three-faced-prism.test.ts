/**
 * ADR-539 — buildFacedPrism unit tests: group ranges, faceKey↔materialIndex SSoT,
 * determinism. Pure geometry (no WebGL) → runs headless under jest.
 */

import * as THREE from 'three';
import { buildFacedPrism } from '../bim-three-faced-prism';

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
