'use client';

/**
 * ADR-406 — MEP fixture Firestore persistence React adapter.
 *
 * Bridges `MepFixtureFirestoreService` to the scene model owned by
 * `LevelsSystem`. Mirrors `useColumnPersistence` — same hybrid auto-save,
 * selective-skip diff-merge, and first-save listener wired to
 * `drawing:entity-created` with `tool === 'mep-fixture'`. No BOQ feed (a point
 * fixture carries no quantity volume in this slice).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import { EventBus } from '../../systems/events/EventBus';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createMepFixtureFirestoreService,
  entityToSaveInput,
  MepFixtureFirestoreService,
  type MepFixtureDoc,
} from '../../bim/mep-fixtures/mep-fixture-firestore-service';
import { recordMepFixtureChange } from '../../bim/mep-fixtures/mep-fixture-audit-client';
import { mepFixtureDocToEntity as docToEntity } from './mep-fixture-persistence-helpers';
import { projectMepConnectorsOntoFresh } from './mep-connector-projection-merge';
import { mergeDocsIntoScene } from './merge-docs-into-scene';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type MepFixtureSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseMepFixturePersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedFixture: MepFixtureEntity | null;
}

export interface UseMepFixturePersistenceResult {
  readonly saveState: MepFixtureSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteFixture: (fixtureId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isFixture(entity: AnySceneEntity): entity is MepFixtureEntity {
  return (entity as { type?: string }).type === 'mep-fixture';
}

// ============================================================================
// HOOK
// ============================================================================

export function useMepFixturePersistence(
  params: UseMepFixturePersistenceParams,
): UseMepFixturePersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    floorId,
    userId,
    levelManager,
    primarySelectedFixture,
  } = params;

  const [saveState, setSaveState] = useState<MepFixtureSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<MepFixtureFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, MepFixtureEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedFixtureRef = useRef<MepFixtureEntity | null>(null);
  selectedFixtureRef.current = primarySelectedFixture;

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
    serviceRef.current = createMepFixtureFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty fixtures.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeFixtures(
      // Diff-merge μέσω του `mergeDocsIntoScene` SSoT — comparable = `params`. Το MEP
      // project-άρει το live (reconciler-owned) systemId πάνω στο fresh doc-entity
      // (ADR-408 anti-ping-pong) μέσω του `projectMepConnectorsOntoFresh` adapter +
      // `differs` που συγκρίνει το projected candidate. Δεν έχει write-grace.
      (docs) => {
        mergeDocsIntoScene<MepFixtureDoc, MepFixtureEntity, MepFixtureEntity['params']>(
          docs,
          levelId,
          levelManagerRef.current,
          {
            isEntity: isFixture,
            docToEntity: (doc, existing) => projectMepConnectorsOntoFresh(docToEntity(doc), existing),
            entityComparable: (e) => e.params,
            docComparable: (d) => d.params,
            differs: (existing, _doc, getCandidate) => {
              const candidate = getCandidate();
              return candidate !== null && !dequal(existing.params, candidate.params);
            },
          },
          {
            dirty: dirtyIdsRef.current,
            deleted: deletedIdsRef.current,
            pending: pendingFirstSaveIdsRef.current,
            isWithinGrace: () => false,
            lastSavedBaseline: lastSavedParamsRef.current,
          },
        );
      },
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [currentLevelId, companyId, projectId, floorplanId, floorId, userId]);

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: MepFixtureEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      // setDoc only on first write (stamps immutable createdAt); existing
      // fixtures go through updateDoc so re-edits persist (mirror column ADR-397).
      if (isNew) {
        await svc.saveFixture(entityToSaveInput(entity));
      } else {
        await svc.updateFixture(entity.id, {
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
      void recordMepFixtureChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_FIXTURE_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Auto-save debounce on selected fixture params change.
  useEffect(() => {
    const fixture = primarySelectedFixture;
    if (!fixture || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(fixture.id);
    const pending = pendingFirstSaveIdsRef.current.has(fixture.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(fixture.id);
    if (lastSaved && dequal(lastSaved, fixture.params)) return;

    dirtyIdsRef.current.add(fixture.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(fixture);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedFixture, persist]);

  const saveNow = useCallback(async () => {
    const fixture = selectedFixtureRef.current;
    if (!fixture) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(fixture);
  }, [persist]);

  // Delete fixture: remove from Firestore + scene + audit.
  const deleteFixture = useCallback(async (fixtureId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === fixtureId);
    const deletedFixture = (deletedEntity && isFixture(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteFixture(fixtureId);
      void recordMepFixtureChange(
        'deleted',
        deletedFixture
          ? { id: deletedFixture.id, kind: deletedFixture.kind, layerId: deletedFixture.layerId, params: deletedFixture.params }
          : { id: fixtureId, kind: 'light-fixture' },
      );
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== fixtureId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(fixtureId);
    lastSavedParamsRef.current.delete(fixtureId);
    pendingFirstSaveIdsRef.current.delete(fixtureId);
    deletedIdsRef.current.add(fixtureId);
  }, [levelManager]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: MepFixtureEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveFixture(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordMepFixtureChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_FIXTURE_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn fixtures.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'mep-fixture') return;
      const entity = payload.entity as MepFixtureEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'mep-fixture') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (bridge emits after confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:mep-fixture-delete-requested', ({ fixtureId }) => {
      void deleteFixture(fixtureId);
    });
    return cleanup;
  }, [deleteFixture]);

  useBimEntityMovedPersistEffect(isFixture, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'mep-fixture',
    isFixture,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteFixture }),
    [saveState, lastSavedAt, error, saveNow, deleteFixture],
  );
}
