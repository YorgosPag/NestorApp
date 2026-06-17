/**
 * roof-tile-tessellation tests — ADR-417 #6.
 *
 * Tests for the pure tessellation utilities:
 *   - buildSlopePlane: linear plane fit from 3 outline vertices
 *   - slopeZMm: z interpolation on the plane
 *   - pointInPolygon2D: ray-casting PIP (incl. concave outlines)
 *   - tessellateRoofTopCap: full pipeline (geometry, vertex count, UVs)
 */

import * as THREE from 'three';
import {
  buildSlopePlane,
  slopeZMm,
  pointInPolygon2D,
  tessellateRoofTopCap,
} from '../roof-tile-tessellation';
import type { RoofFace } from '../../../bim/types/roof-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal RoofFace from a list of {x, y, z} points. */
function makeFace(pts: { x: number; y: number; z?: number }[], slopeRatio = 0.5): RoofFace {
  return {
    outline: pts.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
    slopeRatio,
    projectedAreaM2: 1,
    grossAreaM2: 1,
  };
}

const DEFAULT_TILE_OPTS = { scaleU: 1, scaleV: 1, rotate90: false };

// ─── buildSlopePlane ──────────────────────────────────────────────────────────

describe('buildSlopePlane', () => {
  it('flat face (non-collinear) → valid=true, A=0, B=0, C=z0', () => {
    // det = dx1*dy2 - dx2*dy1 = 5*5 - 5*0 = 25 ≠ 0 → valid=true
    // A = (dz1*dy2 - dz2*dy1)/det = 0, B = (dx1*dz2 - dx2*dz1)/det = 0, C = 100
    const face = makeFace([
      { x: 0, y: 0, z: 100 },
      { x: 5, y: 0, z: 100 },
      { x: 5, y: 5, z: 100 },
    ]);
    const p = buildSlopePlane(face.outline);
    expect(p.valid).toBe(true);
    expect(slopeZMm(2, 3, p)).toBeCloseTo(100, 1);
    expect(slopeZMm(0, 0, p)).toBeCloseTo(100, 1);
  });

  it('sloped face → valid plane with non-zero A or B', () => {
    // Slope rising in y direction: z = 0 + 500 * (y/5) = 100*y
    const face = makeFace([
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
      { x: 5, y: 5, z: 500 }, // z goes up with y
    ]);
    const p = buildSlopePlane(face.outline);
    expect(p.valid).toBe(true);
    // z at (0,5) should be ~500
    expect(slopeZMm(0, 5, p)).toBeCloseTo(500, 1);
    // z at (0,0) should be 0
    expect(slopeZMm(0, 0, p)).toBeCloseTo(0, 1);
    // z at (5,5) should be 500
    expect(slopeZMm(5, 5, p)).toBeCloseTo(500, 1);
  });

  it('collinear first 3 vertices → valid=false, z=C', () => {
    const face = makeFace([
      { x: 0, y: 0, z: 50 },
      { x: 1, y: 0, z: 50 },
      { x: 2, y: 0, z: 50 }, // collinear (same y)
    ]);
    const p = buildSlopePlane(face.outline);
    expect(p.valid).toBe(false);
    expect(slopeZMm(3, 7, p)).toBeCloseTo(50, 1); // C = z0
  });

  it('degenerate outline < 3 → valid=false', () => {
    const p = buildSlopePlane([{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }]);
    expect(p.valid).toBe(false);
  });
});

// ─── pointInPolygon2D ─────────────────────────────────────────────────────────

describe('pointInPolygon2D', () => {
  const square = [
    { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
  ].map((p) => ({ ...p, z: 0 }));

  it('center of square → inside', () => {
    expect(pointInPolygon2D(2, 2, square)).toBe(true);
  });

  it('outside square → false', () => {
    expect(pointInPolygon2D(5, 5, square)).toBe(false);
    expect(pointInPolygon2D(-1, 2, square)).toBe(false);
  });

  it('concave L-shape: point in recess → outside', () => {
    const lShape = [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 },
      { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 },
    ].map((p) => ({ ...p, z: 0 }));
    // Point at (3, 3) is in the recess (outside the L)
    expect(pointInPolygon2D(3, 3, lShape)).toBe(false);
    // Point at (1, 3) is inside the L
    expect(pointInPolygon2D(1, 3, lShape)).toBe(true);
  });

  it('triangle: centroid inside', () => {
    const tri = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 6 },
    ].map((p) => ({ ...p, z: 0 }));
    expect(pointInPolygon2D(3, 2, tri)).toBe(true);
    expect(pointInPolygon2D(0.1, 5.9, tri)).toBe(false);
  });
});

// ─── tessellateRoofTopCap ────────────────────────────────────────────────────

