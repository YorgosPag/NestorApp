/**
 * LEVELS SYSTEM - Hooks
 * React hooks for level management functionality
 */

import { useContext, createContext } from 'react';
import type {
  Level,
  FloorplanDoc,
  ImportWizardState, 
  CalibrationData, 
  LevelSystemSettings,
  ImportWizardActions
} from './config';
import type { SceneModel } from '../../types/scene';

export interface LevelSystemState {
  levels: Level[];
  currentLevelId: string | null;
  floorplans: Record<string, FloorplanDoc>;
  importWizard: ImportWizardState;
  settings: LevelSystemSettings;
  isLoading: boolean;
  error: string | null;
}

export interface LevelSystemActions extends ImportWizardActions {
  // Level operations
  addLevel: (name: string, setAsDefault?: boolean) => Promise<string | null>;
  removeLevel: (levelId: string) => Promise<void>;
  deleteLevel: (levelId: string) => Promise<void>;
  clearAllLevels: () => Promise<void>;
  reorderLevels: (levelIds: string[]) => Promise<void>;
  renameLevel: (levelId: string, name: string) => Promise<void>;
  setCurrentLevel: (levelId: string) => void;
  getCurrentLevel: () => { id: string } | null; // ✅ ADD: Required by useOverlayDrawing
  toggleLevelVisibility: (levelId: string) => Promise<void>;
  setDefaultLevel: (levelId: string) => Promise<void>;
  duplicateLevel: (levelId: string, newName?: string) => Promise<string | null>;

  // Floorplan operations
  addFloorplan: (floorplan: Omit<FloorplanDoc, 'id' | 'importedAt'>) => string;
  removeFloorplan: (floorplanId: string) => void;
  updateFloorplan: (floorplanId: string, updates: Partial<FloorplanDoc>) => void;
  getFloorplansForLevel: (levelId: string) => FloorplanDoc[];
  calibrateFloorplan: (floorplanId: string, calibration: CalibrationData) => void;

  // Scene management
  setLevelScene: (levelId: string, scene: SceneModel) => void;
  getLevelScene: (levelId: string) => SceneModel | null;
  clearLevelScene: (levelId: string) => void;
  
  // Auto-save functionality
  setCurrentFileName?: (fileName: string | null) => void;
  getCurrentFileName?: () => string | null;
  setAutoSaveEnabled?: (enabled: boolean) => void;
  getAutoSaveStatus?: () => { lastSaveTime: Date | null; saveStatus: string };

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

// Create context directly here - will be used by LevelsSystem
export const LevelsContext = createContext<LevelsHookReturn | null>(null);

export function useLevels(): LevelsHookReturn {
  const context = useContext(LevelsContext);
  if (!context) {
    throw new Error('useLevels must be used within LevelsSystem');
  }
  return context;
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
    setCalibration, 
    completeImport, 
    cancelImportWizard 
  } = useLevels();
  
  return {
    importWizard,
    startImportWizard,
    setImportWizardStep,
    setSelectedLevel,
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