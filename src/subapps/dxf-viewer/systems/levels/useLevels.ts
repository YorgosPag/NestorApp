/**
 * LEVELS SYSTEM - Hooks
 * React hooks for level management functionality
 */

import * as React from 'react';
import { useContext } from 'react';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';
import type {
  Level,
  FloorplanDoc,
  ImportWizardState,
  CalibrationData,
  LevelSystemSettings,
  ImportWizardActions,
} from './config';
import type { UseLevelOperationsResult } from './hooks/useLevelOperations';
import type { SceneModel } from '../../types/scene';
import type { SceneWriteOrigin } from '../../hooks/scene/scene-write-origin';

export interface LevelSystemState {
  levels: Level[];
  currentLevelId: string | null;
  floorplans: Record<string, FloorplanDoc>;
  importWizard: ImportWizardState;
  settings: LevelSystemSettings;
  isLoading: boolean;
  /** 🏢 ENTERPRISE: True while loading DXF scene from Storage (level switch / startup) */
  sceneLoading: boolean;
  error: string | null;
}

/**
 * Οι ενέργειες του συστήματος ορόφων.
 *
 * Οι **λειτουργίες ορόφου** (add/remove/rename/updateLevelContext…) ΔΕΝ ξαναδηλώνονται εδώ:
 * κληρονομούνται αυτούσιες από το {@link UseLevelOperationsResult}, που είναι το συμβόλαιο του
 * hook που τις υλοποιεί. Ήταν αντιγραμμένη λίστα 11 υπογραφών (N.0.2/N.18) — δύο δηλώσεις του
 * ίδιου συμβολαίου αποκλίνουν σιωπηλά (ακριβώς αυτό έγινε στο `updateLevelContext`, όπου το ένα
 * αντίγραφο δεν ήξερε το `sheetNumberOverride`).
 */
export interface LevelSystemActions extends ImportWizardActions, UseLevelOperationsResult {
  // Floorplan operations
  addFloorplan: (floorplan: Omit<FloorplanDoc, 'id' | 'importedAt'>) => string;
  removeFloorplan: (floorplanId: string) => void;
  updateFloorplan: (floorplanId: string, updates: Partial<FloorplanDoc>) => void;
  getFloorplansForLevel: (levelId: string) => FloorplanDoc[];
  calibrateFloorplan: (floorplanId: string, calibration: CalibrationData) => void;

  // Scene management
  // 🏢 ADR-040: optional SSoT write origin → drives the auto-save gate.
  setLevelScene: (levelId: string, scene: SceneModel, origin?: SceneWriteOrigin) => void;
  getLevelScene: (levelId: string) => SceneModel | null;
  clearLevelScene: (levelId: string) => void;
  
  // Auto-save functionality
  // 🚀 The volatile scene save-status (currentFileName / saveStatus / lastSaveTime)
  // was moved out of this context into `AutoSaveStatusStore` to stop a ribbon
  // re-render cascade (profiler 2026-06-28). Read it via `useAutoSaveStatus()`.
  setCurrentFileName?: (fileName: string | null) => void;
  setAutoSaveEnabled?: (enabled: boolean) => void;
  /** 🏢 ENTERPRISE: Inject FileRecord ID so cadFiles uses the same ID as files collection */
  setFileRecordId?: (id: string | null) => void;
  /** 🪜 ADR-358 Phase 8: reactive read of injected FileRecord id (for stair persistence floorplanId scope) */
  fileRecordId?: string | null;
  /** 🏢 ADR-240: Inject save context (entityType/floorId/purpose) from Wizard import */
  setSaveContext?: (ctx: DxfSaveContext | null) => void;
  /** 🪜 ADR-358 Phase 8: reactive read of injected save context (for stair persistence projectId scope) */
  saveContext?: DxfSaveContext | null;
  /** 🏢 ENTERPRISE: Persist level→DXF association in Firestore for auto-load on restart */
  linkSceneToLevel: (levelId: string, fileId: string, fileName: string) => Promise<void>;

  // Import wizard - inherits from shared interface
  completeImport: () => FloorplanDoc | null;

