'use client';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { DxfFirestoreService } from '../../../services/dxf-firestore.service';
import { useAutoSaveSceneManager } from '../../../hooks/scene/useAutoSaveSceneManager';
import { onSuperAdminActiveCompanyChange } from '@/services/firestore/super-admin-active-company';
import { isCrossFloorSceneLink } from '../cross-floor-link';
import {
  reconcileLoadedSceneBim,
  reconcileLoadedSceneBimPreserving,
  ensureUniqueEntityIds,
} from '../scene-bim-load-policy';
import {
  detectMissingPerEntityDocIds,
  emitBackfillFirstSaves,
} from '../backfill-missing-per-entity-docs';
import type { Level } from '../config';

// 🔺 FIXED: Helper για ΠΡΑΓΜΑΤΙΚΑ κενή σκηνή χωρίς default layer
const createEmptyScene = () => ({
  entities: [],
  layersById: {},
  bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
  units: 'mm' as const,
});

type SceneManager = ReturnType<typeof useAutoSaveSceneManager>;

interface UseLevelSceneLoaderParams {
  currentLevelId: string | null;
  levels: Level[];
  sceneManager: SceneManager;
  enableFirestore: boolean;
  firestoreCollection: string;
}

interface UseLevelSceneLoaderResult {
  sceneLoading: boolean;
  linkSceneToLevel: (levelId: string, fileId: string, fileName: string) => Promise<void>;
}

/**
 * 🏢 ENTERPRISE: Scene auto-load + persistence for level switches (CAD-industry standard)
 *
 * Responsibilities:
 *  - On currentLevelId change: load the persisted DXF scene from Firestore/Storage
 *    (or create an empty scene if the level has no DXF yet).
 *  - Race-condition safe: cancels pending loads when the user switches levels rapidly
 *    (AbortController pattern).
 *  - Persist level→DXF association in Firestore when auto-save completes (linkSceneToLevel).
 *  - Wires the `onSceneSaved` callback from the scene manager so that newly saved
 *    scenes are auto-linked to their parent level.
 *
 * This replaces the old "create empty scene" approach with persistent scene loading.
 */
