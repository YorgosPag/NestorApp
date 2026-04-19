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
  const [currentFileName, setCurrentFileNameState] = useState<string | null>(null);
  // Ref mirrors state so setLevelSceneWithAutoSave always reads the latest value
  // even before React re-renders (avoids stale closure when called synchronously
  // after setCurrentFileName in the same event handler as setLevelScene).
  const currentFileNameRef = useRef<string | null>(null);
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

  /** Stable setter — updates ref (sync) and state (triggers re-render for consumers). */
  const setCurrentFileName = useCallback((fileName: string | null) => {
    currentFileNameRef.current = fileName;
    setCurrentFileNameState(fileName);
  }, []);

  /**
   * 🏢 ENTERPRISE: Inject FileRecord ID from external source (wizard upload)
   * When set, auto-save writes to cadFiles using THIS ID instead of generating a new one.
   * This ensures cadFiles and files collections share the same document ID.
   */
  const setFileRecordId = useCallback((id: string | null) => {
    injectedFileRecordIdRef.current = id;
    // Cache against current filename (read from ref to avoid stale closure)
    const fileName = currentFileNameRef.current;
    if (id && fileName) {
      fileIdCacheRef.current.set(fileName, id);
    }
  }, []);

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

    // Read filename from ref — always current even before React re-renders
    // (avoids stale-closure issue when setCurrentFileName and setLevelScene are
    // called in the same synchronous block before any await).
    const fileName = currentFileNameRef.current;

    // Trigger auto-save if enabled and we have a filename and not loading from Firestore
    if (autoSaveEnabled && fileName && !isLoadingFromFirestoreRef.current) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new debounced save
      saveTimeoutRef.current = setTimeout(async () => {
        // 🏢 ADR-240 / ADR-309 Phase 6: Skip auto-save when wizard pipeline is active.
        // Detect wizard mode by the presence of an injected FileRecord ID — more
        // reliable than checking `purpose` which can be empty string → coerced to
        // undefined (LevelPanel: `purpose: meta.purpose || undefined`).
        const wizardFileId = injectedFileRecordIdRef.current
          ?? fileIdCacheRef.current.get(fileName);
        if (wizardFileId) {
          // Wizard already handled the file upload. Just notify LevelsSystem so
          // sceneFileId gets persisted on the level for auto-reload after refresh.
          onSceneSavedRef.current?.(wizardFileId, fileName);
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
            ?? fileIdCacheRef.current.get(fileName);
          let canonicalScenePath: string | undefined;

          if (!fileId) {
            // Check if wizard already created a FileRecord for this filename (tenant-scoped)
            const lookupCompanyId = injectedSaveContextRef.current?.companyId ?? user?.companyId;
            if (!lookupCompanyId) {
              setSaveStatus('error');
              return;
            }
            const existing = await DxfFirestoreService.findExistingFileRecord(lookupCompanyId, fileName);
            if (existing) {
              fileId = existing.id;
              // Derive scene path next to the original DXF in canonical storage
              if (existing.storagePath) {
                canonicalScenePath = DxfFirestoreService.deriveScenePath(existing.storagePath);
              }
            } else {
              fileId = DxfFirestoreService.generateFileId(fileName);
            }
            fileIdCacheRef.current.set(fileName, fileId);
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
            fileId, fileName, scene,
            Object.keys(saveContext).length > 0 ? saveContext : undefined
          );

          if (success) {
            setSaveStatus('success');
            setLastSaveTime(new Date());
            // 🏢 ENTERPRISE: Notify LevelsSystem to persist level→DXF association
            onSceneSavedRef.current?.(fileId, fileName);
          } else {
            setSaveStatus('error');
            console.error(`❌ [AutoSave] Failed to save changes to ${fileName}`);
          }
        } catch (error) {
          setSaveStatus('error');
          console.error(`❌ [AutoSave] Exception during save:`, error);
        }

        // Reset status after delay
        setTimeout(() => setSaveStatus('idle'), PANEL_LAYOUT.TIMING.SAVE_STATUS_RESET);
      }, STORAGE_TIMING.SCENE_AUTOSAVE_DEBOUNCE); // 🏢 ADR-098
    }
  }, [sceneManager, autoSaveEnabled]);
  
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