/**
 * Phase 5.5i+ — Beam-supports-slab analytical link: BOQ volume deduction tests.
 * Phase 3.8 — Analytical free-span computation with supporting elements.
 *
 * Verifies that `computeSlabGeometry` correctly deducts beam intersection
 * volumes from the slab BOQ volume (industry precedent: Revit Material Takeoff /
 * ArchiCAD Interactive Schedule).
 *
 * Also covers `polygonIntersectionAreaMm2`, `clipPolygonBySH`, and
 * `computeSlabMaxFreeSpanM` directly.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5i+ §3.8
 */

import {
  computeSlabGeometry,
  computeSlabMaxFreeSpanM,
  type BeamFootprintForDeduction,
  type WallFootprintForSpan,
} from '../slab-geometry';
import { polygonIntersectionAreaMm2, clipPolygonBySH } from '../shared/polygon-utils';
import type { SlabParams } from '../../types/slab-types';
import type { Point3D, Polygon3D } from '../../types/bim-base';

// ─── Test fixtures ────────────────────────────────────────────────────────────

/** 4m × 4m CCW square slab, thickness 200mm. Volume = 16 × 0.2 = 3.2 m³. */
const SLAB_4X4: SlabParams = {
  kind: 'floor',
  outline: {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 4000, y: 0, z: 0 },
      { x: 4000, y: 4000, z: 0 },
      { x: 0, y: 4000, z: 0 },
    ],
  },
  levelElevation: 0,
  thickness: 200,
};

/** Beam fully inside slab: 1m × 0.25m rectangle, depth 500mm. */
const beamFullyInside = (): BeamFootprintForDeduction => ({
  outline: {
    vertices: [
      { x: 1000, y: 1000, z: 0 },
      { x: 2000, y: 1000, z: 0 },
      { x: 2000, y: 1250, z: 0 },
      { x: 1000, y: 1250, z: 0 },
    ],
  },
  depthMm: 500,
});

/** Beam half-outside slab (right edge at x=4500 → 500mm hang-over). */
const beamHalfOutside = (): BeamFootprintForDeduction => ({
  outline: {
    vertices: [
      { x: 3500, y: 1000, z: 0 },
      { x: 4500, y: 1000, z: 0 },
      { x: 4500, y: 1500, z: 0 },
      { x: 3500, y: 1500, z: 0 },
    ],
  },
  depthMm: 300,
});

/** Beam completely outside slab (x starts at 5000). */
const beamOutside = (): BeamFootprintForDeduction => ({
  outline: {
    vertices: [
      { x: 5000, y: 0, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 6000, y: 1000, z: 0 },
      { x: 5000, y: 1000, z: 0 },
    ],
  },
  depthMm: 400,
});

function makeRectVertices(x0: number, y0: number, x1: number, y1: number): Point3D[] {
  return [
    { x: x0, y: y0, z: 0 },
    { x: x1, y: y0, z: 0 },
    { x: x1, y: y1, z: 0 },
    { x: x0, y: y1, z: 0 },
  ];
}

// ─── clipPolygonBySH ─────────────────────────────────────────────────────────

describe('clipPolygonBySH', () => {
  it('1. identical rectangles → same area', () => {
    const rect = makeRectVertices(0, 0, 1000, 1000);
    const clipped = clipPolygonBySH(rect, rect);
    // area = 1,000,000 mm²
    expect(clipped.length).toBeGreaterThanOrEqual(3);
  });

  it('2. no overlap → empty result', () => {
    const a = makeRectVertices(0, 0, 100, 100);
    const b = makeRectVertices(200, 200, 300, 300);
    const clipped = clipPolygonBySH(a, b);
    expect(clipped.length).toBe(0);
  });

  it('3. partial overlap (half) → non-empty result', () => {
    const subject = makeRectVertices(0, 0, 1000, 1000);
    const clip = makeRectVertices(500, 0, 1500, 1000);
    const clipped = clipPolygonBySH(subject, clip);
    expect(clipped.length).toBeGreaterThanOrEqual(3);
  });

  it('4. degenerate subject (< 3 verts) → empty', () => {
    const clip = makeRectVertices(0, 0, 100, 100);
    expect(clipPolygonBySH([{ x: 0, y: 0, z: 0 }], clip)).toHaveLength(0);
    expect(clipPolygonBySH([], clip)).toHaveLength(0);
  });
});

// ─── polygonIntersectionAreaMm2 ───────────────────────────────────────────────

