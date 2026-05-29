/**
 * @jest-environment node
 *
 * IFC4 Covering Serializer — unit tests (ADR-396 P9)
 *
 * Direct-graph approach: build an IfcGraph + pre-populated SerializerContext
 * (simulating prior element serializers), run `serializeEnvelopeCoverings`,
 * assert on the emitted records. Lighter than the web-ifc roundtrip — focuses
 * on the covering mapping (covering / rel / material / layerSet / thermal Pset)
 * + the semantic-only + walls-via-spec decisions.
 *
 * jest globals (ΟΧΙ vitest — repo standard).
 */

import { IfcGraph, type IfcEntityRecord, type IfcRefValue } from '../../ifc-entity-graph';
import { writeStepIfc } from '../../ifc-step-writer';
import type { SpatialHierarchyOutput } from '../../ifc-spatial-hierarchy';
import type { IfcExportParams } from '../../ifc-exporter.service';
import { createSerializerContext, type SerializerContext } from '../serializer-context';
import { serializeEnvelopeCoverings } from '../ifc-covering-serializer';

import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import type { ThermalEnvelopeSpec } from '@/subapps/dxf-viewer/bim/types/thermal-envelope-types';
import type { WallEntity } from '@/subapps/dxf-viewer/bim/types/wall-types';
import type { ColumnEntity } from '@/subapps/dxf-viewer/bim/types/column-types';
import type { SlabEntity } from '@/subapps/dxf-viewer/bim/types/slab-types';
import type { OpeningEntity } from '@/subapps/dxf-viewer/bim/types/opening-types';
import type { EnvelopeLayer } from '@/subapps/dxf-viewer/bim/types/thermal-envelope-types';

const FLOOR_ID = 'f-1a';
const STOREY_ID = 10;
const WALL_IFC_ID = 100;
const COLUMN_IFC_ID = 200;
const SLAB_IFC_ID = 300;

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeSpatial(): SpatialHierarchyOutput {
  return {
    storeyIDs: new Map<string, number>([[FLOOR_ID, STOREY_ID]]),
    contextID: 1,
  } as unknown as SpatialHierarchyOutput;
}

function makeScene(entities: unknown[]): SceneModel {
  return {
    entities,
    layersById: { lyr_default: { id: 'lyr_default', name: 'default' } },
    bounds: { min: { x: 0, y: 0 }, max: { x: 5000, y: 5000 } },
    units: 'mm',
  } as unknown as SceneModel;
}

function makeParams(
  scene: SceneModel,
  opts: { spec?: ThermalEnvelopeSpec; includePsets?: boolean } = {},
): IfcExportParams {
  return {
    scenes: new Map<string, SceneModel>([[FLOOR_ID, scene]]),
    envelopeSpecs: opts.spec ? new Map([[FLOOR_ID, opts.spec]]) : undefined,
    includePsets: opts.includePsets,
  } as unknown as IfcExportParams;
}

function makeCtx(): SerializerContext {
  const ctx = createSerializerContext();
  ctx.wallIDs.set('wall-1', WALL_IFC_ID);
  ctx.columnIDs.set('col-1', COLUMN_IFC_ID);
  ctx.slabIDs.set('slab-1', SLAB_IFC_ID);
  return ctx;
}

function spec(materialId: string, zones: Partial<ThermalEnvelopeSpec['zones']> = { Z1: true }): ThermalEnvelopeSpec {
  return {
    materialId,
    thickness_m: 0.1,
    revealThickness_m: 0.05,
    zones: { Z1: false, Z2: false, Z3: false, Z4: false, ...zones },
  };
}

function layer(materialId: string, zone: EnvelopeLayer['zone'], thickness_m = 0.1): EnvelopeLayer {
  return { materialId, thickness_m, zone };
}

function makeWall(): WallEntity {
  return {
    id: 'wall-1',
    type: 'wall',
    layerId: 'lyr_default',
    floorId: FLOOR_ID,
    kind: 'straight',
    ifcGuid: '0aZbYcXdWeVfUgThSiR0Q$',
    ifcType: 'IfcWallStandardCase',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      height: 3000,
      thickness: 200,
      flip: false,
      baseBinding: 'storey-floor',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
    },
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }] },
      outerEdge: { points: [{ x: 0, y: 100 }, { x: 5000, y: 100 }] },
      innerEdge: { points: [{ x: 0, y: -100 }, { x: 5000, y: -100 }] },
      bbox: { min: { x: 0, y: -100 }, max: { x: 5000, y: 100 } },
      length: 5,
      area: 15,
      volume: 3,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

