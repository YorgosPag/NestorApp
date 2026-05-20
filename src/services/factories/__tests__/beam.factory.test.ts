/**
 * Tests — Beam Factory (ADR-369 §2.2 + §9 Q5 + Q8) — Phase A4
 *
 * Coverage:
 *   - topElevation propagation (required, no factory default)
 *   - zOffset default 0 + override
 *   - IfcEntityMixin auto-fill (ifcGuid uniqueness, ifcType='IfcBeam')
 *   - Enterprise ID prefix (beam_)
 *   - Zod schema accept/reject (BeamParamsSchema + BeamEntitySchema)
 *   - Tenant pass-through
 */

import { createBeam } from '../beam.factory';
import {
  BeamParamsSchema,
  BeamEntitySchema,
} from '@/subapps/dxf-viewer/bim/types/beam.schemas';
import { IFC_GUID_REGEX } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';
import type {
  BeamGeometry,
  BeamKind,
} from '@/subapps/dxf-viewer/bim/types/beam-types';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const mockGeometry: BeamGeometry = {
  axisPolyline: { points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }] },
  outline: {
    vertices: [
      { x: 0, y: -125 },
      { x: 4000, y: -125 },
      { x: 4000, y: 125 },
      { x: 0, y: 125 },
    ],
  },
  bbox: { min: { x: 0, y: -125 }, max: { x: 4000, y: 125 } },
  length: 4.0,
  area: 1.0,
  volume: 0.5,
  maxFreeSpanM: 4.0,
};

const baseParams = {
  kind: 'straight' as BeamKind,
  startPoint: { x: 0, y: 0 },
  endPoint: { x: 4000, y: 0 },
  width: 250,
  depth: 500,
  topElevation: 3000,
};

const baseInput = {
  params: baseParams,
  geometry: mockGeometry,
  layerId: 'lyr_test',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createBeam', () => {
  // ─── ADR-369 zOffset default ──────────────────────────────────────────────

  describe('ADR-369 zOffset default', () => {
    it('zOffset default = 0', () => {
      const b = createBeam(baseInput);
      expect(b.params.zOffset).toBe(0);
    });

    it('zOffset override propagates', () => {
      const b = createBeam({
        ...baseInput,
        params: { ...baseParams, zOffset: -150 },
      });
      expect(b.params.zOffset).toBe(-150);
    });

    it('topElevation propagates from input', () => {
      const b = createBeam({
        ...baseInput,
        params: { ...baseParams, topElevation: 5800 },
      });
      expect(b.params.topElevation).toBe(5800);
    });
  });

  // ─── IfcEntityMixin auto-fill ─────────────────────────────────────────────

  describe('IfcEntityMixin', () => {
    it('ifcGuid matches IFC_GUID_REGEX (22 chars)', () => {
      const b = createBeam(baseInput);
      expect(b.ifcGuid).toMatch(IFC_GUID_REGEX);
      expect(b.ifcGuid).toHaveLength(22);
    });

    it('100 calls produce unique ifcGuids', () => {
      const guids = new Set<string>();
      for (let i = 0; i < 100; i++) guids.add(createBeam(baseInput).ifcGuid);
      expect(guids.size).toBe(100);
    });

    it("ifcType='IfcBeam' πάντα (όλα kinds)", () => {
      const kinds: BeamKind[] = ['straight', 'curved', 'cantilever'];
      for (const kind of kinds) {
        const params =
          kind === 'curved'
            ? { ...baseParams, kind, curveControl: { x: 2000, y: 500 } }
            : { ...baseParams, kind };
        const b = createBeam({ ...baseInput, params });
        expect(b.ifcType).toBe('IfcBeam');
        expect(b.kind).toBe(kind);
      }
    });

    it('ifcGuid override (test ergonomic) preserved', () => {
      const b = createBeam({ ...baseInput, ifcGuid: '0123456789ABCDEFGHIJKL' });
      expect(b.ifcGuid).toBe('0123456789ABCDEFGHIJKL');
    });

    it('pset propagated when provided', () => {
      const b = createBeam({
        ...baseInput,
        pset: { loadBearing: true, isExternal: false },
      });
      expect(b.pset).toEqual({ loadBearing: true, isExternal: false });
    });
  });

  // ─── Enterprise ID ────────────────────────────────────────────────────────

  describe('enterprise ID', () => {
    it('id starts με "beam_" prefix', () => {
      const b = createBeam(baseInput);
      expect(b.id).toMatch(/^beam_/);
    });

    it('100 calls produce unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) ids.add(createBeam(baseInput).id);
      expect(ids.size).toBe(100);
    });

    it('id override preserved', () => {
      const b = createBeam({ ...baseInput, id: 'beam_test_override' });
      expect(b.id).toBe('beam_test_override');
    });
  });

  // ─── Tenant pass-through ──────────────────────────────────────────────────

  describe('tenant fields pass-through', () => {
    it('companyId / projectId / buildingId propagate', () => {
      const b = createBeam({
        ...baseInput,
        companyId: 'co_x',
        projectId: 'proj_x',
        buildingId: 'bldg_x',
      });
      expect(b.companyId).toBe('co_x');
      expect(b.projectId).toBe('proj_x');
      expect(b.buildingId).toBe('bldg_x');
    });
  });

  // ─── Entity shape ─────────────────────────────────────────────────────────

  describe('entity shape', () => {
    it("type='beam' literal", () => {
      const b = createBeam(baseInput);
      expect(b.type).toBe('beam');
    });

    it('validation default = empty BimValidation', () => {
      const b = createBeam(baseInput);
      expect(b.validation.hasCodeViolations).toBe(false);
      expect(b.validation.violationKeys).toEqual([]);
      expect(b.validation.lastValidatedAt).toBeNull();
    });
  });
});

