/**
 * ADR-909 Γ1β — **«ό,τι ζητήθηκε έχει καταλήξει»** (`awaitSettled`) και η ρητή νέα προσπάθεια (`retryFailed`).
 *
 * **Γιατί υπάρχει:** η λήψη της δημόσιας κάτοψης ζωγραφίζει **μία φορά**. Το `awaitInFlightScenes` (ADR-689)
 * περιμένει μόνο το **αρχείο**· το ακριβές περίγραμμα γεμίσματος έρχεται αργότερα από worker και αντικαθιστά το
 * πρόχειρο. Μια λήψη ανάμεσα στα δύο βγάζει άλλη εικόνα από την επόμενη — και κανένα test δεν το έβλεπε.
 */

import * as THREE from 'three';

const loadAsync = jest.fn();
const resolveMeshUrl = jest.fn();
const requestExactFillRings = jest.fn();

jest.mock('three/addons/loaders/GLTFLoader.js', () => ({
  __esModule: true,
  GLTFLoader: class {
    loadAsync = (...args: unknown[]) => loadAsync(...args);
  },
}));

jest.mock('../bim-mesh-url-resolver', () => ({
  __esModule: true,
  resolveMeshUrl: (...args: unknown[]) => resolveMeshUrl(...args),
  meshAssetKey: (category: string, assetId: string) => `${category}/${assetId}`,
}));

jest.mock('../mesh-fill-union-client', () => ({
  __esModule: true,
  requestExactFillRings: (...args: unknown[]) => requestExactFillRings(...args),
}));

jest.mock('../../../stores/Bim3DEntitiesStore', () => ({
  __esModule: true,
  useBim3DEntitiesStore: { getState: () => ({ bumpMeshAssetVersion: jest.fn() }) },
}));

jest.mock('../../../../rendering/core/frame-scheduler-api', () => ({
  __esModule: true,
  markAllCanvasDirty: jest.fn(),
}));

import { bimMeshCache, __resetBimMeshCacheForTests } from '../bim-mesh-cache';

const CATEGORY = 'furniture';
const ASSET = 'chair_01';
/** Τετράγωνο 4 × 4 m — το «ακριβές» περίγραμμα που θα έδινε ο worker. */
const EXACT_RING = [0, 0, 4, 0, 4, 4, 0, 4];

function boxScene(): THREE.Object3D {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  return scene;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

beforeEach(() => {
  __resetBimMeshCacheForTests();
  loadAsync.mockReset();
  resolveMeshUrl.mockReset();
  requestExactFillRings.mockReset();
  resolveMeshUrl.mockResolvedValue('https://example.test/chair.glb');
  requestExactFillRings.mockResolvedValue(null);
});

describe('bimMeshCache.awaitSettled (ADR-909 Γ1β)', () => {
  it('Σ1 🔴 περιμένει ΚΑΙ την ακριβή ένωση του worker — όχι μόνο το αρχείο', async () => {
    let deliver: (rings: number[][] | null) => void = () => undefined;
    requestExactFillRings.mockReturnValue(new Promise((resolve) => { deliver = resolve; }));
    loadAsync.mockResolvedValue({ scene: boxScene() });

    bimMeshCache.preload(CATEGORY, ASSET);
    let settled = false;
    void bimMeshCache.awaitSettled().then(() => { settled = true; });
    await flush();

    // Το αρχείο έχει φορτώσει — το `awaitInFlightScenes` μόνο του θα έλεγε «έτοιμο» εδώ.
    expect(bimMeshCache.getLoadState(CATEGORY, ASSET)).toBe('ready');
    expect(requestExactFillRings).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    const provisional = bimMeshCache.getFillContours(CATEGORY, ASSET);

    deliver([EXACT_RING]);
    await flush();

    expect(settled).toBe(true);
    const exact = bimMeshCache.getFillContours(CATEGORY, ASSET);
    expect(exact).not.toBe(provisional);
    expect(exact).toHaveLength(1);
  });

  it('Σ2 ποτέ reject: αρχείο που λείπει ⇒ καταλήγει, και η κατάσταση είναι `error`', async () => {
    loadAsync.mockRejectedValue(new Error('404'));

    bimMeshCache.preload(CATEGORY, ASSET);
    await expect(bimMeshCache.awaitSettled()).resolves.toBeUndefined();
    await flush();

    expect(bimMeshCache.getLoadState(CATEGORY, ASSET)).toBe('error');
  });

  it('Σ3 τίποτα σε εξέλιξη ⇒ καταλήγει αμέσως', async () => {
    await expect(bimMeshCache.awaitSettled()).resolves.toBeUndefined();
  });
});

describe('bimMeshCache.retryFailed (ADR-909 Γ1β)', () => {
  it('Ε1 χωρίς ρητή νέα προσπάθεια το σφάλμα ΔΕΝ ξαναχτυπά το δίκτυο· με αυτήν, μία φορά', async () => {
    loadAsync.mockRejectedValueOnce(new Error('404')).mockResolvedValue({ scene: boxScene() });

    bimMeshCache.preload(CATEGORY, ASSET);
    await bimMeshCache.awaitSettled();
    await flush();
    bimMeshCache.preload(CATEGORY, ASSET);
    await flush();
    expect(loadAsync).toHaveBeenCalledTimes(1);

    bimMeshCache.retryFailed(CATEGORY, ASSET);
    expect(bimMeshCache.getLoadState(CATEGORY, ASSET)).toBe('idle');
    bimMeshCache.preload(CATEGORY, ASSET);
    await bimMeshCache.awaitSettled();
    await flush();

    expect(loadAsync).toHaveBeenCalledTimes(2);
    expect(bimMeshCache.getLoadState(CATEGORY, ASSET)).toBe('ready');
  });

  it('Ε2 δεν αγγίζει ό,τι ΔΕΝ είναι σε σφάλμα (φορτωμένο ή σε εξέλιξη)', async () => {
    loadAsync.mockResolvedValue({ scene: boxScene() });
    bimMeshCache.preload(CATEGORY, ASSET);
    bimMeshCache.retryFailed(CATEGORY, ASSET);
    expect(bimMeshCache.getLoadState(CATEGORY, ASSET)).toBe('loading');

    await bimMeshCache.awaitSettled();
    await flush();
    bimMeshCache.retryFailed(CATEGORY, ASSET);
    expect(bimMeshCache.getLoadState(CATEGORY, ASSET)).toBe('ready');
    expect(loadAsync).toHaveBeenCalledTimes(1);
  });
});
