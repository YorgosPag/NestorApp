'use client';

/**
 * ADR-363 Phase 3 — Slab Firestore persistence React adapter.
 *
 * Bridges `SlabFirestoreService` σε scene model owned by `LevelsSystem`.
 * Mirrors `useOpeningPersistence` — same hybrid auto-save pattern, same
 * selective skip diff-merge, same first-save listener wired σε
 * `drawing:entity-created` με tool='slab'.
 *
 * Persistence trigger — hybrid:
 *   - Debounced auto-save 500 ms μετά από `slab.params` change settle.
 *   - `saveNow()` imperative escape hatch.
 *
 * Scene sync — diff-merge με selective skip:
 *   - Κάθε snapshot adds / updates / removes slabs στο active scene.
 *   - Slabs marked locally-dirty ΠΟΤΕ overwritten από snapshot data.
 *
 * Geometry re-derivation: όταν φτάνει snapshot από Firestore, η γεωμετρία
 * αναπαράγεται client-side από `params`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SlabEntity } from '../../bim/types/slab-types';
import { EventBus } from '../../systems/events/EventBus';
import {
  createSlabFirestoreService,
  entityToSaveInput,
  SlabFirestoreService,
  type SlabDoc,
} from '../../bim/slabs/slab-firestore-service';
import { recordSlabChange } from '../../bim/slabs/slab-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';
import { slabBoqGeometry } from './slab-boq-feed';
import {
  docToEntity,
  isSlab,
  slabEntityDiffersFromDoc,
  slabTypeLinkChanged,
  type SlabTypeLink,
} from './slab-persistence-helpers';
import { useSlabTypeReresolution } from './useSlabTypeReresolution';

// ============================================================================
// TYPES
// ============================================================================

export type SlabSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseSlabPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedSlab: SlabEntity | null;
}

export interface UseSlabPersistenceResult {
  readonly saveState: SlabSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteSlab: (slabId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HOOK
// ============================================================================

export function useSlabPersistence(
  params: UseSlabPersistenceParams,
): UseSlabPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId,
    levelManager,
    primarySelectedSlab,
  } = params;

  const [saveState, setSaveState] = useState<SlabSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<SlabFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, SlabEntity['params']>>(new Map());
  // ADR-412 — last-saved family-type link per slab, so a non-destructive detach
  // (params kept, `typeId` cleared) still triggers an auto-save.
  const lastSavedTypeLinkRef = useRef<Map<string, SlabTypeLink>>(new Map());
  // ADR-390 — tracks IDs με in-flight first save (drawn or restored). Replaces
  // the buggy `neverSaved` guard that kept DXF-JSON-only ghost entities in scene.
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  // ADR-390 — tombstone Set που blocks subscribe loop from re-adding entities
  // that were just deleted (race between Firestore snapshot + local delete).
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedSlabRef = useRef<SlabEntity | null>(null);
  selectedSlabRef.current = primarySelectedSlab;

  // ⚡ STABILITY (ca9 fix 2026-06-08): key the Firestore subscription off stable
  // scope primitives + `currentLevelId`, NOT the per-render `levelManager` object,
  // so onSnapshot does not unsubscribe/re-subscribe on every render (target removed
  // before ack → `INTERNAL ASSERTION FAILED ca9 {ve:-1}`). Mirror of the fitting hook.
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const currentLevelId = levelManager.currentLevelId;

  // Instantiate service όταν auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createSlabFirestoreService({
      companyId,
      projectId,
      floorplanId,
      floorId: floorId ?? undefined,
      userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty slabs.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeSlabs(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, SlabDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneSlabs = new Map<string, SlabEntity>();
        const nonSlabs: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isSlab(e)) sceneSlabs.set(e.id, e);
          else nonSlabs.push(e);
        }

        const nextSlabs: SlabEntity[] = [];
        let mutated = false;

        // ADR-390 — block subscribe from re-adding tombstoned IDs (delete race).
        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneSlabs.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextSlabs.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextSlabs.push(existing);
            continue;
          }
          // ADR-412 — diff against the doc's EFFECTIVE (type-resolved) params so
          // a typed slab doesn't churn on every snapshot (scene holds resolved).
          if (slabEntityDiffersFromDoc(existing, doc)) {
            nextSlabs.push(docToEntity(doc));
            mutated = true;
          } else {
            nextSlabs.push(existing);
          }
        }

        // ADR-390 — replaces buggy `neverSaved` guard. Keep entities only αν
        // είναι (a) dirty (locally being edited), or (b) pendingFirstSave
        // (just drawn / just restored, in-flight first persist). DXF-JSON-only
        // ghost entities (loaded after refresh με κενό pendingRef) DROP από
        // scene — Bug B fix.
        for (const [id, entity] of sceneSlabs) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextSlabs.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...nonSlabs, ...nextSlabs],
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
  const persist = useCallback(async (entity: SlabEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveSlab(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      lastSavedTypeLinkRef.current.set(entity.id, {
        typeId: entity.typeId,
        typeOverrides: entity.typeOverrides,
      });
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordSlabChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      if (companyId && projectId && buildingId) {
        const levelId = levelManager.currentLevelId;
        const scene = levelId ? levelManager.getLevelScene(levelId) : null;
        void bimToBoqBridge.upsertBoqItemForBim(
          'slab',
          { id: entity.id, kind: entity.kind, geometry: slabBoqGeometry(entity, scene) },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SLAB_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId, levelManager]);

  // Auto-save debounce σε selected slab params change.
  useEffect(() => {
    const slab = primarySelectedSlab;
    if (!slab || !serviceRef.current) return;
    // ADR-390 — Bug A defense-in-depth: don't auto-persist entities που είναι
    // στο scene αλλά ΟΥΤΕ έχουν σωθεί ποτέ ΟΥΤΕ είναι pending first save.
    // Καλύπτει: (a) entities loaded από DXF JSON only (Bug B race), (b) stale
    // primarySelected ref μετά από delete (Bug A zombie write).
    const known = lastSavedParamsRef.current.has(slab.id);
    const pending = pendingFirstSaveIdsRef.current.has(slab.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(slab.id);
    // ADR-412 — a detach keeps params identical, so OR-in the type-link diff.
    const linkChanged = slabTypeLinkChanged(lastSavedTypeLinkRef.current.get(slab.id), slab);
    if (lastSaved && dequal(lastSaved, slab.params) && !linkChanged) return;

    dirtyIdsRef.current.add(slab.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(slab);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedSlab, persist]);

  const saveNow = useCallback(async () => {
    const slab = selectedSlabRef.current;
    if (!slab) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(slab);
  }, [persist]);

  // Phase 3 — Delete slab: remove από Firestore + scene + audit.
  const deleteSlab = useCallback(async (slabId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === slabId);

    const deletedSlab = (deletedEntity && isSlab(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteSlab(slabId);
      void recordSlabChange(
        'deleted',
        deletedSlab
          ? { id: deletedSlab.id, kind: deletedSlab.kind, layerId: deletedSlab.layerId, params: deletedSlab.params }
          : { id: slabId, kind: 'floor' },
      );
      void bimToBoqBridge.deleteBoqItemForBim(slabId, companyId ?? '');
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== slabId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(slabId);
    lastSavedParamsRef.current.delete(slabId);
    lastSavedTypeLinkRef.current.delete(slabId);
    pendingFirstSaveIdsRef.current.delete(slabId);
    // ADR-390 — tombstone tracking για subscribe loop race protection.
    deletedIdsRef.current.add(slabId);
  }, [levelManager, companyId]);

  // ADR-390 — persistRestore writes Firestore με `action='restored'` (όχι
  // misleading `'created'`). Pre-ADR-390 zombie write went through `persist()`
  // και επέφερε `'created'` audit row για entity που είχε προηγουμένως διαγραφεί.
  const persistRestore = useCallback(async (entity: SlabEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveSlab(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      lastSavedTypeLinkRef.current.set(entity.id, {
        typeId: entity.typeId,
        typeOverrides: entity.typeOverrides,
      });
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordSlabChange('restored', entity);
      if (companyId && projectId && buildingId) {
        const levelId = levelManager.currentLevelId;
        const scene = levelId ? levelManager.getLevelScene(levelId) : null;
        void bimToBoqBridge.upsertBoqItemForBim(
          'slab',
          { id: entity.id, kind: entity.kind, geometry: slabBoqGeometry(entity, scene) },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          'created',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SLAB_RESTORE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId, levelManager]);

  // First-save listener — fires άμεσα για freshly drawn slabs.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'slab') return;
      const entity = payload.entity as SlabEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'slab') return;
      if (!serviceRef.current) return;
      // ADR-390 — mark pending BEFORE persist so subscribe loop doesn't drop
      // entity during the race window.
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (bridge emits μετά από confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:slab-delete-requested', ({ slabId }) => {
      void deleteSlab(slabId);
    });
    return cleanup;
  }, [deleteSlab]);

  // Phase 5.5i+ — Re-BOQ all slabs when a beam changes (move/resize/delete).
  // Reads scene beams from memory — no extra Firestore query.
  useEffect(() => {
    if (!companyId || !projectId || !buildingId) return;
    const ctx = { companyId, projectId, buildingId, floorId: floorId ?? undefined };
    const cleanup = EventBus.on('bim:beam-persisted', () => {
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!scene) return;
      for (const entity of scene.entities) {
        if ((entity as { type?: string }).type !== 'slab') continue;
        const slab = entity as SlabEntity;
        void bimToBoqBridge.upsertBoqItemForBim(
          'slab',
          { id: slab.id, kind: slab.kind, geometry: slabBoqGeometry(slab, scene) },
          ctx,
          'updated',
        );
      }
    });
    return cleanup;
  }, [levelManager, companyId, projectId, buildingId, floorId]);

  // ADR-395 G2 — re-feed host slab BOQ net volume when one of its cutouts is
  // added / edited / deleted (cutout area changes the slab's net m³). Mirror
  // wall's `bim:opening-persisted` listener. Reads scene from memory — no query.
  useEffect(() => {
    if (!companyId || !projectId || !buildingId) return;
    const ctx = { companyId, projectId, buildingId, floorId: floorId ?? undefined };
    const cleanup = EventBus.on('bim:slab-opening-persisted', ({ slabId }) => {
      // Skip slabs whose own first save hasn't landed — their persist feeds net
      // itself (collects cutouts too), and a premature row would race it.
      if (!lastSavedParamsRef.current.has(slabId)) return;
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!scene) return;
      const host = scene.entities.find((e) => e.id === slabId);
      if (!host || !isSlab(host)) return;
      void bimToBoqBridge.upsertBoqItemForBim(
        'slab',
        { id: host.id, kind: host.kind, geometry: slabBoqGeometry(host, scene) },
        ctx,
        'updated',
      );
    });
    return cleanup;
  }, [levelManager, companyId, projectId, buildingId, floorId]);

  // ADR-412 «type always wins» — re-flow type edits / late type loads onto the
  // active scene's typed slabs (activates per-layer rendering). Mirrors wall.
  useSlabTypeReresolution(levelManager, dirtyIdsRef);

  useBimEntityMovedPersistEffect(isSlab, serviceRef, dirtyIdsRef, persist);
  // ADR-390 — symmetric undo→Firestore restore.
  useBimEntityRestoredPersistEffect(
    'slab',
    isSlab,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteSlab }),
    [saveState, lastSavedAt, error, saveNow, deleteSlab],
  );
}
