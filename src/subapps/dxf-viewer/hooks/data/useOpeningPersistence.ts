'use client';

/**
 * ADR-363 Phase 2 — Opening Firestore persistence React adapter.
 *
 * Bridges `OpeningFirestoreService` σε scene model owned by `LevelsSystem`.
 * Mirrors `useWallPersistence` — same hybrid auto-save pattern, same selective
 * skip diff-merge, same first-save listener wired to `drawing:entity-created`.
 *
 * Persistence trigger — hybrid (DD-1 parallel):
 *   - Debounced auto-save 500 ms μετά από `opening.params` change settle.
 *   - `saveNow()` imperative escape hatch (explicit "Αποθήκευση" button).
 *
 * Scene sync — diff-merge με selective skip:
 *   - Κάθε snapshot adds / updates / removes openings στο active scene.
 *   - Openings marked locally-dirty ΠΟΤΕ δεν overwritten από snapshot data
 *     (local edits πάντα κερδίζουν μέχρι το round-trip να ολοκληρωθεί).
 *
 * Geometry re-derivation: όταν φτάνει ένα snapshot από Firestore, η γεωμετρία
 * αναπαράγεται client-side από `params + hostWall`. Αν ο host wall δεν υπάρχει
 * (πάλι load) → opening μένει εκτός scene μέχρι ο wall να υδρευθεί (next snapshot).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { Level } from '../../systems/levels/config';
import { EventBus } from '../../systems/events/EventBus';
import {
  createOpeningFirestoreService,
  entityToSaveInput,
  OpeningFirestoreService,
  type OpeningDoc,
} from '../../bim/walls/opening-firestore-service';
import { recordOpeningChange } from '../../bim/walls/opening-audit-client';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';
import {
  deleteOpeningFromGroup,
  upsertOpeningGroupForOpening,
} from '../../bim/services/opening-boq-sync';
import { isOpening, isWall, openingDocToEntity } from '../../bim/walls/opening-doc-hydration';
import { allocateMarkAndPatchScene } from '../../bim/walls/opening-mark-allocator';

// ============================================================================
// TYPES
// ============================================================================

export type OpeningSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  readonly levels: readonly Level[];
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseOpeningPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
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
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HOOK
// ============================================================================

export function useOpeningPersistence(
  params: UseOpeningPersistenceParams,
): UseOpeningPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    buildingId,
    userId,
    levelManager,
    primarySelectedOpening,
  } = params;

  const { t } = useTranslation('dxf-viewer');

  const [saveState, setSaveState] = useState<OpeningSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<OpeningFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  // ADR-390 — pending first save (drawn or restored via undo).
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, OpeningEntity['params']>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOpeningRef = useRef<OpeningEntity | null>(null);
  selectedOpeningRef.current = primarySelectedOpening;
  // Ref-based access to avoid stale closures without adding to effect dep arrays.
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const currentFloorIdRef = useRef<string | null>(null);
  currentFloorIdRef.current =
    levelManager.levels.find((l) => l.id === levelManager.currentLevelId)?.floorId ?? null;

  // Listen for explicit deletion — marks ID so subscription never re-adds it.
  useEffect(() => {
    return EventBus.on('bim:opening-delete-requested', ({ openingId }) => {
      deletedIdsRef.current.add(openingId);
      void serviceRef.current?.deleteOpening(openingId).catch(() => undefined);
    });
  }, []);

  // Instantiate service όταν auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createOpeningFirestoreService({
      companyId,
      projectId,
      floorplanId,
      userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty openings.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeOpenings(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, OpeningDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const wallsById = new Map<string, WallEntity>();
        const sceneOpenings = new Map<string, OpeningEntity>();
        const nonOpenings: AnySceneEntity[] = [];

        for (const e of scene.entities) {
          if (isWall(e)) {
            wallsById.set(e.id, e);
            nonOpenings.push(e);
          } else if (isOpening(e)) {
            sceneOpenings.set(e.id, e);
          } else {
            nonOpenings.push(e);
          }
        }

        const nextOpenings: OpeningEntity[] = [];
        let mutated = false;

        for (const doc of docs) {
          const existing = sceneOpenings.get(doc.id);
          const host = wallsById.get(doc.params.wallId) ?? null;
          if (!existing) {
            if (!dirty.has(doc.id)) {
              const entity = openingDocToEntity(doc, host);
              if (entity) {
                nextOpenings.push(entity);
                mutated = true;
              }
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextOpenings.push(existing);
            continue;
          }
          if (!dequal(existing.params, doc.params)) {
            const entity = openingDocToEntity(doc, host);
            if (entity) {
              nextOpenings.push(entity);
              mutated = true;
            } else {
              nextOpenings.push(existing);
            }
          } else {
            nextOpenings.push(existing);
          }
        }

        // Mark all Firestore docs as "exists in DB" so the retry-save path
        // never calls saveOpening() (setDoc) on already-persisted openings,
        // which would violate the UPDATE rule (createdAt immutability check).
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        const pending = pendingFirstSaveIdsRef.current;
        for (const [id, entity] of sceneOpenings) {
          if (docsById.has(id)) continue;
          // Explicitly deleted — never re-add regardless of save state.
          if (deletedIdsRef.current.has(id)) { mutated = true; continue; }
          // ADR-390 — replaces buggy `neverSaved` guard.
          if (dirty.has(id) || pending.has(id)) {
            nextOpenings.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, {
            ...scene,
            entities: [...nonOpenings, ...nextOpenings],
          });
        }
      },
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [levelManager, companyId, projectId, floorplanId, userId]);

  const persist = useCallback(async (entity: OpeningEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      await (isNew
        ? svc.saveOpening(entityToSaveInput(entity, currentFloorIdRef.current ?? undefined))
        : svc.updateOpening(entity.id, { kind: entity.kind, params: entity.params, validation: entity.validation, layerId: entity.layerId }));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordOpeningChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      // ADR-376 Phase B.2 — signature-group aggregation (όχι per-opening row).
      // opening-boq-sync recomputes the new signature group (+ old αν άλλαξε).
      if (companyId && projectId && buildingId && floorplanId) {
        void upsertOpeningGroupForOpening(
          { id: entity.id, kind: entity.kind, params: entity.params },
          prevParams,
          { companyId, projectId, buildingId, floorplanId, floorId: currentFloorIdRef.current ?? undefined },
        );
      }
      // ADR-395 G6 — host wall net area depends on its openings; signal the wall
      // persistence hook to re-feed BOQ with the updated subtraction.
      EventBus.emit('bim:opening-persisted', { wallId: entity.params.wallId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OPENING_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorplanId]);

  // ADR-376 Phase A — allocate mark before first persist (idempotent if already set).
  const allocateAndPersistOpening = useCallback(async (entity: OpeningEntity) => {
    const finalEntity =
      companyId && projectId && floorplanId
        ? await allocateMarkAndPatchScene(entity, { companyId, projectId, floorplanId, levelManager, t })
        : entity;
    await persist(finalEntity);
  }, [persist, companyId, projectId, floorplanId, levelManager, t]);

  const allocateAndPersistRef = useRef(allocateAndPersistOpening);
  allocateAndPersistRef.current = allocateAndPersistOpening;

  // Auto-save debounce on selected opening params change.
  useEffect(() => {
    const opening = primarySelectedOpening;
    if (!opening || !serviceRef.current) return;
    // ADR-390 — Bug A defense-in-depth.
    const known = lastSavedParamsRef.current.has(opening.id);
    const pendingOpening = pendingFirstSaveIdsRef.current.has(opening.id);
    if (!known && !pendingOpening) return;
    const lastSaved = lastSavedParamsRef.current.get(opening.id);
    if (lastSaved && dequal(lastSaved, opening.params)) return;

    dirtyIdsRef.current.add(opening.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(opening);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedOpening, persist]);

  const saveNow = useCallback(async () => {
    const opening = selectedOpeningRef.current;
    if (!opening) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(opening);
  }, [persist]);

  // ADR-396 P7 Part B — thermal envelope applied → persist Z4 reveal insulation
  // on exterior openings. Openings are NOT in the shared moved-persist family
  // (`useBimEntityMovedPersistEffect`), so they need their own listener. Payload
  // carries the changed entities directly (no stale getLevelScene read).
  useEffect(() => {
    return EventBus.on('bim:envelope-applied', ({ entities }) => {
      if (!serviceRef.current) return;
      for (const entity of entities) {
        if (!isOpening(entity)) continue;
        dirtyIdsRef.current.add(entity.id);
        void persist(entity);
      }
    });
  }, [persist]);

  // Phase 2 — Delete opening: remove από Firestore + scene + audit.
  const deleteOpening = useCallback(async (openingId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    // Cancel pending auto-save για να αποφύγουμε save-after-delete race.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === openingId);
    const lastKnownParams =
      lastSavedParamsRef.current.get(openingId) ??
      ((deletedEntity as Partial<OpeningEntity> | undefined)?.params ?? null);

    const deletedOpening = (deletedEntity && isOpening(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteOpening(openingId);
      void recordOpeningChange(
        'deleted',
        deletedOpening
          ? {
              id: deletedOpening.id,
              kind: deletedOpening.kind,
              layerId: deletedOpening.layerId,
              params: lastKnownParams ?? deletedOpening.params,
            }
          : { id: openingId, kind: 'door' },
      );
      // ADR-376 Phase B.2 — recompute signature group post-delete (count
      // decrements; row deleted if last opening of signature gone).
      if (companyId && projectId && buildingId && floorplanId) {
        void deleteOpeningFromGroup(
          lastKnownParams,
          { companyId, projectId, buildingId, floorplanId, floorId: currentFloorIdRef.current ?? undefined },
        );
      }
      // ADR-395 G6 — removing an opening grows the host wall's net area.
      if (lastKnownParams?.wallId) {
        EventBus.emit('bim:opening-persisted', { wallId: lastKnownParams.wallId });
      }
    } catch {
      // Non-fatal: deletion failure silent — user can retry.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== openingId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(openingId);
    lastSavedParamsRef.current.delete(openingId);
    pendingFirstSaveIdsRef.current.delete(openingId);
  }, [levelManager, companyId, projectId, buildingId, floorplanId]);

  // ADR-390 — persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: OpeningEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveOpening(entityToSaveInput(entity, currentFloorIdRef.current ?? undefined));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordOpeningChange('restored', entity);
      if (companyId && projectId && buildingId && floorplanId) {
        void upsertOpeningGroupForOpening(
          { id: entity.id, kind: entity.kind, params: entity.params },
          null,
          { companyId, projectId, buildingId, floorplanId, floorId: currentFloorIdRef.current ?? undefined },
        );
      }
      // ADR-395 G6 — restored opening re-shrinks the host wall's net area.
      EventBus.emit('bim:opening-persisted', { wallId: entity.params.wallId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OPENING_RESTORE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorplanId]);

  // First-save listener — fires άμεσα για freshly drawn openings.
  // ADR-376 Phase A: lazy-allocate `params.mark` here (single SSoT lifecycle
  // owner για mark assignment — N.7.2 Q7) πριν το persist + scene optimistic
  // patch ώστε ο tag να εμφανίζεται immediately χωρίς να περιμένει round-trip.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'opening') return;
      const entity = payload.entity as OpeningEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'opening') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void allocateAndPersistOpening(entity);
    });
    return cleanup;
  }, [allocateAndPersistOpening]);

  // Retry-save for openings drawn before floorplanId was available (neverSaved in Firestore).
  useEffect(() => {
    if (!floorplanId || !companyId || !projectId || !userId) return;
    const lm = levelManagerRef.current;
    const levelId = lm.currentLevelId;
    if (!levelId) return;
    const scene = lm.getLevelScene(levelId);
    if (!scene) return;
    const unsaved = scene.entities.filter(
      (e): e is OpeningEntity =>
        isOpening(e) &&
        !lastSavedParamsRef.current.has(e.id) &&
        !deletedIdsRef.current.has(e.id),
    );
    if (unsaved.length === 0) return;
    for (const opening of unsaved) {
      dirtyIdsRef.current.add(opening.id);
      void allocateAndPersistRef.current(opening);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorplanId, companyId, projectId, userId]);

  // Phase 2 — Delete-requested listener (bridge emits μετά από confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:opening-delete-requested', ({ openingId }) => {
      void deleteOpening(openingId);
    });
    return cleanup;
  }, [deleteOpening]);

  // ADR-390 — symmetric undo→Firestore restore.
  useBimEntityRestoredPersistEffect(
    'opening',
    isOpening,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteOpening }),
    [saveState, lastSavedAt, error, saveNow, deleteOpening],
  );
}
