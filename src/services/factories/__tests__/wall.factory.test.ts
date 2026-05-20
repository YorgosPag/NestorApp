/**
 * Tests — Wall Factory (ADR-369 §9 Q5 + Q8) — Phase A3
 *
 * Coverage:
 *   - ADR-369 binding defaults (baseBinding/topBinding/baseOffset/topOffset)
 *   - User overrides preserved
 *   - IfcEntityMixin auto-fill (ifcGuid uniqueness, ifcType inference)
 *   - Enterprise ID prefix (wall_)
 *   - Validation throws (unconnected mismatch)
 *   - Zod schema accept/reject (WallParamsSchema)
 *   - Tenant pass-through
 */

import { createWall, inferWallIfcType } from '../wall.factory';
import { WallParamsSchema, WallEntitySchema } from '@/subapps/dxf-viewer/bim/types/wall.schemas';
import { IFC_GUID_REGEX } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';
import type {
  WallGeometry,
  WallKind,
} from '@/subapps/dxf-viewer/bim/types/wall-types';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockGeometry: WallGeometry = {
  axisPolyline: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] },
  outerEdge: { points: [{ x: 0, y: 100 }, { x: 1000, y: 100 }] },
  innerEdge: { points: [{ x: 0, y: -100 }, { x: 1000, y: -100 }] },
  bbox: { min: { x: 0, y: -100 }, max: { x: 1000, y: 100 } },
  length: 1.0,
  area: 3.0,
  volume: 0.6,
};

const baseParams = {
  category: 'interior' as const,
  start: { x: 0, y: 0 },
  end: { x: 1000, y: 0 },
  height: 3000,
  thickness: 200,
  flip: false,
};

