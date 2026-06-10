/**
 * Tests — Foundation Factory (ADR-436, Slice 0).
 *
 * Mirror του column.factory.test.ts. Coverage:
 *   - Enterprise ID prefix (fnd_) + uniqueness + override
 *   - IfcEntityMixin auto-fill (ifcGuid 22-char, ifcType='IfcFooting')
 *   - predefinedType ντετερμινιστικά από kind (FOUNDATION_IFC_MAP)
 *   - Zod schema accept (factory output)
 *   - Tenant pass-through
 */

import { createFoundation } from '../foundation.factory';
import { FoundationEntitySchema } from '@/subapps/dxf-viewer/bim/types/foundation.schemas';
import { IFC_GUID_REGEX } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';
import {
  buildDefaultFoundationParams,
  FOUNDATION_IFC_MAP,
  type FoundationGeometry,
  type FoundationKind,
} from '@/subapps/dxf-viewer/bim/types/foundation-types';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockGeometry: FoundationGeometry = {
  footprint: {
    vertices: [
      { x: -750, y: -750 },
      { x: 750, y: -750 },
      { x: 750, y: 750 },
      { x: -750, y: 750 },
    ],
  },
  bbox: { min: { x: -750, y: -750 }, max: { x: 750, y: 750 } },
  area: 2.25,
  volume: 1.125,
  thickness: 500,
};

const baseInput = {
  params: buildDefaultFoundationParams('pad'),
  geometry: mockGeometry,
  layerId: 'lyr_test',
};

const ALL_KINDS: readonly FoundationKind[] = ['pad', 'strip', 'tie-beam'];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createFoundation', () => {
  describe('enterprise ID', () => {
    it('id starts με "fnd_" prefix', () => {
      expect(createFoundation(baseInput).id).toMatch(/^fnd_/);
    });

    it('100 calls produce unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) ids.add(createFoundation(baseInput).id);
      expect(ids.size).toBe(100);
    });

    it('id override preserved', () => {
      expect(createFoundation({ ...baseInput, id: 'fnd_override' }).id).toBe('fnd_override');
    });
  });

  describe('IfcEntityMixin', () => {
    it('ifcGuid matches IFC_GUID_REGEX (22 chars)', () => {
      const f = createFoundation(baseInput);
      expect(f.ifcGuid).toMatch(IFC_GUID_REGEX);
      expect(f.ifcGuid).toHaveLength(22);
    });

    it('100 calls produce unique ifcGuids', () => {
      const guids = new Set<string>();
      for (let i = 0; i < 100; i++) guids.add(createFoundation(baseInput).ifcGuid);
      expect(guids.size).toBe(100);
    });

    it("ifcType='IfcFooting' πάντα (όλα kinds)", () => {
      for (const kind of ALL_KINDS) {
        const f = createFoundation({ ...baseInput, params: buildDefaultFoundationParams(kind) });
        expect(f.ifcType).toBe('IfcFooting');
        expect(f.kind).toBe(kind);
      }
    });
  });

  describe('predefinedType (SSoT FOUNDATION_IFC_MAP)', () => {
    it.each(ALL_KINDS)('kind=%s → correct predefinedType', (kind) => {
      const f = createFoundation({ ...baseInput, params: buildDefaultFoundationParams(kind) });
      expect(f.predefinedType).toBe(FOUNDATION_IFC_MAP[kind]);
    });

    it('pad→PAD_FOOTING, strip→STRIP_FOOTING, tie-beam→FOOTING_BEAM', () => {
      expect(createFoundation({ ...baseInput, params: buildDefaultFoundationParams('pad') }).predefinedType).toBe('PAD_FOOTING');
      expect(createFoundation({ ...baseInput, params: buildDefaultFoundationParams('strip') }).predefinedType).toBe('STRIP_FOOTING');
      expect(createFoundation({ ...baseInput, params: buildDefaultFoundationParams('tie-beam') }).predefinedType).toBe('FOOTING_BEAM');
    });
  });

  describe('entity shape', () => {
    it("type='foundation' literal", () => {
      expect(createFoundation(baseInput).type).toBe('foundation');
    });

    it('validation default = empty BimValidation', () => {
      const f = createFoundation(baseInput);
      expect(f.validation.hasCodeViolations).toBe(false);
      expect(f.validation.violationKeys).toEqual([]);
      expect(f.validation.lastValidatedAt).toBeNull();
    });

    it('pset propagated when provided', () => {
      const f = createFoundation({ ...baseInput, pset: { loadBearing: true } });
      expect(f.pset).toEqual({ loadBearing: true });
    });
  });

  describe('tenant fields pass-through', () => {
    it('companyId / projectId / buildingId propagate', () => {
      const f = createFoundation({
        ...baseInput,
        companyId: 'co_x',
        projectId: 'proj_x',
        buildingId: 'bldg_x',
      });
      expect(f.companyId).toBe('co_x');
      expect(f.projectId).toBe('proj_x');
      expect(f.buildingId).toBe('bldg_x');
    });
  });

  describe('Zod schema (factory output)', () => {
    it.each(ALL_KINDS)('FoundationEntitySchema accepts kind=%s', (kind) => {
      const f = createFoundation({ ...baseInput, params: buildDefaultFoundationParams(kind) });
      expect(() => FoundationEntitySchema.parse(f)).not.toThrow();
    });

    it('rejects entity με invalid ifcGuid', () => {
      const f = createFoundation(baseInput);
      expect(() => FoundationEntitySchema.parse({ ...f, ifcGuid: 'TOO_SHORT' })).toThrow();
    });

    it("rejects entity με ifcType ≠ 'IfcFooting'", () => {
      const f = createFoundation(baseInput);
      expect(() => FoundationEntitySchema.parse({ ...f, ifcType: 'IfcSlab' })).toThrow();
    });
  });
});
