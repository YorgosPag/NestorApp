'use client';

/**
 * ADR-684 Φ2 — Generic solid Firestore persistence React adapter.
 *
 * Λεπτό config πάνω στο **υπάρχον** `createBimEntityPersistenceHook` SSoT (ADR-594) — μηδέν νέος
 * μηχανισμός αποθήκευσης. Καθρέφτης του `useImportedMeshPersistence.ts`: hybrid auto-save,
 * selective-skip diff-merge, first-save στο `drawing:entity-created`, delete + undo restore.
 *
 * **Audit + BOQ**: σκόπιμα εκτός Φ2 (ADR-684 §7 — μεταφέρονται στη Φ4 μαζί με την ταξινόμηση/
 * κοστολόγηση). Τα lifecycle callbacks του hook είναι optional· η παράλειψή τους δεν επηρεάζει
 * persistence/undo. Το «δομικό vs διακοσμητικό» (που ορίζει BOQ) είναι metadata της Φ4.
 *
 * **Ο λόγος ύπαρξης, με μία πρόταση:** χωρίς αυτό, ό,τι στερεό δημιουργείται εξαφανίζεται στο πρώτο
 * reload — γιατί ο `reconcileLoadedSceneBim` πετά τα per-entity BIM του scene snapshot και τα
 * ξαναγεμίζει μόνο από per-entity έγγραφα (`scene-bim-load-policy.ts`).
 *
 * @see ./useImportedMeshPersistence — ο αδελφός που καθρεφτίζεται (με audit+BOQ)
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { AnySceneEntity } from '../../types/entities';
import type { GenericSolidEntity } from '../../bim/entities/generic-solid/generic-solid-types';
import {
  createGenericSolidFirestoreService,
  genericSolidEntityToSaveInput,
  GenericSolidFirestoreService,
  type GenericSolidDoc,
} from '../../bim/entities/generic-solid/generic-solid-firestore-service';
import { genericSolidDocToEntity as docToEntity } from './generic-solid-persistence-helpers';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

export type GenericSolidSaveState = BimEntitySaveState;

export interface UseGenericSolidPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedGenericSolid: GenericSolidEntity | null;
}

export interface UseGenericSolidPersistenceResult {
  readonly saveState: GenericSolidSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteGenericSolid: (genericSolidId: string) => Promise<void>;
}

function isGenericSolid(entity: AnySceneEntity): entity is GenericSolidEntity {
  return (entity as { type?: string }).type === 'generic-solid';
}

const useGenericSolidPersistenceBase = createBimEntityPersistenceHook<
  GenericSolidFirestoreService,
  GenericSolidDoc,
  GenericSolidEntity,
  GenericSolidEntity['params']
>({
  entityType: 'generic-solid',
  restoreEntityType: 'generic-solid',
  saveErrorKey: 'GENERIC_SOLID_SAVE_ERROR',
  restoreErrorKey: 'GENERIC_SOLID_RESTORE_ERROR',
  typeGuard: isGenericSolid,
  entityComparable: (e) => e.params,
  createService: (scope) => createGenericSolidFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveGenericSolid(genericSolidEntityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateGenericSolid(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        name: e.name,
        layerId: e.layerId,
        // ADR-539 / ADR-684 Φ4-C — persist τις βαφές εδρών στο υπάρχον doc (αλλιώς χάνονται στο reload).
        faceAppearance: e.faceAppearance,
      }),
    remove: (svc, id) => svc.deleteGenericSolid(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeGenericSolids(onDocs as (docs: readonly GenericSolidDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isGenericSolid,
      docToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:generic-solid-delete-requested',
    getId: (p) => (p as { genericSolidId?: string }).genericSolidId,
  },
});

export function useGenericSolidPersistence(
  params: UseGenericSolidPersistenceParams,
): UseGenericSolidPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useGenericSolidPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedGenericSolid,
  } as BimEntityPersistenceParams<GenericSolidEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteGenericSolid: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
