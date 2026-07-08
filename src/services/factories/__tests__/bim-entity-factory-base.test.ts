import {
  assembleBimEntity,
  spreadBimEntityCommonFields,
} from '@/services/factories/bim-entity-factory-base';
import { resolveBindingParams } from '@/services/factories/bim-binding-params';

describe('bim-entity-factory-base', () => {
  describe('spreadBimEntityCommonFields', () => {
    it('omits every absent optional field', () => {
      expect(spreadBimEntityCommonFields({})).toEqual({});
    });

    it('spreads only the provided fields', () => {
      expect(
        spreadBimEntityCommonFields({
          visible: false,
          companyId: 'c1',
          updatedBy: 'u1',
        }),
      ).toEqual({ visible: false, companyId: 'c1', updatedBy: 'u1' });
    });
  });

  describe('assembleBimEntity', () => {
    const core = {
      type: 'demo' as const,
      kind: 'k1' as const,
      layerId: 'lyr_1',
      params: { a: 1 },
      geometry: { g: 2 },
      ifcType: 'IfcDemo' as const,
      generateId: () => 'gen_id_1',
    };

    it('auto-fills id / ifcGuid / validation and copies discriminants', () => {
      const entity = assembleBimEntity(core, { layerId: 'lyr_1' });
      expect(entity.id).toBe('gen_id_1');
      expect(entity.type).toBe('demo');
      expect(entity.kind).toBe('k1');
      expect(entity.ifcType).toBe('IfcDemo');
      expect(entity.params).toEqual({ a: 1 });
      expect(entity.geometry).toEqual({ g: 2 });
      expect(typeof entity.ifcGuid).toBe('string');
      expect(entity.validation).toEqual({
        hasCodeViolations: false,
        violationKeys: [],
        lastValidatedAt: null,
      });
    });

    it('honours id / ifcGuid overrides and spreads tenant fields', () => {
      const entity = assembleBimEntity(core, {
        layerId: 'lyr_1',
        id: 'override_id',
        ifcGuid: 'override_guid',
        companyId: 'c9',
        floorId: 'f9',
      });
      expect(entity.id).toBe('override_id');
      expect(entity.ifcGuid).toBe('override_guid');
      expect(entity.companyId).toBe('c9');
      expect(entity.floorId).toBe('f9');
    });
  });

  describe('resolveBindingParams', () => {
    it('applies ADR-369 binding + offset defaults', () => {
      const resolved = resolveBindingParams({ width: 400 } as never, 'createDemo') as {
        baseBinding: string;
        topBinding: string;
        baseOffset: number;
        topOffset: number;
        offsetFromStorey: number;
        width: number;
      };
      expect(resolved.baseBinding).toBe('storey-floor');
      expect(resolved.topBinding).toBe('storey-ceiling');
      expect(resolved.baseOffset).toBe(0);
      expect(resolved.topOffset).toBe(0);
      expect(resolved.offsetFromStorey).toBe(0);
      expect(resolved.width).toBe(400);
    });

    it("throws when topBinding='unconnected' without unconnectedHeight", () => {
      expect(() => resolveBindingParams({ topBinding: 'unconnected' }, 'createDemo')).toThrow(
        /unconnected/,
      );
    });

    it('throws when unconnectedHeight is set for a connected topBinding', () => {
      expect(() =>
        resolveBindingParams({ topBinding: 'storey-ceiling', unconnectedHeight: 2500 }, 'createDemo'),
      ).toThrow(/unconnectedHeight/);
    });

    it('keeps unconnectedHeight when topBinding is unconnected', () => {
      const resolved = resolveBindingParams(
        { topBinding: 'unconnected', unconnectedHeight: 2800 },
        'createDemo',
      );
      expect(resolved.topBinding).toBe('unconnected');
      expect(resolved.unconnectedHeight).toBe(2800);
    });
  });
});