function makeColumn(envelopeLayer?: EnvelopeLayer): ColumnEntity {
  return {
    id: 'col-1',
    type: 'column',
    layerId: 'lyr_default',
    floorId: FLOOR_ID,
    kind: 'rectangular',
    ifcGuid: '1aZbYcXdWeVfUgThSiR0Q$',
    ifcType: 'IfcColumn',
    params: {
      kind: 'rectangular',
      position: { x: 1000, y: 1000 },
      anchor: 'center',
      width: 400,
      depth: 400,
      height: 3000,
      rotation: 0,
      baseBinding: 'storey-floor',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
      ...(envelopeLayer ? { envelopeLayer } : {}),
    },
    geometry: { footprint: { vertices: [] }, bbox: { min: { x: 0, y: 0 }, max: { x: 400, y: 400 } }, area: 0.16, volume: 0.48, height: 3000 },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as ColumnEntity;
}

function makeSlab(envelopeLayer?: EnvelopeLayer): SlabEntity {
  return {
    id: 'slab-1',
    type: 'slab',
    layerId: 'lyr_default',
    floorId: FLOOR_ID,
    kind: 'roof',
    ifcGuid: '5aZbYcXdWeVfUgThSiR0Q$',
    ifcType: 'IfcSlab',
    params: {
      kind: 'roof',
      outline: { vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 4000 }, { x: 0, y: 4000 }] },
      levelElevation: 0,
      thickness: 200,
      geometryType: 'box',
      ...(envelopeLayer ? { envelopeLayer } : {}),
    },
    geometry: { polygon: { vertices: [] }, bbox: { min: { x: 0, y: 0 }, max: { x: 5000, y: 4000 } }, area: 20, netArea: 20, volume: 4, perimeter: 18, maxFreeSpanM: 4 },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SlabEntity;
}

function makeOpening(revealInsulation?: EnvelopeLayer): OpeningEntity {
  return {
    id: 'op-1',
    type: 'opening',
    layerId: 'lyr_default',
    floorId: FLOOR_ID,
    kind: 'window',
    ifcGuid: '7aZbYcXdWeVfUgThSiR0Q$',
    ifcType: 'IfcWindow',
    params: {
      kind: 'window',
      wallId: 'wall-1',
      offsetFromStart: 2000,
      width: 1200,
      height: 1400,
      sillHeight: 900,
      ...(revealInsulation ? { revealInsulation } : {}),
    },
    geometry: { position: { x: 0, y: 0 }, rotation: 0, outline: { vertices: [] }, bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }, area: 1.68, perimeter: 5.2 },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as OpeningEntity;
}

// ─── Assertions helpers ──────────────────────────────────────────────────────

function run(scene: SceneModel, opts: { spec?: ThermalEnvelopeSpec; includePsets?: boolean } = {}): IfcGraph {
  const graph = new IfcGraph();
  serializeEnvelopeCoverings(graph, makeSpatial(), makeParams(scene, opts), makeCtx());
  return graph;
}

function count(graph: IfcGraph, type: string): number {
  return graph.records().filter((r) => r.type === type).length;
}

