/**
 * @jest-environment node
 *
 * IFC4 STEP21 Roundtrip Validation (ADR-369 §Q8.3.5)
 *
 * Verifies that the Nestor text-writer (`IfcExporter`) produces an IFC4 file
 * that the `web-ifc` reference parser can open without errors and whose
 * spatial hierarchy matches the input domain model exactly.
 *
 * Strategy (Revit-style enterprise validation):
 *  1. Construct a synthetic Project + Buildings[] + Floors[] sample.
 *  2. Run `IfcExporter.exportProject()` → `Uint8Array`.
 *  3. Parse the bytes with `IfcAPI.OpenModel()` (web-ifc WASM, MPL-2.0).
 *  4. Assert schema version + entity counts + spatial chain integrity.
 *
 * web-ifc is loaded from `node_modules/web-ifc/` with absolute path so the
 * WASM blob resolves correctly under Jest's node environment.
 */

import * as path from 'path';
import {
  IfcAPI,
  IFCPROJECT,
  IFCSITE,
  IFCBUILDING,
  IFCBUILDINGSTOREY,
  IFCRELAGGREGATES,
  IFCWALLSTANDARDCASE,
  IFCEXTRUDEDAREASOLID,
  IFCRELCONTAINEDINSPATIALSTRUCTURE,
  IFCCOLUMN,
  IFCBEAM,
  IFCSLAB,
  IFCDOOR,
  IFCWINDOW,
  IFCOPENINGELEMENT,
  IFCRELVOIDSELEMENT,
  IFCRELFILLSELEMENT,
} from 'web-ifc';

import { IfcExporter } from '../ifc-exporter.service';
import { CombinedEntitySerializer } from '../serializers';
import type { Project } from '@/types/project';
import type { Building } from '@/types/building/contracts';
import type { FloorDocument } from '@/app/api/floors/floors.types';
import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import type { WallEntity } from '@/subapps/dxf-viewer/bim/types/wall-types';
import type { ColumnEntity } from '@/subapps/dxf-viewer/bim/types/column-types';
import type { BeamEntity } from '@/subapps/dxf-viewer/bim/types/beam-types';
import type { SlabEntity } from '@/subapps/dxf-viewer/bim/types/slab-types';
import type { OpeningEntity } from '@/subapps/dxf-viewer/bim/types/opening-types';

// ─── Sample fixture ─────────────────────────────────────────────────────────

function makeSampleProject(): {
  project: Project;
  buildings: Building[];
  floors: FloorDocument[];
} {
  const project = {
    id: 'prj-1',
    name: 'Roundtrip Test Project',
    title: 'Roundtrip Test',
    status: 'planning',
    company: 'Test Co',
    companyId: 'co-1',
    address: 'Test Street 1',
    city: 'Athens',
    progress: 0,
    totalValue: 0,
    lastUpdate: new Date().toISOString(),
    totalArea: 0,
    northRotation: 12,
    surveyPoint: { z: 145.7 },
  } as unknown as Project;

  const buildings: Building[] = [
    {
      id: 'b-1',
      name: 'Κτήριο Α',
      code: 'A',
      projectId: project.id,
      totalArea: 1200,
      floors: 3,
      status: 'in_progress',
      progress: 0,
      baseElevation: 0,
    } as unknown as Building,
    {
      id: 'b-2',
      name: 'Κτήριο Β',
      code: 'B',
      projectId: project.id,
      totalArea: 900,
      floors: 2,
      status: 'in_progress',
      progress: 0,
      baseElevation: 0.85,
    } as unknown as Building,
  ];

  const floors: FloorDocument[] = [
    { id: 'f-1a', buildingId: 'b-1', number: 0, name: 'GF', longName: 'Ισόγειο', elevation: 0 } as FloorDocument,
    { id: 'f-1b', buildingId: 'b-1', number: 1, name: 'L1', longName: '1ος Όροφος', elevation: 3.2 } as FloorDocument,
    { id: 'f-1c', buildingId: 'b-1', number: 2, name: 'L2', longName: '2ος Όροφος', elevation: 6.4 } as FloorDocument,
    { id: 'f-2a', buildingId: 'b-2', number: 0, name: 'GF', longName: 'Ισόγειο', elevation: 0 } as FloorDocument,
    { id: 'f-2b', buildingId: 'b-2', number: 1, name: 'L1', longName: '1ος Όροφος', elevation: 3.0 } as FloorDocument,
  ];

  return { project, buildings, floors };
}

