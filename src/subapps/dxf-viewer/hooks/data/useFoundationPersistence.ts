'use client';

/**
 * ADR-436 Slice 1-persist — Foundation Firestore persistence React adapter.
 *
 * Bridges `FoundationFirestoreService` σε scene model owned by `LevelsSystem`.
 * Mirror του `useColumnPersistence` — same hybrid auto-save pattern, same
 * selective-skip diff-merge, same first-save listener wired σε
 * `drawing:entity-created` με tool='foundation'. **ΧΩΡΙΣ BOQ bridge** (structural
 * substructure· BOQ/ATOE = Slice 4) και **ΧΩΡΙΣ buildingId**.
 *
 * Persistence trigger — hybrid:
 *   - Debounced auto-save 500 ms μετά από `foundation.params` change settle.
 *   - `saveNow()` imperative escape hatch.
 *
 * Scene sync — diff-merge με selective skip:
 *   - Κάθε snapshot adds / updates / removes foundations στο active scene.
 *   - Foundations marked locally-dirty ΠΟΤΕ overwritten από snapshot data.
 *
 * Geometry re-derivation: όταν φτάνει snapshot από Firestore, η γεωμετρία
 * αναπαράγεται client-side από `params` (SSoT `createFoundation` factory).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import { computeFoundationGeometry } from '../../bim/geometry/foundation-geometry';
import { validateFoundationParams } from '../../bim/validators/foundation-validator';
import { createFoundation } from '@/services/factories/foundation.factory';
import { EventBus } from '../../systems/events/EventBus';
import {
  createFoundationFirestoreService,
  entityToSaveInput,
  FoundationFirestoreService,
  type FoundationDoc,
} from '../../bim/foundations/foundation-firestore-service';
import { recordFoundationChange } from '../../bim/foundations/foundation-audit-client';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';
import { useBimFirestoreWriteGrace } from './useBimFirestoreWriteGrace';

// ============================================================================
// TYPES
// ============================================================================

export type FoundationSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseFoundationPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedFoundation: FoundationEntity | null;
}

export interface UseFoundationPersistenceResult {
  readonly saveState: FoundationSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteFoundation: (foundationId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isFoundation(entity: AnySceneEntity): entity is FoundationEntity {
  return (entity as { type?: string }).type === 'foundation';
}

/**
 * Build scene-side `FoundationEntity` από persisted `FoundationDoc`. Geometry +
 * validation recomputed via SSoT pure functions· IFC mixin auto-filled από το
 * `createFoundation` factory (predefinedType ντετερμινιστικά από kind).
 */
