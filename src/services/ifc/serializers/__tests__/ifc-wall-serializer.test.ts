/**
 * @jest-environment node
 *
 * IFC4 Wall Serializer — unit tests (ADR-396 P10)
 *
 * Verifies: IfcMaterialLayerSet από DNA + Pset_WallCommon.ThermalTransmittance.
 * Direct-graph approach (mirror of ifc-covering-serializer.test.ts).
 * jest globals (ΟΧΙ vitest).
 */

import { IfcGraph } from '../../ifc-entity-graph';
import { writeStepIfc } from '../../ifc-step-writer';
import type { SpatialHierarchyOutput } from '../../ifc-spatial-hierarchy';
import type { IfcExportParams } from '../../ifc-exporter.service';
import { createSerializerContext } from '../serializer-context';
import { serializeWalls } from '../ifc-wall-serializer';

import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import type { WallEntity } from '@/subapps/dxf-viewer/bim/types/wall-types';
import type { WallDna } from '@/subapps/dxf-viewer/bim/types/wall-dna-types';

const FLOOR_ID = 'f-wall-test';
const STOREY_ID = 20;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSpatial(): SpatialHierarchyOutput {
  return {
    storeyIDs: new Map([[FLOOR_ID, STOREY_ID]]),
    contextID: 1,
  } as unknown as SpatialHierarchyOutput;
}

function makeDna(layers: Array<{ thickness: number; materialId: string }>): WallDna {
  return {
    layers: layers.map((l, i) => ({
      id: `layer-${i}`,
      name: l.materialId,
      thickness: l.thickness,
      materialId: l.materialId,
      side: i === 0 ? 'exterior' : i === layers.length - 1 ? 'interior' : 'core',
    })),
    totalThickness: layers.reduce((s, l) => s + l.thickness, 0),
  };
}

const EXTERIOR_DNA = makeDna([
  { thickness: 20, materialId: 'mat-plaster-ext' },
  { thickness: 200, materialId: 'mat-brick-masonry' },
  { thickness: 20, materialId: 'mat-plaster-int' },
]);