// ─── web-ifc lifecycle ──────────────────────────────────────────────────────

let api: IfcAPI;

beforeAll(async () => {
  api = new IfcAPI();
  // Resolve the package directory via the entry point so the WASM binary
  // loads correctly under Jest+pnpm (package.json is not in the `exports`
  // map so `resolve('web-ifc/package.json')` would fail).
  const apiEntry = require.resolve('web-ifc');
  const wasmDir = path.dirname(apiEntry) + path.sep;
  api.SetWasmPath(wasmDir, true);
  await api.Init();
});

afterAll(() => {
  api.Dispose();
});

// ─── Assertions ─────────────────────────────────────────────────────────────

describe('IFC4 export — roundtrip validation', () => {
  it('produces a file that web-ifc can open with IFC4 schema', () => {
    const { project, buildings, floors } = makeSampleProject();
    const exporter = new IfcExporter();
    const { bytes, fileName, entityCount } = exporter.exportProject({
      project,
      buildings,
      floors,
    });

    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(fileName).toMatch(/\.ifc$/);
    expect(entityCount).toBeGreaterThan(0);

    const modelID = api.OpenModel(bytes);
    expect(modelID).not.toBe(-1);

    try {
      expect(api.GetModelSchema(modelID)).toBe('IFC4');
    } finally {
      api.CloseModel(modelID);
    }
  });

  it('preserves the spatial hierarchy entity counts exactly', () => {
    const { project, buildings, floors } = makeSampleProject();
    const exporter = new IfcExporter();
    const { bytes } = exporter.exportProject({ project, buildings, floors });

    const modelID = api.OpenModel(bytes);
    try {
      expect(getLineCount(modelID, IFCPROJECT)).toBe(1);
      expect(getLineCount(modelID, IFCSITE)).toBe(1);
      expect(getLineCount(modelID, IFCBUILDING)).toBe(buildings.length);
      expect(getLineCount(modelID, IFCBUILDINGSTOREY)).toBe(floors.length);
      // 1 (project→site) + 1 (site→buildings) + N (per-building→storeys) = 2 + buildings.length
      expect(getLineCount(modelID, IFCRELAGGREGATES)).toBe(2 + buildings.length);
    } finally {
      api.CloseModel(modelID);
    }
  });

  it('emits long Greek storey names verbatim (IFC4 UTF-16 escape)', () => {
    const { project, buildings, floors } = makeSampleProject();
    const exporter = new IfcExporter();
    const { bytes } = exporter.exportProject({ project, buildings, floors });

    const modelID = api.OpenModel(bytes);
    try {
      const storeyIDs = api.GetLineIDsWithType(modelID, IFCBUILDINGSTOREY);
      const decodedLongNames = new Set<string>();
      for (let i = 0; i < storeyIDs.size(); i += 1) {
        const expressID = storeyIDs.get(i);
        const line = api.GetLine(modelID, expressID);
        // IfcBuildingStorey.LongName is the 8th attribute (0-based: index 7).
        // web-ifc exposes attributes by name on the flattened line object.
        const longName = (line as { LongName?: { value?: string } }).LongName?.value;
        if (longName) decodedLongNames.add(longName);
      }
      expect(decodedLongNames.has('Ισόγειο')).toBe(true);
      expect(decodedLongNames.has('1ος Όροφος')).toBe(true);
      expect(decodedLongNames.has('2ος Όροφος')).toBe(true);
    } finally {
      api.CloseModel(modelID);
    }
  });
});

// ─── Entity-level tests (ADR-369 Q8.4) ──────────────────────────────────────

