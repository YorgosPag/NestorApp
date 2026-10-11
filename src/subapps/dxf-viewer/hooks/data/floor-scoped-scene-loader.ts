/**
 * floor-scoped-scene-loader — η σκηνή ενός **μη-ανοιχτού** ορόφου, με φράχτη ορόφου και εφεδρεία
 * ανά οντότητα (ADR-914 §2.14 · ADR-484 Slice 3 · ADR-469).
 *
 * Δύο βήματα, με αυτή τη σειρά:
 *   1. στιγμιότυπο `.scene.json` — `null` όταν η εγγραφή ανήκει σε **άλλον** όροφο (κοινό
 *      `sceneFileId`, ADR-484 Slice 3), ώστε να μη διαρρεύσει ξένη σκηνή·
 *   2. χωρίς στιγμιότυπο (όροφος χωρίς αρχείο ή ορφανός, ADR-469) — μία ανάγνωση των BIM οντοτήτων
 *      του ορόφου από τις συλλογές `floorplan_*`.
 *
 * Το μοιράζονται οι `useFloors3DAggregator` και `useBuildingFloorScenes`: ρωτούν **την ίδια**
 * ερώτηση, άρα παίρνουν την ίδια απάντηση.
 *
 * @see ./useFloorSceneSnapshots — το hook που το καλεί
 */

import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import { loadFloorBimEntities } from '../../bim/persistence/cross-floor-bim-loader';
import { resolveFloorScopedScene } from '../../systems/levels/cross-floor-link';
import { EMPTY_BOUNDS } from '../../config/geometry-constants';
import type { SceneModel } from '../../types/scene';
import type { FloorSnapshotTarget } from './useFloorSceneSnapshots';

/** Ό,τι χρειάζεται η εμβέλεια αποθήκευσης ενός ορόφου (ADR-469). */
export interface FloorScopedSceneTarget extends FloorSnapshotTarget {
  readonly floorId: string;
  readonly projectId: string | null;
}

/** Η ταυτότητα του ανθρώπου — μέρος της εμβέλειας αποθήκευσης. */
export interface FloorSceneIdentity {
  readonly companyId: string | null;
  readonly userId: string | null;
}

/** Οι BIM οντότητες του ορόφου ως σκηνή, ή `null` όταν δεν υπάρχει καμία. */
async function loadPerEntityScene(
  target: FloorScopedSceneTarget,
  identity: FloorSceneIdentity,
): Promise<SceneModel | null> {
  const scope = resolveBimPersistenceScope({
    companyId: identity.companyId,
    projectId: target.projectId,
    userId: identity.userId,
    floorId: target.floorId,
    floorplanId: target.sceneFileId,
  });
  const entities = scope ? await loadFloorBimEntities(scope) : [];
  if (entities.length === 0) return null;
  return { entities, layersById: {}, bounds: { ...EMPTY_BOUNDS }, units: 'mm' } as unknown as SceneModel;
}

export async function loadFloorScopedScene(
  target: FloorScopedSceneTarget,
  identity: FloorSceneIdentity,
  isCancelled: () => boolean,
): Promise<SceneModel | null> {
  if (target.sceneFileId) {
    const rec = await DxfFirestoreService.loadFileV2(target.sceneFileId);
    // Ακυρώθηκε στη μέση: το αποτέλεσμα θα πεταχτεί — μην πληρώσεις και δεύτερο αίτημα.
    if (isCancelled()) return null;
    const scene = resolveFloorScopedScene(rec, target.floorId);
    if (scene) return scene;
  }
  return loadPerEntityScene(target, identity);
}
