'use client';
import * as React from 'react';
import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Level,
  FloorplanDoc,
  ImportWizardState,
  CalibrationData,
  LevelSystemSettings,
  DEFAULT_LEVEL_SETTINGS,
  LEVELS_EXPORT_VERSION,
} from './config';
import { FloorplanOperations, CalibrationOperations, LevelOperations } from './utils';
import { type LevelsHookReturn } from './useLevels';
import { useAutoSaveSceneManager } from '../../hooks/scene/useAutoSaveSceneManager';
import type { SceneModel } from '../../types/scene';
import type { SceneWriteOrigin } from '../../hooks/scene/scene-write-origin';
import { StorageErrorHandler } from '../../utils/storage-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { LevelsSystemProps, DEFAULT_IMPORT_WIZARD_STATE } from './LevelsSystem.types';
import { useLevelSceneLoader } from './hooks/useLevelSceneLoader';
import { useLevelsFirestoreSync } from './hooks/useLevelsFirestoreSync';
// ADR-362 Phase F4 — hydrate per-company custom DIMSTYLES + default pointer into
// the in-memory dim-style registry. Mounted at the same lifecycle point as the
// levels sync (top-level DXF viewer provider), tenant-gated by the same claims.
import { useDimStylesFirestoreSync } from '../dimensions/hooks/useDimStylesFirestoreSync';
import { useLevelOperations } from './hooks/useLevelOperations';
import { useLevelFloorplanSync } from './hooks/useLevelFloorplanSync';
import { useLevelImportWizardOps } from './hooks/useLevelImportWizardOps';
import { useAuth } from '@/auth';
import { readViewportFromUrl } from '../../services/viewport-persistence';

// ============================================================================
// 🏢 ENTERPRISE: STATIC CONTEXT CREATION (ADR-125)
// ============================================================================
// CRITICAL: Context MUST be created in the SAME file as the Provider component.
// This prevents "Provider is null" errors in production builds due to bundler
// optimizations that can reorder module evaluation.
// Pattern: Autodesk/Microsoft/Google enterprise standard
// ============================================================================

/**
 * Static context instance (created once at module load)
 * This is the CANONICAL location for LevelsContext.
 */
export const LevelsContext = React.createContext<LevelsHookReturn | null>(null);

// Re-export for backward compatibility (consumers importing from this module)
export type { LevelsSystemProps };

