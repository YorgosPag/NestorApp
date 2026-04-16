'use client';
import * as React from 'react';
import { useState, useCallback } from 'react';
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
import { useImportWizard } from '../../hooks/common/useImportWizard';
import { StorageErrorHandler } from '../../utils/storage-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { LevelsSystemProps, DEFAULT_IMPORT_WIZARD_STATE } from './LevelsSystem.types';
import { useLevelSceneLoader } from './hooks/useLevelSceneLoader';
import { useLevelsFirestoreSync } from './hooks/useLevelsFirestoreSync';
import { useLevelOperations } from './hooks/useLevelOperations';
import { useAuth } from '@/auth';

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
  firestoreCollection = 'dxf-viewer-levels',
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
  const importWizardHook = useImportWizard();

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

  // Scene management (delegated to sceneManager)
  const setLevelScene = useCallback(
    (levelId: string, scene: SceneModel) => {
      sceneManager.setLevelScene(levelId, scene);
    },
    [sceneManager.setLevelScene]
  );

  // 🔧 CRITICAL FIX: getLevelScene dependency must be the actual function, not sceneManager
  // This ensures useMemo in useSceneState re-computes when scenes change
  const getLevelScene = useCallback(
    (levelId: string) => {
      return sceneManager.getLevelScene(levelId);
    },
    [sceneManager.getLevelScene]
  );

  const clearLevelScene = useCallback(
    (levelId: string) => {
      sceneManager.clearLevelScene(levelId);
    },
    [sceneManager.clearLevelScene]
  );

  // Import wizard operations
  const startImportWizard = useCallback(
    (file: File) => {
      setImportWizard(prev => ({ ...prev, file, step: 'level' }));
      importWizardHook.startImportWizard(file);
    },
    [importWizardHook]
  );

  const setImportWizardStep = useCallback(
    (step: ImportWizardState['step']) => {
      setImportWizard(prev => ({ ...prev, step }));
      importWizardHook.setImportWizardStep(step);
    },
    [importWizardHook]
  );

  const setSelectedLevel = useCallback(
    (levelId?: string, newLevelName?: string) => {
      setImportWizard(prev => ({ ...prev, selectedLevelId: levelId, newLevelName }));
      importWizardHook.setSelectedLevel(levelId, newLevelName);
    },
    [importWizardHook]
  );

  const setCalibration = useCallback(
    (calibration: CalibrationData) => {
      setImportWizard(prev => ({ ...prev, calibration }));
      importWizardHook.setCalibration(calibration);
    },
    [importWizardHook]
  );

  const completeImport = useCallback((): FloorplanDoc | null => {
    const result = importWizardHook.completeImport(levels, floorplans);
    if (result) {
      setLevels(result.updatedLevels);
      setFloorplans(result.updatedFloorplans);
      setCurrentLevelId(result.levelId);
      setImportWizard(DEFAULT_IMPORT_WIZARD_STATE);
      return result.floorplan;
    }
    return null;
  }, [importWizardHook, levels, floorplans]);

  const cancelImportWizard = useCallback(() => {
    setImportWizard(DEFAULT_IMPORT_WIZARD_STATE);
    importWizardHook.cancelImportWizard();
  }, [importWizardHook]);

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

  return {
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
    getCurrentFileName: () => sceneManager.currentFileName,
    setAutoSaveEnabled: sceneManager.setAutoSaveEnabled,
    getAutoSaveStatus: () => ({
      lastSaveTime: sceneManager.lastSaveTime,
      saveStatus: sceneManager.saveStatus,
    }),
    setFileRecordId: sceneManager.setFileRecordId,
    setSaveContext: sceneManager.setSaveContext,
    linkSceneToLevel,

    // Import wizard
    startImportWizard,
    setImportWizardStep,
    setSelectedLevel,
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
  };
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
