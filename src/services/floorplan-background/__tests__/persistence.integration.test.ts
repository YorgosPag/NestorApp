/**
 * =============================================================================
 * Persistence Integration Tests — Floorplan Background System (ADR-340 Phase 7)
 * =============================================================================
 *
 * Phase 7 ships pure-math + service-shape tests. The full Firestore-emulator
 * integration suite is staged in Phase 8 (visual + emulator) — these tests
 * cover the deterministic, math-heavy parts that don't need an emulator.
 *
 * Covered here:
 *   - Calibration remap math: vertex_new = inverse(T_new) ∘ T_old(vertex_old)
 *     Round-trip property: world position invariant under transform change.
 *   - Calibration remap math: identity transform → polygon unchanged.
 *   - Calibration remap math: pure scale → vertex coordinates inversely scaled
 *     (so world position is preserved).
 *
 * NOT covered here (Phase 8):
 *   - Firestore emulator round-trip (create + listByFloor + patch + delete)
 *   - Cascade delete with seeded overlays + dxf_viewer_levels
 *   - Cloud Function ref-count cleanup
 *
 * @module services/floorplan-background/__tests__/persistence.integration.test
 * @enterprise ADR-340 Phase 7
 */

import { __test__ as remap } from '../calibration-remap.service';
import type { BackgroundTransform, Point2D } from '@/subapps/dxf-viewer/floorplan-background/providers/types';

const IDENTITY: BackgroundTransform = {
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

function approxEqual(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps;
}

function pointsApproxEqual(a: Point2D, b: Point2D, eps = 1e-9): boolean {
  return approxEqual(a.x, b.x, eps) && approxEqual(a.y, b.y, eps);
}

describe('CalibrationRemapService.__test__ — affine math', () => {
  describe('applyTransform / applyInverseTransform — round-trip', () => {
    it('identity transform leaves a vertex unchanged', () => {
      const v: Point2D = { x: 100, y: 50 };
      expect(pointsApproxEqual(remap.applyTransform(v, IDENTITY), v)).toBe(true);
    });

    it('apply then inverse returns the original vertex (translate)', () => {
      const t: BackgroundTransform = { ...IDENTITY, translateX: 30, translateY: -15 };
      const v: Point2D = { x: 7, y: 11 };
      const round = remap.applyInverseTransform(remap.applyTransform(v, t), t);
      expect(pointsApproxEqual(round, v)).toBe(true);
    });

    it('apply then inverse returns the original vertex (scale + rotation + translate)', () => {
      const t: BackgroundTransform = {
        translateX: 100,
        translateY: -50,
        scaleX: 2,
        scaleY: 1.5,
        rotation: 33,
      };
      const v: Point2D = { x: 12.5, y: -8.25 };
      const round = remap.applyInverseTransform(remap.applyTransform(v, t), t);
      expect(pointsApproxEqual(round, v, 1e-6)).toBe(true);
    });
  });

  describe('remapVertex — preserves world-space position', () => {
    it('identity → identity: vertex unchanged', () => {
      const v: Point2D = { x: 5, y: 5 };
      expect(pointsApproxEqual(remap.remapVertex(v, IDENTITY, IDENTITY), v)).toBe(true);
    });

    it('pure scale change: vertex inversely scaled so world stays fixed', () => {
      const oldT: BackgroundTransform = { ...IDENTITY };
      const newT: BackgroundTransform = { ...IDENTITY, scaleX: 2, scaleY: 2 };
      const v: Point2D = { x: 10, y: 20 };
      // World position before: (10, 20). After remap, vertex must satisfy
      //   newT(remapped) === oldT(v) === (10, 20)
      //   newT scales by 2 → remapped = (5, 10)
      const remapped = remap.remapVertex(v, oldT, newT);
      expect(pointsApproxEqual(remapped, { x: 5, y: 10 })).toBe(true);
      // Verify world invariance.
      const worldBefore = remap.applyTransform(v, oldT);
      const worldAfter = remap.applyTransform(remapped, newT);
      expect(pointsApproxEqual(worldBefore, worldAfter)).toBe(true);
    });

    it('translate-only change: vertex shifts by inverse of new translation', () => {
      const oldT: BackgroundTransform = { ...IDENTITY };
      const newT: BackgroundTransform = { ...IDENTITY, translateX: 10, translateY: -5 };
      const v: Point2D = { x: 0, y: 0 };
      const remapped = remap.remapVertex(v, oldT, newT);
      // World before = (0, 0). After remap, newT(remapped) must equal (0, 0).
      // remapped + (10, -5) === (0, 0) → remapped = (-10, 5)
      expect(pointsApproxEqual(remapped, { x: -10, y: 5 })).toBe(true);
    });

    it('rotation change preserves world distance from the post-rotation center', () => {
      const oldT: BackgroundTransform = { ...IDENTITY };
      const newT: BackgroundTransform = { ...IDENTITY, rotation: 90 };
      const v: Point2D = { x: 1, y: 0 };
      const remapped = remap.remapVertex(v, oldT, newT);
      // World before = (1, 0). After remap, newT(remapped) should equal (1, 0).
      // newT rotates 90° CCW → applying to (0, 1) gives (-1, 0)… so we need (0, -1)? No:
      //   rotate(remapped, 90°) = (-r.y, r.x). We want (1, 0) → r = (0, -1)? No:
      //   if remapped = (0, -1), then 90° CCW gives (-(-1), 0) = (1, 0). ✓
      expect(pointsApproxEqual(remapped, { x: 0, y: -1 }, 1e-9)).toBe(true);
    });
  });

  describe('remapPolygon — applies remapVertex over an array', () => {
    it('handles empty polygon', () => {
      expect(remap.remapPolygon([], IDENTITY, IDENTITY)).toEqual([]);
    });

    it('preserves world position of every vertex when transform changes', () => {
      const oldT: BackgroundTransform = {
        translateX: 0,
        translateY: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      };
      const newT: BackgroundTransform = {
        translateX: 100,
        translateY: 200,
        scaleX: 2,
        scaleY: 3,
        rotation: 45,
      };
      const polygon: Point2D[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ];
      const remapped = remap.remapPolygon(polygon, oldT, newT);
      expect(remapped).toHaveLength(polygon.length);
      for (let i = 0; i < polygon.length; i += 1) {
        const worldBefore = remap.applyTransform(polygon[i], oldT);
        const worldAfter = remap.applyTransform(remapped[i], newT);
        expect(pointsApproxEqual(worldBefore, worldAfter, 1e-6)).toBe(true);
      }
    });
  });
});