function useLevelsSystemState({
  initialLevels = [],
  initialFloorplans = {},
  initialCurrentLevelId = null,
  enableFirestore = true,
  firestoreCollection = 'dxf_viewer_levels',
  settings: initialSettings = {},
  onLevelChange,
  onFloorplanAdd,
  onFloorplanRemove,
  onError,
}: Omit<LevelsSystemProps, 'children'>): LevelsHookReturn {
  const [levels, setLevels] = useState<Level[]>(initialLevels);
  const [currentLevelId, setCurrentLevelId] = useState<string | null>(initialCurrentLevelId);
  const [floorplans, setFloorplans] = useState<Record<string, FloorplanDoc>>(initialFloorplans);
  const [importWizard, setImportWizard] = useState<ImportWizardState>(DEFAULT_IMPORT_WIZARD_STATE);
  const [settings, setSettings] = useState<LevelSystemSettings>({
    ...DEFAULT_LEVEL_SETTINGS,
    ...initialSettings,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sceneManager = useAutoSaveSceneManager();
  const sceneManagerRef = useRef(sceneManager);
  sceneManagerRef.current = sceneManager;

  // Auth claims for tenant-scoped Firestore query
  const { user: firebaseUser } = useAuth();
  const companyId = firebaseUser?.companyId ?? null;
  const userId = firebaseUser?.uid ?? null;
  const isSuperAdmin = firebaseUser?.globalRole === 'super_admin';

  const handleError = useCallback(
    async (err: string | Error) => {
      const errorMessage = typeof err === 'string' ? err : err.message;

      // Check if it's a storage error
      if (StorageErrorHandler.isStorageError(err)) {
        const handled = await StorageErrorHandler.handleStorageError(err);
        if (handled) {
          return; // Error was handled, don't propagate
        }
      }

      setError(errorMessage);
      onError?.(errorMessage);
    },
    [onError]
  );

  // 🏢 ENTERPRISE: Auto-load DXF scene from Storage on level switch + link on save
  const { sceneLoading, linkSceneToLevel } = useLevelSceneLoader({
    currentLevelId,
    levels,
    sceneManager,
    enableFirestore,
    firestoreCollection,
  });

  // 🏢 ENTERPRISE: Real-time Firestore subscription for the levels collection
  useLevelsFirestoreSync({
    enableFirestore,
    firestoreCollection,
    currentLevelId,
    companyId,
    userId,
    isSuperAdmin,
    setLevels,
    setCurrentLevelId,
    setIsLoading,
    setError,
    onLevelChange,
    handleError,
  });

  // 📐 ADR-362 Phase F4: Real-time sync of per-company custom DIMSTYLES + the
  // company default-style pointer into the in-memory dim-style registry.
  useDimStylesFirestoreSync({
    enableFirestore,
    companyId,
    isSuperAdmin,
  });

  // 🏢 ENTERPRISE: Mutating level operations (add/remove/rename/reorder/…)
  const {
    addLevel,
    removeLevel,
    deleteLevel,
    clearAllLevels,
    reorderLevels,
    renameLevel,
    setCurrentLevel,
    toggleLevelVisibility,
    setDefaultLevel,
    duplicateLevel,
    linkLevelToFloor,
    updateLevelContext,
  } = useLevelOperations({
    levels,
    setLevels,
    currentLevelId,
    setCurrentLevelId,
    setFloorplans,
    enableFirestore,
    settings,
    sceneManager,
    setIsLoading,
    handleError,
    onLevelChange,
  });

  // Floorplan operations
  const addFloorplan = useCallback(
    (floorplan: Omit<FloorplanDoc, 'id' | 'importedAt'>): string => {
      const { floorplans: updatedFloorplans, floorplanId } = FloorplanOperations.addFloorplan(
        floorplans,
        floorplan
      );
      setFloorplans(updatedFloorplans);
      onFloorplanAdd?.(updatedFloorplans[floorplanId]);
      return floorplanId;
    },
    [floorplans, onFloorplanAdd]
  );

  const removeFloorplan = useCallback(
    (floorplanId: string) => {
      setFloorplans(prev => {
        const updated = FloorplanOperations.removeFloorplan(prev, floorplanId);
        onFloorplanRemove?.(floorplanId);
        return updated;
      });
    },
    [onFloorplanRemove]
  );

  const updateFloorplan = useCallback((floorplanId: string, updates: Partial<FloorplanDoc>) => {
    setFloorplans(prev => {
      const floorplan = prev[floorplanId];
      if (!floorplan) return prev;

      return {
        ...prev,
        [floorplanId]: { ...floorplan, ...updates },
      };
    });
  }, []);

  const getFloorplansForLevel = useCallback(
    (levelId: string): FloorplanDoc[] => {
      return FloorplanOperations.getFloorplansForLevel(floorplans, levelId);
    },
    [floorplans]
  );

  const calibrateFloorplan = useCallback((floorplanId: string, calibration: CalibrationData) => {
    setFloorplans(prev => {
      const floorplan = prev[floorplanId];
      if (!floorplan) return prev;

      const newTransform = CalibrationOperations.applyCalibrationToTransform(
        floorplan.transform,
        calibration
      );

      return {
        ...prev,
        [floorplanId]: {
          ...floorplan,
          transform: newTransform,
          units: calibration.units,
          calibrated: true,
        },
      };
    });
  }, []);

  // Scene management (delegated to sceneManager via stable ref)
  const setLevelScene = useCallback(
    // 🏢 ADR-040: forward the SSoT write origin so the auto-save gate can decide.
    // This is the generic forwarder ALL consumers use via useLevels — it must NOT
    // swallow the 3rd arg, otherwise every 'remote-echo'/'system-reconcile'/'load'
    // tag set by persistence hooks/reconcilers/loaders would be lost here.
    (levelId: string, scene: SceneModel, origin?: SceneWriteOrigin) => {
      sceneManagerRef.current.setLevelScene(levelId, scene, origin);
    },
    []
  );

  const getLevelScene = useCallback(
    (levelId: string) => {
      return sceneManagerRef.current.getLevelScene(levelId);
    },
    []
  );

  const clearLevelScene = useCallback(
    (levelId: string) => {
      sceneManagerRef.current.clearLevelScene(levelId);
    },
    []
  );

  // 🏢 ENTERPRISE: Bidirectional sync — external floorplan deletion clears canvas scene
  useLevelFloorplanSync({ levels, clearLevelScene });

  // ADR-400 — One-shot URL level restore: when the levels list first becomes non-empty
  // (Firestore delivery), check if the URL carries a `lvl` param that matches an
  // existing level. If so, select it once (restores floor on page refresh / shared link).
  // Guard: useRef<boolean> ensures this runs at most once per mount.
  const urlLevelRestoredRef = useRef(false);
  React.useEffect(() => {
    if (urlLevelRestoredRef.current || levels.length === 0) return;
    const urlLevelId = readViewportFromUrl().levelId ?? null;
    if (!urlLevelId) return;
    const levelExists = levels.some(l => l.id === urlLevelId);
    if (levelExists && urlLevelId !== currentLevelId) {
      urlLevelRestoredRef.current = true;
      setCurrentLevelId(urlLevelId);
    } else if (levelExists) {
      // Already selected — still mark as done so we don't loop.
      urlLevelRestoredRef.current = true;
    }
  }, [levels, currentLevelId, setCurrentLevelId]);

  // Import wizard operations (extracted to a dedicated hook — SRP / N.7.1)
  const {
    startImportWizard,
    setImportWizardStep,
    setSelectedLevel,
    setUserDrawingUnits,
    setCalibration,
    completeImport,
    cancelImportWizard,
  } = useLevelImportWizardOps({
    levels,
    floorplans,
    setLevels,
    setFloorplans,
    setCurrentLevelId,
    setImportWizard,
  });

  // Settings operations
  const updateSettings = useCallback((newSettings: Partial<LevelSystemSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_LEVEL_SETTINGS);
  }, []);

  // Utility operations
  const validateLevelName = useCallback(
    (name: string): string | null => {
      return LevelOperations.validateLevelName(name, levels);
    },
    [levels]
  );

  const exportLevelsData = useCallback(() => {
    return {
      levels,
      floorplans,
      settings,
      version: LEVELS_EXPORT_VERSION,
      timestamp: Date.now(),
    };
  }, [levels, floorplans, settings]);

  const importLevelsData = useCallback(
    async (data: unknown): Promise<void> => {
      try {
        setIsLoading(true);

        // Type guard for import data
        if (typeof data !== 'object' || !data) {
          throw new Error('Invalid import data format');
        }

        const importData = data as {
          levels?: Level[];
          floorplans?: Record<string, FloorplanDoc>;
          settings?: Partial<LevelSystemSettings>;
        };

        if (importData.levels) {
          setLevels(importData.levels);
        }
        if (importData.floorplans) {
          setFloorplans(importData.floorplans);
        }
        if (importData.settings) {
          setSettings(prev => ({ ...prev, ...importData.settings }));
        }
      } catch (err) {
        handleError(getErrorMessage(err, 'Failed to import levels data'));
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  // 🚀 Ribbon-cascade fix (profiler 2026-06-28): the volatile scene save-status
  // (currentFileName / saveStatus / lastSaveTime) no longer rides on this context.
  // It used to be exposed through `getCurrentFileName` / `getAutoSaveStatus` getters
  // that depended on `sceneManager` — which changes identity on every save cycle —
  // so the whole `LevelsHookReturn` memo recomputed on each edit, churning ~40
  // ribbon-command bridges → `RibbonRoot` memo broke → the entire ribbon re-rendered
  // (69% of session time). The status now lives in `AutoSaveStatusStore`, consumed
  // directly by `AutoSaveStatus` via `useAutoSaveStatus()`.

  // ADR-040 Phase XVI — memoize the Context value so consumers don't re-render
  // on every Provider render. Root cause of idle render-loop (2026-05-16):
  // the bare object literal `value` caused every consumer (CanvasSection,
  // floorplan-background hook, entity-join hook, …) to receive a new
  // reference on each Provider render, even when content was identical.
  return useMemo<LevelsHookReturn>(
    () => ({
      // State
      levels,
      currentLevelId,
      floorplans,
      importWizard,
      settings,
      isLoading,
      sceneLoading,
      error,

      // Level operations
      addLevel,
      removeLevel,
      deleteLevel,
      clearAllLevels,
      reorderLevels,
      renameLevel,
      setCurrentLevel,
      toggleLevelVisibility,
      setDefaultLevel,
      duplicateLevel,
      linkLevelToFloor,
      updateLevelContext,

      // Floorplan operations
      addFloorplan,
      removeFloorplan,
      updateFloorplan,
      getFloorplansForLevel,
      calibrateFloorplan,

      // Scene management
      setLevelScene,
      getLevelScene,
      clearLevelScene,

      // Auto-save functionality
      setCurrentFileName: sceneManager.setCurrentFileName,
      setAutoSaveEnabled: sceneManager.setAutoSaveEnabled,
      setFileRecordId: sceneManager.setFileRecordId,
      fileRecordId: sceneManager.fileRecordId,
      setSaveContext: sceneManager.setSaveContext,
      saveContext: sceneManager.saveContext,
      linkSceneToLevel,

      // Import wizard
      startImportWizard,
      setImportWizardStep,
      setSelectedLevel,
      setUserDrawingUnits,
      setCalibration,
      completeImport,
      cancelImportWizard,

      // Settings
      updateSettings,
      resetSettings,

      // Utility operations
      validateLevelName,
      exportLevelsData,
      importLevelsData,
    }),
    [
      levels, currentLevelId, floorplans, importWizard, settings, isLoading, sceneLoading, error,
      addLevel, removeLevel, deleteLevel, clearAllLevels, reorderLevels, renameLevel,
      setCurrentLevel, toggleLevelVisibility, setDefaultLevel, duplicateLevel, linkLevelToFloor,
      updateLevelContext,
      addFloorplan, removeFloorplan, updateFloorplan, getFloorplansForLevel, calibrateFloorplan,
      setLevelScene, getLevelScene, clearLevelScene,
      linkSceneToLevel,
      // ADR-358 Phase 8: reactive scope inputs so `useStairPersistence` re-runs
      // when a new floorplan loads or the wizard updates the project context.
      sceneManager.fileRecordId, sceneManager.saveContext,
      startImportWizard, setImportWizardStep, setSelectedLevel, setUserDrawingUnits, setCalibration, completeImport,
      cancelImportWizard,
      updateSettings, resetSettings,
      validateLevelName, exportLevelsData, importLevelsData,
    ],
  );
}

export function useLevelsContext(): LevelsHookReturn {
  const context = React.useContext(LevelsContext);
  if (!context) {
    throw new Error('useLevelsContext must be used within LevelsSystem');
  }
  return context;
}

export function LevelsSystem({ children, ...props }: LevelsSystemProps) {
  const value = useLevelsSystemState(props);

  return <LevelsContext.Provider value={value}>{children}</LevelsContext.Provider>;
}
