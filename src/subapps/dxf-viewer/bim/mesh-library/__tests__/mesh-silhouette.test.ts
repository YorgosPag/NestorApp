/**
 * ADR-411 (generalised from ADR-410) — top-view silhouette unit tests
 * (pure geometry, no GL).
 */

import * as THREE from 'three';
import { computeTopSilhouette, computeTopFillTriangles, computeTopEdges } from '../mesh-silhouette';

/** Sum of unsigned triangle areas in a flat CCW plan-triangle buffer (plan m²). */
function fillArea(tris: Float32Array): number {
  let a = 0;
  for (let i = 0; i + 5 < tris.length; i += 6) {
    a += Math.abs(
      (tris[i + 2] - tris[i]) * (tris[i + 5] - tris[i + 1]) -
        (tris[i + 4] - tris[i]) * (tris[i + 3] - tris[i + 1]),
    ) / 2;
  }
  return a;
}

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

// ADR-683 §10.9 — faithful projected-triangle fill (πιστή προβολή, όπως το 3Δ).
describe('computeTopFillTriangles', () => {
  it('emits flat CCW plan triangles covering the box footprint (X×Z)', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4));
    const tris = computeTopFillTriangles(mesh);
    expect(tris.length % 6).toBe(0);
    expect(tris.length).toBeGreaterThanOrEqual(6);
    // Every stored triangle is CCW (signed area ≥ 0) — so a nonzero fill never cancels overlaps.
    for (let i = 0; i + 5 < tris.length; i += 6) {
      const s =
        (tris[i + 2] - tris[i]) * (tris[i + 5] - tris[i + 1]) -
        (tris[i + 4] - tris[i]) * (tris[i + 3] - tris[i + 1]);
      expect(s).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('covers BOTH halves of a two-component mesh (mirror arms) — not just one', () => {
    // Two disjoint boxes = the failure the single-contour raster silhouette could not fill.
    const g = new THREE.Group();
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.4));
    left.position.set(-0.6, 0, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.4));
    right.position.set(0.6, 0, 0);
    g.add(left, right);
    // Faithful fill area ≈ both footprints (2 × 0.2×0.4 = 0.16 m²), independent of raster resolution.
    expect(fillArea(computeTopFillTriangles(g))).toBeGreaterThan(0.15);
  });

  it('returns empty for an object with no mesh geometry', () => {
    expect(computeTopFillTriangles(new THREE.Group()).length).toBe(0);
  });
});

describe('computeTopEdges', () => {
  it('returns projected feature-edge segments for a box (interior detail)', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4));
    const segs = computeTopEdges(mesh);
    // A box yields its silhouette + vertical-edge projections → ≥4 segments.
    expect(segs.length).toBeGreaterThanOrEqual(4);
    // Every segment is finite and within the footprint extents (±0.3 / ±0.2).
    for (const s of segs) {
      expect(Number.isFinite(s.x1) && Number.isFinite(s.y2)).toBe(true);
      expect(Math.abs(s.x1)).toBeLessThanOrEqual(0.31);
      expect(Math.abs(s.y1)).toBeLessThanOrEqual(0.21);
    }
  });

  it('returns empty for an empty object', () => {
    expect(computeTopEdges(new THREE.Group())).toEqual([]);
  });
});
