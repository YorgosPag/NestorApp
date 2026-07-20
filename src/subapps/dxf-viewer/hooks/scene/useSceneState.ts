/**
 * useSceneState
 * Manages scene and level state, including DXF import
 */

'use client';

import { useEffect, useCallback } from 'react';
import type { SceneModel, AnySceneEntity } from '../../types/scene';
import { useLevels, useCurrentLevelScene } from '../../systems/levels';
// ADR-635 Φ C.17 — η ΜΙΑ πόρτα εισαγωγής σκηνής σε όροφο (reconcile layer ids → write →
// per-entity first-saves → block capture → file link → auto-fit). Κοινή για .tek ΚΑΙ DXF.
import { commitImportedScene } from '../../systems/levels/commit-imported-scene';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';
// ✅ ΦΑΣΗ 7: useDxfImport μεταφέρθηκε στο hooks/ folder
import { useDxfImport } from '../useDxfImport';
// ADR-526 — Tekton .tek import (καθρέφτης του DXF import path)
import { importTekFile, isTekFileName } from '../../io/tek/tek-import';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// ✅ ENTERPRISE: Centralized copy-to-clipboard hook
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
// 🔒 TENANT SCOPING + replace cleanup (ADR-399)
import { useAuth } from '@/auth/hooks/useAuth';
import { FileRecordService } from '@/services/file-record.service';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { EMPTY_BOUNDS } from '../../config/geometry-constants';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT + DXF default-layer constant
import { getLayer } from '../../stores/LayerStore';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { dlog, dwarn, derr } from '../../debug';

const DEBUG_SCENE_STATE = false;

