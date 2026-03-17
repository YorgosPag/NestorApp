/**
 * useSceneState
 * Manages scene and level state, including DXF import
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCanvasOperations } from '../interfaces/useCanvasOperations';
import type { SceneModel, AnySceneEntity } from '../../types/scene';
import { useLevels } from '../../systems/levels';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';
// ✅ ΦΑΣΗ 7: useDxfImport μεταφέρθηκε στο hooks/ folder
import { useDxfImport } from '../useDxfImport';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// ✅ ENTERPRISE: Centralized copy-to-clipboard hook
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { EMPTY_BOUNDS } from '../../config/geometry-constants';
import { dlog, dwarn, derr } from '../../debug';

export function useSceneState() {
  const canvasOps = useCanvasOperations();
  const notifications = useNotifications();
  // ✅ ENTERPRISE: 2 separate copy instances for error notification actions
  const { copy: copyErrorMessage } = useCopyToClipboard();
  const { copy: copyImportError } = useCopyToClipboard();
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);

  // Levels and scene management
  const levelsSystem = useLevels();
  const { currentLevelId, getLevelScene, setLevelScene, addLevel, levels, setCurrentLevel } = levelsSystem;
  const { importDxfFile, error: importError } = useDxfImport();

  // Derived current scene
  // 🔧 FIX (2026-01-31): Remove useMemo - getLevelScene reference changes cause issues
  // Direct call ensures fresh scene on every render
  const currentScene = currentLevelId ? getLevelScene(currentLevelId) : null;

  // 🔍 DEBUG (2026-01-31): Log currentScene for circle debugging
  dlog('SceneState', '📊 [useSceneState] currentScene computed', {
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
        layers: {}, // ← Empty layers object - no default "0" layer!
        bounds: { ...EMPTY_BOUNDS },
        units: 'mm' as const
      };

      setLevelScene(currentLevelId, emptyScene);
    }
  }, [currentLevelId, getLevelScene, setLevelScene]);

  // Entity creation handler
  const onEntityCreated = useCallback((entity: AnySceneEntity) => {
    if (currentLevelId && currentScene) {
      // Ensure entity has a default layer if not specified
      if (!entity.layer) {
        entity.layer = '0';
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
  const handleFileImport = useCallback(async (file: File, fileRecordId?: string, saveContext?: DxfSaveContext) => {
    let targetLevelId = currentLevelId;
    
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
      // 🏢 ENTERPRISE: Inject FileRecord ID so cadFiles uses the same ID as files collection
      if (fileRecordId && levelsSystem.setFileRecordId) {
        levelsSystem.setFileRecordId(fileRecordId);
      }
      // 🏢 ADR-240: Inject save context from Wizard (entityType/floorId/purpose)
      if (levelsSystem.setSaveContext) {
        levelsSystem.setSaveContext(saveContext ?? null);
      }
      
      const scene = await importDxfFile(file);
      if (scene) {

        setLevelScene(targetLevelId, scene);
        // Scene rendering is handled by Canvas V2 system
        setTimeout(() => canvasOps.fitToView(), PANEL_LAYOUT.TIMING.FIT_TO_VIEW_DELAY);
      } else {
        derr('SceneState', '❌ DXF import returned null scene');
        const errorMessage = importError ? `DXF Import Error: ${importError}` : 'Failed to import DXF file. Please check the file format and try again.';
        notifications.error(errorMessage, {
          duration: 6000,
          actions: [{
            label: 'Αντιγραφή',
            onClick: async () => {
              const success = await copyErrorMessage(errorMessage);
              if (success) notifications.success('Αντιγράφηκε στο πρόχειρο!', { duration: 2000 });
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
          label: 'Αντιγραφή',
          onClick: async () => {
            const success = await copyImportError(fullMessage);
            if (success) notifications.success('Αντιγράφηκε στο πρόχειρο!', { duration: 2000 });
          }
        }]
      });
    }
  }, [currentLevelId, importDxfFile, setLevelScene, addLevel, levels, setCurrentLevel, levelsSystem, copyErrorMessage, copyImportError, notifications, importError, canvasOps]);

  return {
    // State
    currentScene,
    selectedEntityIds,
    currentLevelId,
    
    // Actions
    setSelectedEntityIds,
    onEntityCreated,
    handleSceneChange,
    handleFileImport
  };
}