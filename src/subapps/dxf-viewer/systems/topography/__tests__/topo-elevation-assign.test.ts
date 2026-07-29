/**
 * ADR-731 — Elevation assignment from surface: pure logic tests.
 * Mutation coverage: 4/4 (isElevationAssignable, planElevationAssignment, applyElevationAssignment, clearDerivedElevations).
 */

import { describe, it, expect } from '@jest/globals';
import type { TopoPoint, TinSurface } from '../topo-types';
import {
  isElevationAssignable,
  planElevationAssignment,
  applyElevationAssignment,
  clearDerivedElevations,
} from '../topo-elevation-assign';

describe('topo-elevation-assign', () => {
  // Simple TIN: one triangle at z=1000 mm, corners at (0,0), (100,0), (50,100). LOCAL frame,
  // origin at world (0,0) — positions/bounds are therefore identical to world here.
  const simpleTin: TinSurface = {
    positions: [[0, 0], [100, 0], [50, 100]],
    elevations: [1000, 1000, 1000],
    triangles: [[0, 1, 2]],
    origin: { x: 0, y: 0 },
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100, minZ: 1000, maxZ: 1000 },
    flatTriangleCount: 0,
  };

  describe('isElevationAssignable', () => {
    it('should return true for 2D points (no z)', () => {
      const point: TopoPoint = { x: 50, y: 50 };
      expect(isElevationAssignable(point)).toBe(true);
    });

    it('should return true for derived elevations (zSource: "derived")', () => {
      const point: TopoPoint = { x: 50, y: 50, z: 900, zSource: 'derived' };
      expect(isElevationAssignable(point)).toBe(true);
    });

    it('should return false for measured elevations (zSource undefined)', () => {
      const point: TopoPoint = { x: 50, y: 50, z: 900 };
      expect(isElevationAssignable(point)).toBe(false);
    });
  });

  describe('planElevationAssignment', () => {
    it('should return empty plan for empty surface', () => {
      const points: TopoPoint[] = [{ x: 50, y: 50 }];
      const emptySurface: TinSurface = {
        positions: [],
        elevations: [],
        triangles: [],
        origin: { x: 0, y: 0 },
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0 },
        flatTriangleCount: 0,
      };
      const plan = planElevationAssignment(points, [0], emptySurface);
      expect(plan.assignments).toHaveLength(0);
      expect(plan.outsideSurfaceCount).toBe(0);
    });

    it('should skip measured elevations entirely', () => {
      const points: TopoPoint[] = [
        { x: 50, y: 50, z: 1234 }, // measured
        { x: 50, y: 50 }, // 2D candidate
      ];
      const plan = planElevationAssignment(points, [0, 1], simpleTin);
      expect(plan.measuredSkippedCount).toBe(1);
      expect(plan.assignments).toHaveLength(1);
      expect(plan.assignments[0]?.pointIndex).toBe(1);
    });

    it('should assign valid 2D points inside the surface', () => {
      const points: TopoPoint[] = [{ x: 50, y: 50 }]; // center of triangle
      const plan = planElevationAssignment(points, [0], simpleTin);
      expect(plan.assignments).toHaveLength(1);
      expect(plan.assignments[0]?.zMm).toBe(1000);
      expect(plan.outsideSurfaceCount).toBe(0);
    });

    it('should report points outside the surface', () => {
      const points: TopoPoint[] = [{ x: 1000, y: 1000 }]; // far outside
      const plan = planElevationAssignment(points, [0], simpleTin);
      expect(plan.assignments).toHaveLength(0);
      expect(plan.outsideSurfaceCount).toBe(1);
    });

    it('should be idempotent when point already has same derived z', () => {
      const points: TopoPoint[] = [{ x: 50, y: 50, z: 1000, zSource: 'derived' }];
      const plan = planElevationAssignment(points, [0], simpleTin);
      expect(plan.assignments).toHaveLength(0); // already correct, skip
    });

    it('should deduplicate and ignore out-of-bounds indices', () => {
      const points: TopoPoint[] = [{ x: 50, y: 50 }];
      const plan = planElevationAssignment(points, [0, 0, 999, -1], simpleTin);
      expect(plan.assignments).toHaveLength(1);
      expect(plan.assignments[0]?.pointIndex).toBe(0);
    });
  });

  describe('applyElevationAssignment', () => {
    it('should return original array on empty assignments (idempotency)', () => {
      const points: TopoPoint[] = [{ x: 50, y: 50 }];
      const result = applyElevationAssignment(points, []);
      expect(result).toBe(points); // same reference
    });

    it('should apply assignments with zSource: "derived"', () => {
      const points: TopoPoint[] = [{ x: 50, y: 50 }, { x: 25, y: 25 }];
      const assignments = [{ pointIndex: 0, zMm: 1234, overBridge: false }];
      const result = applyElevationAssignment(points, assignments);
      expect(result[0]).toEqual({ x: 50, y: 50, z: 1234, zSource: 'derived' });
      expect(result[1]).toBe(points[1]); // unchanged
    });

    it('should overwrite previous derived z with new value', () => {
      const points: TopoPoint[] = [{ x: 50, y: 50, z: 900, zSource: 'derived' }];
      const assignments = [{ pointIndex: 0, zMm: 1100, overBridge: false }];
      const result = applyElevationAssignment(points, assignments);
      expect(result[0]?.z).toBe(1100);
      expect(result[0]?.zSource).toBe('derived');
    });
  });

  describe('clearDerivedElevations', () => {
    it('should return original array if no derived elevations', () => {
      const points: TopoPoint[] = [
        { x: 50, y: 50 }, // 2D
        { x: 60, y: 60, z: 1234 }, // measured
      ];
      const result = clearDerivedElevations(points);
      expect(result).toBe(points); // same reference
    });

    it('should remove z and zSource from derived points', () => {
      const points: TopoPoint[] = [
        { x: 50, y: 50, z: 1200, zSource: 'derived' },
        { x: 60, y: 60, z: 1234 }, // measured, unchanged
      ];
      const result = clearDerivedElevations(points);
      expect(result[0]).toEqual({ x: 50, y: 50 }); // z and zSource removed
      expect(result[1]).toEqual({ x: 60, y: 60, z: 1234 }); // unchanged
    });
  });

  describe('roundtrip: plan → apply → clear', () => {
    it('should produce clean idempotency cycle', () => {
      const points: TopoPoint[] = [{ x: 50, y: 50 }];

      // 1. Plan
      const plan1 = planElevationAssignment(points, [0], simpleTin);
      expect(plan1.assignments).toHaveLength(1);

      // 2. Apply
      const applied = applyElevationAssignment(points, plan1.assignments);
      expect(applied[0]?.zSource).toBe('derived');

      // 3. Plan again (should be idempotent)
      const plan2 = planElevationAssignment(applied, [0], simpleTin);
      expect(plan2.assignments).toHaveLength(0); // no change

      // 4. Clear
      const cleared = clearDerivedElevations(applied);
      expect(cleared).toEqual(points); // back to start
    });
  });
});
