'use client';

/**
 * ADR-417 — Roof Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: hybrid auto-save + `saveNow`, diff-merge with ADR-412 "type always
 * wins" (`roofEntityDiffersFromDoc` + family-type link baseline seed), setDoc/
 * updateDoc split persist, ΑΤΟΕ BOQ auto-feed (create/update only — grossArea m²),
 * and `useRoofTypeReresolution`. First-save on `drawing:entity-created` (tool 'roof').
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';
import { dequal } from 'dequal';

import type { RoofEntity } from '../../bim/types/roof-types';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import {
  createRoofFirestoreService,
  entityToSaveInput,
  RoofFirestoreService,
  type RoofDoc,
} from '../../bim/roofs/roof-firestore-service';
import { recordRoofChange } from '../../bim/roofs/roof-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import {
  docToEntity,
  isRoof,
  roofEntityDiffersFromDoc,
  roofTypeLinkChanged,
  type RoofTypeLink,
} from './roof-persistence-helpers';
import { useRoofTypeReresolution } from './useRoofTypeReresolution';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type RoofSaveState = BimEntitySaveState;

export interface UseRoofPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-417 — tenant scope για το ΑΤΟΕ BOQ auto-feed (grossArea m²). */
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedRoof: RoofEntity | null;
}

export interface UseRoofPersistenceResult {
  readonly saveState: RoofSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteRoof: (roofId: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

type RoofExtra = { readonly lastSavedTypeLink: Map<string, RoofTypeLink> };

const useRoofPersistenceBase = createBimEntityPersistenceHook<
  RoofFirestoreService,
  RoofDoc,
  RoofEntity,
  RoofEntity['params'],
  void,
  RoofExtra
>({
  entityType: 'roof',
  restoreEntityType: 'roof',
  saveErrorKey: 'ROOF_SAVE_ERROR',
  restoreErrorKey: 'ROOF_RESTORE_ERROR',
  entityComparable: (e) => e.params,
  createExtraRefs: () => ({ lastSavedTypeLink: new Map<string, RoofTypeLink>() }),
  createService: (scope) => createRoofFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveRoof(entityToSaveInput(e)),
    // ADR-417 §10 #3 typeId/typeOverrides (null detaches) + ADR-539 Φ3b faceAppearance.
    update: (svc, e) =>
      svc.updateRoof(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
        typeId: e.typeId ?? null,
        typeOverrides: e.typeOverrides ?? null,
        faceAppearance: e.faceAppearance,
      }),
    remove: (svc, id) => svc.deleteRoof(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeRoofs(onDocs as (docs: readonly RoofDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: (extra) => ({
      isEntity: isRoof,
      docToEntity: (doc) => docToEntity(doc),
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
      differs: (existing, doc) => roofEntityDiffersFromDoc(existing, doc),
      seedExtraBaseline: (doc) => {
        if (!extra.lastSavedTypeLink.has(doc.id)) {
          extra.lastSavedTypeLink.set(doc.id, { typeId: doc.typeId, typeOverrides: doc.typeOverrides });
        }
      },
    }),
  },
  deleteTrigger: {
    event: 'bim:roof-delete-requested',
    getId: (p) => (p as { roofId?: string }).roofId,
  },
  autoSaveDirty: (entity, lastSaved, extra) => {
    const linkChanged = roofTypeLinkChanged(extra.lastSavedTypeLink.get(entity.id), entity);
    return !(lastSaved !== undefined && dequal(lastSaved, entity.params) && !linkChanged);
  },
  onPersisted: (entity, { isNew, prevComparable, scope, extra }) => {
    extra.lastSavedTypeLink.set(entity.id, { typeId: entity.typeId, typeOverrides: entity.typeOverrides });
    void recordRoofChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
    // ADR-417 — ΑΤΟΕ BOQ auto-feed: roof = grossArea (m²) κεκλιμένης επιφάνειας.
    if (scope.companyId && scope.projectId && scope.buildingId) {
      const boqGeom = entity.geometry ? { area: entity.geometry.grossAreaM2 } : undefined;
      void bimToBoqBridge.upsertBoqItemForBim(
        'roof',
        { id: entity.id, kind: entity.kind, geometry: boqGeom },
        {
          companyId: scope.companyId,
          projectId: scope.projectId,
          buildingId: scope.buildingId,
          floorId: scope.floorId ?? undefined,
        },
        isNew ? 'created' : 'updated',
      );
    }
  },
  onDeleted: (id, deleted) => {
    void recordRoofChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'roof' },
    );
  },
  onDeleteCleanup: (id, extra) => {
    extra.lastSavedTypeLink.delete(id);
  },
  onRestored: (entity, { extra }) => {
    extra.lastSavedTypeLink.set(entity.id, { typeId: entity.typeId, typeOverrides: entity.typeOverrides });
    void recordRoofChange('restored', entity);
  },
  useExtra: (ctx) => {
    // ADR-417 §10 #3 — re-flow type edits / late type loads onto placed roofs.
    useRoofTypeReresolution(ctx.levelManagerRef.current, ctx.dirtyIdsRef);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useRoofPersistence(
  params: UseRoofPersistenceParams,
): UseRoofPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useRoofPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    buildingId: params.buildingId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedRoof,
  } as BimEntityPersistenceParams<RoofEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteRoof: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
