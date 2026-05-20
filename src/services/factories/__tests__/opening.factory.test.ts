/**
 * Tests — Opening Factory (ADR-369 §9 Q8) — Phase A5
 *
 * Coverage:
 *   - ifcType inference per kind (door/sliding-door/french-door → IfcDoor,
 *     window/fixed → IfcWindow)
 *   - ifcGuid uniqueness (100 calls)
 *   - Enterprise ID prefix (opening_)
 *   - IfcEntityMixin auto-fill
 *   - Zod schema accept/reject (OpeningParamsSchema + OpeningEntitySchema)
 *   - Tenant pass-through
 *   - inferOpeningIfcType() helper (all 5 kinds)
 */

import { createOpening, inferOpeningIfcType } from '../opening.factory';
import {
  OpeningParamsSchema,
  OpeningEntitySchema,
} from '@/subapps/dxf-viewer/bim/types/opening.schemas';
import { IFC_GUID_REGEX } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';
import type { OpeningGeometry, OpeningKind } from '@/subapps/dxf-viewer/bim/types/opening-types';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockGeometry: OpeningGeometry = {
  position: { x: 500, y: 0, z: 0 },
  rotation: 0,
  outline: {
    vertices: [
      { x: 50,  y: -25 },
      { x: 950, y: -25 },
      { x: 950, y:  25 },
      { x: 50,  y:  25 },
    ],
  },
  bbox: { min: { x: 50, y: -25 }, max: { x: 950, y: 25 } },
  area: 1.89,
  perimeter: 6.0,
};

const baseDoorParams = {
  kind: 'door' as OpeningKind,
  wallId: 'wall_test_001',
  offsetFromStart: 500,
  width: 900,
  height: 2100,
  sillHeight: 0,
  frameWidth: 50,
};

const baseWindowParams = {
  kind: 'window' as OpeningKind,
  wallId: 'wall_test_001',
  offsetFromStart: 1000,
  width: 1200,
  height: 1400,
  sillHeight: 900,
  frameWidth: 50,
};

const baseInput = {
  params: baseDoorParams,
  geometry: mockGeometry,
  layerId: 'lyr_test',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('inferOpeningIfcType', () => {
  it("'door' → 'IfcDoor'", () => {
    expect(inferOpeningIfcType('door')).toBe('IfcDoor');
  });

  it("'sliding-door' → 'IfcDoor'", () => {
    expect(inferOpeningIfcType('sliding-door')).toBe('IfcDoor');
  });

  it("'french-door' → 'IfcDoor'", () => {
    expect(inferOpeningIfcType('french-door')).toBe('IfcDoor');
  });

  it("'window' → 'IfcWindow'", () => {
    expect(inferOpeningIfcType('window')).toBe('IfcWindow');
  });

  it("'fixed' → 'IfcWindow'", () => {
    expect(inferOpeningIfcType('fixed')).toBe('IfcWindow');
  });
});

describe('createOpening', () => {
  // ─── ifcType inference per kind ────────────────────────────────────────────

  describe('ifcType inference per kind', () => {
    const doorKinds: OpeningKind[] = ['door', 'sliding-door', 'french-door'];
    const windowKinds: OpeningKind[] = ['window', 'fixed'];

    for (const kind of doorKinds) {
      it(`kind='${kind}' → ifcType='IfcDoor'`, () => {
        const o = createOpening({ ...baseInput, params: { ...baseDoorParams, kind } });
        expect(o.ifcType).toBe('IfcDoor');
        expect(o.kind).toBe(kind);
      });
    }

    for (const kind of windowKinds) {
      it(`kind='${kind}' → ifcType='IfcWindow'`, () => {
        const o = createOpening({
          ...baseInput,
          params: { ...baseWindowParams, kind },
        });
        expect(o.ifcType).toBe('IfcWindow');
        expect(o.kind).toBe(kind);
      });
    }
  });

  // ─── IfcEntityMixin auto-fill ──────────────────────────────────────────────

  describe('IfcEntityMixin', () => {
    it('ifcGuid matches IFC_GUID_REGEX (22 chars)', () => {
      const o = createOpening(baseInput);
      expect(o.ifcGuid).toMatch(IFC_GUID_REGEX);
      expect(o.ifcGuid).toHaveLength(22);
    });

    it('100 calls produce unique ifcGuids', () => {
      const guids = new Set<string>();
      for (let i = 0; i < 100; i++) guids.add(createOpening(baseInput).ifcGuid);
      expect(guids.size).toBe(100);
    });

    it('ifcGuid override (test ergonomic) preserved', () => {
      const o = createOpening({ ...baseInput, ifcGuid: '0123456789ABCDEFGHIJKL' });
      expect(o.ifcGuid).toBe('0123456789ABCDEFGHIJKL');
    });

    it('pset propagated when provided', () => {
      const o = createOpening({ ...baseInput, pset: { fireRating: 'EI30', isExternal: true } });
      expect(o.pset).toEqual({ fireRating: 'EI30', isExternal: true });
    });

    it('pset absent when not provided', () => {
      const o = createOpening(baseInput);
      expect(o.pset).toBeUndefined();
    });
  });

  // ─── Enterprise ID ─────────────────────────────────────────────────────────

  describe('enterprise ID', () => {
    it('id starts με "opening_" prefix', () => {
      const o = createOpening(baseInput);
      expect(o.id).toMatch(/^opening_/);
    });

    it('100 calls produce unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) ids.add(createOpening(baseInput).id);
      expect(ids.size).toBe(100);
    });

    it('id override preserved', () => {
      const o = createOpening({ ...baseInput, id: 'opening_test_override' });
      expect(o.id).toBe('opening_test_override');
    });
  });

  // ─── Entity shape ──────────────────────────────────────────────────────────

  describe('entity shape', () => {
    it("type='opening' literal", () => {
      const o = createOpening(baseInput);
      expect(o.type).toBe('opening');
    });

    it('validation default = empty BimValidation', () => {
      const o = createOpening(baseInput);
      expect(o.validation.hasCodeViolations).toBe(false);
      expect(o.validation.violationKeys).toEqual([]);
      expect(o.validation.lastValidatedAt).toBeNull();
    });

    it('visible propagates when provided', () => {
      const o = createOpening({ ...baseInput, visible: true });
      expect(o.visible).toBe(true);
    });

    it('visible absent when not provided', () => {
      const o = createOpening(baseInput);
      expect(o.visible).toBeUndefined();
    });

    it('params passed through unchanged', () => {
      const o = createOpening(baseInput);
      expect(o.params).toEqual(baseDoorParams);
    });
  });

  // ─── Tenant pass-through ───────────────────────────────────────────────────

  describe('tenant fields pass-through', () => {
    it('companyId / projectId / buildingId / floorplanId / floorId propagate', () => {
      const o = createOpening({
        ...baseInput,
        companyId: 'co_x',
        projectId: 'proj_x',
        buildingId: 'bldg_x',
        floorplanId: 'fp_x',
        floorId: 'flr_x',
      });
      expect(o.companyId).toBe('co_x');
      expect(o.projectId).toBe('proj_x');
      expect(o.buildingId).toBe('bldg_x');
      expect(o.floorplanId).toBe('fp_x');
      expect(o.floorId).toBe('flr_x');
    });

    it('tenant fields absent when not provided', () => {
      const o = createOpening(baseInput);
      expect(o.companyId).toBeUndefined();
      expect(o.projectId).toBeUndefined();
    });
  });
});

