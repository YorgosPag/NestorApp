/**
 * @jest-environment node
 *
 * IFC4 Floor Finish Covering Serializer — unit tests (ADR-419)
 *
 * Validates that `serializeFloorFinishCoverings` emits:
 *   - IfcCovering with PredefinedType=FLOORING (not INSULATION)
 *   - Pset_CoveringCommon: Thickness + ThermalTransmittance
 *   - Entity registered in storey containment map
 *   - Unknown material → Thickness only (no ThermalTransmittance)
 *
 * Jest globals (ΟΧΙ vitest — repo standard).
 */

import { IfcGraph, type IfcEntityRecord, type IfcEnumValue } from '../../ifc-entity-graph';
import type { SpatialHierarchyOutput } from '../../ifc-spatial-hierarchy';
import type { IfcExportParams } from '../../ifc-exporter.service';
import { createSerializerContext, type SerializerContext } from '../serializer-context';
import { serializeFloorFinishCoverings } from '../ifc-covering-serializer';

import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import type { FloorFinishEntity } from '@/subapps/dxf-viewer/bim/types/floor-finish-types';
import {
  DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM,
  DEFAULT_FLOOR_FINISH_MATERIAL_ID,
} from '@/subapps/dxf-viewer/bim/types/floor-finish-types';

const FLOOR_ID = 'f-1a';
const STOREY_ID = 42;

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeSpatial(): SpatialHierarchyOutput {
  return {
    storeyIDs: new Map<string, number>([[FLOOR_ID, STOREY_ID]]),
    contextID: 1,
  } as unknown as SpatialHierarchyOutput;
}

function makeFloorFinishEntity(overrides: Partial<FloorFinishEntity['params']> = {}): FloorFinishEntity {
  return {
    id: 'ffl_test-001',
    type: 'floor-finish',
    kind: DEFAULT_FLOOR_FINISH_MATERIAL_ID,
    ifcType: 'IfcCovering',
    params: {
      footprint: {
        vertices: [
          { x: 0, y: 0 },
          { x: 3000, y: 0 },
          { x: 3000, y: 4000 },
          { x: 0, y: 4000 },
        ],
      },
      materialId: DEFAULT_FLOOR_FINISH_MATERIAL_ID,
      thicknessMm: DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM,
      finishLevel: 0,
      ...overrides,
    },
    geometry: {
      bbox: { min: { x: 0, y: 0 }, max: { x: 3000, y: 4000 } },
      area: 12.0,
      perimeter: 14.0,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as FloorFinishEntity;
}

function makeScene(entities: unknown[]): SceneModel {
  return {
    entities,
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 5000, y: 5000 } },
    units: 'mm',
  } as unknown as SceneModel;
}

