'use client';

/**
 * ADR-363 Phase 2 / ADR-594 Phase 2 — Opening Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT. Opening is the richest
 * member — it threads its bespoke pieces through the factory's escape hatches:
 *   - `beforeSave` — ADR-376 mark allocation on first save + ADR-363 §5.4 kind→mark
 *     re-sync on edit (both patch the scene, then persist the returned entity).
 *   - `merge.mode: 'custom'` — `mergeOpeningDocsIntoScene` (host-wall re-derivation +
 *     Family/Type link baseline), reading the `lastSavedLink` map from the extra bag.
 *   - family-type link: `createExtraRefs` (lastSavedLink) + `autoSaveDirty` (params OR
 *     link changed) + `onPersisted`/`onRestored` seed the map.
 *   - `useExtra` — re-resolution, thermal-envelope persist, and the pre-floorplanId
 *     retry-save; `onDeleted` / `onRestored` own the ADR-376 signature-group BOQ +
 *     `bim:opening-persisted` host-wall re-feed.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { dequal } from 'dequal';

import type { OpeningEntity } from '../../bim/types/opening-types';
import type { Level } from '../../systems/levels/config';
import { EventBus } from '../../systems/events/EventBus';
import {
  createOpeningFirestoreService,
  entityToSaveInput,
  OpeningFirestoreService,
  type OpeningDoc,
} from '../../bim/walls/opening-firestore-service';
import { recordOpeningChange } from '../../bim/walls/opening-audit-client';
import {
  deleteOpeningFromGroup,
  upsertOpeningGroupForOpening,
} from '../../bim/services/opening-boq-sync';
import {
  deleteOpeningHardwareBoq,
  upsertOpeningHardwareBoq,
} from '../../bim/services/opening-hardware-boq-sync';
import { isOpening, mergeOpeningDocsIntoScene } from '../../bim/walls/opening-doc-hydration';
import {
  allocateMarkAndPatchScene,
  syncMarkToKindAndPatchScene,
} from '../../bim/walls/opening-mark-allocator';
import {
  openingTypeLinkChanged,
  openingUpdateLinkPatch,
  type OpeningTypeLink,
} from '../../bim/family-types/opening-type-resolution';
import { useOpeningTypeReresolution } from './useOpeningTypeReresolution';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
  BimPersistenceHookContext,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type OpeningSaveState = BimEntitySaveState;

interface OpeningLevelManager extends LevelSceneWriter {
  readonly levels: readonly Level[];
}

export interface UseOpeningPersistenceParams
  extends Omit<BimEntityPersistenceParams<OpeningEntity>, 'primarySelected' | 'levelManager'> {
  readonly levelManager: OpeningLevelManager;
  readonly primarySelectedOpening: OpeningEntity | null;
}

export interface UseOpeningPersistenceResult {
  readonly saveState: OpeningSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteOpening: (openingId: string) => Promise<void>;
}

// ============================================================================
// EXTRA REF BAG (family-type link map + live t / derived floorId)
// ============================================================================

interface OpeningExtra {
  /** ADR-421 — last-persisted Family/Type link per opening. */
  readonly lastSavedLink: Map<string, OpeningTypeLink>;
  /** Live deps updated each render by `useExtra` (read at persist/delete time). */
  readonly live: { t: (k: string) => string; floorId: string | null };
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

/**
 * ADR-395 G6 / ADR-615 — re-feed the host wall BOQ (its net area depends on its openings) ONLY when
 * the opening is wall-hosted. A self-hosted opening (ADR-615) has no host wall, so there is nothing
 * to re-feed. SSoT for the guard shared by onPersisted / onDeleted / onRestored.
 */
function emitOpeningPersistedIfHosted(wallId: string | undefined | null): void {
  if (wallId) EventBus.emit('bim:opening-persisted', { wallId });
}

/**
 * ADR-674 Φ C — feed the opening's additive priced «σιδερικά» rows (one per
 * hardware component). SSoT for the persist/restore call shared by
 * onPersisted / onRestored (identical shape → extracted, N.18 / jscpd).
 */
function feedOpeningHardwareBoq(
  entity: OpeningEntity,
  scope: { readonly companyId: string; readonly projectId: string; readonly buildingId: string },
  floorId: string | undefined,
  action: 'created' | 'updated',
): void {
  void upsertOpeningHardwareBoq(
    { id: entity.id, kind: entity.params.kind, params: entity.params },
    { companyId: scope.companyId, projectId: scope.projectId, buildingId: scope.buildingId, floorId },
    action,
  );
}

