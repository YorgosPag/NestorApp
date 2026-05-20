/**
 * Tests — Slab Factory (ADR-369 §9 Q7 + Q8) — Phase A4
 *
 * Coverage:
 *   - ADR-369 geometryType default + override
 *   - slope discriminator (tilted requires slope, box forbids slope)
 *   - IfcEntityMixin auto-fill (ifcGuid uniqueness, ifcType='IfcSlab')
 *   - Enterprise ID prefix (slab_)
 *   - Validation throws
 *   - Zod schema accept/reject (SlabParamsSchema + SlabEntitySchema)
 *   - Tenant pass-through
 */

import { createSlab } from '../slab.factory';
import {
  SlabParamsSchema,
  SlabEntitySchema,
} from '@/subapps/dxf-viewer/bim/types/slab.schemas';
import { IFC_GUID_REGEX } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';
import type {
  SlabGeometry,
  SlabKind,
} from '@/subapps/dxf-viewer/bim/types/slab-types';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 5000, y: 0 },
    { x: 5000, y: 4000 },
    { x: 0, y: 4000 },
  ],
};

const mockGeometry: SlabGeometry = {
  polygon: mockOutline,
  bbox: { min: { x: 0, y: 0 }, max: { x: 5000, y: 4000 } },
  area: 20.0,
  netArea: 20.0,
  volume: 4.0,
  perimeter: 18.0,
  maxFreeSpanM: 4.0,
};

const baseParams = {
  kind: 'floor' as SlabKind,
  outline: mockOutline,
  levelElevation: 0,
  thickness: 200,
};

const baseInput = {
  params: baseParams,
  geometry: mockGeometry,
  layerId: 'lyr_test',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createSlab', () => {
  // ─── ADR-369 geometryType default ─────────────────────────────────────────

  describe('ADR-369 geometryType defaults', () => {
    it("geometryType default = 'box'", () => {
      const s = createSlab(baseInput);
      expect(s.params.geometryType).toBe('box');
    });

    it("geometryType='tilted' με slope propagates", () => {
      const s = createSlab({
        ...baseInput,
        params: {
          ...baseParams,
          geometryType: 'tilted',
          slope: { direction: 0, angle: 2 },
        },
      });
      expect(s.params.geometryType).toBe('tilted');
      expect(s.params.slope).toEqual({ direction: 0, angle: 2 });
    });

    it('heightOffsetFromLevel propagates when provided', () => {
      const s = createSlab({
        ...baseInput,
        params: { ...baseParams, heightOffsetFromLevel: -50 },
      });
      expect(s.params.heightOffsetFromLevel).toBe(-50);
    });

    it('slope absent when geometryType=box', () => {
      const s = createSlab(baseInput);
      expect(s.params.slope).toBeUndefined();
    });
  });

  // ─── Validation throws ────────────────────────────────────────────────────

  describe('validation', () => {
    it("throws when geometryType='tilted' χωρίς slope", () => {
      expect(() =>
        createSlab({
          ...baseInput,
          params: { ...baseParams, geometryType: 'tilted' },
        }),
      ).toThrow(/slope/);
    });

    it("throws when geometryType='box' με slope set", () => {
      expect(() =>
        createSlab({
          ...baseInput,
          params: {
            ...baseParams,
            geometryType: 'box',
            slope: { direction: 0, angle: 2 },
          },
        }),
      ).toThrow(/slope/);
    });
  });

  // ─── IfcEntityMixin auto-fill ─────────────────────────────────────────────

  describe('IfcEntityMixin', () => {
    it('ifcGuid matches IFC_GUID_REGEX (22 chars)', () => {
      const s = createSlab(baseInput);
      expect(s.ifcGuid).toMatch(IFC_GUID_REGEX);
      expect(s.ifcGuid).toHaveLength(22);
    });

    it('100 calls produce unique ifcGuids', () => {
      const guids = new Set<string>();
      for (let i = 0; i < 100; i++) guids.add(createSlab(baseInput).ifcGuid);
      expect(guids.size).toBe(100);
    });

    it("ifcType='IfcSlab' πάντα (όλα kinds)", () => {
      const kinds: SlabKind[] = ['floor', 'ceiling', 'roof', 'ground', 'foundation'];
      for (const kind of kinds) {
        const s = createSlab({
          ...baseInput,
          params: { ...baseParams, kind },
        });
        expect(s.ifcType).toBe('IfcSlab');
        expect(s.kind).toBe(kind);
      }
    });

    it('ifcGuid override (test ergonomic) preserved', () => {
      const s = createSlab({ ...baseInput, ifcGuid: '0123456789ABCDEFGHIJKL' });
      expect(s.ifcGuid).toBe('0123456789ABCDEFGHIJKL');
    });

    it('pset propagated when provided', () => {
      const s = createSlab({
        ...baseInput,
        pset: { fireRating: 'F90', isExternal: false },
      });
      expect(s.pset).toEqual({ fireRating: 'F90', isExternal: false });
    });

    it('pset absent when not provided', () => {
      const s = createSlab(baseInput);
      expect(s.pset).toBeUndefined();
    });
  });

  // ─── Enterprise ID ────────────────────────────────────────────────────────

  describe('enterprise ID', () => {
    it('id starts με "slab_" prefix', () => {
      const s = createSlab(baseInput);
      expect(s.id).toMatch(/^slab_/);
    });

    it('100 calls produce unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) ids.add(createSlab(baseInput).id);
      expect(ids.size).toBe(100);
    });

    it('id override preserved', () => {
      const s = createSlab({ ...baseInput, id: 'slab_test_override' });
      expect(s.id).toBe('slab_test_override');
    });
  });

  // ─── Tenant pass-through ──────────────────────────────────────────────────

  describe('tenant fields pass-through', () => {
    it('companyId / projectId / buildingId / floorplanId / floorId propagate', () => {
      const s = createSlab({
        ...baseInput,
        companyId: 'co_x',
        projectId: 'proj_x',
        buildingId: 'bldg_x',
        floorplanId: 'fp_x',
        floorId: 'flr_x',
      });
      expect(s.companyId).toBe('co_x');
      expect(s.projectId).toBe('proj_x');
      expect(s.buildingId).toBe('bldg_x');
      expect(s.floorplanId).toBe('fp_x');
      expect(s.floorId).toBe('flr_x');
    });

    it('tenant fields absent when not provided', () => {
      const s = createSlab(baseInput);
      expect(s.companyId).toBeUndefined();
      expect(s.projectId).toBeUndefined();
    });
  });

  // ─── Entity shape ─────────────────────────────────────────────────────────

  describe('entity shape', () => {
    it("type='slab' literal", () => {
      const s = createSlab(baseInput);
      expect(s.type).toBe('slab');
    });

    it('validation default = empty BimValidation', () => {
      const s = createSlab(baseInput);
      expect(s.validation.hasCodeViolations).toBe(false);
      expect(s.validation.violationKeys).toEqual([]);
      expect(s.validation.lastValidatedAt).toBeNull();
    });

    it('visible propagates when provided', () => {
      const s = createSlab({ ...baseInput, visible: true });
      expect(s.visible).toBe(true);
    });
  });
});

