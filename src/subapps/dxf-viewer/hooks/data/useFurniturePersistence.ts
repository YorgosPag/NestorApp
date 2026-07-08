'use client';

/**
 * ADR-410 — Furniture Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-593). Behaviour
 * unchanged: hybrid auto-save, selective-skip diff-merge, first-save listener
 * wired to `drawing:entity-created` with `tool === 'furniture'`, delete + undo
 * restore, audit trail (created/updated/deleted/restored). No BOQ feed, no
 * connector reconciliation (furniture carries no MEP connectors).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 * @see docs/centralized-systems/reference/adrs/ADR-593-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { AnySceneEntity } from '../../types/entities';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import {
  createFurnitureFirestoreService,
  entityToSaveInput,
  FurnitureFirestoreService,
  type FurnitureDoc,
} from '../../bim/furniture/furniture-firestore-service';
import { recordFurnitureChange } from '../../bim/furniture/furniture-audit-client';
import { furnitureDocToEntity as docToEntity } from './furniture-persistence-helpers';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type FurnitureSaveState = BimEntitySaveState;

export interface UseFurniturePersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedFurniture: FurnitureEntity | null;
}

export interface UseFurniturePersistenceResult {
  readonly saveState: FurnitureSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteFurniture: (furnitureId: string) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function isFurniture(entity: AnySceneEntity): entity is FurnitureEntity {
  return (entity as { type?: string }).type === 'furniture';
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useFurniturePersistenceBase = createBimEntityPersistenceHook<
  FurnitureFirestoreService,
  FurnitureDoc,
  FurnitureEntity,
  FurnitureEntity['params']
>({
  entityType: 'furniture',
  restoreEntityType: 'furniture',
  saveErrorKey: 'FURNITURE_SAVE_ERROR',
  restoreErrorKey: 'FURNITURE_RESTORE_ERROR',
  typeGuard: isFurniture,
  entityComparable: (e) => e.params,
  createService: (scope) => createFurnitureFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveFurniture(entityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateFurniture(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteFurniture(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeFurniture(onDocs as (docs: readonly FurnitureDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isFurniture,
      docToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:furniture-delete-requested',
    getId: (p) => (p as { furnitureId?: string }).furnitureId,
  },
  onPersisted: (entity, { isNew, prevComparable }) => {
    void recordFurnitureChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
  },
  onDeleted: (id, deleted) => {
    void recordFurnitureChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'chair' },
    );
  },
  onRestored: (entity) => {
    void recordFurnitureChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useFurniturePersistence(
  params: UseFurniturePersistenceParams,
): UseFurniturePersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useFurniturePersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedFurniture,
  } as BimEntityPersistenceParams<FurnitureEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteFurniture: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