function makeParams(
  scene: SceneModel,
  opts: { includePsets?: boolean } = {},
): IfcExportParams {
  return {
    scenes: new Map<string, SceneModel>([[FLOOR_ID, scene]]),
    includePsets: opts.includePsets,
  } as unknown as IfcExportParams;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRecordsByType(graph: IfcGraph, type: string): IfcEntityRecord[] {
  return graph.records().filter((r) => r.type === type);
}

function getEnumValue(record: IfcEntityRecord, index: number): string | undefined {
  const v = record.args[index];
  if (v && typeof v === 'object' && 'kind' in v && v.kind === 'enum') {
    return (v as IfcEnumValue).value;
  }
  return undefined;
}

function getLabelValue(record: IfcEntityRecord, index: number): string | undefined {
  const v = record.args[index];
  if (v && typeof v === 'object' && 'kind' in v && v.kind === 'label') {
    return (v as { kind: 'label'; value: string }).value;
  }
  return undefined;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('serializeFloorFinishCoverings()', () => {
  it('emits 0 records when scene has no floor-finish entities', () => {
    const graph = new IfcGraph();
    const ctx = createSerializerContext();
    serializeFloorFinishCoverings(graph, makeSpatial(), makeParams(makeScene([])), ctx);
    expect(getRecordsByType(graph, 'IFCCOVERING')).toHaveLength(0);
  });

  describe('single FloorFinishEntity', () => {
    let graph: IfcGraph;
    let ctx: SerializerContext;
    const ff = makeFloorFinishEntity();

    beforeEach(() => {
      graph = new IfcGraph();
      ctx = createSerializerContext();
      serializeFloorFinishCoverings(graph, makeSpatial(), makeParams(makeScene([ff])), ctx);
    });

    it('emits exactly 1 IfcCovering', () => {
      expect(getRecordsByType(graph, 'IFCCOVERING')).toHaveLength(1);
    });

    it('IfcCovering has PredefinedType=FLOORING (not INSULATION)', () => {
      const covering = getRecordsByType(graph, 'IFCCOVERING')[0];
      // PredefinedType is the 9th attribute (index 8) per IFC4 schema
      expect(getEnumValue(covering, 8)).toBe('FLOORING');
    });

    it('IfcCovering does NOT have PredefinedType=INSULATION', () => {
      const covering = getRecordsByType(graph, 'IFCCOVERING')[0];
      expect(getEnumValue(covering, 8)).not.toBe('INSULATION');
    });

    it('emits IfcPropertySet with name Pset_CoveringCommon', () => {
      const psets = getRecordsByType(graph, 'IFCPROPERTYSET');
      const coveringPset = psets.find((p) => getLabelValue(p, 2) === 'Pset_CoveringCommon');
      expect(coveringPset).toBeDefined();
    });

    it('Pset_CoveringCommon contains Thickness property', () => {
      const props = getRecordsByType(graph, 'IFCPROPERTYSINGLEVALUE');
      const thicknessProp = props.find((p) => getLabelValue(p, 0) === 'Thickness');
      expect(thicknessProp).toBeDefined();
    });

    it('Thickness value = thicknessMm / 1000 (in metres)', () => {
      const props = getRecordsByType(graph, 'IFCPROPERTYSINGLEVALUE');
      const thicknessProp = props.find((p) => getLabelValue(p, 0) === 'Thickness')!;
      const nominalValue = thicknessProp.args[2];
      expect(nominalValue).toBeDefined();
      // typed value: { kind: 'typed', typeName: 'IFCLENGTHMEASURE', inner: { kind: 'real', value } }
      const inner = (nominalValue as { inner: { value: number } }).inner;
      expect(inner.value).toBeCloseTo(DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM / 1000, 6);
    });

    it('Pset_CoveringCommon contains ThermalTransmittance property for known material', () => {
      const props = getRecordsByType(graph, 'IFCPROPERTYSINGLEVALUE');
      const uProp = props.find((p) => getLabelValue(p, 0) === 'ThermalTransmittance');
      expect(uProp).toBeDefined();
    });

    it('ThermalTransmittance = λ / thicknessM (W/m²K)', () => {
      const props = getRecordsByType(graph, 'IFCPROPERTYSINGLEVALUE');
      const uProp = props.find((p) => getLabelValue(p, 0) === 'ThermalTransmittance')!;
      const inner = (uProp.args[2] as { inner: { value: number } }).inner;
      // ceramic λ ≈ 1.0, thickness = 0.015m → U ≈ 66.7
      expect(inner.value).toBeGreaterThan(0);
    });

    it('covering is registered in storey containment', () => {
      const storeyElements = ctx.elementsByStorey.get(STOREY_ID);
      expect(storeyElements).toBeDefined();
      expect(storeyElements!.length).toBeGreaterThan(0);
    });

    it('emits IfcRelDefinesByProperties relating covering → pset', () => {
      expect(getRecordsByType(graph, 'IFCRELDEFINESBYPROPERTIES')).toHaveLength(1);
    });
  });

  describe('unknown material (no lambda in catalog)', () => {
    it('emits Thickness but skips ThermalTransmittance', () => {
      const graph = new IfcGraph();
      const ctx = createSerializerContext();
      // Pass a custom materialId not present in the built-in catalog → lambda=undefined
      const ff = makeFloorFinishEntity({ materialId: 'custom-unknown-material' as FloorFinishEntity['params']['materialId'] });
      serializeFloorFinishCoverings(graph, makeSpatial(), makeParams(makeScene([ff])), ctx);

      const props = getRecordsByType(graph, 'IFCPROPERTYSINGLEVALUE');
      const names = props.map((p) => getLabelValue(p, 0));
      expect(names).toContain('Thickness');
      // unknown material → getFloorFinishLambda returns undefined → skip U-value
      expect(names).not.toContain('ThermalTransmittance');
    });
  });

  describe('includePsets=false', () => {
    it('emits IfcCovering but no IfcPropertySet', () => {
      const graph = new IfcGraph();
      const ctx = createSerializerContext();
      const ff = makeFloorFinishEntity();
      serializeFloorFinishCoverings(
        graph,
        makeSpatial(),
        makeParams(makeScene([ff]), { includePsets: false }),
        ctx,
      );
      expect(getRecordsByType(graph, 'IFCCOVERING')).toHaveLength(1);
      expect(getRecordsByType(graph, 'IFCPROPERTYSET')).toHaveLength(0);
    });
  });

  describe('entity name propagation', () => {
    it('uses entity.params.name as IfcCovering Name when set', () => {
      const graph = new IfcGraph();
      const ctx = createSerializerContext();
      const ff = makeFloorFinishEntity({ name: 'Bedroom Oak Floor' });
      serializeFloorFinishCoverings(graph, makeSpatial(), makeParams(makeScene([ff])), ctx);
      const covering = getRecordsByType(graph, 'IFCCOVERING')[0];
      expect(getLabelValue(covering, 2)).toBe('Bedroom Oak Floor');
    });

    it('falls back to "Floor Finish" when name is not set', () => {
      const graph = new IfcGraph();
      const ctx = createSerializerContext();
      const ff = makeFloorFinishEntity();
      serializeFloorFinishCoverings(graph, makeSpatial(), makeParams(makeScene([ff])), ctx);
      const covering = getRecordsByType(graph, 'IFCCOVERING')[0];
      expect(getLabelValue(covering, 2)).toBe('Floor Finish');
    });
  });

  describe('multiple floor finishes', () => {
    it('emits N coverings for N entities', () => {
      const graph = new IfcGraph();
      const ctx = createSerializerContext();
      const ff1 = { ...makeFloorFinishEntity(), id: 'ffl_001' };
      const ff2 = { ...makeFloorFinishEntity(), id: 'ffl_002' };
      serializeFloorFinishCoverings(graph, makeSpatial(), makeParams(makeScene([ff1, ff2])), ctx);
      expect(getRecordsByType(graph, 'IFCCOVERING')).toHaveLength(2);
    });
  });

  describe('no storey mapping', () => {
    it('skips entities when storeyID is not found', () => {
      const graph = new IfcGraph();
      const ctx = createSerializerContext();
      const ff = makeFloorFinishEntity();
      const emptyStoreys = {
        storeyIDs: new Map<string, number>(),
        contextID: 1,
      } as unknown as SpatialHierarchyOutput;
      serializeFloorFinishCoverings(graph, emptyStoreys, makeParams(makeScene([ff])), ctx);
      expect(getRecordsByType(graph, 'IFCCOVERING')).toHaveLength(0);
    });
  });
});
