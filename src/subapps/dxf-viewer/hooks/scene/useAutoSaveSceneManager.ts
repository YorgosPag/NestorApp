import { useState, useCallback, useRef, useEffect } from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { STORAGE_TIMING } from '../../config/timing-config';
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
  /** 🏢 ENTERPRISE: Inject existing FileRecord ID so cadFiles uses the same ID */
  setFileRecordId: (id: string | null) => void;
}

export function useAutoSaveSceneManager(): AutoSaveSceneManagerState {
  const sceneManager = useSceneManager();
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  // Debounce auto-save to prevent excessive Firestore writes
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Flag to prevent auto-save when loading from Firestore
  const isLoadingFromFirestoreRef = useRef<boolean>(false);
  // Flag to prevent multiple simultaneous loads
  const loadedFilesRef = useRef<Set<string>>(new Set());
  // Cache fileName → enterpriseId mapping to avoid generating new IDs on every save
  const fileIdCacheRef = useRef<Map<string, string>>(new Map());
  // 🏢 ENTERPRISE: Injected FileRecord ID (from wizard/upload) — ensures cadFiles uses the same ID
  const injectedFileRecordIdRef = useRef<string | null>(null);
  
  /**
   * 🏢 ENTERPRISE: Inject FileRecord ID from external source (wizard upload)
   * When set, auto-save writes to cadFiles using THIS ID instead of generating a new one.
   * This ensures cadFiles and files collections share the same document ID.
   */
  const setFileRecordId = useCallback((id: string | null) => {
    injectedFileRecordIdRef.current = id;
    // Also cache it for the current filename so subsequent saves reuse it
    if (id && currentFileName) {
      fileIdCacheRef.current.set(currentFileName, id);
    }
  }, [currentFileName]);

  /**
   * Enhanced setLevelScene with auto-save
   */
  const setLevelSceneWithAutoSave = useCallback((levelId: string, scene: SceneModel) => {
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
          // 🏢 ENTERPRISE: Resolve file ID with priority:
          // 1. Injected FileRecord ID (from wizard/upload via setFileRecordId)
          // 2. Cached ID (from previous save in this session)
          // 3. Existing FileRecord in `files` collection (wizard uploaded this file before)
          // 4. New enterprise ID (first standalone save — no wizard involved)
          let fileId = injectedFileRecordIdRef.current
            ?? fileIdCacheRef.current.get(currentFileName);
          if (!fileId) {
            // Check if wizard already created a FileRecord for this filename
            const existingId = await DxfFirestoreService.findExistingFileRecordId(currentFileName);
            fileId = existingId ?? DxfFirestoreService.generateFileId(currentFileName);
            fileIdCacheRef.current.set(currentFileName, fileId);
          }
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
      }, STORAGE_TIMING.SCENE_AUTOSAVE_DEBOUNCE); // 🏢 ADR-098
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
    saveStatus,
    setFileRecordId,
  };
}