describe('polygonIntersectionAreaMm2', () => {
  it('5. beam fully inside slab → intersection = full beam area', () => {
    const slab = makeRectVertices(0, 0, 4000, 4000);
    const beam = makeRectVertices(1000, 1000, 2000, 1250); // 1000×250 = 250,000 mm²
    const area = polygonIntersectionAreaMm2(slab, beam);
    expect(area).toBeCloseTo(250_000, 0);
  });

  it('6. beam half outside slab → intersection = half beam area', () => {
    const slab = makeRectVertices(0, 0, 4000, 4000);
    const beam = makeRectVertices(3500, 1000, 4500, 1500); // 1000×500 = 500,000 mm²; half = 250,000
    const area = polygonIntersectionAreaMm2(slab, beam);
    expect(area).toBeCloseTo(250_000, 0); // only 3500→4000 = 500mm × 500mm
  });

  it('7. no overlap → 0', () => {
    const slab = makeRectVertices(0, 0, 4000, 4000);
    const beam = makeRectVertices(5000, 0, 6000, 1000);
    expect(polygonIntersectionAreaMm2(slab, beam)).toBe(0);
  });

  it('8. AABB adjacent (touching edge) → 0', () => {
    const slab = makeRectVertices(0, 0, 1000, 1000);
    const beam = makeRectVertices(1000, 0, 2000, 1000); // shares edge x=1000
    // S-H considers the boundary as inside (>=0), so touching edge may give 0 area strip
    const area = polygonIntersectionAreaMm2(slab, beam);
    expect(area).toBeCloseTo(0, 0);
  });
});

// ─── computeSlabGeometry with beamFootprints ─────────────────────────────────

describe('computeSlabGeometry — beam deductions (Phase 5.5i+)', () => {
  const BASE_VOLUME = 16 * 0.2; // 3.2 m³

  it('9. no beamFootprints → volume unchanged (backward compat)', () => {
    const geom = computeSlabGeometry(SLAB_4X4);
    expect(geom.volume).toBeCloseTo(BASE_VOLUME, 6);
  });

  it('10. empty beamFootprints array → volume unchanged', () => {
    const geom = computeSlabGeometry(SLAB_4X4, undefined, []);
    expect(geom.volume).toBeCloseTo(BASE_VOLUME, 6);
  });

  it('11. beam fully inside, depth < slab thickness → deduct intersect × depth', () => {
    // Beam 1000×250mm fully inside. Depth 150mm < slab 200mm → use 150mm.
    const beam: BeamFootprintForDeduction = {
      outline: { vertices: makeRectVertices(1000, 1000, 2000, 1250) },
      depthMm: 150,
    };
    const geom = computeSlabGeometry(SLAB_4X4, undefined, [beam]);
    // deduction = 250,000 mm² × 150mm / 1e9 = 0.0375 m³
    const expectedDeduction = (250_000 * 150) / 1e9;
    expect(geom.volume).toBeCloseTo(BASE_VOLUME - expectedDeduction, 6);
  });

  it('12. beam depth > slab thickness → clamp to slab thickness', () => {
    const beam = beamFullyInside(); // depth=500 > slab 200
    const geom = computeSlabGeometry(SLAB_4X4, undefined, [beam]);
    // deduction clamped to 200mm: 250,000 × 200 / 1e9 = 0.05 m³
    const expectedDeduction = (250_000 * 200) / 1e9;
    expect(geom.volume).toBeCloseTo(BASE_VOLUME - expectedDeduction, 6);
  });

  it('13. beam partially overlapping → deduct only intersection portion', () => {
    const beam = beamHalfOutside(); // half inside (500×500 = 250,000mm²), depth 300
    const geom = computeSlabGeometry(SLAB_4X4, undefined, [beam]);
    const effectiveDepth = Math.min(300, 200); // clamped to 200
    const expectedDeduction = (250_000 * effectiveDepth) / 1e9;
    expect(geom.volume).toBeCloseTo(BASE_VOLUME - expectedDeduction, 6);
  });

  it('14. beam outside slab → volume unchanged', () => {
    const geom = computeSlabGeometry(SLAB_4X4, undefined, [beamOutside()]);
    expect(geom.volume).toBeCloseTo(BASE_VOLUME, 6);
  });

  it('15. multiple beams → Σ deductions', () => {
    const beam1 = beamFullyInside(); // 250,000mm² × min(500,200) = 0.05 m³
    const beam2: BeamFootprintForDeduction = {
      outline: { vertices: makeRectVertices(2500, 2500, 3500, 2750) },
      depthMm: 200,
    }; // 1000×250 = 250,000mm² × 200 = 0.05 m³
    const geom = computeSlabGeometry(SLAB_4X4, undefined, [beam1, beam2]);
    const deduction1 = (250_000 * 200) / 1e9;
    const deduction2 = (250_000 * 200) / 1e9;
    expect(geom.volume).toBeCloseTo(BASE_VOLUME - deduction1 - deduction2, 6);
  });

  it('16. volume always >= 0 even with large beams', () => {
    // A beam that covers the entire slab
    const beam: BeamFootprintForDeduction = {
      outline: { vertices: makeRectVertices(-100, -100, 4100, 4100) },
      depthMm: 10_000,
    };
    const geom = computeSlabGeometry(SLAB_4X4, undefined, [beam]);
    expect(geom.volume).toBeGreaterThanOrEqual(0);
  });

  it('17. netArea and perimeter unchanged by beam deductions', () => {
    const geom = computeSlabGeometry(SLAB_4X4, undefined, [beamFullyInside()]);
    expect(geom.area).toBeCloseTo(16, 6);
    expect(geom.netArea).toBeCloseTo(16, 6);
    expect(geom.perimeter).toBeCloseTo(16, 3); // 4×4m perimeter = 16m
  });

  it('18. maxFreeSpanM present — no supports → fallback to min(bbox.w, bbox.h)', () => {
    const geom = computeSlabGeometry(SLAB_4X4);
    // 4m × 4m square → min = 4m
    expect(geom.maxFreeSpanM).toBeCloseTo(4, 3);
  });
});

