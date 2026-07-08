'use client';

/**
 * ADR-363 Phase 5 — Beam Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: hybrid auto-save + `saveNow`, generic diff-merge, serialized persist
 * (ADR-390 Φ4 — same-tick create+move race), finish-aware BOQ feed
 * (create/update/delete/restore), `bim:beam-persisted` emit (slab BOQ deduction),
 * and immediate persist off `bim:beam-params-updated` (grip/ribbon edits bypass the
 * selection debounce). First-save on `drawing:entity-created` (tool 'beam').
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useEffect, useMemo } from 'react';

import type { BeamEntity } from '../../bim/types/beam-types';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { EventBus } from '../../systems/events/EventBus';
import {
  createBeamFirestoreService,
  entityToSaveInput,
  BeamFirestoreService,
  type BeamDoc,
} from '../../bim/beams/beam-firestore-service';
import { recordBeamChange } from '../../bim/beams/beam-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { beamBoqEntity } from './beam-boq-feed';
import { beamDocToEntity } from './beam-persistence-helpers';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
  BimPersistenceScope,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type BeamSaveState = BimEntitySaveState;

export interface UseBeamPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedBeam: BeamEntity | null;
}

export interface UseBeamPersistenceResult {
  readonly saveState: BeamSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteBeam: (beamId: string) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

/** ADR-449 Slice 4 — finish-aware BOQ feed (minimal payload = byte-identical pre-Slice-4). */
function feedBeamBoq(
  entity: BeamEntity,
  scope: BimPersistenceScope,
  action: 'created' | 'updated',
): void {
  if (!(scope.companyId && scope.projectId && scope.buildingId)) return;
  const levelId = scope.levelManager.currentLevelId;
  const scene = levelId ? scope.levelManager.getLevelScene(levelId) : null;
  void bimToBoqBridge.upsertBoqItemForBim(
    'beam',
    beamBoqEntity(entity, scene),
    {
      companyId: scope.companyId,
      projectId: scope.projectId,
      buildingId: scope.buildingId,
      floorId: scope.floorId ?? undefined,
    },
    action,
  );
}

function emitBeamPersisted(scope: BimPersistenceScope): void {
  if (scope.floorplanId) EventBus.emit('bim:beam-persisted', { floorplanId: scope.floorplanId });
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useBeamPersistenceBase = createBimEntityPersistenceHook<
  BeamFirestoreService,
  BeamDoc,
  BeamEntity,
  BeamEntity['params']
>({
  entityType: 'beam',
  restoreEntityType: 'beam',
  saveErrorKey: 'BEAM_SAVE_ERROR',
  restoreErrorKey: 'BEAM_RESTORE_ERROR',
  serialize: true,
  entityComparable: (e) => e.params,
  createService: (scope) => createBeamFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveBeam(entityToSaveInput(e)),
    // ADR-441 guideBindings + ADR-539 Φ3d faceAppearance round-trip on every update.
    update: (svc, e) =>
      svc.updateBeam(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
        guideBindings: e.guideBindings,
        faceAppearance: e.faceAppearance,
      }),
    remove: (svc, id) => svc.deleteBeam(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeBeams(onDocs as (docs: readonly BeamDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: (e): e is BeamEntity => (e as { type?: string }).type === 'beam',
      docToEntity: beamDocToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:beam-delete-requested',
    getId: (p) => (p as { beamId?: string }).beamId,
  },
  onPersisted: (entity, { isNew, prevComparable, scope }) => {
    void recordBeamChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
    feedBeamBoq(entity, scope, isNew ? 'created' : 'updated');
    emitBeamPersisted(scope);
  },
  onDeleted: (id, deleted, { scope }) => {
    void recordBeamChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'straight' },
    );
    void bimToBoqBridge.deleteBoqItemForBim(id, scope.companyId ?? '');
    emitBeamPersisted(scope);
  },
  onRestored: (entity, { scope }) => {
    void recordBeamChange('restored', entity);
    feedBeamBoq(entity, scope, 'created');
    emitBeamPersisted(scope);
  },
  // ADR-390 Φ4 — grip/ribbon param edit emits `bim:beam-params-updated`; persist
  // immediately (read live from the scene) regardless of selection/debounce timing.
  useExtra: (ctx) => {
    useEffect(() => {
      const cleanup = EventBus.on('bim:beam-params-updated', ({ beamId }) => {
        if (!ctx.serviceRef.current) return;
        const lm = ctx.levelManagerRef.current;
        const levelId = lm.currentLevelId;
        if (!levelId) return;
        const entity = lm.getLevelScene(levelId)?.entities.find((e) => e.id === beamId);
        if (!entity || (entity as { type?: string }).type !== 'beam') return;
        ctx.dirtyIdsRef.current.add(beamId);
        void ctx.persist(entity as BeamEntity);
      });
      return cleanup;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx.persist]);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useBeamPersistence(
  params: UseBeamPersistenceParams,
): UseBeamPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useBeamPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    buildingId: params.buildingId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedBeam,
  } as BimEntityPersistenceParams<BeamEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteBeam: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
