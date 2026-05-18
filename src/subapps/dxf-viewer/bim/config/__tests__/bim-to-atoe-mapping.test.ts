/**
 * Tests for BIM → ATOE mapping resolver (ADR-363 Phase 6)
 */

import { resolveAtoeMapping, BIM_TO_ATOE_MAPPING } from '../bim-to-atoe-mapping';

describe('resolveAtoeMapping', () => {
  describe('wall', () => {
    it('maps exterior wall to OIK-3.05 m2', () => {
      const result = resolveAtoeMapping('wall', 'straight', 'exterior');
      expect(result).not.toBeNull();
      expect(result!.categoryCode).toBe('OIK-3.05');
      expect(result!.unit).toBe('m2');
    });

    it('maps interior wall to OIK-3.06 m2', () => {
      const result = resolveAtoeMapping('wall', 'curved', 'interior');
      expect(result!.categoryCode).toBe('OIK-3.06');
      expect(result!.unit).toBe('m2');
    });

    it('returns null when category missing for wall', () => {
      const result = resolveAtoeMapping('wall', 'straight');
      expect(result).toBeNull();
    });

    it('maps partition to OIK-3.06', () => {
      const result = resolveAtoeMapping('wall', 'polyline', 'partition');
      expect(result!.categoryCode).toBe('OIK-3.06');
    });
  });

  describe('opening', () => {
    it('maps door to OIK-5.01 pcs', () => {
      const result = resolveAtoeMapping('opening', 'door');
      expect(result!.categoryCode).toBe('OIK-5.01');
      expect(result!.unit).toBe('pcs');
    });

    it('maps window to OIK-5.02 pcs', () => {
      const result = resolveAtoeMapping('opening', 'window');
      expect(result!.categoryCode).toBe('OIK-5.02');
      expect(result!.unit).toBe('pcs');
    });

    it('maps sliding-door to OIK-5.02', () => {
      const result = resolveAtoeMapping('opening', 'sliding-door');
      expect(result!.categoryCode).toBe('OIK-5.02');
    });
  });

  describe('slab', () => {
    it('maps floor slab to OIK-2.01 m3', () => {
      const result = resolveAtoeMapping('slab', 'floor');
      expect(result!.categoryCode).toBe('OIK-2.01');
      expect(result!.unit).toBe('m3');
    });

    it('maps foundation slab to OIK-2.02 m3', () => {
      const result = resolveAtoeMapping('slab', 'foundation');
      expect(result!.categoryCode).toBe('OIK-2.02');
    });
  });

  describe('column', () => {
    it('maps rectangular column to OIK-2.03 m3', () => {
      const result = resolveAtoeMapping('column', 'rectangular');
      expect(result!.categoryCode).toBe('OIK-2.03');
      expect(result!.unit).toBe('m3');
    });

    it('maps circular column to OIK-2.03 m3', () => {
      const result = resolveAtoeMapping('column', 'circular');
      expect(result!.categoryCode).toBe('OIK-2.03');
    });
  });

  describe('beam', () => {
    it('maps straight beam to OIK-2.04 m3', () => {
      const result = resolveAtoeMapping('beam', 'straight');
      expect(result!.categoryCode).toBe('OIK-2.04');
      expect(result!.unit).toBe('m3');
    });

    it('maps cantilever to OIK-2.04', () => {
      const result = resolveAtoeMapping('beam', 'cantilever');
      expect(result!.categoryCode).toBe('OIK-2.04');
    });
  });

  describe('unknown values', () => {
    it('returns null for unknown opening kind', () => {
      const result = resolveAtoeMapping('opening', 'skylight');
      expect(result).toBeNull();
    });

    it('returns null for unknown slab kind', () => {
      const result = resolveAtoeMapping('slab', 'bridge');
      expect(result).toBeNull();
    });
  });

  describe('BIM_TO_ATOE_MAPPING coverage', () => {
    it('all mapping tables are exported and non-empty', () => {
      expect(Object.keys(BIM_TO_ATOE_MAPPING.wall).length).toBeGreaterThan(0);
      expect(Object.keys(BIM_TO_ATOE_MAPPING.opening).length).toBeGreaterThan(0);
      expect(Object.keys(BIM_TO_ATOE_MAPPING.slab).length).toBeGreaterThan(0);
      expect(Object.keys(BIM_TO_ATOE_MAPPING.column).length).toBeGreaterThan(0);
      expect(Object.keys(BIM_TO_ATOE_MAPPING.beam).length).toBeGreaterThan(0);
    });

    it('all categoryCode values use Latin OIK- prefix', () => {
      const allEntries = [
        ...Object.values(BIM_TO_ATOE_MAPPING.wall),
        ...Object.values(BIM_TO_ATOE_MAPPING.opening),
        ...Object.values(BIM_TO_ATOE_MAPPING.slab),
        ...Object.values(BIM_TO_ATOE_MAPPING.column),
        ...Object.values(BIM_TO_ATOE_MAPPING.beam),
      ];
      for (const entry of allEntries) {
        expect(entry.categoryCode).toMatch(/^OIK-/);
      }
    });
  });
});
