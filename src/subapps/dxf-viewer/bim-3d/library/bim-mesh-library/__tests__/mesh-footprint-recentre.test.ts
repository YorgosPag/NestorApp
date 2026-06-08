/**
 * ADR-411 2D polish (issue #2) — footprint recentring unit tests (pure, no GL).
 */

import * as THREE from 'three';
import { computeTopSilhouette } from '../../../../bim/mesh-library/mesh-silhouette';
import { recentreMeshFootprint } from '../mesh-footprint-recentre';

function footprintCentre(obj: THREE.Object3D): { x: number; z: number; y: { min: number; max: number } } {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  return {
    x: (box.min.x + box.max.x) / 2,
    z: (box.min.z + box.max.z) / 2,
    y: { min: box.min.y, max: box.max.y },
  };
}

/** A box whose origin is deliberately off-centre in X/Z (artist origin). */
function offCentreScene(): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.26, 1.05));
  // Push the geometry off the origin: footprint centre at (+0.7, +0.4), and the
  // base resting at y = 0 (min.y = 0, like a floor-standing cabin).
  mesh.position.set(0.7, 1.13, 0.4);
  g.add(mesh);
  return g;
}

describe('recentreMeshFootprint', () => {
  it('moves the X/Z footprint centre onto the origin', () => {
    const before = footprintCentre(offCentreScene());
    expect(Math.abs(before.x)).toBeGreaterThan(0.5);
    expect(Math.abs(before.z)).toBeGreaterThan(0.3);

    const after = footprintCentre(recentreMeshFootprint(offCentreScene()));
    expect(Math.abs(after.x)).toBeLessThan(1e-6);
    expect(Math.abs(after.z)).toBeLessThan(1e-6);
  });

  it('leaves the vertical (Y) extent untouched — the anchor owns the up-axis', () => {
    const after = footprintCentre(recentreMeshFootprint(offCentreScene()));
    // Base stayed at y = 0, top at y ≈ 2.26 (unchanged by the X/Z recentring).
    expect(after.y.min).toBeCloseTo(0, 5);
    expect(after.y.max).toBeCloseTo(2.26, 5);
  });

  it('is idempotent for an already-centred mesh (offset ≈ 0)', () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    const after = footprintCentre(recentreMeshFootprint(g));
    expect(Math.abs(after.x)).toBeLessThan(1e-6);
    expect(Math.abs(after.z)).toBeLessThan(1e-6);
  });

  it('passes an empty scene through unchanged (placeholder fallback)', () => {
    const empty = new THREE.Group();
    expect(recentreMeshFootprint(empty)).toBe(empty);
  });

  it('yields a silhouette centred on the origin (3D ↔ 2D stay in sync)', () => {
    const sil = computeTopSilhouette(recentreMeshFootprint(offCentreScene()));
    expect(sil.length).toBeGreaterThanOrEqual(4);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of sil) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    // Centre within ~1 grid cell of the origin (the silhouette rasterises).
    expect(Math.abs((minX + maxX) / 2)).toBeLessThan(0.05);
    expect(Math.abs((minY + maxY) / 2)).toBeLessThan(0.05);
  });
});