describe('tessellateRoofTopCap', () => {
  const SCENE_TO_M = 1; // 1 scene-unit = 1 metre (simplifies checks)
  const BASE_ELEV = 0;

  function vertexCount(geo: THREE.BufferGeometry): number {
    return geo.getAttribute('position').count;
  }

  it('degenerate face (< 3 vertices) → null', () => {
    const face = makeFace([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    const result = tessellateRoofTopCap(face, 0, SCENE_TO_M, BASE_ELEV, DEFAULT_TILE_OPTS);
    expect(result).toBeNull();
  });

  it('flat 4×4m square → produces geometry with many vertices', () => {
    const face = makeFace([
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
      { x: 4, y: 4, z: 0 },
      { x: 0, y: 4, z: 0 },
    ]);
    const geo = tessellateRoofTopCap(face, 0, SCENE_TO_M, BASE_ELEV, DEFAULT_TILE_OPTS);
    expect(geo).not.toBeNull();
    // 4m × 4m with stepScene = max(0.1, max(4,4)/50) = 0.1 → ~40×40 = 1600 cells → 6400 vertices
    expect(vertexCount(geo!)).toBeGreaterThan(100);
  });

  it('produces UVs (attribute "uv" exists and matches vertex count)', () => {
    const face = makeFace([
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 2, z: 0 },
      { x: 0, y: 2, z: 0 },
    ]);
    const geo = tessellateRoofTopCap(face, 0, SCENE_TO_M, BASE_ELEV, DEFAULT_TILE_OPTS);
    expect(geo).not.toBeNull();
    const uv = geo!.getAttribute('uv');
    expect(uv).toBeTruthy();
    expect(uv.count).toBe(vertexCount(geo!));
  });

  it('produces normals (attribute "normal" exists)', () => {
    const face = makeFace([
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
      { x: 3, y: 3, z: 0 },
      { x: 0, y: 3, z: 0 },
    ]);
    const geo = tessellateRoofTopCap(face, 0, SCENE_TO_M, BASE_ELEV, DEFAULT_TILE_OPTS);
    expect(geo).not.toBeNull();
    const nor = geo!.getAttribute('normal');
    expect(nor).toBeTruthy();
    expect(nor.count).toBe(vertexCount(geo!));
  });

  it('triangular face (hip shape) → inside cells only, some clipped', () => {
    // Triangle: 3m base, 3m height → ~4.5m² footprint
    const face = makeFace([
      { x: 0, y: 0, z: 0 },
      { x: 6, y: 0, z: 0 },
      { x: 3, y: 6, z: 300 }, // sloped apex
    ], 0.5);
    const geo = tessellateRoofTopCap(face, 0, SCENE_TO_M, BASE_ELEV, DEFAULT_TILE_OPTS);
    expect(geo).not.toBeNull();
    // Square bounding box 6×6 = 36 cells; triangle fills ~half → less than full bbox
    const fullSquareFace = makeFace([
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 },
    ]);
    const squareGeo = tessellateRoofTopCap(fullSquareFace, 0, SCENE_TO_M, BASE_ELEV, DEFAULT_TILE_OPTS);
    // Triangle has fewer cells than the bounding square
    expect(vertexCount(geo!)).toBeLessThan(vertexCount(squareGeo!));
  });

  it('sloped face: z values reflect the slope plane (not flat)', () => {
    // Face rising z = 100*y mm
    const face = makeFace([
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 2, z: 200 },
      { x: 0, y: 2, z: 200 },
    ], 0.5);
    const geo = tessellateRoofTopCap(face, 0, SCENE_TO_M, BASE_ELEV, DEFAULT_TILE_OPTS);
    expect(geo).not.toBeNull();
    const pos = geo!.getAttribute('position');
    // All y-world coords (Three.js y=up) should span z→y range (0→0.2m)
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    // Face goes from z=0 to z=200mm = 0.2m; world y should span similarly
    expect(maxY - minY).toBeGreaterThan(0.1);
  });

  it('topDepthMm offset shifts all vertices down uniformly', () => {
    const face = makeFace([
      { x: 0, y: 0, z: 1000 }, // 1000mm base
      { x: 2, y: 0, z: 1000 },
      { x: 2, y: 2, z: 1000 },
      { x: 0, y: 2, z: 1000 },
    ]);
    const geoAt0 = tessellateRoofTopCap(face, 0, SCENE_TO_M, BASE_ELEV, DEFAULT_TILE_OPTS);
    const geoAt50 = tessellateRoofTopCap(face, 50, SCENE_TO_M, BASE_ELEV, DEFAULT_TILE_OPTS);
    expect(geoAt0).not.toBeNull();
    expect(geoAt50).not.toBeNull();
    const pos0 = geoAt0!.getAttribute('position');
    const pos50 = geoAt50!.getAttribute('position');
    // All y values in geoAt50 should be 50mm = 0.05m lower
    for (let i = 0; i < Math.min(pos0.count, pos50.count); i++) {
      expect(pos0.getY(i) - pos50.getY(i)).toBeCloseTo(0.05, 3);
    }
  });
});