// ─── Zod schema tests ──────────────────────────────────────────────────────

describe('BeamParamsSchema (Zod)', () => {
  it('accepts factory output με defaults', () => {
    const b = createBeam(baseInput);
    expect(() => BeamParamsSchema.parse(b.params)).not.toThrow();
  });

  it('accepts curved kind με curveControl', () => {
    const b = createBeam({
      ...baseInput,
      params: {
        ...baseParams,
        kind: 'curved',
        curveControl: { x: 2000, y: 500 },
      },
    });
    expect(() => BeamParamsSchema.parse(b.params)).not.toThrow();
  });

  it('rejects negative width', () => {
    const invalid = {
      ...baseParams,
      width: -100,
      zOffset: 0,
    };
    expect(() => BeamParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid beam kind enum value', () => {
    const invalid = {
      ...baseParams,
      kind: 'invalid-kind',
      zOffset: 0,
    };
    expect(() => BeamParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects non-finite topElevation', () => {
    const invalid = {
      ...baseParams,
      topElevation: Number.POSITIVE_INFINITY,
      zOffset: 0,
    };
    expect(() => BeamParamsSchema.parse(invalid)).toThrow();
  });
});

describe('BeamEntitySchema (Zod)', () => {
  it('accepts factory output', () => {
    const b = createBeam(baseInput);
    expect(() => BeamEntitySchema.parse(b)).not.toThrow();
  });

  it('rejects entity με invalid ifcGuid', () => {
    const b = createBeam(baseInput);
    const invalid = { ...b, ifcGuid: 'TOO_SHORT' };
    expect(() => BeamEntitySchema.parse(invalid)).toThrow();
  });

  it("rejects entity με ifcType ≠ 'IfcBeam'", () => {
    const b = createBeam(baseInput);
    const invalid = { ...b, ifcType: 'IfcWall' };
    expect(() => BeamEntitySchema.parse(invalid)).toThrow();
  });

  it("rejects entity με type ≠ 'beam'", () => {
    const b = createBeam(baseInput);
    const invalid = { ...b, type: 'wall' };
    expect(() => BeamEntitySchema.parse(invalid)).toThrow();
  });
});
