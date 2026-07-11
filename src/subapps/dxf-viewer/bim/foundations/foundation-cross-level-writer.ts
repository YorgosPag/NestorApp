'use client';

/**
 * foundation-cross-level-writer — εγγραφή πεδίλου στον όροφο Θεμελίωσης ενώ ο
 * ενεργός όροφος είναι άλλος (ADR-459 Phase 1 — cross-level WRITE).
 *
 * Ο single-level `useFoundationPersistence` γράφει ΠΑΝΤΑ στο scope του ενεργού
 * ορόφου (ο first-save listener του πιάνει το `drawing:entity-created`). Άρα ΔΕΝ
 * μπορεί να χρησιμοποιηθεί το `CreateFoundationsCommand` για cross-level create —
 * το event του θα persist-άριζε το πέδιλο στον λάθος (ενεργό) όροφο. Αυτός ο
 * writer στήνει ένα `FoundationFirestoreService` με το **foundation scope**
 * (`target.floorId/sceneFileId`) και γράφει απευθείας, + μεταλλάσσει τη σκηνή του
 * ορόφου Θεμελίωσης ΟΤΑΝ είναι φορτωμένη (αλλιώς η Firestore subscription του
 * συγχρονίζει μόλις ο χρήστης πάει εκεί). Geometry-neutral για τις κολόνες (το FK
 * `footingId` τίθεται από τον καλούντα στην ενεργή σκηνή).
 *
 * Firestore writes = fire-and-forget (mirror του deferred-Firestore pattern των
 * batch commands)· τα errors είναι μη-κρίσιμα (heal στο επόμενο edit).
 *
 * @see foundation-firestore-service.ts — createFoundationFirestoreService / entityToSaveInput
 * @see ../../systems/levels/building-foundation-level.ts — FoundationLevelTarget
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 1
 */

import {
  createFoundationFirestoreService,
  entityToSaveInput,
  type FoundationFirestoreService,
} from './foundation-firestore-service';
import { resolveBimPersistenceScope } from '../persistence/bim-floor-scope';
import { mutateLevelSceneEntities } from '../../systems/levels/mutate-level-scene';
import { useFoundationLevelStore } from '../../state/foundation-level-store';
import type { FoundationLevelTarget } from '../../systems/levels/building-foundation-level';
import type { FoundationEntity } from '../types/foundation-types';
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import type { AnySceneEntity } from '../../types/scene';
import type { SceneWriteOrigin } from '../../hooks/scene/scene-write-origin';

/** Auth/project scope (το κτίριο είναι κοινό — αλλάζει μόνο ο όροφος). */
export interface FoundationWriteScope {
  readonly companyId: string | null | undefined;
  readonly projectId: string | null | undefined;
  readonly userId: string | null | undefined;
}

interface LevelSceneIO {
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

/** Cross-level εγγραφή πεδίλων στον όροφο Θεμελίωσης (Firestore + scene). */
export interface FoundationCrossLevelWriter {
  /** Δημιουργία νέου πεδίλου στον όροφο Θεμελίωσης. */
  create(entity: FoundationEntity): void;
  /** Ενημέρωση υπάρχοντος πεδίλου (π.χ. επέκταση — Phase 3). */
  update(entity: FoundationEntity): void;
  /** Διαγραφή πεδίλου (undo του create). */
  remove(foundationId: string): void;
}

/**
 * Φτιάχνει writer για το foundation scope του `target`, ή `null` αν λείπει
 * έγκυρο scope (companyId/projectId/userId + floorId/floorplanId).
 */
export function createFoundationCrossLevelWriter(
  scope: FoundationWriteScope,
  target: FoundationLevelTarget,
  io: LevelSceneIO,
): FoundationCrossLevelWriter | null {
  const resolved = resolveBimPersistenceScope({
    companyId: scope.companyId,
    projectId: scope.projectId,
    userId: scope.userId,
    floorId: target.floorId,
    floorplanId: target.sceneFileId,
  });
  if (!resolved) return null;

  const svc: FoundationFirestoreService = createFoundationFirestoreService({
    companyId: resolved.companyId,
    projectId: resolved.projectId,
    floorplanId: resolved.floorplanId,
    floorId: resolved.floorId,
    userId: resolved.userId,
  });

  return {
    create(entity) {
      // Origin `'system-reconcile'`: derived write — η αυθεντική persistence γίνεται μέσω
      // `svc.saveFoundation()` (foundation collection). ΔΕΝ πρέπει να πυροδοτεί το DXF-scene
      // autosave του special ορόφου Θεμελίωσης (χωρίς `canonicalScenePath` → ADR-293 θόρυβος).
      mutateLevelSceneEntities(io, target.levelId, (es) => [...es, entity as unknown as AnySceneEntity], 'system-reconcile');
      // ADR-459 Phase 7 — optimistic store sync ώστε ο reconciler να βλέπει το νέο
      // πέδιλο αμέσως (χωρίς να περιμένει τον async refresh του useFoundationLevelSync).
      useFoundationLevelStore.getState().upsertEntity(entity as unknown as Entity);
      void svc.saveFoundation(entityToSaveInput(entity)).catch(() => {
        /* μη-κρίσιμο: heal στο επόμενο edit / επίσκεψη ορόφου */
      });
    },
    update(entity) {
      mutateLevelSceneEntities(
        io,
        target.levelId,
        (es) => es.map((e) => (e.id === entity.id ? (entity as unknown as AnySceneEntity) : e)),
        'system-reconcile',
      );
      useFoundationLevelStore.getState().upsertEntity(entity as unknown as Entity);
      void svc
        .updateFoundation(entity.id, {
          params: entity.params,
          validation: entity.validation,
          geometry: entity.geometry,
          layerId: entity.layerId,
        })
        .catch(() => {
          /* μη-κρίσιμο */
        });
    },
    remove(foundationId) {
      mutateLevelSceneEntities(io, target.levelId, (es) => es.filter((e) => e.id !== foundationId), 'system-reconcile');
      useFoundationLevelStore.getState().removeEntity(foundationId);
      void svc.deleteFoundation(foundationId).catch(() => {
        /* μη-κρίσιμο */
      });
    },
  };
}
