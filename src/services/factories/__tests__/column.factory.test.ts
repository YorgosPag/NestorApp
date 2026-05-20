/**
 * Tests — Column Factory (ADR-369 §9 Q5 + Q8) — Phase A3
 *
 * Mirror του wall.factory.test.ts. Coverage:
 *   - ADR-369 binding defaults
 *   - User overrides
 *   - IfcEntityMixin auto-fill (ifcGuid uniqueness, ifcType='IfcColumn')
 *   - Enterprise ID prefix (col_)
 *   - Validation throws (unconnected mismatch)
 *   - Zod schema accept/reject
 *   - Tenant pass-through
 */

import { createColumn } from '../column.factory';
import {
  ColumnParamsSchema,
  ColumnEntitySchema,
} from '@/subapps/dxf-viewer/bim/types/column.schemas';
import { IFC_GUID_REGEX } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';
import type {
  ColumnGeometry,
  ColumnKind,
} from '@/subapps/dxf-viewer/bim/types/column-types';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockGeometry: ColumnGeometry = {
  footprint: {
    vertices: [
      { x: -200, y: -200 },
      { x: 200, y: -200 },
      { x: 200, y: 200 },
      { x: -200, y: 200 },
    ],
  },
  bbox: { min: { x: -200, y: -200 }, max: { x: 200, y: 200 } },
  area: 0.16,
  volume: 0.48,
  height: 3000,
};

const baseParams = {
  kind: 'rectangular' as ColumnKind,
  position: { x: 0, y: 0 },
  anchor: 'center' as const,
  width: 400,
  depth: 400,
  height: 3000,
  rotation: 0,
};

const baseInput = {
  params: baseParams,
  geometry: mockGeometry,
  layerId: 'lyr_test',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createColumn', () => {
  // ─── ADR-369 binding defaults ─────────────────────────────────────────────

  describe('ADR-369 binding defaults', () => {
    it("baseBinding default = 'storey-floor'", () => {
      const c = createColumn(baseInput);
      expect(c.params.baseBinding).toBe('storey-floor');
    });

    it("topBinding default = 'storey-ceiling'", () => {
      const c = createColumn(baseInput);
      expect(c.params.topBinding).toBe('storey-ceiling');
    });

    it('baseOffset / topOffset default = 0', () => {
      const c = createColumn(baseInput);
      expect(c.params.baseOffset).toBe(0);
      expect(c.params.topOffset).toBe(0);
    });
  });

  // ─── User overrides ───────────────────────────────────────────────────────

  describe('user overrides preserved', () => {
    it("baseBinding='absolute' propagates", () => {
      const c = createColumn({
        ...baseInput,
        params: { ...baseParams, baseBinding: 'absolute' },
      });
      expect(c.params.baseBinding).toBe('absolute');
    });

    it('offset overrides propagate', () => {
      const c = createColumn({
        ...baseInput,
        params: { ...baseParams, baseOffset: 100, topOffset: -50 },
      });
      expect(c.params.baseOffset).toBe(100);
      expect(c.params.topOffset).toBe(-50);
    });

    it("topBinding='unconnected' με unconnectedHeight propagates", () => {
      const c = createColumn({
        ...baseInput,
        params: {
          ...baseParams,
          topBinding: 'unconnected',
          unconnectedHeight: 2700,
        },
      });
      expect(c.params.topBinding).toBe('unconnected');
      expect(c.params.unconnectedHeight).toBe(2700);
    });
  });

  // ─── Validation throws ────────────────────────────────────────────────────

  describe('validation', () => {
    it("throws when topBinding='unconnected' χωρίς unconnectedHeight", () => {
      expect(() =>
        createColumn({
          ...baseInput,
          params: { ...baseParams, topBinding: 'unconnected' },
        }),
      ).toThrow(/unconnectedHeight/);
    });

    it("throws when unconnectedHeight set αλλά topBinding≠'unconnected'", () => {
      expect(() =>
        createColumn({
          ...baseInput,
          params: { ...baseParams, unconnectedHeight: 2700 },
        }),
      ).toThrow(/unconnectedHeight/);
    });
  });

  // ─── IfcEntityMixin ───────────────────────────────────────────────────────

  describe('IfcEntityMixin', () => {
    it('ifcGuid matches IFC_GUID_REGEX (22 chars)', () => {
      const c = createColumn(baseInput);
      expect(c.ifcGuid).toMatch(IFC_GUID_REGEX);
      expect(c.ifcGuid).toHaveLength(22);
    });

    it('100 calls produce unique ifcGuids', () => {
      const guids = new Set<string>();
      for (let i = 0; i < 100; i++) guids.add(createColumn(baseInput).ifcGuid);
      expect(guids.size).toBe(100);
    });

    it("ifcType='IfcColumn' πάντα (όλα kinds)", () => {
      const kinds: ColumnKind[] = ['rectangular', 'circular', 'L-shape', 'T-shape'];
      for (const kind of kinds) {
        const c = createColumn({
          ...baseInput,
          params: { ...baseParams, kind },
        });
        expect(c.ifcType).toBe('IfcColumn');
        expect(c.kind).toBe(kind);
      }
    });

    it('pset propagated when provided', () => {
      const c = createColumn({
        ...baseInput,
        pset: { loadBearing: true, isExternal: false },
      });
      expect(c.pset).toEqual({ loadBearing: true, isExternal: false });
    });
  });

  // ─── Enterprise ID ────────────────────────────────────────────────────────

  describe('enterprise ID', () => {
    it('id starts με "col_" prefix', () => {
      const c = createColumn(baseInput);
      expect(c.id).toMatch(/^col_/);
    });

    it('100 calls produce unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) ids.add(createColumn(baseInput).id);
      expect(ids.size).toBe(100);
    });

    it('id override preserved', () => {
      const c = createColumn({ ...baseInput, id: 'col_test_override' });
      expect(c.id).toBe('col_test_override');
    });
  });

  // ─── Tenant pass-through ──────────────────────────────────────────────────

  describe('tenant fields pass-through', () => {
    it('companyId / projectId / buildingId propagate', () => {
      const c = createColumn({
        ...baseInput,
        companyId: 'co_x',
        projectId: 'proj_x',
        buildingId: 'bldg_x',
      });
      expect(c.companyId).toBe('co_x');
      expect(c.projectId).toBe('proj_x');
      expect(c.buildingId).toBe('bldg_x');
    });
  });

  // ─── Entity shape ─────────────────────────────────────────────────────────

  describe('entity shape', () => {
    it("type='column' literal", () => {
      const c = createColumn(baseInput);
      expect(c.type).toBe('column');
    });

    it('validation default = empty BimValidation', () => {
      const c = createColumn(baseInput);
      expect(c.validation.hasCodeViolations).toBe(false);
      expect(c.validation.violationKeys).toEqual([]);
      expect(c.validation.lastValidatedAt).toBeNull();
    });
  });
});

