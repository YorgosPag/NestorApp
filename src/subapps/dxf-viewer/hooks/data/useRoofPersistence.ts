'use client';

/**
 * ADR-417 — Roof Firestore persistence React adapter.
 *
 * Bridges `RoofFirestoreService` στο scene model που κατέχει το `LevelsSystem`.
 * Mirrors `useRailingPersistence` (ADR-407) — ίδιο hybrid auto-save,
 * selective-skip diff-merge, και first-save listener wired σε
 * `drawing:entity-created` με `tool === 'roof'`. Η geometry re-derived από
 * params on hydrate (FOOTPRINT ⊥ TYPE → derived geometry, never persisted as truth).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { RoofEntity } from '../../bim/types/roof-types';
import { EventBus } from '../../systems/events/EventBus';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
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
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type RoofSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseRoofPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-417 — tenant scope για το ΑΤΟΕ BOQ auto-feed (grossArea m²). */
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
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
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HOOK
// ============================================================================

export function useRoofPersistence(
  params: UseRoofPersistenceParams,
): UseRoofPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId,
    levelManager,
    primarySelectedRoof,
  } = params;

  const [saveState, setSaveState] = useState<RoofSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<RoofFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, RoofEntity['params']>>(new Map());
  // ADR-417 §10 #3 — last-saved family-type link per roof, so a detach (params
  // kept, `typeId` cleared) still triggers an auto-save.
  const lastSavedTypeLinkRef = useRef<Map<string, RoofTypeLink>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRoofRef = useRef<RoofEntity | null>(null);
  selectedRoofRef.current = primarySelectedRoof;

  // ⚡ STABILITY (ca9 fix 2026-06-08): key the Firestore subscription off stable
  // scope primitives + `currentLevelId`, NOT the per-render `levelManager` object,
  // so onSnapshot does not unsubscribe/re-subscribe on every render (target removed
  // before ack → `INTERNAL ASSERTION FAILED ca9 {ve:-1}`). Mirror of the fitting hook.
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const currentLevelId = levelManager.currentLevelId;

  // Instantiate service when auth + scope ready.
  useEffect(() => {
    const scope = resolveBimPersistenceScope({ companyId, projectId, userId, floorId, floorplanId });
    if (!scope) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createRoofFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty roofs.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeRoofs(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, RoofDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneRoofs = new Map<string, RoofEntity>();
        const nonRoofs: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isRoof(e)) sceneRoofs.set(e.id, e);
          else nonRoofs.push(e);
        }

        const nextRoofs: RoofEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneRoofs.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextRoofs.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextRoofs.push(existing);
            continue;
          }
          // ADR-412 — diff against EFFECTIVE (type-resolved) params so a typed
          // roof does not re-map on every snapshot.
          if (roofEntityDiffersFromDoc(existing, doc)) {
            nextRoofs.push(docToEntity(doc));
            mutated = true;
          } else {
            nextRoofs.push(existing);
          }
        }

        // Seed last-saved baseline για κάθε Firestore doc (mirror ADR-397).
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
          if (!lastSavedTypeLinkRef.current.has(doc.id)) {
            lastSavedTypeLinkRef.current.set(doc.id, {
              typeId: doc.typeId,
              typeOverrides: doc.typeOverrides,
            });
          }
        }

        for (const [id, entity] of sceneRoofs) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextRoofs.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...nonRoofs, ...nextRoofs],
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

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: RoofEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveRoof(entityToSaveInput(entity));
      } else {
        await svc.updateRoof(entity.id, {
          params: entity.params,
          validation: entity.validation,
          geometry: entity.geometry,
          layerId: entity.layerId,
          // ADR-417 §10 #3 — persist the family-type link; `null` detaches
          // (deleteField) so the link is removed rather than left stale.
          typeId: entity.typeId ?? null,
          typeOverrides: entity.typeOverrides ?? null,
        });
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
      lastSavedTypeLinkRef.current.set(entity.id, {
        typeId: entity.typeId,
        typeOverrides: entity.typeOverrides,
      });
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordRoofChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      // ADR-417 — ΑΤΟΕ BOQ auto-feed: roof = grossArea (m²) κεκλιμένης επιφάνειας.
      if (companyId && projectId && buildingId) {
        const boqGeom = entity.geometry
          ? { area: entity.geometry.grossAreaM2 }
          : undefined;
        void bimToBoqBridge.upsertBoqItemForBim(
          'roof',
          { id: entity.id, kind: entity.kind, geometry: boqGeom },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ROOF_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId]);

  // Auto-save debounce on selected roof params change.
  useEffect(() => {
    const roof = primarySelectedRoof;
    if (!roof || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(roof.id);
    const pending = pendingFirstSaveIdsRef.current.has(roof.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(roof.id);
    // ADR-412 — a detach keeps params identical, so OR-in the type-link diff.
    const linkChanged = roofTypeLinkChanged(lastSavedTypeLinkRef.current.get(roof.id), roof);
    if (lastSaved && dequal(lastSaved, roof.params) && !linkChanged) return;

    dirtyIdsRef.current.add(roof.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(roof);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedRoof, persist]);

  const saveNow = useCallback(async () => {
    const roof = selectedRoofRef.current;
    if (!roof) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(roof);
  }, [persist]);

  // Delete roof: remove from Firestore + scene + audit.
  const deleteRoof = useCallback(async (roofId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === roofId);
    const deletedRoof = (deletedEntity && isRoof(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteRoof(roofId);
      void recordRoofChange(
        'deleted',
        deletedRoof
          ? { id: deletedRoof.id, kind: deletedRoof.kind, layerId: deletedRoof.layerId, params: deletedRoof.params }
          : { id: roofId, kind: 'roof' },
      );
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== roofId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(roofId);
    lastSavedParamsRef.current.delete(roofId);
    lastSavedTypeLinkRef.current.delete(roofId);
    pendingFirstSaveIdsRef.current.delete(roofId);
    deletedIdsRef.current.add(roofId);
  }, [levelManager]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: RoofEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveRoof(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      lastSavedTypeLinkRef.current.set(entity.id, {
        typeId: entity.typeId,
        typeOverrides: entity.typeOverrides,
      });
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordRoofChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ROOF_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately για φρέσκα roofs από το tool.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'roof') return;
      const entity = payload.entity as RoofEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'roof') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (bridge emits after confirm). ADR-417 Φ1-part-2 —
  // 'bim:roof-delete-requested' wired in drawing-event-map.ts.
  useEffect(() => {
    const cleanup = EventBus.on('bim:roof-delete-requested', ({ roofId }) => {
      void deleteRoof(roofId);
    });
    return cleanup;
  }, [deleteRoof]);

  useBimEntityMovedPersistEffect(isRoof, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'roof',
    isRoof,
    serviceRef,
    pendingFirstSaveIdsRef,
    deletedIdsRef,
    persistRestore,
  );

  // ADR-417 §10 #3 — re-flow type edits / late type loads onto placed roofs.
  useRoofTypeReresolution(levelManager, dirtyIdsRef);

  // Unmount cleanup — flush pending timers.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteRoof }),
    [saveState, lastSavedAt, error, saveNow, deleteRoof],
  );
}
