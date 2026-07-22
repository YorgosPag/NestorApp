/**
 * ADR-683 §render-gate — regression anchor: το single-floor `resyncBimScene` πρέπει να προωθεί
 * ΟΛΑ τα entity slices στον 3Δ manager, συμπεριλαμβανομένου του `importedMeshes`.
 *
 * Ιστορικό bug: το `resyncBimScene` ξανάγραφε με το χέρι το object literal των slices και είχε
 * ξεχάσει το `importedMeshes` (προστέθηκε στο ADR-683 Φ3). Αποτέλεσμα: τα εισαγόμενα πλέγματα δεν
 * έφταναν ΠΟΤΕ στον manager → 3Δ κενό, και ο 3Δ converter (μόνος που καλεί `bimMeshCache.preload`)
 * δεν έτρεχε → ο cache δεν γέμιζε → το 2Δ κολλούσε στο bbox κουτί αντί για silhouette.
 *
 * Το fix χρησιμοποιεί τον υπάρχοντα typed SSoT selector `selectBim3DEntities(s)` — που απαιτεί ΟΛΑ
 * τα slices — ώστε καμία μελλοντική οικογένεια οντοτήτων να μην μπορεί να ξεχαστεί ξανά. Αυτό το
 * test κλειδώνει τη συμπεριφορά με τον ΠΡΑΓΜΑΤΙΚΟ store + selector (μόνο τα περιφερειακά stores
 * mockάρονται, ώστε να μη φορτωθεί το three.js pipeline).
 */

import type { ThreeJsSceneManager } from '../ThreeJsSceneManager';
import type { ImportedMeshEntity } from '../../../bim/entities/imported-mesh/imported-mesh-types';
import type { Bim3DEntities } from '../../stores/Bim3DEntitiesStore';

jest.mock('../../stores/ViewMode3DStore', () => ({
  useViewMode3DStore: {
    getState: () => ({ floor3DScope: 'single', floorVisibilityModes: new Map() }),
  },
}));
jest.mock('../multi-floor-3d-source', () => ({ getMultiFloorStack: () => [] }));
jest.mock('../../../systems/levels/active-storey-store', () => ({
  useActiveStoreyStore: { getState: () => ({ context: null }) },
}));

import { resyncBimScene } from '../bim3d-resync';
import { useBim3DEntitiesStore, EMPTY_BIM_ENTITIES } from '../../stores/Bim3DEntitiesStore';

/** Fake manager — καταγράφει μόνο το πρώτο argument του `syncBimEntities`. */
function makeFakeManager(): {
  manager: ThreeJsSceneManager;
  syncBimEntities: jest.Mock;
} {
  const syncBimEntities = jest.fn();
  const manager = {
    syncBimEntities,
    syncBimEntitiesMultiFloor: jest.fn(),
    applyFloorVisibility: jest.fn(),
  } as unknown as ThreeJsSceneManager;
  return { manager, syncBimEntities };
}

const importedMesh = (id: string): ImportedMeshEntity =>
  ({ id, type: 'imported-mesh' }) as unknown as ImportedMeshEntity;

beforeEach(() => {
  useBim3DEntitiesStore.setState({ ...EMPTY_BIM_ENTITIES, activeLevelId: null });
});

describe('resyncBimScene — imported-mesh feed (ADR-683 §render-gate)', () => {
  it('προωθεί το slice `importedMeshes` στον 3Δ manager (single-floor scope)', () => {
    const mesh = importedMesh('imesh_1');
    useBim3DEntitiesStore.setState({ importedMeshes: [mesh] });

    const { manager, syncBimEntities } = makeFakeManager();
    resyncBimScene(manager, { externalEntitiesMode: false });

    expect(syncBimEntities).toHaveBeenCalledTimes(1);
    const entitiesArg = syncBimEntities.mock.calls[0][0] as Bim3DEntities;
    expect(entitiesArg.importedMeshes).toEqual([mesh]);
  });

  it('προωθεί κάθε slice του selectBim3DEntities — καμία οικογένεια δεν λείπει', () => {
    const { manager, syncBimEntities } = makeFakeManager();
    resyncBimScene(manager, { externalEntitiesMode: false });

    const entitiesArg = syncBimEntities.mock.calls[0][0] as Bim3DEntities;
    // Το snapshot πρέπει να έχει ΚΑΘΕ κλειδί του κανονικού EMPTY_BIM_ENTITIES (anti-drift).
    for (const key of Object.keys(EMPTY_BIM_ENTITIES)) {
      expect(entitiesArg).toHaveProperty(key);
    }
  });

  it('no-op όταν ο manager είναι null (καμία εξαίρεση)', () => {
    expect(() => resyncBimScene(null, { externalEntitiesMode: false })).not.toThrow();
  });
});
