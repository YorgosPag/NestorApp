/**
 * ADR-683 §10.9 (revised) — cached simplified multi-component + hole-aware fill contours.
 * Pure geometry (no GL). Verifies the big-player plan symbol: every disjoint region traced,
 * real holes punched, output simplified to FEW points (not the 42k raw-triangle shadow).
 */

import * as THREE from 'three';
import {
  computeTopFillContours,
  contoursWithHolesFromTriangles,
  flatRingsToFilteredContours,
} from '../mesh-fill-contours';

/** Unsigned shoelace area (plan m²) of a ring. */
function ringArea(ring: readonly { x: number; y: number }[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

describe('computeTopFillContours', () => {
  it('returns ONE simplified ring for a solid box footprint (few points, not 42k)', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4));
    const rings = computeTopFillContours(mesh);
    expect(rings.length).toBe(1);
    // Simplified — a rectangle collapses to a handful of corners, never hundreds of cells.
    expect(rings[0].length).toBeGreaterThanOrEqual(3);
    expect(rings[0].length).toBeLessThan(40);
  });

  it('traces BOTH halves of a two-component mesh (mirror arms) — two rings', () => {
    const g = new THREE.Group();
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.4));
    left.position.set(-0.7, 0, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.4));
    right.position.set(0.7, 0, 0);
    g.add(left, right);
    expect(computeTopFillContours(g).length).toBe(2);
  });

  it('punches a real hole (annulus/torus footprint) — outer ring + inner hole ring', () => {
    // Torus rotated flat into the XZ plane → top-down projection is an annulus (disc with a hole).
    const geo = new THREE.TorusGeometry(0.5, 0.12, 16, 48);
    geo.rotateX(Math.PI / 2);
    const rings = computeTopFillContours(new THREE.Mesh(geo));
    // One outer boundary + one interior hole = two rings.
    expect(rings.length).toBe(2);
    // Largest ring is the outer boundary; the other is the punched hole (smaller, non-empty).
    const areas = rings.map(ringArea).sort((a, b) => b - a);
    expect(areas[1]).toBeGreaterThan(0);
    expect(areas[1]).toBeLessThan(areas[0]);
  });

  it('returns empty for an object with no mesh geometry', () => {
    expect(computeTopFillContours(new THREE.Group())).toEqual([]);
  });

  it('returns empty for a triangle set below the minimum', () => {
    expect(contoursWithHolesFromTriangles([])).toEqual([]);
  });
});

// ADR-683 §10.9.2 — exact union rings (from the worker) → filtered SilPoint contours.
describe('flatRingsToFilteredContours', () => {
  it('keeps a big outer ring + its hole, dropping a sub-visible weave speck', () => {
    const outer = [0, 0, 1, 0, 1, 1, 0, 1]; // 1×1 m square
    const hole = [0.4, 0.4, 0.6, 0.4, 0.6, 0.6, 0.4, 0.6]; // 0.2×0.2 m hole (real gap)
    const speck = [0.01, 0.01, 0.012, 0.01, 0.012, 0.012]; // ~µm² noise → dropped
    const out = flatRingsToFilteredContours([outer, hole, speck]);
    expect(out.length).toBe(2);
    expect(out.every((r) => r.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))).toBe(true);
  });

  it('returns empty for degenerate (zero-span) input', () => {
    expect(flatRingsToFilteredContours([[0, 0, 0, 0, 0, 0]])).toEqual([]);
  });
});
