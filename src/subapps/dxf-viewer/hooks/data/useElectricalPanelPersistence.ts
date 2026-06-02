'use client';

/**
 * ADR-408 Φ3 — Electrical panel Firestore persistence React adapter.
 *
 * Bridges `ElectricalPanelFirestoreService` to the scene model owned by
 * `LevelsSystem`. Mirrors `useMepFixturePersistence` — same hybrid auto-save,
 * selective-skip diff-merge, and first-save listener wired to
 * `drawing:entity-created` with `tool === 'electrical-panel'`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import {
  computeElectricalPanelGeometry,
  validateElectricalPanelParams,
} from '../../bim/electrical-panels/electrical-panel-geometry';
import { EventBus } from '../../systems/events/EventBus';
import {
  createElectricalPanelFirestoreService,
  entityToSaveInput,
  ElectricalPanelFirestoreService,
  type ElectricalPanelDoc,
} from '../../bim/electrical-panels/electrical-panel-firestore-service';
import { recordElectricalPanelChange } from '../../bim/electrical-panels/electrical-panel-audit-client';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type ElectricalPanelSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseElectricalPanelPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedPanel: ElectricalPanelEntity | null;
}

export interface UseElectricalPanelPersistenceResult {
  readonly saveState: ElectricalPanelSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deletePanel: (panelId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isPanel(entity: AnySceneEntity): entity is ElectricalPanelEntity {
  return (entity as { type?: string }).type === 'electrical-panel';
}

/** Build scene-side `ElectricalPanelEntity` from a persisted `ElectricalPanelDoc`. */
function docToEntity(doc: ElectricalPanelDoc): ElectricalPanelEntity {
  const validation = doc.validation ?? validateElectricalPanelParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'electrical-panel',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeElectricalPanelGeometry(doc.params),
    validation,
    visible: true,
  } as ElectricalPanelEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useElectricalPanelPersistence(
  params: UseElectricalPanelPersistenceParams,
): UseElectricalPanelPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    userId,
    levelManager,
    primarySelectedPanel,
  } = params;

  const [saveState, setSaveState] = useState<ElectricalPanelSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<ElectricalPanelFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, ElectricalPanelEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedPanelRef = useRef<ElectricalPanelEntity | null>(null);
  selectedPanelRef.current = primarySelectedPanel;

  // Instantiate service when auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createElectricalPanelFirestoreService({
      companyId,
      projectId,
      floorplanId,
      userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty panels.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribePanels(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, ElectricalPanelDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const scenePanels = new Map<string, ElectricalPanelEntity>();
        const nonPanels: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isPanel(e)) scenePanels.set(e.id, e);
          else nonPanels.push(e);
        }

        const nextPanels: ElectricalPanelEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = scenePanels.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextPanels.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextPanels.push(existing);
            continue;
          }
          if (!dequal(existing.params, doc.params)) {
            nextPanels.push(docToEntity(doc));
            mutated = true;
          } else {
            nextPanels.push(existing);
          }
        }

        // Seed last-saved baseline for every Firestore doc.
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        for (const [id, entity] of scenePanels) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextPanels.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, {
            ...scene,
            entities: [...nonPanels, ...nextPanels],
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
  const persist = useCallback(async (entity: ElectricalPanelEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.savePanel(entityToSaveInput(entity));
      } else {
        await svc.updatePanel(entity.id, {
          params: entity.params,
          validation: entity.validation,
          geometry: entity.geometry,
          layerId: entity.layerId,
        });
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordElectricalPanelChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ELECTRICAL_PANEL_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Auto-save debounce on selected panel params change.
  useEffect(() => {
    const panel = primarySelectedPanel;
    if (!panel || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(panel.id);
    const pending = pendingFirstSaveIdsRef.current.has(panel.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(panel.id);
    if (lastSaved && dequal(lastSaved, panel.params)) return;

    dirtyIdsRef.current.add(panel.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(panel);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedPanel, persist]);

  const saveNow = useCallback(async () => {
    const panel = selectedPanelRef.current;
    if (!panel) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(panel);
  }, [persist]);

  // Delete panel: remove from Firestore + scene + audit.
  const deletePanel = useCallback(async (panelId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === panelId);
    const deletedPanel = (deletedEntity && isPanel(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deletePanel(panelId);
      void recordElectricalPanelChange(
        'deleted',
        deletedPanel
          ? { id: deletedPanel.id, kind: deletedPanel.kind, layerId: deletedPanel.layerId, params: deletedPanel.params }
          : { id: panelId, kind: 'distribution-board' },
      );
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== panelId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(panelId);
    lastSavedParamsRef.current.delete(panelId);
    pendingFirstSaveIdsRef.current.delete(panelId);
    deletedIdsRef.current.add(panelId);
  }, [levelManager]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: ElectricalPanelEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.savePanel(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordElectricalPanelChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ELECTRICAL_PANEL_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn panels.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'electrical-panel') return;
      const entity = payload.entity as ElectricalPanelEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'electrical-panel') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (smart-delete emits after batch filter).
  useEffect(() => {
    const cleanup = EventBus.on('bim:electrical-panel-delete-requested', ({ panelId }) => {
      void deletePanel(panelId);
    });
    return cleanup;
  }, [deletePanel]);

  useBimEntityMovedPersistEffect(isPanel, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'electrical-panel',
    isPanel,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deletePanel }),
    [saveState, lastSavedAt, error, saveNow, deletePanel],
  );
}