// ─── Zod schema tests ──────────────────────────────────────────────────────

describe('ColumnParamsSchema (Zod)', () => {
  it('accepts factory output με bound defaults', () => {
    const c = createColumn(baseInput);
    expect(() => ColumnParamsSchema.parse(c.params)).not.toThrow();
  });

  it("accepts topBinding='unconnected' με unconnectedHeight", () => {
    const c = createColumn({
      ...baseInput,
      params: {
        ...baseParams,
        topBinding: 'unconnected',
        unconnectedHeight: 2700,
      },
    });
    expect(() => ColumnParamsSchema.parse(c.params)).not.toThrow();
  });

  it("rejects topBinding='unconnected' χωρίς unconnectedHeight", () => {
    const invalid = {
      ...baseParams,
      baseBinding: 'storey-floor' as const,
      topBinding: 'unconnected' as const,
      baseOffset: 0,
      topOffset: 0,
    };
    expect(() => ColumnParamsSchema.parse(invalid)).toThrow();
  });

  it("rejects unconnectedHeight όταν topBinding='storey-ceiling'", () => {
    const invalid = {
      ...baseParams,
      baseBinding: 'storey-floor' as const,
      topBinding: 'storey-ceiling' as const,
      baseOffset: 0,
      topOffset: 0,
      unconnectedHeight: 2700,
    };
    expect(() => ColumnParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects negative width', () => {
    const invalid = {
      ...baseParams,
      width: -10,
      baseBinding: 'storey-floor' as const,
      topBinding: 'storey-ceiling' as const,
      baseOffset: 0,
      topOffset: 0,
    };
    expect(() => ColumnParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid anchor enum value', () => {
    const invalid = {
      ...baseParams,
      anchor: 'invalid-anchor',
      baseBinding: 'storey-floor',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
    };
    expect(() => ColumnParamsSchema.parse(invalid)).toThrow();
  });
});

describe('ColumnEntitySchema (Zod)', () => {
  it('accepts factory output', () => {
    const c = createColumn(baseInput);
    expect(() => ColumnEntitySchema.parse(c)).not.toThrow();
  });

  it('rejects entity με invalid ifcGuid', () => {
    const c = createColumn(baseInput);
    const invalid = { ...c, ifcGuid: 'TOO_SHORT' };
    expect(() => ColumnEntitySchema.parse(invalid)).toThrow();
  });

  it("rejects entity με ifcType ≠ 'IfcColumn'", () => {
    const c = createColumn(baseInput);
    const invalid = { ...c, ifcType: 'IfcWall' };
    expect(() => ColumnEntitySchema.parse(invalid)).toThrow();
  });

  it("rejects entity με type ≠ 'column'", () => {
    const c = createColumn(baseInput);
    const invalid = { ...c, type: 'wall' };
    expect(() => ColumnEntitySchema.parse(invalid)).toThrow();
  });
});