function find(graph: IfcGraph, type: string): IfcEntityRecord | undefined {
  return graph.records().find((r) => r.type === type);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ADR-396 P9 — serializeEnvelopeCoverings', () => {
  it('(a) exterior wall + spec Z1 → covering + rel + material + layerSet + thermal Pset', () => {
    const graph = run(makeScene([makeWall()]), { spec: spec('mat-eps-graphite') });

    expect(count(graph, 'IFCCOVERING')).toBe(1);
    expect(count(graph, 'IFCRELCOVERSBLDGELEMENTS')).toBe(1);
    expect(count(graph, 'IFCMATERIAL')).toBe(1);
    expect(count(graph, 'IFCMATERIALLAYER')).toBe(1);
    expect(count(graph, 'IFCMATERIALLAYERSET')).toBe(1);
    expect(count(graph, 'IFCRELASSOCIATESMATERIAL')).toBe(1);
    expect(count(graph, 'IFCMATERIALPROPERTIES')).toBe(1);
    expect(count(graph, 'IFCPROPERTYSINGLEVALUE')).toBe(1);

    // Rel points at the wall's IFC id (RelatingBuildingElement = arg index 4).
    const rel = find(graph, 'IFCRELCOVERSBLDGELEMENTS');
    const relating = rel?.args[4] as IfcRefValue;
    expect(relating.id).toBe(WALL_IFC_ID);

    // Covering carried into storey containment.
    const ctxStoreyHas = graph.records().some((r) => r.type === 'IFCCOVERING');
    expect(ctxStoreyHas).toBe(true);
  });

  it('(a2) covering is semantic-only (placement + representation = $)', () => {
    const graph = run(makeScene([makeWall()]), { spec: spec('mat-eps-graphite') });
    const cov = find(graph, 'IFCCOVERING');
    // args: [GlobalId, $, Name, $, $, placement, representation, $, PredefinedType]
    expect(cov?.args[5]).toBeNull();
    expect(cov?.args[6]).toBeNull();
  });

  it('(b) column with envelopeLayer (Z1) → covering on the column', () => {
    const graph = run(makeScene([makeColumn(layer('mat-xps', 'Z1'))]));
    expect(count(graph, 'IFCCOVERING')).toBe(1);
    const relating = find(graph, 'IFCRELCOVERSBLDGELEMENTS')?.args[4] as IfcRefValue;
    expect(relating.id).toBe(COLUMN_IFC_ID);
  });

  it('(c) slab with envelopeLayer (Z3) → covering on the slab', () => {
    const graph = run(makeScene([makeSlab(layer('mat-eps-graphite', 'Z3'))]));
    expect(count(graph, 'IFCCOVERING')).toBe(1);
    const relating = find(graph, 'IFCRELCOVERSBLDGELEMENTS')?.args[4] as IfcRefValue;
    expect(relating.id).toBe(SLAB_IFC_ID);
  });

  it('(d) opening reveal (Z4) → covering on the host wall', () => {
    const graph = run(makeScene([makeOpening(layer('mat-eps-graphite', 'Z4', 0.05))]));
    expect(count(graph, 'IFCCOVERING')).toBe(1);
    const relating = find(graph, 'IFCRELCOVERSBLDGELEMENTS')?.args[4] as IfcRefValue;
    expect(relating.id).toBe(WALL_IFC_ID);
  });

  it('(e) includePsets:false → no thermal Pset (covering + material remain)', () => {
    const graph = run(makeScene([makeColumn(layer('mat-eps-graphite', 'Z1'))]), { includePsets: false });
    expect(count(graph, 'IFCCOVERING')).toBe(1);
    expect(count(graph, 'IFCMATERIAL')).toBe(1);
    expect(count(graph, 'IFCMATERIALPROPERTIES')).toBe(0);
  });

  it('(f) custom material (unknown λ) → covering without thermal Pset', () => {
    const graph = run(makeScene([makeColumn(layer('my-custom-foam', 'Z1'))]));
    expect(count(graph, 'IFCCOVERING')).toBe(1);
    expect(count(graph, 'IFCMATERIAL')).toBe(1);
    expect(count(graph, 'IFCMATERIALPROPERTIES')).toBe(0);
  });

  it('(g) spec.zones.Z1 = false → no wall covering', () => {
    const graph = run(makeScene([makeWall()]), { spec: spec('mat-eps-graphite', { Z1: false }) });
    expect(count(graph, 'IFCCOVERING')).toBe(0);
  });

  it('(g2) no envelopeSpecs → no wall covering', () => {
    const graph = run(makeScene([makeWall()]));
    expect(count(graph, 'IFCCOVERING')).toBe(0);
  });

  it('(h) thermal conductivity emitted as a typed STEP measure', () => {
    const graph = run(makeScene([makeColumn(layer('mat-eps-graphite', 'Z1'))]));
    const text = new TextDecoder().decode(writeStepIfc(graph));
    expect(text).toContain('IFCTHERMALCONDUCTIVITYMEASURE(');
    // λ(Neopor) = 0.031 (wall-material-catalog P8 SSoT)
    expect(text).toContain('IFCTHERMALCONDUCTIVITYMEASURE(0.031)');
    expect(text).toContain("IFCMATERIALPROPERTIES('Pset_MaterialThermal'");
  });
});