export function useSceneState() {
  const notifications = useNotifications();
  const { t } = useTranslation('dxf-viewer');
  // ✅ ENTERPRISE: 2 separate copy instances for error notification actions
  const { copy: copyErrorMessage } = useCopyToClipboard();
  const { copy: copyImportError } = useCopyToClipboard();
  const { user } = useAuth();
  // Levels and scene management
  const levelsSystem = useLevels();
  const { currentLevelId, getLevelScene, setLevelScene, addLevel, levels, setCurrentLevel } = levelsSystem;
  const { importDxfFile, error: importError } = useDxfImport();

  // Derived current scene — ADR-557 SSoT (was an inline `getLevelScene(currentLevelId)`; the
  // 2026-01-31 "remove useMemo, direct call" fix now lives in `useCurrentLevelScene`, so every
  // render-time consumer shares ONE live-scene derivation instead of hand-copying it).
  const currentScene = useCurrentLevelScene();

  // 🔍 DEBUG (2026-01-31): Log currentScene for circle debugging — guarded (fires on every render)
  if (DEBUG_SCENE_STATE) dlog('SceneState', '📊 [useSceneState] currentScene computed', {
    currentLevelId,
    hasScene: !!currentScene,
    entityCount: currentScene?.entities?.length || 0
  });

  // Create empty scene if needed - WITHOUT default layer "0"
  useEffect(() => {
    if (!currentLevelId) return;
    const scene = getLevelScene(currentLevelId);
    if (!scene) {
      // 🔺 FIXED: Don't create default layer "0" until DXF is loaded
      // 🏢 ADR-118: Use centralized EMPTY_BOUNDS for empty scene
      const emptyScene = {
        entities: [],
        layersById: {},
        bounds: { ...EMPTY_BOUNDS },
        units: 'mm' as const
      };

      setLevelScene(currentLevelId, emptyScene);
    }
  }, [currentLevelId, getLevelScene, setLevelScene]);

  // Entity creation handler
  const onEntityCreated = useCallback((entity: AnySceneEntity) => {
    if (currentLevelId && currentScene) {
      // ADR-358 Phase 9D-5a — id-only WRITE: ensure entity carries a stable `layerId`.
      // Legacy `entity.layer` name assignment dropped; downstream readers resolve display
      // name via `resolveEntityLayerName(entity)` (LayerStore id-first lookup).
      if (!entity.layerId) {
        const defaultLayer = getLayer(DXF_DEFAULT_LAYER);
        if (defaultLayer) {
          entity.layerId = defaultLayer.id;
        }
      }

      const newScene = { ...currentScene, entities: [...currentScene.entities, entity] };
      setLevelScene(currentLevelId, newScene);
    }
  }, [currentLevelId, currentScene, setLevelScene]);

  const handleSceneChange = useCallback((scene: SceneModel) => {
    if (currentLevelId) {
      setLevelScene(currentLevelId, scene);
    }
  }, [currentLevelId, setLevelScene]);

  // File import handler
  const handleFileImport = useCallback(async (file: File, fileRecordId?: string, saveContext?: DxfSaveContext, targetLevelIdOverride?: string) => {
    // ADR-420 — when the wizard resolves the level owning the selected floor it
    // passes it explicitly; honour that over the (possibly stale) active level so
    // the imported scene is written to the correct floor, never another one.
    let targetLevelId = targetLevelIdOverride ?? currentLevelId;
    
    // If no level is selected, use the first available level or create one
    if (!targetLevelId) {
      dwarn('SceneState', 'No level selected for import. Checking available levels...');
      
      // First check if we have any levels available
      const availableLevels = levels;
      if (availableLevels && availableLevels.length > 0) {
        targetLevelId = availableLevels[0].id;

        // Auto-select this level
        setCurrentLevel?.(targetLevelId);
      } else {
        dwarn('SceneState', 'No levels available. Creating default level...');
        try {
          // Try to create a default level if none exists
          const levelId = await addLevel?.('Ισόγειο', true);
          if (levelId) {
            targetLevelId = levelId;

          } else {
            // If we can't create a level, use fallback
            targetLevelId = 'default';
            dwarn('SceneState', '⚠️ Using fallback level ID: default');
          }
        } catch (error) {
          derr('SceneState', '❌ Failed to create default level:', error);
          targetLevelId = 'default';
          dwarn('SceneState', '⚠️ Using fallback level ID: default');
        }
      }
    }

    try {
      // Set current filename for auto-save (levelsSystem has access to the auto-save scene manager)
      if (levelsSystem.setCurrentFileName) {
        levelsSystem.setCurrentFileName(file.name);
      }
      // 🏢 ENTERPRISE: Inject FileRecord ID so cadFiles uses the same ID as files collection.
      // Prefer explicitly-passed fileRecordId; fall back to saveContext.fileRecordId (from wizard).
      const resolvedFileRecordId = fileRecordId ?? saveContext?.fileRecordId;
      if (resolvedFileRecordId && levelsSystem.setFileRecordId) {
        levelsSystem.setFileRecordId(resolvedFileRecordId);
      }
      // 🛡️ ADR-526 Φ5a / ADR-399 — link the level to its canonical FileRecord NOW
      // (deterministic, not the 2s debounced round-trip) so the scene blob survives a
      // hard-refresh, and trash the level's PREVIOUS scene file on replace (FILE-LESS
      // levels never run the wizard floor-wipe → otherwise each replace orphans the old
      // FileRecord + Storage blob; moveToTrash is soft/recoverable, cron purge frees Storage).
      // Idempotent; skips when there is no canonical id. Shared by BOTH the Tekton and DXF
      // import branches (N.18 — one copy instead of two twins).
      const linkSceneFileToLevel = (): void => {
        if (!(resolvedFileRecordId && levelsSystem.linkSceneToLevel)) return;
        const prevFileId = levels.find((l) => l.id === targetLevelId)?.sceneFileId;
        if (prevFileId && prevFileId !== resolvedFileRecordId && user?.uid) {
          void FileRecordService.moveToTrash(prevFileId, user.uid).catch(() => {
            /* non-blocking: already deleted by floor-wipe, or permission no-op */
          });
        }
        void levelsSystem.linkSceneToLevel(targetLevelId, resolvedFileRecordId, file.name);
      };
      // 🏢 ADR-240: Inject save context from Wizard (entityType/floorId/purpose)
      if (levelsSystem.setSaveContext) {
        levelsSystem.setSaveContext(saveContext ?? null);
      }

      // 🛡️ ADR-635 Φ C.16 — ο ΣΤΟΧΟΣ αυτής της εισαγωγής, δηλωμένος ΡΗΤΑ, ώστε τα
      // per-entity first-saves να γράψουν στον σωστό όροφο ανεξάρτητα από το τι είναι
      // «ενεργό» όταν τρέξουν οι listeners. Υπολογίζεται ΕΔΩ, ΠΡΙΝ από κάθε `await`:
      // μετά το await, ο ενεργός όροφος μπορεί να έχει προσπεράσει (React re-render +
      // effect), ενώ ο στόχος μας δεν αλλάζει. Ένας υπολογισμός για ΚΑΙ τα δύο branches
      // (.tek + DXF) — N.18, όχι δίδυμα.
      //
      // Προτεραιότητα `saveContext` πρώτα (αντίθετα από το `DxfViewerTopBar`, που τιμά
      // το durable `Level.floorId`): εδώ το `saveContext` είναι ΟΡΙΣΜΑ αυτής της κλήσης —
      // η δήλωση του wizard για ΑΥΤΗ την εισαγωγή, άρα το φρεσκότερο. Το `levels` closure
      // μπορεί να ΜΗΝ περιέχει ακόμα ένα level που μόλις έφτιαξε το
      // `findOrCreateLevelForFloor` (level-panel-hooks) — γι' αυτό είναι fallback.
      const targetLevel = levels.find((l) => l.id === targetLevelId);
      const importTargetScope = {
        levelId: targetLevelId,
        floorId: saveContext?.floorId ?? targetLevel?.floorId ?? null,
        floorplanId: resolvedFileRecordId ?? targetLevel?.sceneFileId ?? null,
      };

      // 🛡️ ADR-635 Φ C.17 — Η ΜΙΑ πόρτα εισαγωγής (setLevelScene → emit → capture → link →
      // fit), ΜΑΖΙ με το layer-identity reconcile που εμποδίζει τα per-entity persisted
      // entities να ορφανιάσουν σε κάθε re-import (117 γραμμοσκιάσεις, 2026-07-20).
      // Η σειρά των βημάτων είναι συμβόλαιο — ζει στο module, κλειδωμένη με test.
      const commitImported = (imported: SceneModel): void => commitImportedScene(imported, {
        targetLevelId,
        scope: importTargetScope,
        getLevelScene,
        setLevelScene,
        linkSceneFileToLevel,
      });


      // ADR-526 — Tekton .tek → ίδιο pipeline (level-resolution έγινε ήδη παραπάνω).
      // Φορτώνει τη σκηνή· οι σκάλες (BIM) κάνουν first-save μέσω StairPersistenceHost,
      // ενώ τα 2Δ primitives (Φ5a: line/arc/circle) ζουν ΜΟΝΟ στο scene blob (DXF-style).
      if (isTekFileName(file.name)) {
        const result = await importTekFile(file, targetLevelId);
        if (!result.success || !result.scene) {
          notifications.error(result.error ?? t('callbacks.tekImportFailed'), { duration: 6000 });
          return;
        }
        if (result.warnings.length > 0) {
          notifications.warning(result.warnings.join('\n'), { duration: 5000 });
        }
        commitImported(result.scene);
        return;
      }

      const scene = await importDxfFile(file);
      if (scene) {
        commitImported(scene);
      } else {
        derr('SceneState', '❌ DXF import returned null scene');
        const errorMessage = importError ? `DXF Import Error: ${importError}` : 'Failed to import DXF file. Please check the file format and try again.';
        notifications.error(errorMessage, {
          duration: 6000,
          actions: [{
            label: t('callbacks.copy'),
            onClick: async () => {
              const success = await copyErrorMessage(errorMessage);
              if (success) notifications.success(t('callbacks.copiedToClipboard'), { duration: 2000 });
            }
          }]
        });
      }
    } catch (error) {
      derr('SceneState', '⛔ Error importing DXF file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const fullMessage = `Error importing DXF file: ${errorMessage}`;
      notifications.error(fullMessage, {
        duration: 6000,
        actions: [{
          label: t('callbacks.copy'),
          onClick: async () => {
            const success = await copyImportError(fullMessage);
            if (success) notifications.success(t('callbacks.copiedToClipboard'), { duration: 2000 });
          }
        }]
      });
    }
  }, [currentLevelId, importDxfFile, setLevelScene, addLevel, levels, setCurrentLevel, levelsSystem, user, copyErrorMessage, copyImportError, notifications, importError, t]);

  return {
    currentScene,
    currentLevelId,
    onEntityCreated,
    handleSceneChange,
    handleFileImport
  };
}