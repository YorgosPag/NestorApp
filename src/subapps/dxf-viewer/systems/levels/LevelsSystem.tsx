'use client';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { 
  Level, 
  FloorplanDoc, 
  ImportWizardState, 
  CalibrationData, 
  LevelSystemSettings,
  DEFAULT_LEVEL_SETTINGS,
  LEVELS_EXPORT_VERSION
} from './config';
import { LevelOperations, FloorplanOperations, CalibrationOperations } from './utils';
import { type LevelsHookReturn } from './useLevels';
import { useAutoSaveSceneManager } from '../../hooks/scene/useAutoSaveSceneManager';
import type { SceneModel } from '../../types/scene';
import { useImportWizard } from '../../hooks/common/useImportWizard';
import { StorageErrorHandler, withStorageErrorHandling } from '../../utils/storage-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { db } from '../../../../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

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

// 🔺 FIXED: Helper για ΠΡΑΓΜΑΤΙΚΑ κενή σκηνή χωρίς default layer
const createEmptyScene = () => ({
  entities: [],
  layers: {}, // ← Εντελώς άδειο! Δεν δημιουργούμε layer "0" μέχρι να φορτωθεί DXF
  bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
  units: 'mm' as const
});

export interface LevelsSystemProps {
  children: React.ReactNode;
  initialLevels?: Level[];
  initialFloorplans?: Record<string, FloorplanDoc>;
  initialCurrentLevelId?: string | null;
  enableFirestore?: boolean;
  firestoreCollection?: string;
  settings?: Partial<LevelSystemSettings>;
  onLevelChange?: (levelId: string | null) => void;
  onFloorplanAdd?: (floorplan: FloorplanDoc) => void;
  onFloorplanRemove?: (floorplanId: string) => void;
  onError?: (error: string) => void;
}