const baseInput = {
  kind: 'straight' as WallKind,
  params: baseParams,
  geometry: mockGeometry,
  layerId: 'lyr_test',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createWall', () => {
  // ─── ADR-369 binding defaults ─────────────────────────────────────────────

  describe('ADR-369 binding defaults', () => {
    it("baseBinding default = 'storey-floor'", () => {
      const w = createWall(baseInput);
      expect(w.params.baseBinding).toBe('storey-floor');
    });

    it("topBinding default = 'storey-ceiling'", () => {
      const w = createWall(baseInput);
      expect(w.params.topBinding).toBe('storey-ceiling');
    });

    it('baseOffset default = 0', () => {
      const w = createWall(baseInput);
      expect(w.params.baseOffset).toBe(0);
    });

    it('topOffset default = 0', () => {
      const w = createWall(baseInput);
      expect(w.params.topOffset).toBe(0);
    });

    it('unconnectedHeight undefined when bound', () => {
      const w = createWall(baseInput);
      expect(w.params.unconnectedHeight).toBeUndefined();
    });
  });

  // ─── User overrides ───────────────────────────────────────────────────────

  describe('user overrides preserved', () => {
    it("baseBinding='absolute' propagates", () => {
      const w = createWall({
        ...baseInput,
        params: { ...baseParams, baseBinding: 'absolute' },
      });
      expect(w.params.baseBinding).toBe('absolute');
    });

    it("topBinding='absolute' propagates", () => {
      const w = createWall({
        ...baseInput,
        params: { ...baseParams, topBinding: 'absolute' },
      });
      expect(w.params.topBinding).toBe('absolute');
    });

    it('baseOffset/topOffset overrides propagate', () => {
      const w = createWall({
        ...baseInput,
        params: { ...baseParams, baseOffset: 150, topOffset: -200 },
      });
      expect(w.params.baseOffset).toBe(150);
      expect(w.params.topOffset).toBe(-200);
    });

    it("topBinding='unconnected' με unconnectedHeight propagates", () => {
      const w = createWall({
        ...baseInput,
        params: {
          ...baseParams,
          topBinding: 'unconnected',
          unconnectedHeight: 2400,
        },
      });
      expect(w.params.topBinding).toBe('unconnected');
      expect(w.params.unconnectedHeight).toBe(2400);
    });
  });

  // ─── Validation throws ────────────────────────────────────────────────────

  describe('validation', () => {
    it("throws when topBinding='unconnected' χωρίς unconnectedHeight", () => {
      expect(() =>
        createWall({
          ...baseInput,
          params: { ...baseParams, topBinding: 'unconnected' },
        }),
      ).toThrow(/unconnectedHeight/);
    });

    it("throws when unconnectedHeight set αλλά topBinding≠'unconnected'", () => {
      expect(() =>
        createWall({
          ...baseInput,
          params: { ...baseParams, unconnectedHeight: 2400 },
        }),
      ).toThrow(/unconnectedHeight/);
    });
  });

  // ─── IfcEntityMixin auto-fill ─────────────────────────────────────────────

  describe('IfcEntityMixin', () => {
    it('ifcGuid matches IFC_GUID_REGEX (22 chars)', () => {
      const w = createWall(baseInput);
      expect(w.ifcGuid).toMatch(IFC_GUID_REGEX);
      expect(w.ifcGuid).toHaveLength(22);
    });

    it('100 calls produce unique ifcGuids', () => {
      const guids = new Set<string>();
      for (let i = 0; i < 100; i++) guids.add(createWall(baseInput).ifcGuid);
      expect(guids.size).toBe(100);
    });

    it("ifcType='IfcWallStandardCase' για kind='straight'", () => {
      const w = createWall({ ...baseInput, kind: 'straight' });
      expect(w.ifcType).toBe('IfcWallStandardCase');
    });

    it("ifcType='IfcWall' για kind='curved'", () => {
      const w = createWall({
        ...baseInput,
        kind: 'curved',
        params: { ...baseParams, curveControl: { x: 500, y: 250 } },
      });
      expect(w.ifcType).toBe('IfcWall');
    });

    it("ifcType='IfcWall' για kind='polyline'", () => {
      const w = createWall({
        ...baseInput,
        kind: 'polyline',
        params: {
          ...baseParams,
          polylineVertices: [
            { x: 0, y: 0 },
            { x: 500, y: 0 },
            { x: 1000, y: 200 },
          ],
        },
      });
      expect(w.ifcType).toBe('IfcWall');
    });

    it('inferWallIfcType pure function', () => {
      expect(inferWallIfcType('straight')).toBe('IfcWallStandardCase');
      expect(inferWallIfcType('curved')).toBe('IfcWall');
      expect(inferWallIfcType('polyline')).toBe('IfcWall');
    });

    it('ifcGuid override (test ergonomic) preserved', () => {
      const w = createWall({ ...baseInput, ifcGuid: '0123456789ABCDEFGHIJKL' });
      expect(w.ifcGuid).toBe('0123456789ABCDEFGHIJKL');
    });

    it('pset propagated when provided', () => {
      const w = createWall({ ...baseInput, pset: { fireRating: 'F60', isExternal: false } });
      expect(w.pset).toEqual({ fireRating: 'F60', isExternal: false });
    });

    it('pset absent when not provided', () => {
      const w = createWall(baseInput);
      expect(w.pset).toBeUndefined();
    });
  });

  // ─── Enterprise ID ────────────────────────────────────────────────────────

  describe('enterprise ID', () => {
    it('id starts με "wall_" prefix', () => {
      const w = createWall(baseInput);
      expect(w.id).toMatch(/^wall_/);
    });

    it('100 calls produce unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) ids.add(createWall(baseInput).id);
      expect(ids.size).toBe(100);
    });

    it('id override preserved', () => {
      const w = createWall({ ...baseInput, id: 'wall_test_override' });
      expect(w.id).toBe('wall_test_override');
    });
  });

  // ─── Tenant pass-through ──────────────────────────────────────────────────

  describe('tenant fields pass-through', () => {
    it('companyId / projectId / buildingId / floorplanId / floorId propagate', () => {
      const w = createWall({
        ...baseInput,
        companyId: 'co_x',
        projectId: 'proj_x',
        buildingId: 'bldg_x',
        floorplanId: 'fp_x',
        floorId: 'flr_x',
      });
      expect(w.companyId).toBe('co_x');
      expect(w.projectId).toBe('proj_x');
      expect(w.buildingId).toBe('bldg_x');
      expect(w.floorplanId).toBe('fp_x');
      expect(w.floorId).toBe('flr_x');
    });

    it('tenant fields absent when not provided', () => {
      const w = createWall(baseInput);
      expect(w.companyId).toBeUndefined();
      expect(w.projectId).toBeUndefined();
    });
  });

  // ─── Validation block + type='wall' ──────────────────────────────────────

  describe('entity shape', () => {
    it("type='wall' literal", () => {
      const w = createWall(baseInput);
      expect(w.type).toBe('wall');
    });

    it('validation default = empty BimValidation', () => {
      const w = createWall(baseInput);
      expect(w.validation.hasCodeViolations).toBe(false);
      expect(w.validation.violationKeys).toEqual([]);
      expect(w.validation.lastValidatedAt).toBeNull();
    });

    it('hostedOpeningIds propagated when provided', () => {
      const w = createWall({ ...baseInput, hostedOpeningIds: ['op_1', 'op_2'] });
      expect(w.hostedOpeningIds).toEqual(['op_1', 'op_2']);
    });
  });
});

