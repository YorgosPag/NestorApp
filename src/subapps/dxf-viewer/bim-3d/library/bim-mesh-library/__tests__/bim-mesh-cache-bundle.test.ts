/**
 * ADR-683 Φ3 — bundle assets στο `bimMeshCache` (`<uploadId>#<nodeName>`).
 *
 * **Γιατί υπάρχει αυτό το αρχείο:** το linked-model μοντέλο (ένα `.glb` = πολλά αντικείμενα) έχει
 * μία μη-προφανή παγίδα που ΚΑΝΕΝΑ άλλο test δεν πιάνει — το `status` guard του cache κλειδώνει
 * **ανά κόμβο**, οπότε 12 κάγκελα από το ΙΔΙΟ αρχείο περνούν και τα 12 τον έλεγχο και ξεκινούν 12
 * παράλληλες λήψεις του ίδιου 20MB αρχείου. Λειτουργικά «δουλεύει» (η οθόνη είναι σωστή), οπότε
 * θα περνούσε απαρατήρητο μέχρι να το δει κάποιος στο network tab.
 *
 * Εδώ κατοχυρώνεται: **ΜΙΑ** λήψη ανά αρχείο, **Ν** templates.
 */

import * as THREE from 'three';

const loadAsync = jest.fn();
const resolveMeshUrl = jest.fn();

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

jest.mock('../../../stores/Bim3DEntitiesStore', () => ({
  __esModule: true,
  useBim3DEntitiesStore: { getState: () => ({ bumpMeshAssetVersion: jest.fn() }) },
}));

jest.mock('../../../../rendering/core/frame-scheduler-api', () => ({
  __esModule: true,
  markAllCanvasDirty: jest.fn(),
}));

import { bimMeshCache, __resetBimMeshCacheForTests } from '../bim-mesh-cache';

/** Σκηνή με 3 ονομασμένους κόμβους — ό,τι θα γύριζε ο συνεργάτης σε ένα `.glb`. */
function makeBundleScene(names: readonly string[]): THREE.Object3D {
  const scene = new THREE.Group();
  for (const name of names) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.name = name;
    scene.add(mesh);
  }
  return scene;
}

/**
 * Αδειάζει την ουρά microtasks. Η αλυσίδα είναι βαθιά (resolveUrl → loadAsync → scene →
 * finally → index), οπότε λίγα ticks αφήνουν το template μισο-γραμμένο και το test βλέπει
 * ψευδές `null`. Γενναιόδωρο περιθώριο.
 */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

beforeEach(() => {
  __resetBimMeshCacheForTests();
  loadAsync.mockReset();
  resolveMeshUrl.mockReset();
  resolveMeshUrl.mockResolvedValue('https://example.test/bundle.glb');
});

describe('bimMeshCache — bundle assets (ADR-683 Φ3)', () => {
  it('κατεβάζει το αρχείο ΜΙΑ φορά για Ν κόμβους (το bug που κρύβεται στο network tab)', async () => {
    loadAsync.mockResolvedValue({ scene: makeBundleScene(['Rail_01', 'Rail_02', 'Rail_03']) });

    // Και οι 3 κόμβοι ζητούνται στο ΙΔΙΟ tick — όπως όταν ο όροφος κάνει sync.
    bimMeshCache.preload('imported', 'imesh_a#Rail_01');
    bimMeshCache.preload('imported', 'imesh_a#Rail_02');
    bimMeshCache.preload('imported', 'imesh_a#Rail_03');
    await flush();

    expect(loadAsync).toHaveBeenCalledTimes(1);
  });

  it('ευρετηριάζει ΟΛΟΥΣ τους κόμβους — οι υπόλοιποι είναι δωρεάν cache hits', async () => {
    loadAsync.mockResolvedValue({ scene: makeBundleScene(['Rail_01', 'Rail_02', 'Rail_03']) });

    // Ζητείται ΜΟΝΟ ο πρώτος.
    bimMeshCache.preload('imported', 'imesh_a#Rail_01');
    await flush();

    // ...αλλά και οι τρεις είναι διαθέσιμοι, χωρίς δεύτερη διαδρομή δικτύου.
    expect(bimMeshCache.getInstance('imported', 'imesh_a#Rail_01')).not.toBeNull();
    expect(bimMeshCache.getInstance('imported', 'imesh_a#Rail_02')).not.toBeNull();
    expect(bimMeshCache.getInstance('imported', 'imesh_a#Rail_03')).not.toBeNull();
    expect(loadAsync).toHaveBeenCalledTimes(1);
  });

  it('το URL ζητείται για το ΑΡΧΕΙΟ (uploadId), όχι για τον κόμβο', async () => {
    loadAsync.mockResolvedValue({ scene: makeBundleScene(['Rail_01']) });
    bimMeshCache.preload('imported', 'imesh_a#Rail_01');
    await flush();
    expect(resolveMeshUrl).toHaveBeenCalledWith('imported', 'imesh_a');
  });

  it('κόμβος που δεν υπάρχει στο αρχείο δεν κολλάει σε «loading» για πάντα', async () => {
    loadAsync.mockResolvedValue({ scene: makeBundleScene(['Rail_01']) });
    bimMeshCache.preload('imported', 'imesh_a#Deleted_Node');
    await flush();

    // Δεν βρέθηκε → κανένα template (ο renderer πέφτει στο ορθογώνιο),
    expect(bimMeshCache.getInstance('imported', 'imesh_a#Deleted_Node')).toBeNull();
    // ...αλλά ο κόμβος ΞΕΚΛΕΙΔΩΣΕ: μια δεύτερη preload ξαναπροσπαθεί (δεν είναι «κολλημένος»).
    bimMeshCache.preload('imported', 'imesh_a#Deleted_Node');
    await flush();
    expect(loadAsync).toHaveBeenCalledTimes(2);
  });

  it('τα απλά (μη-bundle) assets δουλεύουν όπως πριν — καμία παλινδρόμηση ADR-411', async () => {
    loadAsync.mockResolvedValue({ scene: makeBundleScene(['whatever']) });
    bimMeshCache.preload('furniture', 'chair_01');
    await flush();

    expect(resolveMeshUrl).toHaveBeenCalledWith('furniture', 'chair_01');
    expect(bimMeshCache.getInstance('furniture', 'chair_01')).not.toBeNull();
  });
});
