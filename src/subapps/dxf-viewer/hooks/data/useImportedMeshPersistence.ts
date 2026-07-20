'use client';

/**
 * ADR-683 Φ3β — Imported mesh Firestore persistence React adapter.
 *
 * Λεπτό config πάνω στο **υπάρχον** `createBimEntityPersistenceHook` SSoT (ADR-594) — μηδέν νέος
 * μηχανισμός αποθήκευσης. Καθρέφτης του `useFurniturePersistence.ts`: hybrid auto-save,
 * selective-skip diff-merge, first-save στο `drawing:entity-created`, delete + undo restore, audit.
 *
 * **Ο λόγος ύπαρξης, με μία πρόταση:** χωρίς αυτό, ό,τι εισάγεται εξαφανίζεται στο πρώτο reload —
 * γιατί ο `reconcileLoadedSceneBim` πετά τα BIM entities του scene snapshot και τα ξαναγεμίζει
 * μόνο από per-entity έγγραφα (`scene-bim-load-policy.ts:64`).
 *
 * @see ./useFurniturePersistence — ο αδελφός που καθρεφτίζεται
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §5
 */

import { useMemo } from 'react';

import type { AnySceneEntity } from '../../types/entities';
import type { ImportedMeshEntity } from '../../bim/entities/imported-mesh/imported-mesh-types';
import {
  createImportedMeshFirestoreService,
  importedMeshEntityToSaveInput,
  ImportedMeshFirestoreService,
  type ImportedMeshDoc,
} from '../../bim/entities/imported-mesh/imported-mesh-firestore-service';
import { recordImportedMeshChange } from '../../bim/entities/imported-mesh/imported-mesh-audit-client';
import { importedMeshDocToEntity as docToEntity } from './imported-mesh-persistence-helpers';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

export type ImportedMeshSaveState = BimEntitySaveState;

export interface UseImportedMeshPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedImportedMesh: ImportedMeshEntity | null;
}

export interface UseImportedMeshPersistenceResult {
  readonly saveState: ImportedMeshSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteImportedMesh: (importedMeshId: string) => Promise<void>;
}

function isImportedMesh(entity: AnySceneEntity): entity is ImportedMeshEntity {
  return (entity as { type?: string }).type === 'imported-mesh';
}

const useImportedMeshPersistenceBase = createBimEntityPersistenceHook<
  ImportedMeshFirestoreService,
  ImportedMeshDoc,
  ImportedMeshEntity,
  ImportedMeshEntity['params']
>({
  entityType: 'imported-mesh',
  restoreEntityType: 'imported-mesh',
  saveErrorKey: 'IMPORTED_MESH_SAVE_ERROR',
  restoreErrorKey: 'IMPORTED_MESH_RESTORE_ERROR',
  typeGuard: isImportedMesh,
  entityComparable: (e) => e.params,
  createService: (scope) => createImportedMeshFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveImportedMesh(importedMeshEntityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateImportedMesh(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        name: e.name,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteImportedMesh(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeImportedMeshes(onDocs as (docs: readonly ImportedMeshDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isImportedMesh,
      docToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:imported-mesh-delete-requested',
    getId: (p) => (p as { importedMeshId?: string }).importedMeshId,
  },
  onPersisted: (entity, { isNew, prevComparable }) => {
    recordImportedMeshChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
  },
  onDeleted: (id, deleted) => {
    recordImportedMeshChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id },
    );
  },
  onRestored: (entity) => {
    recordImportedMeshChange('restored', entity);
  },
});

export function useImportedMeshPersistence(
  params: UseImportedMeshPersistenceParams,
): UseImportedMeshPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useImportedMeshPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedImportedMesh,
  } as BimEntityPersistenceParams<ImportedMeshEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteImportedMesh: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
