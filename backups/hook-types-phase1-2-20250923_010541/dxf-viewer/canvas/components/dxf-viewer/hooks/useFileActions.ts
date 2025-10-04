'use client';

// ✅ Debug flag for file actions logging
const DEBUG_CANVAS_CORE = false;

import { useCallback } from 'react';
import { useDxfImport } from '../../../../useDxfImport';
import type { SceneModel } from '../../../../types/scene';
import type { DxfCanvasRef } from '../../../../DxfCanvas';

interface FileActionsOptions {
  currentLevelId: string | null;
  dxfCanvasRef: React.RefObject<DxfCanvasRef>;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
  updateUndoRedoState: () => void;
}

export function useFileActions({
  currentLevelId,
  dxfCanvasRef,
  setLevelScene,
  updateUndoRedoState
}: FileActionsOptions) {
  
  const { importDxfFile } = useDxfImport();

  // ============================================================================
  // DXF IMPORT HANDLER
  // ============================================================================
  const handleSceneImported = useCallback(async (file: File, encoding?: string) => {
    if (DEBUG_CANVAS_CORE) console.log('📦 DXF selected:', file.name, 'with encoding:', encoding || 'default');
    if (!currentLevelId) {
      alert('Δεν έχει επιλεγεί επίπεδο (Level) για εισαγωγή.');
      return;
    }
    try {
      const scene = await importDxfFile(file);
      if (!scene) {
        alert('Αποτυχία εισαγωγής DXF. Έλεγξε το αρχείο.');
        return;
      }
      // Σώζουμε στο state του επιπέδου
      setLevelScene(currentLevelId, scene);
      // Ζωγραφίζουμε και κάνουμε fit
      if (dxfCanvasRef.current) {
        dxfCanvasRef.current.renderScene(scene);
        requestAnimationFrame(() => dxfCanvasRef.current?.fitToView());
      }
      if (DEBUG_CANVAS_CORE) console.log('🎯 Scene entities loaded for snapping:', scene.entities?.length ?? 0);
    } catch (e) {
      console.error('⛔ DXF import failed:', e);
      alert('Αποτυχία εισαγωγής DXF.');
    }
  }, [currentLevelId, importDxfFile, setLevelScene, dxfCanvasRef]);

  // ============================================================================
  // SCENE CHANGE HANDLER
  // ============================================================================
  const handleSceneChange = useCallback((scene: SceneModel) => {
    if (!currentLevelId) return;
    
    try {
      setLevelScene(currentLevelId, scene);
      updateUndoRedoState();
    } catch (error) {
      console.error('⛔ Error updating scene:', error);
    }
  }, [currentLevelId, setLevelScene, updateUndoRedoState]);

  return {
    // Actions
    handleSceneImported,
    handleSceneChange,
  };
}