// ─── Zod schema tests ──────────────────────────────────────────────────────

describe('OpeningParamsSchema (Zod)', () => {
  it('accepts door params', () => {
    expect(() => OpeningParamsSchema.parse(baseDoorParams)).not.toThrow();
  });

  it('accepts window params', () => {
    expect(() => OpeningParamsSchema.parse(baseWindowParams)).not.toThrow();
  });

  it('rejects negative width', () => {
    expect(() =>
      OpeningParamsSchema.parse({ ...baseDoorParams, width: -100 }),
    ).toThrow();
  });

  it('rejects negative height', () => {
    expect(() =>
      OpeningParamsSchema.parse({ ...baseDoorParams, height: 0 }),
    ).toThrow();
  });

  it('rejects negative sillHeight', () => {
    expect(() =>
      OpeningParamsSchema.parse({ ...baseDoorParams, sillHeight: -1 }),
    ).toThrow();
  });

  it('rejects invalid kind', () => {
    expect(() =>
      OpeningParamsSchema.parse({ ...baseDoorParams, kind: 'portal' }),
    ).toThrow();
  });

  it('rejects empty wallId', () => {
    expect(() =>
      OpeningParamsSchema.parse({ ...baseDoorParams, wallId: '' }),
    ).toThrow();
  });

  it('rejects invalid glazingPanes (4)', () => {
    expect(() =>
      OpeningParamsSchema.parse({ ...baseWindowParams, glazingPanes: 4 }),
    ).toThrow();
  });

  it('accepts glazingPanes 1 / 2 / 3', () => {
    for (const panes of [1, 2, 3] as const) {
      expect(() =>
        OpeningParamsSchema.parse({ ...baseWindowParams, glazingPanes: panes }),
      ).not.toThrow();
    }
  });
});

describe('OpeningEntitySchema (Zod)', () => {
  it('accepts factory door output', () => {
    const o = createOpening(baseInput);
    expect(() => OpeningEntitySchema.parse(o)).not.toThrow();
  });

  it('accepts factory window output', () => {
    const o = createOpening({ ...baseInput, params: baseWindowParams });
    expect(() => OpeningEntitySchema.parse(o)).not.toThrow();
  });

  it('rejects entity με invalid ifcGuid (not 22 chars)', () => {
    const o = createOpening(baseInput);
    expect(() => OpeningEntitySchema.parse({ ...o, ifcGuid: 'TOO_SHORT' })).toThrow();
  });

  it("rejects entity με ifcType ≠ 'IfcDoor'|'IfcWindow'", () => {
    const o = createOpening(baseInput);
    expect(() => OpeningEntitySchema.parse({ ...o, ifcType: 'IfcWall' })).toThrow();
  });

  it("rejects entity με type ≠ 'opening'", () => {
    const o = createOpening(baseInput);
    expect(() => OpeningEntitySchema.parse({ ...o, type: 'wall' })).toThrow();
  });
});