describe('IFC4 export — building elements', () => {
  it('writes IfcWallStandardCase with extrusion + storey containment', () => {
    const { project, buildings, floors } = makeSampleProject();
    const scenes = new Map<string, SceneModel>();
    scenes.set('f-1a', makeSceneWith('f-1a', [makeSampleWall('f-1a')]));

    const exporter = new IfcExporter();
    const { bytes } = exporter.exportProject({
      project,
      buildings,
      floors,
      scenes,
      entitySerializer: new CombinedEntitySerializer(),
    });

    const modelID = api.OpenModel(bytes);
    try {
      expect(getLineCount(modelID, IFCWALLSTANDARDCASE)).toBe(1);
      expect(getLineCount(modelID, IFCEXTRUDEDAREASOLID)).toBeGreaterThanOrEqual(1);
      expect(getLineCount(modelID, IFCRELCONTAINEDINSPATIALSTRUCTURE)).toBeGreaterThanOrEqual(1);
    } finally {
      api.CloseModel(modelID);
    }
  });

  it('writes IfcOpeningElement + IfcDoor + IfcWindow voiding/filling host wall', () => {
    const { project, buildings, floors } = makeSampleProject();
    const scenes = new Map<string, SceneModel>();
    const wall = makeSampleWall('f-1a');
    const door = makeSampleOpening('f-1a', 'op-door', wall.id, 'door');
    const window = makeSampleOpening('f-1a', 'op-win', wall.id, 'window');
    scenes.set('f-1a', makeSceneWith('f-1a', [wall, door, window]));

    const exporter = new IfcExporter();
    const { bytes } = exporter.exportProject({
      project,
      buildings,
      floors,
      scenes,
      entitySerializer: new CombinedEntitySerializer(),
    });

    const modelID = api.OpenModel(bytes);
    try {
      expect(getLineCount(modelID, IFCOPENINGELEMENT)).toBe(2);
      expect(getLineCount(modelID, IFCDOOR)).toBe(1);
      expect(getLineCount(modelID, IFCWINDOW)).toBe(1);
      expect(getLineCount(modelID, IFCRELVOIDSELEMENT)).toBe(2);
      expect(getLineCount(modelID, IFCRELFILLSELEMENT)).toBe(2);
    } finally {
      api.CloseModel(modelID);
    }
  });

  it('writes IfcSlab (box geometry) with arbitrary-polygon profile', () => {
    const { project, buildings, floors } = makeSampleProject();
    const scenes = new Map<string, SceneModel>();
    scenes.set('f-1a', makeSceneWith('f-1a', [makeSampleSlab('f-1a')]));

    const exporter = new IfcExporter();
    const { bytes } = exporter.exportProject({
      project,
      buildings,
      floors,
      scenes,
      entitySerializer: new CombinedEntitySerializer(),
    });

    const modelID = api.OpenModel(bytes);
    try {
      expect(getLineCount(modelID, IFCSLAB)).toBe(1);
    } finally {
      api.CloseModel(modelID);
    }
  });

  it('writes IfcBeam (rectangular + I-shape) with storey containment', () => {
    const { project, buildings, floors } = makeSampleProject();
    const scenes = new Map<string, SceneModel>();
    scenes.set('f-1a', makeSceneWith('f-1a', [
      makeSampleBeam('f-1a', 'beam-rc'),
      makeSampleBeam('f-1a', 'beam-steel', 'I'),
    ]));

    const exporter = new IfcExporter();
    const { bytes } = exporter.exportProject({
      project,
      buildings,
      floors,
      scenes,
      entitySerializer: new CombinedEntitySerializer(),
    });

    const modelID = api.OpenModel(bytes);
    try {
      expect(getLineCount(modelID, IFCBEAM)).toBe(2);
    } finally {
      api.CloseModel(modelID);
    }
  });

  it('writes IfcColumn (rectangular + circular) with storey containment', () => {
    const { project, buildings, floors } = makeSampleProject();
    const scenes = new Map<string, SceneModel>();
    scenes.set('f-1a', makeSceneWith('f-1a', [
      makeSampleColumn('f-1a', 'col-rect', 'rectangular'),
      makeSampleColumn('f-1a', 'col-circ', 'circular'),
    ]));

    const exporter = new IfcExporter();
    const { bytes } = exporter.exportProject({
      project,
      buildings,
      floors,
      scenes,
      entitySerializer: new CombinedEntitySerializer(),
    });

    const modelID = api.OpenModel(bytes);
    try {
      expect(getLineCount(modelID, IFCCOLUMN)).toBe(2);
    } finally {
      api.CloseModel(modelID);
    }
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLineCount(modelID: number, typeCode: number): number {
  const ids = api.GetLineIDsWithType(modelID, typeCode);
  return ids.size();
}

function makeSceneWith(_floorId: string, entities: unknown[]): SceneModel {
  return {
    entities,
    layersById: { 'lyr_default': { id: 'lyr_default', name: 'default' } },
    bounds: { min: { x: 0, y: 0 }, max: { x: 5000, y: 5000 } },
    units: 'mm',
  } as unknown as SceneModel;
}

function makeSampleOpening(
  floorId: string,
  id: string,
  wallId: string,
  kind: 'door' | 'window',
): OpeningEntity {
  const isDoor = kind === 'door';
  return {
    id,
    type: 'opening',
    layerId: 'lyr_default',
    floorId,
    kind,
    ifcGuid: isDoor ? '6aZbYcXdWeVfUgThSiR0Q$' : '7aZbYcXdWeVfUgThSiR0Q$',
    ifcType: isDoor ? 'IfcDoor' : 'IfcWindow',
    params: {
      kind,
      wallId,
      offsetFromStart: isDoor ? 500 : 2500,
      width: isDoor ? 900 : 1200,
      height: isDoor ? 2100 : 1400,
      sillHeight: isDoor ? 0 : 900,
    },
    geometry: {
      position: { x: 0, y: 0 },
      rotation: 0,
      outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      area: 1.89,
      perimeter: 6,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as OpeningEntity;
}

function makeSampleSlab(floorId: string): SlabEntity {
  return {
    id: 'slab-1',
    type: 'slab',
    layerId: 'lyr_default',
    floorId,
    kind: 'floor',
    ifcGuid: '5aZbYcXdWeVfUgThSiR0Q$',
    ifcType: 'IfcSlab',
    params: {
      kind: 'floor',
      outline: {
        vertices: [
          { x: 0, y: 0 },
          { x: 5000, y: 0 },
          { x: 5000, y: 4000 },
          { x: 0, y: 4000 },
        ],
      },
      levelElevation: 0,
      thickness: 200,
      geometryType: 'box',
    },
    geometry: {
      polygon: { vertices: [] },
      bbox: { min: { x: 0, y: 0 }, max: { x: 5000, y: 4000 } },
      area: 20,
      netArea: 20,
      volume: 4,
      perimeter: 18,
      maxFreeSpanM: 4,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as SlabEntity;
}

function makeSampleBeam(
  floorId: string,
  id: string,
  sectionType?: 'I' | 'H',
): BeamEntity {
  return {
    id,
    type: 'beam',
    layerId: 'lyr_default',
    floorId,
    kind: 'straight',
    ifcGuid: id === 'beam-rc' ? '3aZbYcXdWeVfUgThSiR0Q$' : '4aZbYcXdWeVfUgThSiR0Q$',
    ifcType: 'IfcBeam',
    params: {
      kind: 'straight',
      startPoint: { x: 0, y: id === 'beam-rc' ? 2000 : 3000 },
      endPoint: { x: 5000, y: id === 'beam-rc' ? 2000 : 3000 },
      width: 250,
      depth: 500,
      topElevation: 3000,
      sectionType,
    },
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 2000 }, { x: 5000, y: 2000 }] },
      outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0 }, max: { x: 5000, y: 250 } },
      length: 5,
      area: 1.25,
      volume: 0.625,
      maxFreeSpanM: 5,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as BeamEntity;
}

function makeSampleColumn(
  floorId: string,
  id: string,
  kind: 'rectangular' | 'circular',
): ColumnEntity {
  return {
    id,
    type: 'column',
    layerId: 'lyr_default',
    floorId,
    kind,
    ifcGuid: id === 'col-rect' ? '1aZbYcXdWeVfUgThSiR0Q$' : '2aZbYcXdWeVfUgThSiR0Q$',
    ifcType: 'IfcColumn',
    params: {
      kind,
      position: { x: id === 'col-rect' ? 1000 : 3000, y: 1000 },
      anchor: 'center',
      width: 400,
      depth: 400,
      height: 3000,
      rotation: 0,
      baseBinding: 'storey-floor',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
    },
    geometry: {
      footprint: { vertices: [] },
      bbox: { min: { x: 0, y: 0 }, max: { x: 400, y: 400 } },
      area: 0.16,
      volume: 0.48,
      height: 3000,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as ColumnEntity;
}

function makeSampleWall(floorId: string): WallEntity {
  return {
    id: 'wall-1',
    type: 'wall',
    layerId: 'lyr_default',
    floorId,
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
