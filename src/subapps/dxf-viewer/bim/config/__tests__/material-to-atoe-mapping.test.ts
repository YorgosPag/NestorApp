/**
 * Tests για material-to-atoe-mapping SSoT (ADR-363 Phase 6.2)
 */

import {
  resolveMaterialAtoeMapping,
  MATERIAL_TO_ATOE_MAPPING,
} from '../material-to-atoe-mapping';

describe('resolveMaterialAtoeMapping', () => {
  describe('concrete (volume quantityKind)', () => {
    it('maps mat-concrete-c25 → OIK-2.03 m3 volume', () => {
      const result = resolveMaterialAtoeMapping('mat-concrete-c25');
      expect(result).not.toBeNull();
      expect(result!.categoryCode).toBe('OIK-2.03');
      expect(result!.unit).toBe('m3');
      expect(result!.quantityKind).toBe('volume');
    });

    it('maps mat-concrete-c20 + mat-concrete-c30 to same OIK-2.03', () => {
      expect(resolveMaterialAtoeMapping('mat-concrete-c20')!.categoryCode).toBe('OIK-2.03');
      expect(resolveMaterialAtoeMapping('mat-concrete-c30')!.categoryCode).toBe('OIK-2.03');
    });
  });

  describe('masonry', () => {
    it('maps mat-brick-masonry → OIK-3.01 m2 area', () => {
      const result = resolveMaterialAtoeMapping('mat-brick-masonry');
      expect(result!.categoryCode).toBe('OIK-3.01');
      expect(result!.unit).toBe('m2');
      expect(result!.quantityKind).toBe('area');
    });

    it('maps mat-stone-masonry → OIK-3.05 m3 volume', () => {
      const result = resolveMaterialAtoeMapping('mat-stone-masonry');
      expect(result!.unit).toBe('m3');
      expect(result!.quantityKind).toBe('volume');
    });

    it('maps mat-concrete-block → OIK-3.02 m2 area', () => {
      const result = resolveMaterialAtoeMapping('mat-concrete-block');
      expect(result!.categoryCode).toBe('OIK-3.02');
      expect(result!.unit).toBe('m2');
    });
  });

  describe('plaster (area, per-side)', () => {
    it('maps mat-plaster-ext → OIK-4.03 m2 area', () => {
      const result = resolveMaterialAtoeMapping('mat-plaster-ext');
      expect(result!.categoryCode).toBe('OIK-4.03');
      expect(result!.unit).toBe('m2');
      expect(result!.quantityKind).toBe('area');
    });

    it('maps mat-plaster-int → OIK-4.01', () => {
      expect(resolveMaterialAtoeMapping('mat-plaster-int')!.categoryCode).toBe('OIK-4.01');
    });

    it('maps mat-plaster-thermal → OIK-4.10', () => {
      expect(resolveMaterialAtoeMapping('mat-plaster-thermal')!.categoryCode).toBe('OIK-4.10');
    });
  });

  describe('cladding/finish (area)', () => {
    it('maps mat-gypsum-board → OIK-7.05 m2 area', () => {
      const result = resolveMaterialAtoeMapping('mat-gypsum-board');
      expect(result!.categoryCode).toBe('OIK-7.05');
      expect(result!.quantityKind).toBe('area');
    });

    it('maps mat-tile + mat-marble → OIK-7.x', () => {
      expect(resolveMaterialAtoeMapping('mat-tile')!.categoryCode).toBe('OIK-7.20');
      expect(resolveMaterialAtoeMapping('mat-marble')!.categoryCode).toBe('OIK-7.30');
    });

    it('maps mat-aluminum-cladding → OIK-12.10', () => {
      expect(resolveMaterialAtoeMapping('mat-aluminum-cladding')!.categoryCode).toBe('OIK-12.10');
    });
  });

  describe('insulation/waterproofing (area)', () => {
    it('maps mat-eps + mat-xps → OIK-10.05', () => {
      expect(resolveMaterialAtoeMapping('mat-eps')!.categoryCode).toBe('OIK-10.05');
      expect(resolveMaterialAtoeMapping('mat-xps')!.categoryCode).toBe('OIK-10.05');
    });

    it('maps mat-mineral-wool → OIK-10.06', () => {
      expect(resolveMaterialAtoeMapping('mat-mineral-wool')!.categoryCode).toBe('OIK-10.06');
    });

    it('maps mat-vapor-barrier → OIK-10.10', () => {
      expect(resolveMaterialAtoeMapping('mat-vapor-barrier')!.categoryCode).toBe('OIK-10.10');
    });
  });

  describe('unknown / fallback', () => {
    it('returns null για unknown materialId (custom user input)', () => {
      expect(resolveMaterialAtoeMapping('mat-unicorn-fluff')).toBeNull();
    });

    it('returns null για undefined', () => {
      expect(resolveMaterialAtoeMapping(undefined)).toBeNull();
    });

    it('returns null για empty string', () => {
      expect(resolveMaterialAtoeMapping('')).toBeNull();
    });
  });

  describe('MATERIAL_TO_ATOE_MAPPING coverage', () => {
    it('exports a non-empty map', () => {
      expect(Object.keys(MATERIAL_TO_ATOE_MAPPING).length).toBeGreaterThanOrEqual(18);
    });

    it('all entries use Latin OIK- prefix categoryCode', () => {
      for (const entry of Object.values(MATERIAL_TO_ATOE_MAPPING)) {
        expect(entry.categoryCode).toMatch(/^OIK-/);
      }
    });

    it('all entries have valid unit (m2 or m3)', () => {
      for (const entry of Object.values(MATERIAL_TO_ATOE_MAPPING)) {
        expect(['m2', 'm3']).toContain(entry.unit);
      }
    });

    it('quantityKind matches unit (m3→volume, m2→area)', () => {
      for (const entry of Object.values(MATERIAL_TO_ATOE_MAPPING)) {
        if (entry.unit === 'm3') expect(entry.quantityKind).toBe('volume');
        if (entry.unit === 'm2') expect(entry.quantityKind).toBe('area');
      }
    });

    it('materialId field matches key', () => {
      for (const [key, entry] of Object.entries(MATERIAL_TO_ATOE_MAPPING)) {
        expect(entry.materialId).toBe(key);
      }
    });

    it('all titleEL include "(BIM layer)" suffix', () => {
      for (const entry of Object.values(MATERIAL_TO_ATOE_MAPPING)) {
        expect(entry.titleEL).toMatch(/\(BIM layer\)$/);
      }
    });
  });
});
