/**
 * useSceneState
 * Manages scene and level state, including DXF import
 */

'use client';

import { useEffect, useCallback } from 'react';
import type { SceneModel, AnySceneEntity } from '../../types/scene';
import { EventBus } from '../../systems/events';
import { useLevels, useCurrentLevelScene } from '../../systems/levels';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';
// ✅ ΦΑΣΗ 7: useDxfImport μεταφέρθηκε στο hooks/ folder
import { useDxfImport } from '../useDxfImport';
// ADR-526 — Tekton .tek import (καθρέφτης του DXF import path)
import { importTekFile, isTekFileName } from '../../io/tek/tek-import';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
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
        setLevelScene(targetLevelId, result.scene);
        // BIM entities → PersistenceHost first-save (Firestore). 2Δ primitives (line/arc/
        // circle/text/dimension) ΔΕΝ έχουν host → ΟΧΙ emit· σώζονται με το scene blob (linkSceneToLevel).
        // ADR-531 Φ5b.2 — ΚΡΙΣΙΜΟ: χωρίς first-save, το Firestore reconciliation snapshot αφαιρεί τα
        // wall/opening από το scene (ο τοίχος «εμφανίζεται & εξαφανίζεται»). tool = entity.type
        // (default createTrigger, ADR-594). Τοίχος ΠΡΙΝ το κούφωμα (host-first, opening.wallId ref).
        for (const entity of result.scene.entities) {
          if (entity.type === 'stair') {
            EventBus.emit('drawing:entity-created', { entity, tool: 'stair' });
          } else if (entity.type === 'wall') {
            EventBus.emit('drawing:entity-created', { entity, tool: 'wall' });
          } else if (entity.type === 'opening') {
            EventBus.emit('drawing:entity-created', { entity, tool: 'opening' });
          } else if (entity.type === 'slab') {
            EventBus.emit('drawing:entity-created', { entity, tool: 'slab' });
          } else if (entity.type === 'column') {
            // ADR-531 Φ5b.5 — κολώνα/τοιχίο: first-save (tool 'column') αλλιώς το Firestore
            // reconciliation snapshot την αφαιρεί (ίδιο bug με τον τοίχο).
            EventBus.emit('drawing:entity-created', { entity, tool: 'column' });
          } else if (entity.type === 'hatch') {
            // ADR-531 Φ5b.6 — γραμμοσκίαση: first-save μέσω του extraCreateTrigger του hatch
            // persistence (drawing:entity-created), ΟΧΙ drawing:complete (αποφυγή auto-guide prompt).
            EventBus.emit('drawing:entity-created', { entity, tool: 'hatch' });
          }
        }
        // 🛡️ ADR-526 Φ5a — persist the level↔FileRecord link now (shared helper, N.18).
        linkSceneFileToLevel();
        setTimeout(() => EventBus.emit('canvas-fit-to-view', { source: 'auto' }), PANEL_LAYOUT.TIMING.FIT_TO_VIEW_DELAY);
        return;
      }

      const scene = await importDxfFile(file);
      if (scene) {

        setLevelScene(targetLevelId, scene);
        // 🛡️ ROOT-CAUSE FIX (incident 2026-06-08 — "hard refresh → χάνεται το σχέδιο"):
        // Link the level to the canonical wizard FileRecord id DETERMINISTICALLY, NOW —
        // instead of relying on the 2s debounced auto-save round-trip. The auto-save
        // re-resolves the id (injectedRef ?? cache ?? findExistingFileRecord ?? generateFileId)
        // and, because useLevelSceneLoader.resetDxfAutoSaveTarget() clears the injected id for
        // a still-file-less level, it could mint a PHANTOM id that has no `files` doc → on
        // reload loadFromStorageImpl(getById('FILES', id)) returns null → empty canvas.
        // linkSceneToLevel is idempotent (skips if already linked to this id), so the later
        // onSceneSaved callback is a harmless no-op. Skipped when no canonical id (non-wizard
        // drag-drop import has no FileRecord). Raster (non-dxf) never reaches here.
        linkSceneFileToLevel();
        // Scene rendering is handled by Canvas V2 system
        setTimeout(() => EventBus.emit('canvas-fit-to-view', { source: 'auto' }), PANEL_LAYOUT.TIMING.FIT_TO_VIEW_DELAY);
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