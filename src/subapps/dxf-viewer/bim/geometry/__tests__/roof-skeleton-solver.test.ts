/**
 * Roof straight-skeleton solver + integration (ADR-417 Φ2).
 *
 * Επαληθεύει: (1) κοίλο hip footprint (Γ/Τ) λύνεται μέσω skeleton με σωστό
 * διαμέρισμα (Σ projectedArea = footprint) + λούκι (valley) στην εσωτερική γωνία·
 * (2) parity — κυρτό footprint μένει αμετάβλητο (lower-envelope, μηδέν regression).
 */

import { computeRoofGeometry } from '../roof-geometry';
import { solveRoofByStraightSkeleton } from '../roof-skeleton-solver';
import { resolveEavePlanes } from '../roof-lower-envelope';
import type { Point3D } from '../../types/bim-base';
import type { RoofEdgeSlope, RoofParams } from '../../types/roof-types';

const hipEdges = (n: number, slopeDeg = 30): RoofEdgeSlope[] =>
  Array.from({ length: n }, () => ({ definesSlope: true, slope: slopeDeg, overhangMm: 0 }));

const roofParams = (verts: readonly Point3D[], slopeDeg = 30): RoofParams => ({
  outline: { vertices: verts },
  edges: hipEdges(verts.length, slopeDeg),
  slopeUnit: 'deg',
  basePivotZ: 3000,
  thickness: 200,
  sceneUnits: 'mm',
});

// canvas units (mm domain): L-shape footprint, 1 reflex corner.
const L_SHAPE: Point3D[] = [
  { x: 0, y: 0, z: 0 }, { x: 4000, y: 0, z: 0 }, { x: 4000, y: 2000, z: 0 },
  { x: 2000, y: 2000, z: 0 }, { x: 2000, y: 4000, z: 0 }, { x: 0, y: 4000, z: 0 },
];

describe('solveRoofByStraightSkeleton — concave hip', () => {
  it('L-shape: faces partition footprint (Σ projectedArea ≈ footprint area)', () => {
    const s = 1; // mm → canvas 1:1
    const canvasToM = 1 / 1000;
    const { planes, slopeEdgeIndices } = resolveEavePlanes(L_SHAPE, hipEdges(6), 'deg');
    const res = solveRoofByStraightSkeleton(
      L_SHAPE.map((v) => ({ x: v.x, y: v.y })), planes, slopeEdgeIndices, 3000, s, canvasToM,
    );
    expect(res).not.toBeNull();
    expect(res!.faces).toHaveLength(6);
    // Footprint = 4000×4000 − 2000×2000 = 12e6 mm² = 12 m².
    const totalProjected = res!.faces.reduce((sum, f) => sum + f.projectedAreaM2, 0);
    expect(totalProjected).toBeCloseTo(12, 2);
  });

  it('L-shape: produces a valley ridge at the reflex corner', () => {
    const { planes, slopeEdgeIndices } = resolveEavePlanes(L_SHAPE, hipEdges(6), 'deg');
    const res = solveRoofByStraightSkeleton(
      L_SHAPE.map((v) => ({ x: v.x, y: v.y })), planes, slopeEdgeIndices, 3000, 1, 1 / 1000,
    );
    const valleys = res!.ridges.filter((r) => r.kind === 'valley');
    expect(valleys.length).toBeGreaterThanOrEqual(1);
  });

  it('returns null when not all edges define slope (gable end → fallback)', () => {
    const mixed: RoofEdgeSlope[] = hipEdges(6);
    mixed[0] = { definesSlope: false, slope: 0, overhangMm: 0 };
    const { planes, slopeEdgeIndices } = resolveEavePlanes(L_SHAPE, mixed, 'deg');
    const res = solveRoofByStraightSkeleton(
      L_SHAPE.map((v) => ({ x: v.x, y: v.y })), planes, slopeEdgeIndices, 3000, 1, 1 / 1000,
    );
    expect(res).toBeNull();
  });
});

describe('computeRoofGeometry — Φ2 integration', () => {
  it('concave L-shape hip → shape "complex", 6 faces, valley present', () => {
    const geo = computeRoofGeometry(roofParams(L_SHAPE));
    expect(geo.shape).toBe('complex');
    expect(geo.faces).toHaveLength(6);
    expect(geo.ridges.some((r) => r.kind === 'valley')).toBe(true);
    // projectedArea = footprint = 12 m².
    expect(geo.projectedAreaM2).toBeCloseTo(12, 1);
    const sumProjected = geo.faces.reduce((s, f) => s + f.projectedAreaM2, 0);
    expect(sumProjected).toBeCloseTo(12, 1);
  });

  it('parity: convex rectangle hip unchanged (lower-envelope, 4 faces, no valley)', () => {
    const rect: Point3D[] = [
      { x: 0, y: 0, z: 0 }, { x: 6000, y: 0, z: 0 },
      { x: 6000, y: 4000, z: 0 }, { x: 0, y: 4000, z: 0 },
    ];
    const geo = computeRoofGeometry(roofParams(rect));
    expect(geo.shape).toBe('hip');
    expect(geo.faces).toHaveLength(4);
    expect(geo.ridges.some((r) => r.kind === 'valley')).toBe(false);
    expect(geo.projectedAreaM2).toBeCloseTo(24, 1);
  });
});