export function useLevelSceneLoader({
  currentLevelId,
  levels,
  sceneManager,
  enableFirestore,
  firestoreCollection,
}: UseLevelSceneLoaderParams): UseLevelSceneLoaderResult {
  const [sceneLoading, setSceneLoading] = useState(false);

  // 🏢 ENTERPRISE: AbortController ref for cancelling pending scene loads on rapid level switch
  const sceneLoadAbortRef = React.useRef<AbortController | null>(null);
  // Track which levels have had their scenes loaded to prevent duplicate loads
  const loadedSceneLevelsRef = React.useRef<Set<string>>(new Set());

  // 🏢 ENTERPRISE: Auto-load DXF scene from Storage when level changes (CAD-industry standard)
  // This replaces the old "create empty scene" approach with persistent scene loading
  useEffect(() => {
    if (!currentLevelId) return;

    // Find the level to check for sceneFileId
    const level = levels.find(l => l.id === currentLevelId);
    const sceneFileId = level?.sceneFileId;

    // ADR-399 — reset the DXF auto-save target so edits on THIS level can never
    // persist into a PREVIOUSLY-loaded level's file. Root cause of cross-floor
    // contamination: the auto-save `fileRecordId` / `currentFileName` were sticky
    // across level switches, so drawing on a file-less (or wrongly-linked) floor
    // saved into — and re-linked — the previous floor's DXF file, making every
    // floor render the same scene. Nulling `currentFileName` also disables the
    // auto-save gate (it requires a filename), so a file-less level never writes a
    // DXF scene. BIM entities keep persisting through their own floorId-keyed
    // persistence, unaffected.
    const resetDxfAutoSaveTarget = () => {
      sceneManager.setFileRecordId?.(null);
      sceneManager.setSaveContext?.(null);
      sceneManager.setCurrentFileName?.(null);
    };

    // 🛡️ FIX (Α) — anti-vanish BIM load (incident 2026-06-17 «η κολώνα εμφανίζεται
    // και εξαφανίζεται»). Every load-time "empty scene" write MUST go through the
    // BIM-preservation SSoT (`reconcileLoadedSceneBim`), never a bare
    // `createEmptyScene()`. Otherwise a late, async "scene not found" / orphaned-file
    // result clobbers BIM that a per-entity subscription (`useXPersistence`, keyed by
    // floorId) already merged into the in-memory scene — the columns flash, then the
    // empty write wipes them. The reconcile keeps the loaded scene's DXF-only entities
    // (here: none) + the existing in-memory BIM. No-op when nothing is in memory yet.
    const setEmptyScenePreservingBim = () => {
      sceneManager.setLevelScene(
        currentLevelId,
        reconcileLoadedSceneBim(createEmptyScene(), sceneManager.getLevelScene(currentLevelId)),
        'load',
      );
    };

    // 🛡️ ROOT-CAUSE FIX (incident 2026-06-08 — repeated cross-floor data loss):
    // Re-point the auto-save target at the CURRENT level's file on EVERY level change,
    // BEFORE the fast-path / already-loaded early-returns below. Previously the target
    // (`fileRecordId` / `currentFileName`) was set ONLY inside the fresh-load path, so
    // switching to an already-in-memory level left the target STUCK on the PREVIOUS
    // level's file → subsequent edits auto-saved into the wrong floor's DXF, and that
    // floor's level got re-linked to it (two levels ending up sharing one sceneFileId —
    // observed on this project: revision climbing while the scene blob went empty).
    // The fast path fires only for same-floor levels that loaded with entities;
    // cross-floor / empty levels fall through to the full load path where
    // `isCrossFloorSceneLink` still guards. File-less levels clear the target so they
    // never write a DXF scene (BIM persists independently via floorId).
    // 🛡️ ADR-469 v1.2 — orphaned-target latch (SSoT in useAutoSaveSceneManager).
    // Once a previous load discovered this `sceneFileId` is orphaned (its files/cadFiles
    // doc is gone), it is latched. EVERY subsequent re-run of this effect (fires on each
    // `levels` onSnapshot) must then treat the level as file-less: it must NOT re-open the
    // DXF auto-save target — otherwise a local edit would schedule a save that throws
    // ADR-293 (`canonicalScenePath is required`). The throw's root cause was exactly this:
    // the sync set below re-pointed the target after the async reset had cleared it.
    const isOrphaned = !!sceneFileId && (sceneManager.isFileTargetOrphaned?.(sceneFileId) ?? false);

    if (sceneFileId && !isOrphaned) {
      sceneManager.setFileRecordId?.(sceneFileId);
      sceneManager.setCurrentFileName?.(level?.sceneFileName ?? null);
    } else {
      resetDxfAutoSaveTarget();
    }

    // Check if scene is already in memory (fast path — instant render). The auto-save
    // target was already re-pointed above, so this early return no longer leaks the
    // previous level's save target.
    const existingScene = sceneManager.getLevelScene(currentLevelId);
    if (existingScene && existingScene.entities.length > 0) return;

    if (!sceneFileId || isOrphaned) {
      // No DXF linked (or a known-orphaned/file-less floor) — create empty scene (target
      // already reset above). Short-circuiting on `isOrphaned` avoids a wasteful repeat
      // loadFileV2 fetch on every `levels` snapshot for a floor we already know has no
      // backing file. BIM persists independently via floorId-keyed per-entity collections.
      if (!existingScene) {
        setEmptyScenePreservingBim();
      }
      return;
    }

    // Prevent duplicate loads for the same level
    if (loadedSceneLevelsRef.current.has(currentLevelId)) {
      if (!existingScene) {
        setEmptyScenePreservingBim();
      }
      return;
    }

    // Cancel any pending load from previous level switch
    sceneLoadAbortRef.current?.abort();
    const abortController = new AbortController();
    sceneLoadAbortRef.current = abortController;

    const loadScene = async () => {
      setSceneLoading(true);
      // Set loading guard to prevent auto-save from firing during scene load
      sceneManager.setIsLoadingFromFirestore(true);

      try {
        const fileRecord = await DxfFirestoreService.loadFileV2(sceneFileId);

        // Check if this load was cancelled (user switched to another level)
        if (abortController.signal.aborted) return;

        // 🚨 ADR-399 — cross-floor link guard. A level must only load a scene file
        // that belongs to its OWN floor. A stale / cross-linked `sceneFileId` (left
        // by the sticky auto-save target bug above, or a mis-link) would otherwise
        // load another floor's DXF into this level — making every floor render the
        // same scene — and a subsequent auto-save would overwrite that other floor's
        // file. Detect the mismatch, keep this level empty, and reset the save
        // target. See `isCrossFloorSceneLink` for the conservative predicate.
        if (isCrossFloorSceneLink(fileRecord, level?.floorId)) {
          console.warn(
            `[LevelsSystem] sceneFileId ${sceneFileId} belongs to floor ${fileRecord?.entityId} ` +
            `but level ${currentLevelId} is floor ${level?.floorId} — skipping cross-floor load.`,
          );
          resetDxfAutoSaveTarget();
          setEmptyScenePreservingBim();
          return;
        }

        if (fileRecord?.scene && Array.isArray(fileRecord.scene.entities) && fileRecord.scene.layersById != null) {
          // 🏢 ADR-390 Phase 4 — active-floor SSoT load. The `.scene.json` snapshot is
          // a DERIVED cache (scene-write-origin.ts); its embedded BIM entities can be
          // STALE vs the authoritative per-entity Firestore docs (e.g. a column saved
          // `attached` in the snapshot while its `floorplan_columns` doc is reverted to
          // `storey-ceiling` → snapshot rendered a sloped top). Drop the snapshot BIM;
          // the per-entity subscriptions (useXPersistence) repopulate it from the DB
          // (SSoT). Preserve any BIM already merged in-memory (a subscription that
          // raced ahead of the load) so it is never clobbered/lost. The snapshot is
          // unchanged on save → multi-floor 3D (ADR-399) keeps reading other floors'
          // BIM from their snapshots.
          // 🛡️ ADR-635 Φ C.18 — server-wizard import (Door B) never first-saves its
          // per-entity entities (hatches), so on reload reconcile would drop them with
          // no doc to repopulate (117 hatches vanished, incident 2026-07-20). Detect the
          // no-doc ids up-front (read-only batch existence check), KEEP those visible via
          // the preserving reconcile, and emit their first-save below. Entities that DO
          // have docs stay out of `missing` → dropped as usual → refilled from the SSoT.
          const missingDocIds = await detectMissingPerEntityDocIds(fileRecord.scene);
          if (abortController.signal.aborted) return;
          // ADR-578 — heal legacy duplicate entity ids (Revit «Audit»-on-open)
          // before applying. Same-reference no-op for clean scenes.
          const reconciled = ensureUniqueEntityIds(
            reconcileLoadedSceneBimPreserving(
              fileRecord.scene,
              sceneManager.getLevelScene(currentLevelId),
              missingDocIds,
            ),
          );
          sceneManager.setLevelScene(currentLevelId, reconciled, 'load');
          // 🛡️ ADR-635 Φ C.18 — first-save the no-doc entities with an EXPLICIT target
          // scope (Φ C.16), so the write lands on THIS floor independently of the
          // persistence host's render timing. `isCrossFloorSceneLink` (above) already
          // guaranteed `fileRecord` belongs to `level.floorId`, so the scope is trusted.
          emitBackfillFirstSaves(fileRecord.scene, missingDocIds, {
            levelId: currentLevelId,
            floorId: level?.floorId ?? (fileRecord.entityType === 'floor' ? fileRecord.entityId : null),
            floorplanId: sceneFileId,
          });
          // Set the filename for auto-save context
          if (fileRecord.fileName && sceneManager.setCurrentFileName) {
            sceneManager.setCurrentFileName(fileRecord.fileName);
          }
          // 🏢 ADR-293: Inject FileRecord ID + canonicalScenePath so auto-save
          // writes to the SAME storage path as the loaded scene (no lookup,
          // no race, no "canonicalScenePath is required" throw on line completion).
          sceneManager.setFileRecordId?.(sceneFileId);
          // ADR-358 Phase 9 — restore the FULL save context (not just the
          // canonical scene path) so the floor link bridge surfaces the
          // floor metadata on session resume + the stair builder seeds
          // `multiStoryConfig` from the bound floor. Without this the
          // resume path overwrote the Wizard-injected context with a
          // path-only object and `saveContext.floorId` flipped to
          // `undefined` immediately after the import.
          if (fileRecord.storagePath || fileRecord.entityType) {
            sceneManager.setSaveContext?.({
              ...(fileRecord.storagePath
                ? { canonicalScenePath: DxfFirestoreService.deriveScenePath(fileRecord.storagePath) }
                : {}),
              ...(fileRecord.companyId ? { companyId: fileRecord.companyId } : {}),
              ...(fileRecord.projectId ? { projectId: fileRecord.projectId } : {}),
              ...(fileRecord.entityType
                ? { entityType: fileRecord.entityType as 'project' | 'building' | 'floor' | 'property' }
                : {}),
              ...(fileRecord.entityType === 'floor' && fileRecord.entityId
                ? { floorId: fileRecord.entityId }
                : {}),
              ...(fileRecord.entityType === 'building' && fileRecord.entityId
                ? { buildingId: fileRecord.entityId }
                : {}),
            });
          }
          loadedSceneLevelsRef.current.add(currentLevelId);
        } else {
          // File record/scene missing (orphaned sceneFileId, corrupted, or deleted).
          // 🛡️ FIX (Β v1.2 — ADR-469) — graceful suppress (incident 2026-06-17 ADR-293
          // error spam): the level points at a `sceneFileId` whose `files`/`cadFiles` doc
          // no longer exists, so `getFileStoragePath` returns null and every local edit
          // threw "canonicalScenePath is required (ADR-293)". v1.1 only reset the target
          // here, but each `levels` snapshot re-ran this effect and re-opened it (sync set
          // above) before the async reset — leaving a window where an edit still threw.
          // v1.2: LATCH the orphaned fileId in the auto-save SSoT so the sync set above
          // never re-opens it and the gate hard-suppresses any save. Then reset + preserve
          // in-memory BIM. BIM persists independently via floorId-keyed per-entity colls.
          console.warn(`[LevelsSystem] Scene not found for fileId: ${sceneFileId} — latching orphaned target + suppressing DXF auto-save (missing file).`);
          sceneManager.markFileTargetOrphaned?.(sceneFileId);
          resetDxfAutoSaveTarget();
          setEmptyScenePreservingBim();
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('[LevelsSystem] Failed to load scene:', err);
          resetDxfAutoSaveTarget();
          setEmptyScenePreservingBim();
        }
      } finally {
        if (!abortController.signal.aborted) {
          // Release loading guard after next frame to prevent auto-save race condition
          requestAnimationFrame(() => {
            sceneManager.setIsLoadingFromFirestore(false);
          });
          setSceneLoading(false);
        }
      }
    };

    loadScene();

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevelId, levels]); // levels dependency needed to detect sceneFileId changes from onSnapshot

  // 🏢 ENTERPRISE: Persist level→DXF association via API route (Admin SDK).
  // Firestore rules do NOT allow client-side updates on dxf_viewer_levels.
  // Uses /api/dxf-levels PATCH — same route as updateLevelContext.
  const linkSceneToLevel = useCallback(
    async (levelId: string, fileId: string, fileName: string): Promise<void> => {
      if (!enableFirestore) return;

      // Idempotent guard — skip if already linked
      const level = levels.find(l => l.id === levelId);
      if (level?.sceneFileId === fileId) return;

      try {
        const res = await fetch('/api/dxf-levels', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ levelId, sceneFileId: fileId, sceneFileName: fileName }),
        });
        if (!res.ok) {
          console.error('[LevelsSystem] Failed to link scene to level:', res.status, res.statusText);
        }
      } catch (err) {
        console.error('[LevelsSystem] Failed to link scene to level:', err);
      }
    },
    [enableFirestore, levels]
  );

  // 🏢 ENTERPRISE: Wire onSceneSaved callback — auto-save notifies us when scene is persisted
  // Dependency: setOnSceneSaved (stable ref from useCallback) — NOT the full sceneManager object
  // which changes identity every render due to object spread in useAutoSaveSceneManager
  const { setOnSceneSaved } = sceneManager;
  useEffect(() => {
    setOnSceneSaved((fileId: string, fileName: string) => {
      if (currentLevelId) {
        linkSceneToLevel(currentLevelId, fileId, fileName);
      }
    });
    return () => {
      setOnSceneSaved(null);
    };
  }, [currentLevelId, linkSceneToLevel, setOnSceneSaved]);

  // 🏢 ADR-354 Entry Point #4: super admin company switcher → DXF scene cache invalidation.
  // Cached scenes + dedupe set belong to the previous tenant and must be evicted before
  // useLevelsFirestoreSync delivers the new tenant's levels. Aborts pending load first
  // so an in-flight fetch can't repopulate the just-cleared cache.
  //
  // 🚨 DATA SAFETY (ADR-354 Phase B Part 1 hotfix): a plain clearAllScenes is NOT enough.
  // When the new tenant's level bootstrap fires setLevelScene with an empty scene, the
  // auto-save machinery still holds the previous tenant's fileRecordId + canonicalScenePath
  // + currentFileName and would persist the empty scene to that path — destroying the
  // previous tenant's DXF. resetSceneSession atomically: engages the load guard, cancels
  // the pending debounced save, clears scenes + fileRecordId + saveContext + filename +
  // per-file caches, and releases the guard on the next animation frame.
  // Depend on the stable `resetSceneSession` ref (useCallback [] in
  // useAutoSaveSceneManager) — NOT the full `sceneManager` object, which changes
  // identity on every edit and would needlessly re-subscribe this listener each
  // time (same rationale as the setOnSceneSaved wiring above).
  const { resetSceneSession } = sceneManager;
  useEffect(() => {
    const unsub = onSuperAdminActiveCompanyChange(() => {
      sceneLoadAbortRef.current?.abort();
      loadedSceneLevelsRef.current.clear();
      resetSceneSession();
    });
    return unsub;
  }, [resetSceneSession]);

  return { sceneLoading, linkSceneToLevel };
}