const DEFAULT_IMPORT_WIZARD_STATE: ImportWizardState = {
  step: 'level'
};

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
  onError
}: Omit<LevelsSystemProps, 'children'>): LevelsHookReturn {
  const [levels, setLevels] = useState<Level[]>(initialLevels);
  const [currentLevelId, setCurrentLevelId] = useState<string | null>(initialCurrentLevelId);
  const [floorplans, setFloorplans] = useState<Record<string, FloorplanDoc>>(initialFloorplans);
  const [importWizard, setImportWizard] = useState<ImportWizardState>(DEFAULT_IMPORT_WIZARD_STATE);
  const [settings, setSettings] = useState<LevelSystemSettings>({ 
    ...DEFAULT_LEVEL_SETTINGS, 
    ...initialSettings 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sceneManager = useAutoSaveSceneManager();
  const importWizardHook = useImportWizard();

  // 🔧 FIX: Εξασφαλίζουμε σκηνή για το currentLevel ΜΕΤΑ το render (όχι μέσα σε useMemo αλλού)
  useEffect(() => {
    if (!currentLevelId) return;
    const hasScene = sceneManager.getLevelScene(currentLevelId);
    if (!hasScene) {
      // Δημιουργούμε την κενή σκηνή χωρίς να μπλέκουμε το render phase
      sceneManager.setLevelScene(currentLevelId, createEmptyScene());
    }
  }, [currentLevelId]); // Αφαιρέθηκε το sceneManager από dependencies για να αποφευχθεί το infinite loop

  const handleError = useCallback(async (err: string | Error) => {
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
  }, [onError]);

  useEffect(() => {
    if (!enableFirestore) return;

    setIsLoading(true);
    const q = query(collection(db, firestoreCollection), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        try {
          const fetchedLevels = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Level));
          
          if (fetchedLevels.length > 0) {
            setLevels(fetchedLevels);
            if (!currentLevelId || !fetchedLevels.some(l => l.id === currentLevelId)) {
              const defaultLevel = fetchedLevels.find(l => l.isDefault) || fetchedLevels[0];
              setCurrentLevelId(defaultLevel.id);
              onLevelChange?.(defaultLevel.id);
            }
          } else {
            const defaultLevels = LevelOperations.createDefaultLevels();
            const batch = writeBatch(db);
            defaultLevels.forEach(level => {
              const { id, ...levelData } = level;
              const docRef = doc(db, firestoreCollection, id);
              batch.set(docRef, levelData);
            });
            batch.commit().then(() => console.log("Default levels created in Firestore."));
          }
          setIsLoading(false);
          setError(null);
        } catch (err) {
          handleError(getErrorMessage(err, 'Failed to load levels'));
          setIsLoading(false);
        }
      },
      (err) => {
        handleError(`Firestore error: ${err.message}`);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enableFirestore, firestoreCollection, currentLevelId, onLevelChange, handleError]);

  // Level operations
  const addLevel = useCallback(async (name: string, setAsDefault = false, floorId?: string): Promise<string | null> => {
    try {
      setIsLoading(true);

      const validationError = LevelOperations.validateLevelName(name, levels);
      if (validationError) {
        handleError(validationError);
        return null;
      }

      if (enableFirestore) {
        const newLevelData = {
          name,
          order: levels.length,
          isDefault: setAsDefault,
          visible: true,
          createdAt: serverTimestamp(),
          ...(floorId ? { floorId } : {}),
        };

        const { generateLevelId } = await import('@/services/enterprise-id.service');
        const enterpriseId = generateLevelId();
        const docRef = doc(db, firestoreCollection, enterpriseId);
        await withStorageErrorHandling(
          () => setDoc(docRef, newLevelData),
          'Failed to add level to Firestore'
        );

        if (setAsDefault || settings.autoSelectNewLevel) {
          setCurrentLevelId(enterpriseId);
          onLevelChange?.(enterpriseId);
        }
        return enterpriseId;
      } else {
        const { levels: updatedLevels, newLevelId } = LevelOperations.addLevel(levels, name, setAsDefault, floorId);
        setLevels(updatedLevels);
        
        if (setAsDefault || settings.autoSelectNewLevel) {
          setCurrentLevelId(newLevelId);
          onLevelChange?.(newLevelId);
        }
        return newLevelId;
      }
    } catch (err) {
      handleError(getErrorMessage(err, 'Failed to add level'));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [levels, enableFirestore, firestoreCollection, settings.autoSelectNewLevel, handleError, onLevelChange]);

  const removeLevel = useCallback(async (levelId: string): Promise<void> => {
    try {
      setIsLoading(true);
      sceneManager.clearLevelScene(levelId);
      
      if (enableFirestore) {
        await deleteDoc(doc(db, firestoreCollection, levelId));
      } else {
        setLevels(prev => LevelOperations.removeLevel(prev, levelId));
      }

      setFloorplans(prev => FloorplanOperations.removeFloorplansForLevel(prev, levelId));
      
      if (currentLevelId === levelId) {
        const remainingLevels = levels.filter(l => l.id !== levelId);
        const newCurrentLevel = remainingLevels.length > 0 ? remainingLevels[0].id : null;
        setCurrentLevelId(newCurrentLevel);
        onLevelChange?.(newCurrentLevel);
      }
    } catch (err) {
      handleError(getErrorMessage(err, 'Failed to remove level'));
    } finally {
      setIsLoading(false);
    }
  }, [levels, currentLevelId, enableFirestore, firestoreCollection, sceneManager, handleError, onLevelChange]);

  const deleteLevel = useCallback(async (levelId: string): Promise<void> => {
    await removeLevel(levelId);
  }, [removeLevel]);

  const clearAllLevels = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      if (enableFirestore) {
        const batch = writeBatch(db);
        levels.forEach(level => {
          batch.delete(doc(db, firestoreCollection, level.id));
        });
        await batch.commit();
      } else {
        setLevels([]);
      }
      
      sceneManager.clearAllScenes();
      setFloorplans({});
      setCurrentLevelId(null);
      onLevelChange?.(null);
    } catch (err) {
      handleError(getErrorMessage(err, 'Failed to clear levels'));
    } finally {
      setIsLoading(false);
    }
  }, [levels, enableFirestore, firestoreCollection, sceneManager, handleError, onLevelChange]);

  const reorderLevels = useCallback(async (levelIds: string[]): Promise<void> => {
    try {
      if (enableFirestore) {
        const batch = writeBatch(db);
        levelIds.forEach((id, index) => {
          batch.update(doc(db, firestoreCollection, id), { order: index });
        });
        await batch.commit();
      } else {
        setLevels(prev => LevelOperations.reorderLevels(prev, levelIds));
      }
    } catch (err) {
      handleError(getErrorMessage(err, 'Failed to reorder levels'));
    }
  }, [enableFirestore, firestoreCollection, handleError]);

  const renameLevel = useCallback(async (levelId: string, name: string): Promise<void> => {
    try {
      const validationError = LevelOperations.validateLevelName(name, levels.filter(l => l.id !== levelId));
      if (validationError) {
        handleError(validationError);
        return;
      }

      if (enableFirestore) {
        await updateDoc(doc(db, firestoreCollection, levelId), { name });
      } else {
        setLevels(prev => LevelOperations.renameLevel(prev, levelId, name));
      }
    } catch (err) {
      handleError(getErrorMessage(err, 'Failed to rename level'));
    }
  }, [levels, enableFirestore, firestoreCollection, handleError]);

  const setCurrentLevel = useCallback((levelId: string) => {
    setCurrentLevelId(levelId);
    onLevelChange?.(levelId);
  }, [onLevelChange]);

  const toggleLevelVisibility = useCallback(async (levelId: string): Promise<void> => {
    try {
      const level = levels.find(l => l.id === levelId);
      if (!level) return;

      if (enableFirestore) {
        await updateDoc(doc(db, firestoreCollection, levelId), { visible: !level.visible });
      } else {
        setLevels(prev => LevelOperations.toggleLevelVisibility(prev, levelId));
      }
    } catch (err) {
      handleError(getErrorMessage(err, 'Failed to toggle level visibility'));
    }
  }, [levels, enableFirestore, firestoreCollection, handleError]);

  const setDefaultLevel = useCallback(async (levelId: string): Promise<void> => {
    try {
      if (enableFirestore) {
        const batch = writeBatch(db);
        levels.forEach(level => {
          batch.update(doc(db, firestoreCollection, level.id), { isDefault: level.id === levelId });
        });
        await batch.commit();
      } else {
        setLevels(prev => LevelOperations.setDefaultLevel(prev, levelId));
      }
    } catch (err) {
      handleError(getErrorMessage(err, 'Failed to set default level'));
    }
  }, [levels, enableFirestore, firestoreCollection, handleError]);

  const duplicateLevel = useCallback(async (levelId: string, newName?: string): Promise<string | null> => {
    const level = levels.find(l => l.id === levelId);
    if (!level) return null;

    const duplicateName = newName || `${level.name} (Copy)`;
    return await addLevel(duplicateName, false);
  }, [levels, addLevel]);

  // Floorplan operations
  const addFloorplan = useCallback((floorplan: Omit<FloorplanDoc, 'id' | 'importedAt'>): string => {
    const { floorplans: updatedFloorplans, floorplanId } = FloorplanOperations.addFloorplan(floorplans, floorplan);
    setFloorplans(updatedFloorplans);
    onFloorplanAdd?.(updatedFloorplans[floorplanId]);
    return floorplanId;
  }, [floorplans, onFloorplanAdd]);

  const removeFloorplan = useCallback((floorplanId: string) => {
    setFloorplans(prev => {
      const updated = FloorplanOperations.removeFloorplan(prev, floorplanId);
      onFloorplanRemove?.(floorplanId);
      return updated;
    });
  }, [onFloorplanRemove]);

  const updateFloorplan = useCallback((floorplanId: string, updates: Partial<FloorplanDoc>) => {
    setFloorplans(prev => {
      const floorplan = prev[floorplanId];
      if (!floorplan) return prev;
      
      return {
        ...prev,
        [floorplanId]: { ...floorplan, ...updates }
      };
    });
  }, []);

  const getFloorplansForLevel = useCallback((levelId: string): FloorplanDoc[] => {
    return FloorplanOperations.getFloorplansForLevel(floorplans, levelId);
  }, [floorplans]);

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
          calibrated: true
        }
      };
    });
  }, []);

  // Scene management (delegated to sceneManager)
  const setLevelScene = useCallback((levelId: string, scene: SceneModel) => {
    sceneManager.setLevelScene(levelId, scene);
  }, [sceneManager.setLevelScene]);

  // 🔧 CRITICAL FIX: getLevelScene dependency must be the actual function, not sceneManager
  // This ensures useMemo in useSceneState re-computes when scenes change
  const getLevelScene = useCallback((levelId: string) => {
    return sceneManager.getLevelScene(levelId);
  }, [sceneManager.getLevelScene]);

  const clearLevelScene = useCallback((levelId: string) => {
    sceneManager.clearLevelScene(levelId);
  }, [sceneManager.clearLevelScene]);

  // Import wizard operations
  const startImportWizard = useCallback((file: File) => {
    setImportWizard(prev => ({ ...prev, file, step: 'level' }));
    importWizardHook.startImportWizard(file);
  }, [importWizardHook]);

  const setImportWizardStep = useCallback((step: ImportWizardState['step']) => {
    setImportWizard(prev => ({ ...prev, step }));
    importWizardHook.setImportWizardStep(step);
  }, [importWizardHook]);

  const setSelectedLevel = useCallback((levelId?: string, newLevelName?: string) => {
    setImportWizard(prev => ({ ...prev, selectedLevelId: levelId, newLevelName }));
    importWizardHook.setSelectedLevel(levelId, newLevelName);
  }, [importWizardHook]);

  const setCalibration = useCallback((calibration: CalibrationData) => {
    setImportWizard(prev => ({ ...prev, calibration }));
    importWizardHook.setCalibration(calibration);
  }, [importWizardHook]);

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
  const validateLevelName = useCallback((name: string): string | null => {
    return LevelOperations.validateLevelName(name, levels);
  }, [levels]);

  const exportLevelsData = useCallback(() => {
    return {
      levels,
      floorplans,
      settings,
      version: LEVELS_EXPORT_VERSION,
      timestamp: Date.now()
    };
  }, [levels, floorplans, settings]);

  const importLevelsData = useCallback(async (data: unknown): Promise<void> => {
    try {
      setIsLoading(true);

      // Type guard for import data
      if (typeof data !== 'object' || !data) {
        throw new Error('Invalid import data format');
      }

      const importData = data as { levels?: Level[]; floorplans?: Record<string, FloorplanDoc>; settings?: Partial<LevelSystemSettings> };

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
  }, [handleError]);

  return {
    // State
    levels,
    currentLevelId,
    floorplans,
    importWizard,
    settings,
    isLoading,
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
      saveStatus: sceneManager.saveStatus
    }),
    setFileRecordId: sceneManager.setFileRecordId,

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

  return (
    <LevelsContext.Provider value={value}>
      {children}
    </LevelsContext.Provider>
  );
}