const useOpeningPersistenceBase = createBimEntityPersistenceHook<
  OpeningFirestoreService,
  OpeningDoc,
  OpeningEntity,
  OpeningEntity['params'],
  void,
  OpeningExtra
>({
  entityType: 'opening',
  restoreEntityType: 'opening',
  saveErrorKey: 'OPENING_SAVE_ERROR',
  restoreErrorKey: 'OPENING_RESTORE_ERROR',
  typeGuard: isOpening,
  entityComparable: (e) => e.params,
  // Opening is NOT in the shared moved-persist family; it uses its own envelope
  // listener (useExtra). Mark the tombstone synchronously on delete-request.
  enableMovedEffect: false,
  markDeletedOnRequest: true,
  createExtraRefs: () => ({
    lastSavedLink: new Map<string, OpeningTypeLink>(),
    live: { t: (k: string) => k, floorId: null },
  }),
  createService: (scope) => createOpeningFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveOpening(entityToSaveInput(e)).then(() => undefined),
    update: (svc, e) =>
      svc.updateOpening(e.id, {
        kind: e.params.kind,
        params: e.params,
        validation: e.validation,
        layerId: e.layerId,
        // ADR-421 — persist the Family/Type link (null → deleteField).
        ...openingUpdateLinkPatch(e),
      }),
    remove: (svc, id) => svc.deleteOpening(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeOpenings(onDocs as (docs: readonly OpeningDoc[]) => void, onErr),
  },
  merge: {
    mode: 'custom',
    run: (docs, levelId, lm, refs, extra) =>
      mergeOpeningDocsIntoScene(docs as readonly OpeningDoc[], levelId, lm, {
        dirty: refs.dirty,
        deleted: refs.deleted,
        pending: refs.pending,
        lastSavedParams: refs.lastSavedParams,
        lastSavedLink: extra.lastSavedLink,
      }),
  },
  // ADR-376 mark allocation (first save) + ADR-363 §5.4 kind→mark re-sync (edit).
  beforeSave: async (entity, { isNew, prevComparable, scope, extra }) => {
    const { companyId, projectId, floorplanId } = scope;
    if (!companyId || !projectId || !floorplanId) return entity;
    // The runtime levelManager is always an `OpeningLevelManager` (carries `levels`),
    // which the mark allocator needs; the scope surface types it as the writer subset.
    const levelManager = scope.levelManager as OpeningLevelManager;
    const deps = { companyId, projectId, floorplanId, levelManager, t: extra.live.t };
    if (isNew) return allocateMarkAndPatchScene(entity, deps);
    if (prevComparable && prevComparable.kind !== entity.params.kind) {
      return syncMarkToKindAndPatchScene(entity, deps);
    }
    return entity;
  },
  // ADR-421 — also persist when only the Family/Type link changed (params identical).
  autoSaveDirty: (entity, lastSaved, extra) => {
    const linkChanged = openingTypeLinkChanged(extra.lastSavedLink.get(entity.id), entity);
    return !(lastSaved !== undefined && dequalParams(lastSaved, entity.params) && !linkChanged);
  },
  deleteTrigger: {
    event: 'bim:opening-delete-requested',
    getId: (p) => (p as { openingId?: string }).openingId,
  },
  onPersisted: (entity, { isNew, prevComparable, scope, extra }) => {
    extra.lastSavedLink.set(entity.id, {
      typeId: entity.typeId,
      typeOverrides: entity.typeOverrides,
    });
    void recordOpeningChange(
      isNew ? 'created' : 'updated',
      entity,
      { prevParams: prevComparable ?? undefined },
    );
    // ADR-376 Phase B.2 — signature-group aggregation (recomputes new group + old).
    const { companyId, projectId, buildingId, floorplanId } = scope;
    if (companyId && projectId && buildingId && floorplanId) {
      void upsertOpeningGroupForOpening(
        { id: entity.id, kind: entity.params.kind, params: entity.params },
        prevComparable ?? null,
        { companyId, projectId, buildingId, floorplanId, floorId: extra.live.floorId ?? undefined },
      );
      // ADR-674 Φ C — additive priced «σιδερικά» rows (one per hardware component).
      feedOpeningHardwareBoq(entity, { companyId, projectId, buildingId }, extra.live.floorId ?? undefined, isNew ? 'created' : 'updated');
    }
    emitOpeningPersistedIfHosted(entity.params.wallId);
  },
  onDeleted: (id, deleted, { scope, extra, lastSavedComparable }) => {
    const lastKnownParams = lastSavedComparable ?? deleted?.params ?? null;
    void recordOpeningChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: lastKnownParams ?? deleted.params }
        : { id, kind: 'door' },
    );
    const { companyId, projectId, buildingId, floorplanId } = scope;
    if (companyId && projectId && buildingId && floorplanId) {
      void deleteOpeningFromGroup(lastKnownParams, {
        companyId, projectId, buildingId, floorplanId, floorId: extra.live.floorId ?? undefined,
      });
      // ADR-674 Φ C — cascade-delete the opening's priced «σιδερικά» rows.
      void deleteOpeningHardwareBoq(id);
    }
    emitOpeningPersistedIfHosted(lastKnownParams?.wallId);
  },
  onDeleteCleanup: (id, extra) => {
    extra.lastSavedLink.delete(id);
  },
  onRestored: (entity, { scope, extra }) => {
    extra.lastSavedLink.set(entity.id, {
      typeId: entity.typeId,
      typeOverrides: entity.typeOverrides,
    });
    void recordOpeningChange('restored', entity);
    const { companyId, projectId, buildingId, floorplanId } = scope;
    if (companyId && projectId && buildingId && floorplanId) {
      void upsertOpeningGroupForOpening(
        { id: entity.id, kind: entity.kind, params: entity.params },
        null,
        { companyId, projectId, buildingId, floorplanId, floorId: extra.live.floorId ?? undefined },
      );
      // ADR-674 Φ C — restore the opening's additive priced «σιδερικά» rows.
      feedOpeningHardwareBoq(entity, { companyId, projectId, buildingId }, extra.live.floorId ?? undefined, 'created');
    }
    emitOpeningPersistedIfHosted(entity.params.wallId);
  },
  useExtra: (ctx) => useOpeningExtra(ctx),
});