function makeWall(opts: { category?: WallEntity['params']['category']; dna?: WallDna } = {}): WallEntity {
  return {
    id: 'wall-1',
    type: 'wall',
    layerId: 'lyr_default',
    floorId: FLOOR_ID,
    kind: 'straight',
    ifcGuid: '2aZbYcXdWeVfUgThSiR0Q$',
    ifcType: 'IfcWallStandardCase',
    name: 'W-1',
    params: {
      category: opts.category ?? 'exterior',
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      height: 3000,
      thickness: opts.dna?.totalThickness ?? 200,
      flip: false,
      baseBinding: 'storey-floor',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
      ...(opts.dna ? { dna: opts.dna } : {}),
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

function makeScene(entities: unknown[]): SceneModel {
  return {
    entities,
    layersById: { lyr_default: { id: 'lyr_default', name: 'default' } },
    bounds: { min: { x: 0, y: 0 }, max: { x: 5000, y: 5000 } },
    units: 'mm',
  } as unknown as SceneModel;
}

function makeParams(scene: SceneModel, opts: { includePsets?: boolean; floors?: unknown[] } = {}): IfcExportParams {
  return {
    scenes: new Map([[FLOOR_ID, scene]]),
    floors: opts.floors ?? [{ id: FLOOR_ID }],
    includePsets: opts.includePsets,
  } as unknown as IfcExportParams;
}

function run(wall: WallEntity, opts: { includePsets?: boolean } = {}): IfcGraph {
  const graph = new IfcGraph();
  const ctx = createSerializerContext();
  serializeWalls(graph, makeSpatial(), makeParams(makeScene([wall]), opts), ctx);
  return graph;
}

function count(graph: IfcGraph, type: string): number {
  return graph.records().filter((r) => r.type === type).length;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ADR-396 P10 — serializeWalls material + pset', () => {
  it('(a) wall με DNA → IfcWallStandardCase εκπέμπεται', () => {
    const graph = run(makeWall({ dna: EXTERIOR_DNA }));
    expect(count(graph, 'IFCWALLSTANDARDCASE')).toBe(1);
  });

  it('(b) wall με DNA → IfcMaterialLayerSet + IfcMaterialLayer ανά στρώση', () => {
    const graph = run(makeWall({ dna: EXTERIOR_DNA }));
    expect(count(graph, 'IFCMATERIALLAYERSET')).toBe(1);
    expect(count(graph, 'IFCMATERIALLAYER')).toBe(3); // 3 layers
    expect(count(graph, 'IFCMATERIAL')).toBe(3);
  });

  it('(c) wall με DNA → IfcMaterialLayerSetUsage + IfcRelAssociatesMaterial', () => {
    const graph = run(makeWall({ dna: EXTERIOR_DNA }));
    expect(count(graph, 'IFCMATERIALLAYERSETUSAGE')).toBe(1);
    expect(count(graph, 'IFCRELASSOCIATESMATERIAL')).toBe(1);
  });

  it('(d) wall χωρίς DNA → χωρίς material layer set', () => {
    const graph = run(makeWall());
    expect(count(graph, 'IFCMATERIALLAYERSET')).toBe(0);
    expect(count(graph, 'IFCMATERIALLAYER')).toBe(0);
  });

  it('(e) includePsets:true → Pset_WallCommon εκπέμπεται', () => {
    const graph = run(makeWall({ dna: EXTERIOR_DNA }), { includePsets: true });
    expect(count(graph, 'IFCPROPERTYSET')).toBe(1);
    expect(count(graph, 'IFCRELDEFINESBYPROPERTIES')).toBe(1);
    // IsExternal + LoadBearing + ThermalTransmittance = 3 properties
    expect(count(graph, 'IFCPROPERTYSINGLEVALUE')).toBe(3);
  });

  it('(f) includePsets:false → χωρίς Pset', () => {
    const graph = run(makeWall({ dna: EXTERIOR_DNA }), { includePsets: false });
    expect(count(graph, 'IFCPROPERTYSET')).toBe(0);
    expect(count(graph, 'IFCRELDEFINESBYPROPERTIES')).toBe(0);
  });

  it('(g) ThermalTransmittance εκπέμπεται ως STEP typed measure', () => {
    const graph = run(makeWall({ dna: EXTERIOR_DNA }), { includePsets: true });
    const text = new TextDecoder().decode(writeStepIfc(graph));
    expect(text).toContain('IFCTHERMALTRANSMITTANCEMEASURE(');
    expect(text).toContain("'Pset_WallCommon'");
  });

  it('(h) ThermalTransmittance > 0 για τοίχο με DNA (υπολογίσιμο U)', () => {
    const graph = run(makeWall({ dna: EXTERIOR_DNA }), { includePsets: true });
    const text = new TextDecoder().decode(writeStepIfc(graph));
    // Ο τοίχος έχει U ≈ 1.63 > 0
    const match = text.match(/IFCTHERMALTRANSMITTANCEMEASURE\(([\d.]+)\)/);
    expect(match).not.toBeNull();
    const u = parseFloat(match![1]);
    expect(u).toBeGreaterThan(0.5); // τοίχος χωρίς μόνωση → U > 0.5
    expect(u).toBeLessThan(5);
  });

  it('(i) εξωτ. τοίχος → IsExternal=.T.', () => {
    const graph = run(makeWall({ category: 'exterior', dna: EXTERIOR_DNA }), { includePsets: true });
    const text = new TextDecoder().decode(writeStepIfc(graph));
    expect(text).toContain("'IsExternal',$,.T.,$");
  });

  it('(j) εσωτ. τοίχος → IsExternal=.F.', () => {
    const graph = run(makeWall({ category: 'interior', dna: EXTERIOR_DNA }), { includePsets: true });
    const text = new TextDecoder().decode(writeStepIfc(graph));
    expect(text).toContain("'IsExternal',$,.F.,$");
  });

  it('(k) wall χωρίς DNA + includePsets → Pset_WallCommon με U=0', () => {
    const graph = run(makeWall(), { includePsets: true });
    expect(count(graph, 'IFCPROPERTYSET')).toBe(1);
    const text = new TextDecoder().decode(writeStepIfc(graph));
    // STEP format: 0 → "0." (IfcReal)
    expect(text).toMatch(/IFCTHERMALTRANSMITTANCEMEASURE\(0\.?\)/);
  });
});