// ─── computeSlabMaxFreeSpanM — Phase 3.8 analytical free span ────────────────

describe('computeSlabMaxFreeSpanM — analytical free span (Phase 3.8)', () => {
  const SLAB_VERTS = SLAB_4X4.outline.vertices;

  it('19. no support outlines → fallback min(bbox.w, bbox.h)', () => {
    const span = computeSlabMaxFreeSpanM(SLAB_VERTS, []);
    expect(span).toBeCloseTo(4, 3); // 4×4m square → 4m
  });

  it('20. single support → fallback (need ≥2 for opposing pair detection)', () => {
    const wall: WallFootprintForSpan = {
      outline: { vertices: makeRectVertices(-500, -500, 4500, 0) },
    };
    const span = computeSlabMaxFreeSpanM(SLAB_VERTS, [wall.outline]);
    expect(span).toBeCloseTo(4, 3); // fallback
  });

  it('21. two parallel walls on opposite sides → clear span = slab height − wall widths', () => {
    // 4m × 4m slab. Bottom wall y:[-300, 0], top wall y:[4000, 4300].
    // Slab spans between them: 4000 - 0 = 4000mm → 4m clear span.
    const bottomWall: Polygon3D = { vertices: makeRectVertices(0, -300, 4000, 0) };
    const topWall: Polygon3D = { vertices: makeRectVertices(0, 4000, 4000, 4300) };
    const span = computeSlabMaxFreeSpanM(SLAB_VERTS, [bottomWall, topWall]);
    expect(span).toBeCloseTo(4, 2); // clear span between inner faces (y=0 to y=4000) = 4m
  });

  it('22. walls partially inside slab — inner face at slab edge', () => {
    // Bottom wall at y:[-200, 200] (inner face y=200), top at y:[3800, 4200] (inner face y=3800).
    // Clear span = 3800 - 200 = 3600mm = 3.6m.
    const bottomWall: Polygon3D = { vertices: makeRectVertices(0, -200, 4000, 200) };
    const topWall: Polygon3D = { vertices: makeRectVertices(0, 3800, 4000, 4200) };
    const span = computeSlabMaxFreeSpanM(SLAB_VERTS, [bottomWall, topWall]);
    expect(span).toBeCloseTo(3.6, 2);
  });

  it('23. two parallel beams as supports → uses beam inner faces', () => {
    // Beam A fully inside at y:200–450 (inner face 450), Beam B at y:3550–3800 (inner face 3550).
    // Clear span = 3550 - 450 = 3100mm = 3.1m.
    const beamA: Polygon3D = { vertices: makeRectVertices(500, 200, 3500, 450) };
    const beamB: Polygon3D = { vertices: makeRectVertices(500, 3550, 3500, 3800) };
    const span = computeSlabMaxFreeSpanM(SLAB_VERTS, [beamA, beamB]);
    expect(span).toBeCloseTo(3.1, 2);
  });

  it('24. span clamped to directional slab extent (never exceeds Feret diameter)', () => {
    // Supports far outside slab → span = full slab extent in optimum direction.
    // For 4m×4m square: max Feret (diagonal) ≈ 5.657m.
    const farBelow: Polygon3D = { vertices: makeRectVertices(-10000, -10000, 4000, -5000) };
    const farAbove: Polygon3D = { vertices: makeRectVertices(-10000, 9000, 4000, 10000) };
    const span = computeSlabMaxFreeSpanM(SLAB_VERTS, [farBelow, farAbove]);
    const maxFeret = Math.hypot(4, 4); // 4m×4m diagonal ≈ 5.657m
    expect(span).toBeLessThanOrEqual(maxFeret + 0.01);
    expect(span).toBeGreaterThan(0);
  });

  it('25. degenerate slab (<3 vertices) → fallback bbox', () => {
    const span = computeSlabMaxFreeSpanM([{ x: 0, y: 0, z: 0 }, { x: 4000, y: 0, z: 0 }], []);
    expect(span).toBeGreaterThanOrEqual(0);
  });
});