function docToEntity(doc: FoundationDoc): FoundationEntity {
  const validation = doc.validation ?? validateFoundationParams(doc.params).bimValidation;
  const entity = createFoundation({
    id: doc.id,
    params: doc.params,
    geometry: doc.geometry ?? computeFoundationGeometry(doc.params),
    layerId: doc.layerId ?? '0',
    visible: true,
    validation,
  });
  // ADR-441 Slice 3 — restore grid hosting bindings so follow-on-move survives
  // reload (createFoundation factory δεν δέχεται bindings → spread μετά).
  return doc.guideBindings ? { ...entity, guideBindings: doc.guideBindings } : entity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFoundationPersistence(
  params: UseFoundationPersistenceParams,
): UseFoundationPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    floorId,
    userId,
    levelManager,
    primarySelectedFoundation,
  } = params;

  const [saveState, setSaveState] = useState<FoundationSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<FoundationFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, FoundationEntity['params']>>(new Map());
  const { recordWrite, isWithinGrace } = useBimFirestoreWriteGrace();
  // ADR-390 — pending first save (drawn or restored) + tombstone tracking.
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedFoundationRef = useRef<FoundationEntity | null>(null);
  selectedFoundationRef.current = primarySelectedFoundation;

  // ⚡ STABILITY (ca9 fix): key the Firestore subscription off stable scope
  // primitives + `currentLevelId`, NOT the per-render `levelManager` object, so
  // onSnapshot does not unsubscribe/re-subscribe on every render. Mirror column.
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const currentLevelId = levelManager.currentLevelId;

  // Instantiate service όταν auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createFoundationFirestoreService({
      companyId,
      projectId,
      floorplanId,
      floorId: floorId ?? undefined,
      userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty foundations.
  // Keyed on STABLE primitives only (scope + currentLevelId).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeFoundations(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, FoundationDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneFoundations = new Map<string, FoundationEntity>();
        const nonFoundations: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isFoundation(e)) sceneFoundations.set(e.id, e);
          else nonFoundations.push(e);
        }

        const nextFoundations: FoundationEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneFoundations.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextFoundations.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextFoundations.push(existing);
            continue;
          }
          // Grace-period guard (useBimFirestoreWriteGrace SSoT).
          if (isWithinGrace(doc.id)) {
            nextFoundations.push(existing);
            continue;
          }
          if (!dequal(existing.params, doc.params)) {
            nextFoundations.push(docToEntity(doc));
            mutated = true;
          } else {
            nextFoundations.push(existing);
          }
        }

        // ADR-397 — seed the "last-saved" baseline for every Firestore doc so a
        // subsequently edited foundation (loaded this session, not freshly drawn)
        // passes the auto-save gate (`lastSavedParamsRef.has(id)`) and its dirty
        // flag protects the local edit from this snapshot (anti snap-back).
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        // ADR-390 — keep locally-pending / dirty foundations not yet in Firestore.
        for (const [id, entity] of sceneFoundations) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextFoundations.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...nonFoundations, ...nextFoundations],
          });
        }
      },
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [currentLevelId, companyId, projectId, floorplanId, userId]);

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: FoundationEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      // ADR-397 — setDoc (saveFoundation) only on first write (stamps createdAt,
      // which the Firestore UPDATE rule treats as immutable). Existing foundations
      // go through updateFoundation (updateDoc) so re-edits persist instead of
      // being silently rejected → snapshot revert / snap-back. Mirror column.
      if (isNew) {
        await svc.saveFoundation(entityToSaveInput(entity));
      } else {
        await svc.updateFoundation(entity.id, {
          params: entity.params,
          validation: entity.validation,
          geometry: entity.geometry,
          layerId: entity.layerId,
          // ADR-441 Slice 6b — re-host writes hosting bindings into the existing doc.
          guideBindings: entity.guideBindings,
        });
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
      recordWrite(entity.id);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordFoundationChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FOUNDATION_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Auto-save debounce σε selected foundation params change.
  useEffect(() => {
    const foundation = primarySelectedFoundation;
    if (!foundation || !serviceRef.current) return;
    // ADR-390 — Bug A defense-in-depth.
    const known = lastSavedParamsRef.current.has(foundation.id);
    const pending = pendingFirstSaveIdsRef.current.has(foundation.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(foundation.id);
    if (lastSaved && dequal(lastSaved, foundation.params)) return;

    dirtyIdsRef.current.add(foundation.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(foundation);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedFoundation, persist]);

  const saveNow = useCallback(async () => {
    const foundation = selectedFoundationRef.current;
    if (!foundation) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(foundation);
  }, [persist]);

  // Delete foundation: remove από Firestore + scene + audit.
  const deleteFoundation = useCallback(async (foundationId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === foundationId);
    const deletedFoundation = (deletedEntity && isFoundation(deletedEntity)) ? deletedEntity : null;

    try {
      await svc.deleteFoundation(foundationId);
      void recordFoundationChange(
        'deleted',
        deletedFoundation
          ? { id: deletedFoundation.id, kind: deletedFoundation.kind, layerId: deletedFoundation.layerId, params: deletedFoundation.params }
          : { id: foundationId, kind: 'pad' },
      );
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== foundationId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(foundationId);
    lastSavedParamsRef.current.delete(foundationId);
    pendingFirstSaveIdsRef.current.delete(foundationId);
    deletedIdsRef.current.add(foundationId);
  }, [levelManager]);

  // ADR-390 — persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: FoundationEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveFoundation(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      recordWrite(entity.id);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordFoundationChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FOUNDATION_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires άμεσα για freshly drawn foundations.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'foundation') return;
      const entity = payload.entity as FoundationEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'foundation') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (smart-delete / bridge emits μετά από confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:foundation-delete-requested', ({ foundationId }) => {
      void deleteFoundation(foundationId);
    });
    return cleanup;
  }, [deleteFoundation]);

  useBimEntityMovedPersistEffect(isFoundation, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'foundation',
    isFoundation,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteFoundation }),
    [saveState, lastSavedAt, error, saveNow, deleteFoundation],
  );
}
