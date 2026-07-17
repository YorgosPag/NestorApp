/**
 * Tests for BIM → ATOE mapping resolver (ADR-363 Phase 6)
 */

import { resolveAtoeMapping, resolveStairComponentMapping, resolveOpeningHardwareMapping, deriveAtoeQuantity, BIM_TO_ATOE_MAPPING } from '../bim-to-atoe-mapping';
import { HARDWARE_COMPONENT_LABEL_KEY } from '../../family-types/opening-hardware-set';
import type { OpeningHardwareComponent } from '../../family-types/opening-hardware-set';

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

    it('maps sliding-door to OIK-5.01 (it is a door, not a window)', () => {
      const result = resolveAtoeMapping('opening', 'sliding-door');
      expect(result!.categoryCode).toBe('OIK-5.01');
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

  describe('railing (ADR-407)', () => {
    it('maps railing to OIK-12.01 running length (m)', () => {
      const result = resolveAtoeMapping('railing', 'railing');
      expect(result).not.toBeNull();
      expect(result!.categoryCode).toBe('OIK-12.01');
      expect(result!.unit).toBe('m');
    });
  });

  describe('stair (ADR-395 Phase 2 / G1)', () => {
    it('resolveAtoeMapping returns null for stair — uses component resolver instead', () => {
      expect(resolveAtoeMapping('stair', 'straight')).toBeNull();
    });

    it('concrete component → OIK-2.05 m3', () => {
      const m = resolveStairComponentMapping('concrete');
      expect(m.categoryCode).toBe('OIK-2.05');
      expect(m.unit).toBe('m3');
    });

    it('cladding component → OIK-5.05 m2', () => {
      const m = resolveStairComponentMapping('cladding');
      expect(m.categoryCode).toBe('OIK-5.05');
      expect(m.unit).toBe('m2');
    });

    it('handrail component → OIK-12.01 m', () => {
      const m = resolveStairComponentMapping('handrail');
      expect(m.categoryCode).toBe('OIK-12.01');
      expect(m.unit).toBe('m');
    });
  });

  // ADR-674 Φ C — opening hardware «σιδερικά» → OIK-5.3x per-piece articles.
  describe('opening hardware component (ADR-674 Φ C)', () => {
    it('lever → OIK-5.31 pcs', () => {
      const m = resolveOpeningHardwareMapping('lever');
      expect(m.categoryCode).toBe('OIK-5.31');
      expect(m.unit).toBe('pcs');
    });

    it('lockset → OIK-5.35 pcs', () => {
      const m = resolveOpeningHardwareMapping('lockset');
      expect(m.categoryCode).toBe('OIK-5.35');
      expect(m.unit).toBe('pcs');
    });

    it('hinge → OIK-5.36 pcs', () => {
      const m = resolveOpeningHardwareMapping('hinge');
      expect(m.categoryCode).toBe('OIK-5.36');
      expect(m.unit).toBe('pcs');
    });

    it('friction-stay → OIK-5.39 pcs', () => {
      const m = resolveOpeningHardwareMapping('friction-stay');
      expect(m.categoryCode).toBe('OIK-5.39');
    });

    it('is total over the Phase A component union — every component maps to OIK-5.3x pcs (unique code)', () => {
      const components = Object.keys(HARDWARE_COMPONENT_LABEL_KEY) as OpeningHardwareComponent[];
      const seen = new Set<string>();
      for (const component of components) {
        const m = resolveOpeningHardwareMapping(component);
        expect(m.unit).toBe('pcs');
        expect(m.categoryCode).toMatch(/^OIK-5\.3\d$/);
        expect(seen.has(m.categoryCode)).toBe(false);
        seen.add(m.categoryCode);
      }
      expect(seen.size).toBe(components.length);
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

  // ADR-395 §4.6 (G5): geometry→quantity SSoT shared by the BOQ bridge + the
  // Schedule combined preset (replaces the removed `qto` field).
  describe('deriveAtoeQuantity (ADR-395 G5)', () => {
    it('pcs → 1 regardless of geometry', () => {
      expect(deriveAtoeQuantity('pcs')).toBe(1);
      expect(deriveAtoeQuantity('pcs', { area: 99, volume: 99 })).toBe(1);
    });

    it('m2 → geometry.area', () => {
      expect(deriveAtoeQuantity('m2', { area: 15 })).toBe(15);
    });

    it('m3 → geometry.volume', () => {
      expect(deriveAtoeQuantity('m3', { volume: 3.75 })).toBe(3.75);
    });

    it('m → geometry.lengthM (ADR-407 — running length, e.g. railings)', () => {
      expect(deriveAtoeQuantity('m', { lengthM: 4.2 })).toBe(4.2);
    });

    it('returns 0 when the matching geometry dimension is missing', () => {
      expect(deriveAtoeQuantity('m2')).toBe(0);
      expect(deriveAtoeQuantity('m3', { area: 15 })).toBe(0);
      expect(deriveAtoeQuantity('m2', null)).toBe(0);
      expect(deriveAtoeQuantity('m', { area: 5 })).toBe(0);
    });

    // ADR-363 Φ2 — kg = volume(m³) × steel density (7850). Fixes the prior
    // 0-quantity gap that affected steel I-shape columns too.
    it('derives kg from volume × steel density (7850)', () => {
      expect(deriveAtoeQuantity('kg', { volume: 0.01 })).toBeCloseTo(78.5, 3);
    });

    it('returns 0 kg for missing geometry', () => {
      expect(deriveAtoeQuantity('kg', null)).toBe(0);
    });
  });

  // ADR-363 Φ2 — steel I-shape beam → OIK-12.10 kg (sectionKind discriminator).
  describe('beam steel I-shape (ADR-363 Φ2)', () => {
    it('maps a straight I-shape beam to OIK-12.10 kg', () => {
      const result = resolveAtoeMapping('beam', 'straight', undefined, 'I-shape');
      expect(result).not.toBeNull();
      expect(result!.categoryCode).toBe('OIK-12.10');
      expect(result!.unit).toBe('kg');
    });

    it('keeps a rectangular beam as RC m3 (no sectionKind)', () => {
      const result = resolveAtoeMapping('beam', 'straight');
      expect(result!.categoryCode).toBe('OIK-2.04');
      expect(result!.unit).toBe('m3');
    });

    it('keeps RC mapping when sectionKind is rectangular', () => {
      const result = resolveAtoeMapping('beam', 'cantilever', undefined, 'rectangular');
      expect(result!.unit).toBe('m3');
    });
  });

  // ADR-408 — Η-Μ (MEP) heating/plumbing/drainage entities → ΗΛΜ article groups.
  describe('MEP / Η-Μ entities (ADR-408)', () => {
    it('panel radiator → ΗΛΜ-7.01 pcs', () => {
      const r = resolveAtoeMapping('mep-radiator', 'panel-radiator');
      expect(r).not.toBeNull();
      expect(r!.categoryCode).toBe('ΗΛΜ-7.01');
      expect(r!.unit).toBe('pcs');
    });

    it('wall boiler → ΗΛΜ-7.02 pcs', () => {
      const r = resolveAtoeMapping('mep-boiler', 'wall-boiler');
      expect(r!.categoryCode).toBe('ΗΛΜ-7.02');
      expect(r!.unit).toBe('pcs');
    });

    it('floor-manifold → ΗΛΜ-7.03 pcs (heating distribution)', () => {
      const r = resolveAtoeMapping('mep-manifold', 'floor-manifold');
      expect(r!.categoryCode).toBe('ΗΛΜ-7.03');
      expect(r!.unit).toBe('pcs');
    });

    it('drainage-collector → ΗΛΜ-6.02 pcs (φρεάτιο)', () => {
      const r = resolveAtoeMapping('mep-manifold', 'drainage-collector');
      expect(r!.categoryCode).toBe('ΗΛΜ-6.02');
      expect(r!.unit).toBe('pcs');
    });

    it('underfloor loop → ΗΛΜ-7.04 m (developed pipe length)', () => {
      const r = resolveAtoeMapping('mep-underfloor', 'hydronic-loop');
      expect(r!.categoryCode).toBe('ΗΛΜ-7.04');
      expect(r!.unit).toBe('m');
    });

    describe('mep-segment (Revit System-based takeoff, per classification)', () => {
      it('duct → ΗΛΜ-8.01 m (HVAC group, no classification)', () => {
        const r = resolveAtoeMapping('mep-segment', 'duct');
        expect(r!.categoryCode).toBe('ΗΛΜ-8.01');
        expect(r!.unit).toBe('m');
      });

      it('pipe hydronic-supply → ΗΛΜ-7.10 m', () => {
        const r = resolveAtoeMapping('mep-segment', 'pipe', undefined, undefined, 'hydronic-supply');
        expect(r!.categoryCode).toBe('ΗΛΜ-7.10');
        expect(r!.unit).toBe('m');
      });

      it('pipe hydronic-return → ΗΛΜ-7.11 m (separate System line)', () => {
        const r = resolveAtoeMapping('mep-segment', 'pipe', undefined, undefined, 'hydronic-return');
        expect(r!.categoryCode).toBe('ΗΛΜ-7.11');
      });

      it('pipe domestic-cold-water → ΗΛΜ-5.01 m', () => {
        const r = resolveAtoeMapping('mep-segment', 'pipe', undefined, undefined, 'domestic-cold-water');
        expect(r!.categoryCode).toBe('ΗΛΜ-5.01');
      });

      it('pipe sanitary-drainage → ΗΛΜ-6.01 m', () => {
        const r = resolveAtoeMapping('mep-segment', 'pipe', undefined, undefined, 'sanitary-drainage');
        expect(r!.categoryCode).toBe('ΗΛΜ-6.01');
      });

      it('pipe without classification → ΗΛΜ-5.00 generic m', () => {
        const r = resolveAtoeMapping('mep-segment', 'pipe');
        expect(r!.categoryCode).toBe('ΗΛΜ-5.00');
        expect(r!.unit).toBe('m');
      });

      it('unknown segment kind → null', () => {
        expect(resolveAtoeMapping('mep-segment', 'cable-tray')).toBeNull();
      });
    });
  });

  describe('BIM_TO_ATOE_MAPPING coverage', () => {
    it('all mapping tables are exported and non-empty', () => {
      expect(Object.keys(BIM_TO_ATOE_MAPPING.wall).length).toBeGreaterThan(0);
      expect(Object.keys(BIM_TO_ATOE_MAPPING.opening).length).toBeGreaterThan(0);
      expect(Object.keys(BIM_TO_ATOE_MAPPING.slab).length).toBeGreaterThan(0);
      expect(Object.keys(BIM_TO_ATOE_MAPPING.column).length).toBeGreaterThan(0);
      expect(Object.keys(BIM_TO_ATOE_MAPPING.beam).length).toBeGreaterThan(0);
      expect(Object.keys(BIM_TO_ATOE_MAPPING.railing).length).toBeGreaterThan(0);
    });

    it('all categoryCode values use Latin OIK- prefix', () => {
      const allEntries = [
        ...Object.values(BIM_TO_ATOE_MAPPING.wall),
        ...Object.values(BIM_TO_ATOE_MAPPING.opening),
        ...Object.values(BIM_TO_ATOE_MAPPING.slab),
        ...Object.values(BIM_TO_ATOE_MAPPING.column),
        ...Object.values(BIM_TO_ATOE_MAPPING.beam),
        ...Object.values(BIM_TO_ATOE_MAPPING.railing),
      ];
      for (const entry of allEntries) {
        expect(entry.categoryCode).toMatch(/^OIK-/);
      }
    });
  });
});
