/**
 * ADR-689 — `imported-mesh-faces` SSoT (σμιλεμένη εξαγωγή εισαγόμενου πλέγματος → DXF `3DFACE`).
 *
 * Επαληθεύει: world τρίγωνα → `dxfFaces` με το coordinate mapping (x=worldX/sceneToM,
 * y=-worldZ/sceneToM, zMm=worldY*1000)· cache miss/error → `null` carrier (fallback bbox)·
 * async pre-pass → map keyed by entity id.
 */

import * as THREE from 'three';
import type { Entity } from '../../../types/entities';
import type { ImportedMeshEntity } from '../../../bim/entities/imported-mesh/imported-mesh-types';

// ── Mock το async cache + το world placement (τα τρίγωνα δίνονται από εδώ) ──
const mockGetLoadState = jest.fn<string, [string, string]>();
const mockObject = jest.fn<THREE.Object3D | null, []>();

jest.mock('../../../bim-3d/library/bim-mesh-library/bim-mesh-cache', () => ({
  bimMeshCache: {
    preload: jest.fn(),
    awaitInFlightScenes: jest.fn().mockResolvedValue(0),
    getLoadState: (cat: string, asset: string) => mockGetLoadState(cat, asset),
  },
}));

jest.mock('../../../bim-3d/converters/imported-mesh-to-three', () => ({
  importedMeshToObject3D: () => mockObject(),
}));

import {
  buildImportedMeshFaceCarrier,
  buildImportedMeshFaceCarriers,
} from '../imported-mesh-faces';

/** Ένα εισαγόμενο πλέγμα entity (mm scene units). */
function mesh(id: string): ImportedMeshEntity {
  return {
    id, type: 'imported-mesh', layerId: 'lyr_m', color: '#abcdef', visible: true,
    params: { uploadId: 'imesh_1', nodeName: 'Chair', sceneUnits: 'mm', mountingElevationMm: 0 },
    geometry: { footprint: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] } },
  } as unknown as ImportedMeshEntity;
}

/** THREE.Group με ΕΝΑ mesh τριγώνου σε world μέτρα: (0,0,0),(1,0,0),(0,2,0). */
function triangleObject(): THREE.Object3D {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 2, 0], 3),
  );
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry));
  group.updateMatrixWorld(true);
  return group;
}

beforeEach(() => {
  mockGetLoadState.mockReset();
  mockObject.mockReset();
});

describe('buildImportedMeshFaceCarrier', () => {
  it('φορτωμένο πλέγμα → solid HATCH carrier με τα world τρίγωνα ως dxfFaces (mm mapping)', () => {
    mockGetLoadState.mockReturnValue('ready');
    mockObject.mockReturnValue(triangleObject());

    const carrier = buildImportedMeshFaceCarrier(mesh('m1'));
    expect(carrier).not.toBeNull();
    if (!carrier) throw new Error('null');

    expect(carrier.type).toBe('hatch');
    expect(carrier.id).toBe('m1__mesh3dfaces');
    expect(carrier.layerId).toBe('lyr_m');
    expect(carrier.color).toBe('#abcdef');
    // ΕΝΑ face (τρίγωνο) — mm: x=worldX*1000, y=-worldZ*1000, zMm=worldY*1000.
    expect(carrier.dxfFaces).toEqual([[
      { x: 0, y: 0, zMm: 0 },
      { x: 1000, y: 0, zMm: 0 },
      { x: 0, y: 0, zMm: 2000 },
    ]]);
  });

  it('cache miss (getLoadState !== ready) → null (ο caller πέφτει στο bounding-box)', () => {
    mockGetLoadState.mockReturnValue('error');
    expect(buildImportedMeshFaceCarrier(mesh('m2'))).toBeNull();
    expect(mockObject).not.toHaveBeenCalled();
  });

  it('φορτωμένο αλλά χωρίς τρίγωνα → null', () => {
    mockGetLoadState.mockReturnValue('ready');
    mockObject.mockReturnValue(new THREE.Group()); // κενό — κανένα mesh
    expect(buildImportedMeshFaceCarrier(mesh('m3'))).toBeNull();
  });
});

describe('buildImportedMeshFaceCarriers (async pre-pass)', () => {
  it('map keyed by entity id, μόνο για ό,τι φορτώθηκε', async () => {
    mockGetLoadState.mockReturnValue('ready');
    mockObject.mockReturnValue(triangleObject());

    const other: Entity = { id: 'line1', type: 'line' } as unknown as Entity;
    const map = await buildImportedMeshFaceCarriers([mesh('m1'), other]);

    expect([...map.keys()]).toEqual(['m1']);
    expect(map.get('m1')).toHaveLength(1);
  });

  it('μηδέν εισαγόμενα πλέγματα → κενό map (μηδέν cache calls)', async () => {
    const map = await buildImportedMeshFaceCarriers([
      { id: 'a', type: 'circle' } as unknown as Entity,
    ]);
    expect(map.size).toBe(0);
  });
});
