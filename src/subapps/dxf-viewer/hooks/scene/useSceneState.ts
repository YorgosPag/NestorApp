/**
 * useSceneState
 * Manages scene and level state, including DXF import
 */

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useCanvasOperations } from '../interfaces/useCanvasOperations';
import type { SceneModel, AnySceneEntity } from '../../types/scene';
import { UI_COLORS } from '../../config/color-config';
import { useLevels } from '../../systems/levels';
// ✅ ΦΑΣΗ 7: useDxfImport μεταφέρθηκε στο hooks/ folder
import { useDxfImport } from '../useDxfImport';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

export function useSceneState() {
  const canvasOps = useCanvasOperations();
  const notifications = useNotifications();
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);

  // Levels and scene management
  const levelsSystem = useLevels();
  const { currentLevelId, getLevelScene, setLevelScene, addLevel, levels, setCurrentLevel } = levelsSystem;
  const { importDxfFile, error: importError } = useDxfImport();

  // Derived current scene
  const currentScene = useMemo(() => {
    if (!currentLevelId) return null;
    return getLevelScene(currentLevelId);
  }, [currentLevelId, getLevelScene]);

  // Create empty scene if needed - WITHOUT default layer "0"
  useEffect(() => {
    if (!currentLevelId) return;
    const scene = getLevelScene(currentLevelId);
    if (!scene) {
      // 🔺 FIXED: Don't create default layer "0" until DXF is loaded
      const emptyScene = {
        entities: [],
        layers: {}, // ← Empty layers object - no default "0" layer!
        bounds: {
          min: { x: 0, y: 0 },
          max: { x: 0, y: 0 }
        },
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

  // Scene change handler
  const handleSceneChange = useCallback((scene: SceneModel) => {
    if (currentLevelId) {
      setLevelScene(currentLevelId, scene);
    }
  }, [currentLevelId, setLevelScene]);

  // File import handler
  const handleFileImport = useCallback(async (file: File) => {
    let targetLevelId = currentLevelId;
    
    // If no level is selected, use the first available level or create one
    if (!targetLevelId) {
      console.warn('No level selected for import. Checking available levels...');
      
      // First check if we have any levels available
      const availableLevels = levels;
      if (availableLevels && availableLevels.length > 0) {
        targetLevelId = availableLevels[0].id;

        // Auto-select this level
        setCurrentLevel?.(targetLevelId);
      } else {
        console.warn('No levels available. Creating default level...');
        try {
          // Try to create a default level if none exists
          const levelId = await addLevel?.('Ισόγειο', true);
          if (levelId) {
            targetLevelId = levelId;

          } else {
            // If we can't create a level, use fallback
            targetLevelId = 'default';
            console.warn('⚠️ Using fallback level ID: default');
          }
        } catch (error) {
          console.error('❌ Failed to create default level:', error);
          targetLevelId = 'default';
          console.warn('⚠️ Using fallback level ID: default');
        }
      }
    }

    try {
      // Set current filename for auto-save (levelsSystem has access to the auto-save scene manager)
      if (levelsSystem.setCurrentFileName) {

        levelsSystem.setCurrentFileName(file.name);
      }
      
      const scene = await importDxfFile(file);
      if (scene) {

        setLevelScene(targetLevelId, scene);
        // Scene rendering is handled by Canvas V2 system
        setTimeout(() => canvasOps.fitToView(), PANEL_LAYOUT.TIMING.FIT_TO_VIEW_DELAY);
      } else {
        console.error('❌ DXF import returned null scene');
        const errorMessage = importError ? `DXF Import Error: ${importError}` : 'Failed to import DXF file. Please check the file format and try again.';
        notifications.error(errorMessage, {
          duration: 6000,
          actions: [{
            label: 'Αντιγραφή',
            onClick: () => {
              navigator.clipboard.writeText(errorMessage);
              notifications.success('Αντιγράφηκε στο πρόχειρο!', { duration: 2000 });
            }
          }]
        });
      }
    } catch (error) {
      console.error('⛔ Error importing DXF file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const fullMessage = `Error importing DXF file: ${errorMessage}`;
      notifications.error(fullMessage, {
        duration: 6000,
        actions: [{
          label: 'Αντιγραφή',
          onClick: () => {
            navigator.clipboard.writeText(fullMessage);
            notifications.success('Αντιγράφηκε στο πρόχειρο!', { duration: 2000 });
          }
        }]
      });
    }
  }, [currentLevelId, importDxfFile, setLevelScene, addLevel, levels, setCurrentLevel, levelsSystem]);

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