// Stub Firebase auth chain before any imports — BaseEntityRenderer →
// PhaseManager transitively touches firestore/auth in test env.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-683 — 2Δ silhouette χωρίς 3Δ roundtrip.
 *
 * Ο `ImportedMeshRenderer` + ο `FurnitureRenderer` πρέπει να **πυροδοτούν οι ίδιοι** το
 * `bimMeshCache.preload` όταν το cache είναι άδειο (cache-miss), καθρέφτης του υπάρχοντος
 * `MepFixtureRenderer.ts:111`. Χωρίς αυτό, μια φρέσκια εισαγωγή που μένει στο 2Δ δεν φόρτωνε ποτέ το
 * `.glb` (μόνο ο 3Δ converter καλούσε `preload`) → μόνιμο bbox κουτί μέχρι 3Δ roundtrip.
 *
 * Το cache mock-άρεται ώστε ΟΛΟΙ οι getters να γυρίζουν `null` (miss) → ο renderer πέφτει στο
 * fallback → πρέπει να καλέσει `preload(category, assetId)`.
 */

// Mock the shared mesh cache — every read misses so the renderer hits the fallback path.
jest.mock('../../../bim-3d/library/bim-mesh-library/bim-mesh-cache', () => ({
  __esModule: true,
  bimMeshCache: {
    getSilhouette: jest.fn(() => null),
    getTopEdges: jest.fn(() => null),
    getFillContours: jest.fn(() => null),
    getSlotSilhouettes: jest.fn(() => null),
    getLoadState: jest.fn(() => 'loading'),
    preload: jest.fn(),
  },
}));

import { ImportedMeshRenderer } from '../ImportedMeshRenderer';
import { FurnitureRenderer } from '../FurnitureRenderer';
import { bimMeshCache } from '../../../bim-3d/library/bim-mesh-library/bim-mesh-cache';
import { IMPORTED_MESH_CATEGORY, importedMeshAssetId } from '../../entities/imported-mesh/imported-mesh-types';
import type { EntityModel } from '../../../rendering/types/Types';

const preloadMock = bimMeshCache.preload as jest.Mock;

function createMockCtx(width = 800, height = 600) {
  const record = () => (): unknown => undefined;
  const canvas = { width, height, getBoundingClientRect: () => ({ width, height, left: 0, top: 0, right: width, bottom: height, x: 0, y: 0 }) };
  const ctx = {
    canvas,
    save: record(), restore: record(), beginPath: record(), moveTo: record(), lineTo: record(),
    closePath: record(), stroke: record(), fill: record(), clip: record(), arc: record(), setLineDash: record(),
    set globalCompositeOperation(_v: string) {}, set globalAlpha(_v: number) {},
    set fillStyle(_v: string) {}, set strokeStyle(_v: string) {}, set lineWidth(_v: number) {},
    set lineCap(_v: string) {}, set lineJoin(_v: string) {}, set shadowBlur(_v: number) {}, set shadowColor(_v: string) {},
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

const SQUARE = [
  { x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, { x: 1000, y: 1000, z: 0 }, { x: 0, y: 1000, z: 0 },
];
const BBOX = { min: { x: 0, y: 0, z: 0 }, max: { x: 1000, y: 1000, z: 1000 } };

function makeImportedMesh(): EntityModel {
  return {
    id: 'im1', type: 'imported-mesh', ifcType: 'IfcBuildingElementProxy',
    params: {
      kind: 'imported', uploadId: 'imesh_1', nodeName: 'Rail_01',
      storagePath: 'p/imesh_1.glb', sourceFileName: 'karekla.glb',
      position: { x: 0, y: 0, z: 0 }, rotationDeg: 0, sceneUnits: 'mm',
      measuredWidthMm: 1000, measuredDepthMm: 1000, measuredHeightMm: 1000,
      measuredSurfaceAreaM2: 1, measuredVolumeM3: null, mountingElevationMm: 0,
    },
    geometry: { footprint: { vertices: SQUARE }, bbox: BBOX, area: 1, height: 1000 },
  } as unknown as EntityModel;
}

function makeFurniture(): EntityModel {
  return {
    id: 'f1', type: 'furniture', ifcType: 'IfcFurniture',
    params: {
      kind: 'chair', assetId: 'chair_01', position: { x: 0, y: 0, z: 0 }, rotationDeg: 0,
      widthMm: 500, depthMm: 500, heightMm: 900, mountingElevationMm: 0, sceneUnits: 'mm',
    },
    geometry: { footprint: { vertices: SQUARE }, bbox: BBOX, area: 0.25, height: 900 },
  } as unknown as EntityModel;
}

beforeEach(() => { preloadMock.mockClear(); });

describe('ADR-683 — render-driven preload on cache-miss (μηδέν 3Δ roundtrip)', () => {
  it('ImportedMeshRenderer → preload(IMPORTED_MESH_CATEGORY, assetId) σε άδειο cache', () => {
    const renderer = new ImportedMeshRenderer(createMockCtx()) as unknown as {
      setTransform: (t: { scale: number; offsetX: number; offsetY: number }) => void;
      render: (e: EntityModel, o?: unknown) => void;
    };
    renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
    renderer.render(makeImportedMesh(), {});
    expect(preloadMock).toHaveBeenCalledWith(IMPORTED_MESH_CATEGORY, importedMeshAssetId('imesh_1', 'Rail_01'));
  });

  it('FurnitureRenderer → preload("furniture", assetId) σε άδειο cache (ίδιο gap)', () => {
    const renderer = new FurnitureRenderer(createMockCtx()) as unknown as {
      setTransform: (t: { scale: number; offsetX: number; offsetY: number }) => void;
      render: (e: EntityModel, o?: unknown) => void;
    };
    renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
    renderer.render(makeFurniture(), {});
    expect(preloadMock).toHaveBeenCalledWith('furniture', 'chair_01');
  });

  it('cache-hit (silhouette διαθέσιμο) → ΚΑΝΕΝΑ preload (δεν σπαταλά δίκτυο)', () => {
    (bimMeshCache.getSilhouette as jest.Mock).mockReturnValueOnce([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 },
    ]);
    const renderer = new FurnitureRenderer(createMockCtx()) as unknown as {
      setTransform: (t: { scale: number; offsetX: number; offsetY: number }) => void;
      render: (e: EntityModel, o?: unknown) => void;
    };
    renderer.setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
    renderer.render(makeFurniture(), {});
    expect(preloadMock).not.toHaveBeenCalled();
  });
});
