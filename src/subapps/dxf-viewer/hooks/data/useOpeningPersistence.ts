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
import { doc, getDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { Level } from '../../systems/levels/config';
import { computeOpeningGeometry } from '../../bim/geometry/opening-geometry';
import { validateOpeningParams } from '../../bim/validators/opening-validator';
import { EventBus } from '../../systems/events/EventBus';
import {
  createOpeningFirestoreService,
  entityToSaveInput,
  OpeningFirestoreService,
  type OpeningDoc,
} from '../../bim/walls/opening-firestore-service';
import { recordOpeningChange } from '../../bim/walls/opening-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { getOpeningMarkService } from '../../bim/services/opening-mark-service';

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
// HELPERS
// ============================================================================

function isOpening(entity: AnySceneEntity): entity is OpeningEntity {
  return (entity as { type?: string }).type === 'opening';
}

function isWall(entity: AnySceneEntity): entity is WallEntity {
  return (entity as { type?: string }).type === 'wall';
}

/**
 * Build a scene-side `OpeningEntity` από a persisted `OpeningDoc` + host wall.
 * Returns `null` όταν ο host wall δεν είναι ακόμα στο scene — caller skips
 * the snapshot entry until the next round-trip (re-hydrate).
 */
function docToEntity(
  doc: OpeningDoc,
  hostWall: WallEntity | null,
): OpeningEntity | null {
  if (!hostWall) return null;
  const validation = doc.validation ?? validateOpeningParams(doc.params, hostWall).bimValidation;
  return {
    id: doc.id,
    type: 'opening',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeOpeningGeometry(doc.params, hostWall, hostWall.params.sceneUnits ?? 'mm'),
    validation,
    visible: true,
  } as OpeningEntity;
}

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
  const lastSavedParamsRef = useRef<Map<string, OpeningEntity['params']>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOpeningRef = useRef<OpeningEntity | null>(null);
  selectedOpeningRef.current = primarySelectedOpening;

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
              const entity = docToEntity(doc, host);
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
            const entity = docToEntity(doc, host);
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

        for (const [id, entity] of sceneOpenings) {
          if (docsById.has(id)) continue;
          const neverSaved = !lastSavedParamsRef.current.has(id);
          if (dirty.has(id) || neverSaved) {
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

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: OpeningEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const isNew = !lastSavedParamsRef.current.has(entity.id);
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveOpening(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordOpeningChange(isNew ? 'created' : 'updated', entity);
      if (companyId && projectId && buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          'opening',
          { id: entity.id, kind: entity.kind },
          { companyId, projectId, buildingId },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OPENING_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId]);

  /**
   * ADR-376 Phase A — Resolve `params.mark` πριν την πρώτη persist.
   *
   * Φάσεις:
   *   1. Αν entity ήδη έχει mark → skip allocation (idempotent — N.7.2 Q3)
   *   2. Resolve current `Level.floorId` από `levelManager`. Αν λείπει
   *      → console.warn + persist χωρίς mark (blank-canvas case, Phase B)
   *   3. Fetch `FloorDocument.number` από Firestore floors/{floorId}
   *   4. i18n-resolve kindPrefix + basementPrefix
   *   5. `OpeningMarkService.allocateMark()` → patched entity
   *   6. Optimistic scene patch ώστε ο tag να φαίνεται immediately
   *   7. Persist patched entity
   */
  const allocateAndPersistOpening = useCallback(async (entity: OpeningEntity) => {
    let finalEntity: OpeningEntity = entity;
    if (
      entity.params.mark === undefined &&
      companyId &&
      projectId &&
      floorplanId &&
      levelManager.currentLevelId
    ) {
      const level = levelManager.levels.find((l) => l.id === levelManager.currentLevelId);
      if (!level?.floorId) {
        // Blank-canvas / non-wizard placement — pending Phase B per handoff Α.
        // eslint-disable-next-line no-console
        console.warn('[opening-mark] skipped allocation: level.floorId missing');
      } else {
        try {
          const floorSnap = await getDoc(doc(db, COLLECTIONS.FLOORS, level.floorId));
          const floorNumber = (floorSnap.data() as { number?: number } | undefined)?.number;
          if (typeof floorNumber === 'number') {
            const kindPrefix = t(`opening.tag.prefix.${entity.kind}`);
            const basementPrefix = t('opening.tag.basementPrefix');
            const mark = await getOpeningMarkService().allocateMark({
              companyId,
              projectId,
              floorplanId,
              floorNumber,
              kind: entity.kind,
              kindPrefix,
              basementPrefix,
            });
            finalEntity = {
              ...entity,
              params: { ...entity.params, mark },
            } as OpeningEntity;

            // Optimistic scene patch — ο tag εμφανίζεται immediately χωρίς να
            // περιμένουμε round-trip από Firestore snapshot.
            const levelId = levelManager.currentLevelId;
            const scene = levelManager.getLevelScene(levelId);
            if (scene) {
              const nextEntities = scene.entities.map((e) =>
                e.id === finalEntity.id ? finalEntity : e,
              );
              levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
            }
          }
        } catch {
          // Non-fatal — persist χωρίς mark, lazy-allocate σε επόμενο placement
          // ή μέσω migration script (`npm run bim:migrate:opening-tags`).
        }
      }
    }
    await persist(finalEntity);
  }, [persist, companyId, projectId, floorplanId, levelManager, t]);

  // Auto-save debounce on selected opening params change.
  useEffect(() => {
    const opening = primarySelectedOpening;
    if (!opening || !serviceRef.current) return;
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

    try {
      await svc.deleteOpening(openingId);
      void recordOpeningChange(
        'deleted',
        { id: openingId, kind: (deletedEntity as Partial<OpeningEntity>)?.kind ?? 'door' },
      );
      void bimToBoqBridge.deleteBoqItemForBim(openingId, companyId ?? '');
    } catch {
      // Non-fatal: deletion failure silent — user can retry.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== openingId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(openingId);
    lastSavedParamsRef.current.delete(openingId);
  }, [levelManager, companyId]);

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
      dirtyIdsRef.current.add(entity.id);
      void allocateAndPersistOpening(entity);
    });
    return cleanup;
  }, [allocateAndPersistOpening]);

  // Phase 2 — Delete-requested listener (bridge emits μετά από confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:opening-delete-requested', ({ openingId }) => {
      void deleteOpening(openingId);
    });
    return cleanup;
  }, [deleteOpening]);

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
