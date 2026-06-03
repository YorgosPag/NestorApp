/**
 * ADR-410 — top-view silhouette unit tests (pure geometry, no GL).
 */

import * as THREE from 'three';
import { computeTopSilhouette } from '../furniture-silhouette';

function bboxOf(pts: { x: number; y: number }[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

describe('computeTopSilhouette', () => {
  it('returns a closed outline spanning a box footprint (X×Z)', () => {
    // 0.6 (X) × 0.4 (Z) × 1.0 (Y-up) box centred at origin.
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4));
    const sil = computeTopSilhouette(mesh);
    expect(sil.length).toBeGreaterThanOrEqual(4);
    const bb = bboxOf([...sil]);
    // plan x = worldX (0.6), plan y = -worldZ (0.4). Allow ~1 cell tolerance.
    expect(bb.w).toBeGreaterThan(0.5);
    expect(bb.w).toBeLessThan(0.7);
    expect(bb.h).toBeGreaterThan(0.3);
    expect(bb.h).toBeLessThan(0.5);
  });

  it('is roughly centred on the origin for a centred mesh', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5));
    const bb = bboxOf([...computeTopSilhouette(mesh)]);
    expect(Math.abs((bb.minX + bb.maxX) / 2)).toBeLessThan(0.05);
    expect(Math.abs((bb.minY + bb.maxY) / 2)).toBeLessThan(0.05);
  });

  it('returns empty for an empty object (renderer falls back to rectangle)', () => {
    expect(computeTopSilhouette(new THREE.Group())).toEqual([]);
  });

  it('follows an L-shaped footprint (concave — not just a bounding box)', () => {
    // Two boxes forming an L in the X/Z plane.
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.3));
    a.position.set(0, 0, -0.35);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 1.0));
    b.position.set(-0.35, 0, 0);
    g.add(a, b);
    const sil = computeTopSilhouette(g);
    // An L-outline needs more than the 4 corners of a pure rectangle.
    expect(sil.length).toBeGreaterThan(4);
  });
});
