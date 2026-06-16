'use client';

/**
 * ADR-363 Phase 5 — Beam Firestore persistence React adapter.
 *
 * Bridges `BeamFirestoreService` σε scene model owned by `LevelsSystem`.
 * Mirrors `useColumnPersistence` — same hybrid auto-save pattern, same
 * selective skip diff-merge, same first-save listener wired σε
 * `drawing:entity-created` με tool='beam'.
 *
 * Persistence trigger — hybrid:
 *   - Debounced auto-save 500 ms μετά από `beam.params` change settle.
 *   - `saveNow()` imperative escape hatch.
 *
 * Scene sync — diff-merge με selective skip:
 *   - Κάθε snapshot adds / updates / removes beams στο active scene.
 *   - Beams marked locally-dirty ΠΟΤΕ overwritten από snapshot data.
 *
 * Geometry re-derivation: όταν φτάνει snapshot από Firestore, η γεωμετρία
 * αναπαράγεται client-side από `params`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { BeamEntity } from '../../bim/types/beam-types';
import { EventBus } from '../../systems/events/EventBus';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createBeamFirestoreService,
  entityToSaveInput,
  BeamFirestoreService,
  type BeamDoc,
} from '../../bim/beams/beam-firestore-service';
import { recordBeamChange } from '../../bim/beams/beam-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { beamBoqEntity } from './beam-boq-feed';
import { createPersistSerializer } from './persist-serializer';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type BeamSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseBeamPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
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
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isBeam(entity: AnySceneEntity): entity is BeamEntity {
  return (entity as { type?: string }).type === 'beam';
}

// docToEntity → beamDocToEntity μετακινήθηκε στο './beam-persistence-helpers' (file-size split).

// ============================================================================
// HOOK
// ============================================================================

export function useBeamPersistence(
  params: UseBeamPersistenceParams,
): UseBeamPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId,
    levelManager,
    primarySelectedBeam,
  } = params;

  const [saveState, setSaveState] = useState<BeamSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<BeamFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, BeamEntity['params']>>(new Map());
  // ADR-390 — pending first save (drawn or restored) + tombstone tracking.
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ADR-390 Φ4 / N.7 — per-id write serializer (mirror useColumnPersistence). A
  // freshly-drawn beam moved in the SAME tick races: the create `saveBeam` (setDoc)
  // and the move `updateBeam` run concurrently; if the create lands LAST it clobbers
  // the move (observed: updatedAt==createdAt, axis reverted to the drawn position).
  // Serializing per id chains them → create commits, then move updates → DB = moved.
  const persistSerializerRef = useRef(createPersistSerializer());
  const selectedBeamRef = useRef<BeamEntity | null>(null);
  selectedBeamRef.current = primarySelectedBeam;

  // ⚡ STABILITY (ca9 fix 2026-06-08): key the Firestore subscription off stable
  // scope primitives + `currentLevelId`, NOT the per-render `levelManager` object,
  // so onSnapshot does not unsubscribe/re-subscribe on every render (target removed
  // before ack → `INTERNAL ASSERTION FAILED ca9 {ve:-1}`). Mirror of the fitting hook.
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const currentLevelId = levelManager.currentLevelId;

  // Instantiate service όταν auth + scope ready.
  useEffect(() => {
    const scope = resolveBimPersistenceScope({ companyId, projectId, userId, floorId, floorplanId });
    if (!scope) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createBeamFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty beams.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeBeams(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, BeamDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneBeams = new Map<string, BeamEntity>();
        const nonBeams: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isBeam(e)) sceneBeams.set(e.id, e);
          else nonBeams.push(e);
        }

        const nextBeams: BeamEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneBeams.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextBeams.push(beamDocToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextBeams.push(existing);
            continue;
          }
          if (!dequal(existing.params, doc.params)) {
            nextBeams.push(beamDocToEntity(doc));
            mutated = true;
          } else {
            nextBeams.push(existing);
          }
        }

        // ADR-397 — seed the "known/last-saved" baseline for every Firestore doc
        // so edits to a pre-existing beam pass the auto-save gate + dirty-guard
        // instead of being reverted by the next snapshot (mirror wall/column).
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        // ADR-390 — replaces buggy `neverSaved` guard.
        for (const [id, entity] of sceneBeams) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextBeams.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...nonBeams, ...nextBeams],
          }, 'remote-echo');
        }
      },
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [currentLevelId, companyId, projectId, floorplanId, userId]);

  // Immediate persist body — one save + one audit per call. Always invoked through
  // the serialized `persist` wrapper below so concurrent calls for the same id
  // (e.g. same-tick create + move) run in order instead of clobbering each other.
  const persistOnce = useCallback(async (entity: BeamEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      // ADR-397 — setDoc (saveBeam) only on first write (stamps immutable
      // createdAt); existing beams go through updateBeam (updateDoc) so re-edits
      // persist instead of being silently rejected → snapshot revert. Mirror wall/column.
      if (isNew) {
        await svc.saveBeam(entityToSaveInput(entity));
      } else {
        await svc.updateBeam(entity.id, {
          params: entity.params,
          validation: entity.validation,
          geometry: entity.geometry,
          layerId: entity.layerId,
          // ADR-441 Slice GEN-BEAM — round-trip hosting bindings on every update
          // (follow-move edits keep the born-bound link persisted).
          guideBindings: entity.guideBindings,
        });
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordBeamChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      if (companyId && projectId && buildingId) {
        // ADR-449 Slice 4 — feed via beamBoqEntity (adds derived σοβά contribution
        // όταν ενεργό· αλλιώς minimal payload = byte-identical προ-Slice-4).
        const lm = levelManagerRef.current;
        const lvlId = lm.currentLevelId;
        const scene = lvlId ? lm.getLevelScene(lvlId) : null;
        void bimToBoqBridge.upsertBoqItemForBim(
          'beam',
          beamBoqEntity(entity, scene),
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
      if (floorplanId) EventBus.emit('bim:beam-persisted', { floorplanId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'BEAM_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId, floorplanId]);

  // Serialized persist (ADR-390 Φ4 / N.7): chains concurrent saves for the same id
  // so a same-tick create + move (or grip param-edit) sees the committed baseline →
  // emits one `created` then an `updated` diff, instead of the create clobbering the
  // move. Mirror of useColumnPersistence.
  const persist = useCallback(
    (entity: BeamEntity) =>
      persistSerializerRef.current.run(entity.id, () => persistOnce(entity)),
    [persistOnce],
  );

  // Auto-save debounce σε selected beam params change.
  useEffect(() => {
    const beam = primarySelectedBeam;
    if (!beam || !serviceRef.current) return;
    // ADR-390 — Bug A defense-in-depth.
    const known = lastSavedParamsRef.current.has(beam.id);
    const pendingBeam = pendingFirstSaveIdsRef.current.has(beam.id);
    if (!known && !pendingBeam) return;
    const lastSaved = lastSavedParamsRef.current.get(beam.id);
    if (lastSaved && dequal(lastSaved, beam.params)) return;

    dirtyIdsRef.current.add(beam.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(beam);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedBeam, persist]);

  const saveNow = useCallback(async () => {
    const beam = selectedBeamRef.current;
    if (!beam) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(beam);
  }, [persist]);

  // Phase 5 — Delete beam: remove από Firestore + scene + audit.
  const deleteBeam = useCallback(async (beamId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === beamId);

    const deletedBeam = (deletedEntity && isBeam(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteBeam(beamId);
      void recordBeamChange(
        'deleted',
        deletedBeam
          ? { id: deletedBeam.id, kind: deletedBeam.kind, layerId: deletedBeam.layerId, params: deletedBeam.params }
          : { id: beamId, kind: 'straight' },
      );
      void bimToBoqBridge.deleteBoqItemForBim(beamId, companyId ?? '');
      if (floorplanId) EventBus.emit('bim:beam-persisted', { floorplanId });
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== beamId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(beamId);
    lastSavedParamsRef.current.delete(beamId);
    pendingFirstSaveIdsRef.current.delete(beamId);
    deletedIdsRef.current.add(beamId);
  }, [levelManager, companyId, floorplanId]);

  // ADR-390 — persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: BeamEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveBeam(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordBeamChange('restored', entity);
      if (companyId && projectId && buildingId) {
        // ADR-449 Slice 4 — same finish-aware feed για το restore path.
        const lm = levelManagerRef.current;
        const lvlId = lm.currentLevelId;
        const scene = lvlId ? lm.getLevelScene(lvlId) : null;
        void bimToBoqBridge.upsertBoqItemForBim(
          'beam',
          beamBoqEntity(entity, scene),
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          'created',
        );
      }
      if (floorplanId) EventBus.emit('bim:beam-persisted', { floorplanId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'BEAM_RESTORE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId, floorplanId]);

  // First-save listener — fires άμεσα για freshly drawn beams.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'beam') return;
      const entity = payload.entity as BeamEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'beam') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Param-edit persistence (ADR-390 Phase 4 — render==DB SSoT). A beam grip /
  // ribbon param edit (commitBeamGripDrag etc.) emits `bim:beam-params-updated`
  // but was persisted ONLY by the fragile 500ms selected-beam debounce — if the
  // beam was deselected before it fired, the edit landed in the scene + `.scene.json`
  // snapshot but NEVER in the per-entity doc → on reload the un-edited DB axis
  // rendered (observed: a face-justified beam snapping back ~half-width). Persist
  // immediately off the event (entity read from the live scene by id), so the edit
  // reaches the SSoT regardless of selection/debounce timing. Mirror the first-save
  // listener; `persist` is idempotent (no-op when params already saved).
  useEffect(() => {
    const cleanup = EventBus.on('bim:beam-params-updated', ({ beamId }) => {
      if (!serviceRef.current) return;
      const lm = levelManagerRef.current;
      const levelId = lm.currentLevelId;
      if (!levelId) return;
      const entity = lm.getLevelScene(levelId)?.entities.find((e) => e.id === beamId);
      if (!entity || !isBeam(entity)) return;
      dirtyIdsRef.current.add(beamId);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (bridge emits μετά από confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:beam-delete-requested', ({ beamId }) => {
      void deleteBeam(beamId);
    });
    return cleanup;
  }, [deleteBeam]);

  useBimEntityMovedPersistEffect(isBeam, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'beam',
    isBeam,
    serviceRef,
    pendingFirstSaveIdsRef,
    deletedIdsRef,
    persistRestore,
  );

  // Unmount cleanup — flush pending timers.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteBeam }),
    [saveState, lastSavedAt, error, saveNow, deleteBeam],
  );
}
