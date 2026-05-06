'use client';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { DxfFirestoreService } from '../../../services/dxf-firestore.service';
import { useAutoSaveSceneManager } from '../../../hooks/scene/useAutoSaveSceneManager';
import type { Level } from '../config';

// 🔺 FIXED: Helper για ΠΡΑΓΜΑΤΙΚΑ κενή σκηνή χωρίς default layer
const createEmptyScene = () => ({
  entities: [],
  layers: {}, // ← Εντελώς άδειο! Δεν δημιουργούμε layer "0" μέχρι να φορτωθεί DXF
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

    // Check if scene is already in memory (fast path — instant render)
    const existingScene = sceneManager.getLevelScene(currentLevelId);
    if (existingScene && existingScene.entities.length > 0) return;

    // Find the level to check for sceneFileId
    const level = levels.find(l => l.id === currentLevelId);
    const sceneFileId = level?.sceneFileId;

    if (!sceneFileId) {
      // No DXF linked to this level yet — create empty scene
      if (!existingScene) {
        sceneManager.setLevelScene(currentLevelId, createEmptyScene());
      }
      return;
    }

    // Prevent duplicate loads for the same level
    if (loadedSceneLevelsRef.current.has(currentLevelId)) {
      if (!existingScene) {
        sceneManager.setLevelScene(currentLevelId, createEmptyScene());
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

        if (fileRecord?.scene && Array.isArray(fileRecord.scene.entities) && fileRecord.scene.layers != null) {
          sceneManager.setLevelScene(currentLevelId, fileRecord.scene);
          // Set the filename for auto-save context
          if (fileRecord.fileName && sceneManager.setCurrentFileName) {
            sceneManager.setCurrentFileName(fileRecord.fileName);
          }
          loadedSceneLevelsRef.current.add(currentLevelId);
        } else {
          // File exists in Firestore but scene couldn't be loaded (corrupted/deleted)
          console.warn(`[LevelsSystem] Scene not found for fileId: ${sceneFileId}`);
          sceneManager.setLevelScene(currentLevelId, createEmptyScene());
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('[LevelsSystem] Failed to load scene:', err);
          sceneManager.setLevelScene(currentLevelId, createEmptyScene());
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

  return { sceneLoading, linkSceneToLevel };
}