// ─── Zod schema tests ──────────────────────────────────────────────────────

describe('WallParamsSchema (Zod)', () => {
  it('accepts valid params με bound defaults', () => {
    const w = createWall(baseInput);
    expect(() => WallParamsSchema.parse(w.params)).not.toThrow();
  });

  it("accepts valid params με topBinding='unconnected' + unconnectedHeight", () => {
    const w = createWall({
      ...baseInput,
      params: {
        ...baseParams,
        topBinding: 'unconnected',
        unconnectedHeight: 2400,
      },
    });
    expect(() => WallParamsSchema.parse(w.params)).not.toThrow();
  });

  it("rejects topBinding='unconnected' χωρίς unconnectedHeight", () => {
    const invalid = {
      ...baseParams,
      baseBinding: 'storey-floor' as const,
      topBinding: 'unconnected' as const,
      baseOffset: 0,
      topOffset: 0,
    };
    expect(() => WallParamsSchema.parse(invalid)).toThrow();
  });

  it("rejects unconnectedHeight όταν topBinding='storey-ceiling'", () => {
    const invalid = {
      ...baseParams,
      baseBinding: 'storey-floor' as const,
      topBinding: 'storey-ceiling' as const,
      baseOffset: 0,
      topOffset: 0,
      unconnectedHeight: 2400,
    };
    expect(() => WallParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid baseBinding enum value', () => {
    const invalid = {
      ...baseParams,
      baseBinding: 'invalid-mode',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
    };
    expect(() => WallParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects negative height', () => {
    const invalid = {
      ...baseParams,
      height: -100,
      baseBinding: 'storey-floor' as const,
      topBinding: 'storey-ceiling' as const,
      baseOffset: 0,
      topOffset: 0,
    };
    expect(() => WallParamsSchema.parse(invalid)).toThrow();
  });
});

describe('WallEntitySchema (Zod)', () => {
  it('accepts factory output', () => {
    const w = createWall(baseInput);
    expect(() => WallEntitySchema.parse(w)).not.toThrow();
  });

  it('rejects entity with invalid ifcGuid (not 22 chars)', () => {
    const w = createWall(baseInput);
    const invalid = { ...w, ifcGuid: 'TOO_SHORT' };
    expect(() => WallEntitySchema.parse(invalid)).toThrow();
  });

  it("rejects entity with ifcType outside Wall subset (e.g. 'IfcColumn')", () => {
    const w = createWall(baseInput);
    const invalid = { ...w, ifcType: 'IfcColumn' };
    expect(() => WallEntitySchema.parse(invalid)).toThrow();
  });

  it("rejects entity with type ≠ 'wall'", () => {
    const w = createWall(baseInput);
    const invalid = { ...w, type: 'column' };
    expect(() => WallEntitySchema.parse(invalid)).toThrow();
  });
});
