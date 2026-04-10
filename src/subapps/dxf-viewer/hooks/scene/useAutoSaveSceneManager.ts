import { useState, useCallback, useRef, useEffect } from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { STORAGE_TIMING } from '../../config/timing-config';
import { useSceneManager, type SceneManagerState } from './useSceneManager';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';
import type { SceneModel } from '../../types/scene';
import { useAuth } from '@/auth/hooks/useAuth';

export interface AutoSaveSceneManagerState extends SceneManagerState {
  currentFileName: string | null;
  setCurrentFileName: (fileName: string | null) => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  lastSaveTime: Date | null;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  /** 🏢 ENTERPRISE: Inject existing FileRecord ID so cadFiles uses the same ID */
  setFileRecordId: (id: string | null) => void;
  /** 🏢 ADR-240: Inject save context (entityType/floorId/purpose) from Wizard import */
  setSaveContext: (ctx: DxfSaveContext | null) => void;
  /** 🏢 ENTERPRISE: Callback after successful scene save — used by LevelsSystem to link scene→level */
  setOnSceneSaved: (cb: ((fileId: string, fileName: string) => void) | null) => void;
  /** 🏢 ENTERPRISE: Set loading guard to prevent auto-save during scene load from Storage */
  setIsLoadingFromFirestore: (loading: boolean) => void;
}

export function useAutoSaveSceneManager(): AutoSaveSceneManagerState {
  const sceneManager = useSceneManager();
  // 🔒 TENANT SCOPING (Sentry NESTOR-APP-3): inject authenticated user so
  // auto-save writes companyId + createdBy into cadFiles metadata, enabling
  // cross-user reads under tenant-scoped Firestore rules.
  const { user } = useAuth();
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
  // 🏢 ADR-240: Injected save context from Wizard — carries entityType/floorId/purpose for dual-write
  const injectedSaveContextRef = useRef<DxfSaveContext | null>(null);
  // 🏢 ENTERPRISE: Callback after successful save — LevelsSystem uses this to persist level→DXF link
  const onSceneSavedRef = useRef<((fileId: string, fileName: string) => void) | null>(null);

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

  /** 🏢 ADR-240: Inject DxfSaveContext from Wizard so dual-write uses correct entityType/floorId */
  const setSaveContext = useCallback((ctx: DxfSaveContext | null) => {
    injectedSaveContextRef.current = ctx;
  }, []);

  /** 🏢 ENTERPRISE: Set callback for after successful save (used by LevelsSystem) */
  const setOnSceneSaved = useCallback((cb: ((fileId: string, fileName: string) => void) | null) => {
    onSceneSavedRef.current = cb;
  }, []);

  /** 🏢 ENTERPRISE: External control of loading guard (used by LevelsSystem during scene load) */
  const setIsLoadingFromFirestore = useCallback((loading: boolean) => {
    isLoadingFromFirestoreRef.current = loading;
  }, []);

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
        // 🏢 ADR-240: Skip auto-save when wizard pipeline is active.
        // The wizard handles saving via useFloorplanUpload + /api/floorplans/process.
        // Running auto-save here would create a redundant scene file in Storage (cadFiles / dxf-scenes/).
        if (injectedSaveContextRef.current?.purpose) {
          // 🏢 ENTERPRISE: Even though auto-save is skipped, still notify LevelsSystem
          // about the file association so sceneFileId gets persisted on the level.
          // Without this, wizard-imported DXFs would NOT auto-load after restart.
          const wizardFileId = injectedFileRecordIdRef.current
            ?? fileIdCacheRef.current.get(currentFileName);
          if (wizardFileId) {
            onSceneSavedRef.current?.(wizardFileId, currentFileName);
          }
          setSaveStatus('idle');
          return;
        }

        setSaveStatus('saving');

        try {
          // 🏢 ENTERPRISE: Resolve file ID with priority:
          // 1. Injected FileRecord ID (from wizard/upload via setFileRecordId)
          // 2. Cached ID (from previous save in this session)
          // 3. Existing FileRecord in `files` collection (wizard uploaded this file before)
          // 4. New enterprise ID (first standalone save — no wizard involved)
          let fileId = injectedFileRecordIdRef.current
            ?? fileIdCacheRef.current.get(currentFileName);
          let canonicalScenePath: string | undefined;

          if (!fileId) {
            // Check if wizard already created a FileRecord for this filename (tenant-scoped)
            const lookupCompanyId = injectedSaveContextRef.current?.companyId ?? user?.companyId;
            if (!lookupCompanyId) {
              setSaveStatus('error');
              return;
            }
            const existing = await DxfFirestoreService.findExistingFileRecord(lookupCompanyId, currentFileName);
            if (existing) {
              fileId = existing.id;
              // Derive scene path next to the original DXF in canonical storage
              if (existing.storagePath) {
                canonicalScenePath = DxfFirestoreService.deriveScenePath(existing.storagePath);
              }
            } else {
              fileId = DxfFirestoreService.generateFileId(currentFileName);
            }
            fileIdCacheRef.current.set(currentFileName, fileId);
          }

          // 🚀 PHASE 4: Use Storage-based auto-save with canonical path
          // 🏢 ADR-240: Merge injected save context (from Wizard) with canonical path
          // 🔒 TENANT SCOPING: fall back to authenticated user for companyId/createdBy
          // when the Wizard did not supply them (standalone DXF saves).
          const injectedCtx = injectedSaveContextRef.current ?? {};
          const saveContext: DxfSaveContext = {
            ...injectedCtx,
            companyId: injectedCtx.companyId ?? user?.companyId ?? undefined,
            createdBy: injectedCtx.createdBy ?? user?.uid ?? undefined,
            ...(canonicalScenePath ? { canonicalScenePath } : {}),
          };
          const success = await DxfFirestoreService.autoSaveV2(
            fileId, currentFileName, scene,
            Object.keys(saveContext).length > 0 ? saveContext : undefined
          );
          
          if (success) {
            setSaveStatus('success');
            setLastSaveTime(new Date());
            // 🏢 ENTERPRISE: Notify LevelsSystem to persist level→DXF association
            onSceneSavedRef.current?.(fileId, currentFileName);
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
    setSaveContext,
    setOnSceneSaved,
    setIsLoadingFromFirestore,
  };
}