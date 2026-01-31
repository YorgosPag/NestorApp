import { useState, useCallback, useRef, useEffect } from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useSceneManager, type SceneManagerState } from './useSceneManager';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import type { SceneModel } from '../../types/scene';

export interface AutoSaveSceneManagerState extends SceneManagerState {
  currentFileName: string | null;
  setCurrentFileName: (fileName: string | null) => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  lastSaveTime: Date | null;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
}

export function useAutoSaveSceneManager(): AutoSaveSceneManagerState {
  const sceneManager = useSceneManager();
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  // Debounce auto-save to prevent excessive Firestore writes
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const AUTO_SAVE_DELAY = 2000; // 2 seconds after last change
  
  // Flag to prevent auto-save when loading from Firestore
  const isLoadingFromFirestoreRef = useRef<boolean>(false);
  // Flag to prevent multiple simultaneous loads
  const loadedFilesRef = useRef<Set<string>>(new Set());
  
  /**
   * Enhanced setLevelScene with auto-save
   */
  const setLevelSceneWithAutoSave = useCallback((levelId: string, scene: SceneModel) => {
    // 🔍 DEBUG (2026-01-31): Log auto-save setLevelScene call
    console.log('💾 [useAutoSaveSceneManager] setLevelSceneWithAutoSave called', {
      levelId,
      entityCount: scene?.entities?.length || 0
    });

    // Call the original setLevelScene
    sceneManager.setLevelScene(levelId, scene);
    
    // Trigger auto-save if enabled and we have a filename and not loading from Firestore
    if (autoSaveEnabled && currentFileName && !isLoadingFromFirestoreRef.current) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Set new debounced save
      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus('saving');

        try {
          const fileId = DxfFirestoreService.generateFileId(currentFileName);
          // 🚀 PHASE 4: Use Storage-based auto-save for better performance
          const success = await DxfFirestoreService.autoSaveV2(fileId, currentFileName, scene);
          
          if (success) {
            setSaveStatus('success');
            setLastSaveTime(new Date());

          } else {
            setSaveStatus('error');
            console.error(`❌ [AutoSave] Failed to save changes to ${currentFileName}`);
          }
        } catch (error) {
          setSaveStatus('error');
          console.error(`❌ [AutoSave] Exception during save:`, error);
        }
        
        // Reset status after delay
        setTimeout(() => setSaveStatus('idle'), PANEL_LAYOUT.TIMING.SAVE_STATUS_RESET);
      }, AUTO_SAVE_DELAY);
    }
  }, [sceneManager, autoSaveEnabled, currentFileName]);
  
  /**
   * Load scene from Firestore on file change
   * TEMPORARILY DISABLED TO STOP INFINITE LOOP
   */
  useEffect(() => {
    if (!currentFileName || !autoSaveEnabled) return;

    // TODO: Re-enable auto-loading after fixing the infinite loop
    // const loadFromFirestore = async () => { ... };
    // loadFromFirestore();
  }, [currentFileName, autoSaveEnabled]);
  
  /**
   * Clear loaded files cache when currentFileName changes
   */
  useEffect(() => {
    // Clear cache when filename changes to allow reloading
    return () => {
      loadedFilesRef.current.clear();
    };
  }, [currentFileName]);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    ...sceneManager,
    setLevelScene: setLevelSceneWithAutoSave,
    currentFileName,
    setCurrentFileName,
    autoSaveEnabled,
    setAutoSaveEnabled,
    lastSaveTime,
    saveStatus
  };
}