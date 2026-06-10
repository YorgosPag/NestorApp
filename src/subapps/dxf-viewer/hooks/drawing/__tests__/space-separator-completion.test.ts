/**
 * ADR-437 — Space separator completion builders + geometry tests.
 */

import {
  buildDefaultSpaceSeparatorParams,
  buildSpaceSeparatorEntity,
  completeSpaceSeparatorFromTwoClicks,
} from '../space-separator-completion';
import {
  computeSpaceSeparatorGeometry,
  isValidSpaceSeparatorLength,
} from '../../../bim/types/space-separator-types';

describe('space-separator-completion', () => {
  const A = { x: 0, y: 0 };
  const B = { x: 3000, y: 4000 }; // length 5000mm = 5m

  describe('buildDefaultSpaceSeparatorParams', () => {
    it('stores start/end as Point3D from the two clicks', () => {
      const params = buildDefaultSpaceSeparatorParams(A, B);
      expect(params.start).toEqual({ x: 0, y: 0 });
      expect(params.end).toEqual({ x: 3000, y: 4000 });
      expect(params.sceneUnits).toBe('mm');
    });

    it('passes through optional name override', () => {
      const params = buildDefaultSpaceSeparatorParams(A, B, { name: 'Διαχωριστής 1' });
      expect(params.name).toBe('Διαχωριστής 1');
    });

    it('omits name when not provided (no undefined key for Firestore)', () => {
      const params = buildDefaultSpaceSeparatorParams(A, B);
      expect('name' in params).toBe(false);
    });
  });

  describe('computeSpaceSeparatorGeometry', () => {
    it('derives length in metres + bbox spanning both endpoints', () => {
      const geom = computeSpaceSeparatorGeometry({ start: A, end: B, sceneUnits: 'mm' });
      expect(geom.length).toBeCloseTo(5, 6);
      expect(geom.bbox.min).toEqual({ x: 0, y: 0, z: 0 });
      expect(geom.bbox.max.x).toBe(3000);
      expect(geom.bbox.max.y).toBe(4000);
    });
  });

  describe('isValidSpaceSeparatorLength', () => {
    it('accepts a non-degenerate segment', () => {
      expect(isValidSpaceSeparatorLength({ start: A, end: B })).toBe(true);
    });
    it('rejects a degenerate (zero-length) segment', () => {
      expect(isValidSpaceSeparatorLength({ start: A, end: { x: 0, y: 0 } })).toBe(false);
    });
  });

  describe('buildSpaceSeparatorEntity', () => {
    it('builds a valid IfcVirtualElement entity', () => {
      const params = buildDefaultSpaceSeparatorParams(A, B);
      const result = buildSpaceSeparatorEntity(params, 'lyr_x');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.entity.type).toBe('space-separator');
        expect(result.entity.ifcType).toBe('IfcVirtualElement');
        expect(result.entity.kind).toBe('room-bounding');
        expect(result.entity.geometry.length).toBeCloseTo(5, 6);
      }
    });

    it('rejects a degenerate segment', () => {
      const params = buildDefaultSpaceSeparatorParams(A, { x: 0, y: 0 });
      const result = buildSpaceSeparatorEntity(params, 'lyr_x');
      expect(result.ok).toBe(false);
    });
  });

  describe('completeSpaceSeparatorFromTwoClicks', () => {
    it('produces an entity end-to-end', () => {
      const result = completeSpaceSeparatorFromTwoClicks(A, B, 'lyr_x');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.entity.params.end).toEqual({ x: 3000, y: 4000 });
    });
  });
});
