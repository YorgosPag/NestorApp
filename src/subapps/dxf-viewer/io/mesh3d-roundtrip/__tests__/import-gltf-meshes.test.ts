/**
 * ADR-683 Φ3β — `importGltfMeshes`: ο κόμβος χωρίς αντιστοίχιση γίνεται οντότητα στη σκηνή.
 *
 * Ελέγχονται τα σημεία που **σπάνε σιωπηλά**, όχι το happy path για τη συμπλήρωση αριθμού:
 *  - η δήλωση του asset γίνεται **πριν** μπει η οντότητα στη σκηνή (αλλιώς το πρώτο resolve
 *    χτυπά το path της βιβλιοθήκης και το πλέγμα δεν βρίσκεται ποτέ)·
 *  - αποτυχία upload ⇒ **καμία** οντότητα (αλλιώς μένει μόνιμο placeholder χωρίς αρχείο)·
 *  - κανένας εισαγώγιμος κόμβος ⇒ **κανένα** upload (αλλιώς ορφανά `.glb` στο Storage).
 */

import type { GltfObjectRecord } from '../gltf-scene-parse';
import type { SceneAppendAccessor } from '../../../bim/scene/append-entity-to-scene';

const uploadImportedMeshFile = jest.fn();
const registerImportedMeshAsset = jest.fn();
const appendEntitiesToScene = jest.fn();

jest.mock('../../../bim-3d/library/bim-mesh-library/imported-mesh-assets', () => ({
  uploadImportedMeshFile: (...a: unknown[]) => uploadImportedMeshFile(...a),
  registerImportedMeshAsset: (...a: unknown[]) => registerImportedMeshAsset(...a),
}));

jest.mock('../../../bim/scene/append-entity-to-scene', () => ({
  appendEntitiesToScene: (...a: unknown[]) => appendEntitiesToScene(...a),
}));

// Ο orchestrator είναι ο ιδιοκτήτης του `uploadId` (το παράγει και το ΔΙΝΕΙ στο upload) — δεν το
// παραλαμβάνει. Καρφώνεται ώστε το test να ελέγχει ότι το ίδιο id φτάνει ΚΑΙ στο upload ΚΑΙ στη
// δήλωση asset· αν αποκλίνουν, το πλέγμα δεν βρίσκεται ποτέ.
jest.mock('@/services/enterprise-id.service', () => ({
  __esModule: true,
  generateImportedMeshId: () => 'imesh_x',
}));

import { importGltfMeshes, isImportableNode } from '../import-gltf-meshes';

const accessor: SceneAppendAccessor = {
  currentLevelId: 'level_1',
  getLevelScene: () => null,
  setLevelScene: () => undefined,
};

function record(overrides: Partial<GltfObjectRecord> = {}): GltfObjectRecord {
  return {
    objectName: 'Rail_01',
    materialName: 'Aluminium',
    fingerprint: {
      hash: 'abcdef0123456789',
      signature: {
        vertexCount: 24,
        triangleCount: 12,
        sizeM: [2, 1, 0.1],
        centroidM: [1, 0.5, 0.05],
        areaM2: 4,
      },
    },
    worldBoxM: { centre: { x: 3, y: 0.5, z: 5 }, minY: 0 },
    // Κάγκελο = ανοιχτό πλέγμα → κανένας αξιόπιστος όγκος (ADR-683 §10.2).
    solid: { isWatertight: false, volumeM3: null },
    ...overrides,
  };
}

function input(records: readonly GltfObjectRecord[]) {
  return {
    records,
    data: new ArrayBuffer(128),
    sourceFileName: 'partner-return.glb',
    companyId: 'comp_1',
    projectId: 'proj_1',
    placement: { sceneUnits: 'mm' as const, floorElevationMm: 0 },
    layerId: 'level_1',
  };
}

beforeEach(() => {
  uploadImportedMeshFile.mockReset();
  registerImportedMeshAsset.mockReset();
  appendEntitiesToScene.mockReset();
  uploadImportedMeshFile.mockResolvedValue({ uploadId: 'imesh_x', storagePath: 'companies/c/p.glb' });
});

describe('importGltfMeshes', () => {
  it('χτίζει οντότητα ανά κόμβο και την προσθέτει ως ΕΝΑ αναιρέσιμο βήμα', async () => {
    const result = await importGltfMeshes(accessor, input([record(), record({ objectName: 'Rail_02' })]));

    expect(result.created).toHaveLength(2);
    expect(result.created[0].type).toBe('imported-mesh');
    expect(result.created[0].name).toBe('Rail_01');
    // ΕΝΑ κάλεσμα με ΟΛΕΣ τις οντότητες — όχι ένα κάλεσμα ανά οντότητα (θα ήταν N undo).
    expect(appendEntitiesToScene).toHaveBeenCalledTimes(1);
    expect(appendEntitiesToScene.mock.calls[0][1]).toHaveLength(2);
  });

  it('δηλώνει το asset ΠΡΙΝ προσθέσει την οντότητα στη σκηνή', async () => {
    const order: string[] = [];
    registerImportedMeshAsset.mockImplementation(() => order.push('register'));
    appendEntitiesToScene.mockImplementation(() => order.push('append'));

    await importGltfMeshes(accessor, input([record()]));

    expect(order).toEqual(['register', 'append']);
  });

  it('το ίδιο uploadId πάει ΚΑΙ στο upload ΚΑΙ στη δήλωση asset', async () => {
    await importGltfMeshes(accessor, input([record()]));

    expect(uploadImportedMeshFile).toHaveBeenCalledWith(
      expect.objectContaining({ uploadId: 'imesh_x', companyId: 'comp_1', projectId: 'proj_1' }),
    );
    expect(registerImportedMeshAsset).toHaveBeenCalledWith('imesh_x', 'Rail_01', 'companies/c/p.glb');
  });

  it('μεταφράζει τη θέση του κόμβου σε θέση κάτοψης (three +z → κάτοψη −y)', async () => {
    const result = await importGltfMeshes(accessor, input([record()]));

    // centre (3, ·, 5) m σε σκηνή mm → κάτοψη (3000, −5000).
    expect(result.created[0].params.position.x).toBeCloseTo(3000, 4);
    expect(result.created[0].params.position.y).toBeCloseTo(-5000, 4);
  });

  it('αποτυχία upload ⇒ ΚΑΜΙΑ οντότητα στη σκηνή', async () => {
    uploadImportedMeshFile.mockRejectedValue(new Error('permission-denied'));

    await expect(importGltfMeshes(accessor, input([record()]))).rejects.toThrow('permission-denied');
    expect(appendEntitiesToScene).not.toHaveBeenCalled();
  });

  it('κανένας εισαγώγιμος κόμβος ⇒ κανένα upload (όχι ορφανά αρχεία στο Storage)', async () => {
    const result = await importGltfMeshes(
      accessor,
      input([record({ fingerprint: null }), record({ objectName: 'Ghost', worldBoxM: null })]),
    );

    expect(uploadImportedMeshFile).not.toHaveBeenCalled();
    expect(appendEntitiesToScene).not.toHaveBeenCalled();
    expect(result.created).toHaveLength(0);
    expect(result.skipped).toEqual(['Rail_01', 'Ghost']);
  });
});

describe('isImportableNode', () => {
  it('απαιτεί ΚΑΙ σχήμα ΚΑΙ θέση', () => {
    expect(isImportableNode(record())).toBe(true);
    expect(isImportableNode(record({ fingerprint: null }))).toBe(false);
    expect(isImportableNode(record({ worldBoxM: null }))).toBe(false);
  });
});