// dequal is used only inside autoSaveDirty; keep a local alias so the config object
// reads cleanly (the factory owns the default dequal path for the majority hooks).
function dequalParams(a: OpeningEntity['params'], b: OpeningEntity['params']): boolean {
  return dequal(a, b);
}

// ============================================================================
// useExtra — reresolution + envelope persist + retry-save + live deps
// ============================================================================

function useOpeningExtra(
  ctx: BimPersistenceHookContext<OpeningEntity, OpeningEntity['params'], OpeningExtra>,
): void {
  const { t } = useTranslation('dxf-viewer');
  const lm = ctx.levelManagerRef.current as OpeningLevelManager;
  const currentLevelId = lm.currentLevelId;
  const floorId = lm.levels.find((l) => l.id === currentLevelId)?.floorId ?? null;
  // Live deps read at persist/delete time.
  ctx.extra.live.t = t;
  ctx.extra.live.floorId = floorId;

  // ADR-421 — re-resolve typed openings on a family-type catalog bump.
  useOpeningTypeReresolution(lm, ctx.dirtyIdsRef);

  const { persist, serviceRef, dirtyIdsRef, lastSavedParamsRef, deletedIdsRef, levelManagerRef } = ctx;
  const { companyId, projectId, floorplanId } = ctx.scope;

  // ADR-396 P7 — thermal envelope applied → persist Z4 reveal on exterior openings.
  useEffect(() => {
    return EventBus.on('bim:envelope-applied', ({ entities }) => {
      if (!serviceRef.current) return;
      for (const entity of entities) {
        if (!isOpening(entity)) continue;
        dirtyIdsRef.current.add(entity.id);
        void persist(entity);
      }
    });
  }, [persist, serviceRef, dirtyIdsRef]);

  // Retry-save for openings drawn before floorplanId was available (never persisted).
  // Gated on a ready service (implies auth/scope resolved — userId present).
  useEffect(() => {
    if (!floorplanId || !companyId || !projectId || !serviceRef.current) return;
    const manager = levelManagerRef.current;
    const levelId = manager.currentLevelId;
    if (!levelId) return;
    const scene = manager.getLevelScene(levelId);
    if (!scene) return;
    const unsaved = scene.entities.filter(
      (e): e is OpeningEntity =>
        isOpening(e) && !lastSavedParamsRef.current.has(e.id) && !deletedIdsRef.current.has(e.id),
    );
    for (const opening of unsaved) {
      dirtyIdsRef.current.add(opening.id);
      void persist(opening);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorplanId, companyId, projectId]);
}

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useOpeningPersistence(
  params: UseOpeningPersistenceParams,
): UseOpeningPersistenceResult {
  const { primarySelectedOpening, ...rest } = params;
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } =
    useOpeningPersistenceBase({
      ...rest,
      primarySelected: primarySelectedOpening,
    } as BimEntityPersistenceParams<OpeningEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteOpening: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