  // Settings
  updateSettings: (settings: Partial<LevelSystemSettings>) => void;
  resetSettings: () => void;

  // Utility operations
  validateLevelName: (name: string) => string | null;
  exportLevelsData: () => { levels: Level[]; floorplans: Record<string, FloorplanDoc>; settings: LevelSystemSettings; version: string; timestamp: number };
  importLevelsData: (data: unknown) => Promise<void>;
}

export interface LevelsHookReturn extends LevelSystemState, LevelSystemActions {}

// ============================================================================
// 🏢 ENTERPRISE: CONTEXT RE-EXPORT FOR BACKWARD COMPATIBILITY (ADR-125)
// ============================================================================
// Context is now defined in LevelsSystem.tsx (canonical location).
// This re-export ensures existing imports continue to work.
// Pattern: Autodesk/Microsoft/Google enterprise standard
// ============================================================================

// Re-export context from canonical location
export { LevelsContext } from './LevelsSystem';

// Internal reference for hooks (lazy loaded to prevent circular dependency)
let _cachedLevelsContext: React.Context<LevelsHookReturn | null> | null = null;

function getLevelsContext(): React.Context<LevelsHookReturn | null> {
  if (!_cachedLevelsContext) {
     
    const { LevelsContext } = require('./LevelsSystem') as { LevelsContext: React.Context<LevelsHookReturn | null> };
    _cachedLevelsContext = LevelsContext;
  }
  return _cachedLevelsContext;
}

export function useLevels(): LevelsHookReturn {
  const context = useContext(getLevelsContext());
  if (!context) {
    throw new Error('useLevels must be used within LevelsSystem');
  }
  return context;
}

// ADR-371: safe variant for read-only consumers outside LevelsSystem provider.
export function useLevelsOptional(): LevelsHookReturn | null {
  return useContext(getLevelsContext());
}

// Legacy compatibility hooks
export function useLevelManager(): LevelsHookReturn {
  return useLevels();
}

export function useLevelSystem(): LevelsHookReturn {
  return useLevels();
}

// Specialized hooks for specific functionality
export function useLevelOperations() {
  const { 
    addLevel, 
    removeLevel, 
    deleteLevel, 
    clearAllLevels, 
    reorderLevels, 
    renameLevel, 
    toggleLevelVisibility, 
    setDefaultLevel, 
    duplicateLevel, 
    validateLevelName 
  } = useLevels();
  
  return {
    addLevel,
    removeLevel,
    deleteLevel,
    clearAllLevels,
    reorderLevels,
    renameLevel,
    toggleLevelVisibility,
    setDefaultLevel,
    duplicateLevel,
    validateLevelName
  };
}

export function useFloorplanOperations() {
  const { 
    addFloorplan, 
    removeFloorplan, 
    updateFloorplan, 
    getFloorplansForLevel, 
    calibrateFloorplan 
  } = useLevels();
  
  return {
    addFloorplan,
    removeFloorplan,
    updateFloorplan,
    getFloorplansForLevel,
    calibrateFloorplan
  };
}

export function useImportWizard() {
  const {
    importWizard,
    startImportWizard,
    setImportWizardStep,
    setSelectedLevel,
    setUserDrawingUnits,
    setCalibration,
    completeImport,
    cancelImportWizard
  } = useLevels();

  return {
    importWizard,
    startImportWizard,
    setImportWizardStep,
    setSelectedLevel,
    setUserDrawingUnits,
    setCalibration,
    completeImport,
    cancelImportWizard
  };
}

export function useLevelState() {
  const { levels, currentLevelId, floorplans, isLoading, error } = useLevels();
  
  return {
    levels,
    currentLevelId,
    floorplans,
    isLoading,
    error
  };
}

export function useLevelSelection() {
  const { currentLevelId, setCurrentLevel, levels } = useLevels();
  
  const currentLevel = levels.find(l => l.id === currentLevelId) || null;
  
  return {
    currentLevelId,
    currentLevel,
    setCurrentLevel,
    levels
  };
}

export function useLevelSettings() {
  const { settings, updateSettings, resetSettings } = useLevels();
  
  return {
    settings,
    updateSettings,
    resetSettings
  };
}