// ─── Zod schema tests ──────────────────────────────────────────────────────

describe('SlabParamsSchema (Zod)', () => {
  it('accepts factory output με defaults', () => {
    const s = createSlab(baseInput);
    expect(() => SlabParamsSchema.parse(s.params)).not.toThrow();
  });

  it("accepts geometryType='tilted' με slope", () => {
    const s = createSlab({
      ...baseInput,
      params: {
        ...baseParams,
        geometryType: 'tilted',
        slope: { direction: 90, angle: 2.5 },
      },
    });
    expect(() => SlabParamsSchema.parse(s.params)).not.toThrow();
  });

  it("rejects geometryType='tilted' χωρίς slope", () => {
    const invalid = {
      ...baseParams,
      geometryType: 'tilted' as const,
    };
    expect(() => SlabParamsSchema.parse(invalid)).toThrow();
  });

  it("rejects slope όταν geometryType='box'", () => {
    const invalid = {
      ...baseParams,
      geometryType: 'box' as const,
      slope: { direction: 0, angle: 2 },
    };
    expect(() => SlabParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects negative thickness', () => {
    const invalid = {
      ...baseParams,
      geometryType: 'box' as const,
      thickness: -100,
    };
    expect(() => SlabParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid slab kind enum value', () => {
    const invalid = {
      ...baseParams,
      kind: 'invalid-kind',
      geometryType: 'box' as const,
    };
    expect(() => SlabParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects outline με <3 vertices', () => {
    const invalid = {
      ...baseParams,
      geometryType: 'box' as const,
      outline: { vertices: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] },
    };
    expect(() => SlabParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects slope με negative angle', () => {
    const invalid = {
      ...baseParams,
      geometryType: 'tilted' as const,
      slope: { direction: 0, angle: -2 },
    };
    expect(() => SlabParamsSchema.parse(invalid)).toThrow();
  });
});

describe('SlabEntitySchema (Zod)', () => {
  it('accepts factory output', () => {
    const s = createSlab(baseInput);
    expect(() => SlabEntitySchema.parse(s)).not.toThrow();
  });

  it('rejects entity με invalid ifcGuid (not 22 chars)', () => {
    const s = createSlab(baseInput);
    const invalid = { ...s, ifcGuid: 'TOO_SHORT' };
    expect(() => SlabEntitySchema.parse(invalid)).toThrow();
  });

  it("rejects entity με ifcType ≠ 'IfcSlab'", () => {
    const s = createSlab(baseInput);
    const invalid = { ...s, ifcType: 'IfcWall' };
    expect(() => SlabEntitySchema.parse(invalid)).toThrow();
  });

  it("rejects entity με type ≠ 'slab'", () => {
    const s = createSlab(baseInput);
    const invalid = { ...s, type: 'wall' };
    expect(() => SlabEntitySchema.parse(invalid)).toThrow();
  });
});
