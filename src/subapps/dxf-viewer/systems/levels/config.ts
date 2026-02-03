/**
 * LEVELS SYSTEM - Configuration
 * Types, interfaces, and configuration for level management
 */

import type { Point2D } from '../../rendering/types/Types';

export interface Level {
  id: string;
  name: string;
  order: number;
  isDefault: boolean;
  visible: boolean;
}

export interface FloorplanDoc {
  id: string;
  levelId: string;
  name: string;
  fileName: string;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  transform: {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
  };
  bbox: {
    min: Point2D;
    max: Point2D;
  };
  importedAt: string;
  calibrated: boolean;
}

export interface CalibrationData {
  point1: {
    screen: Point2D;
    world: Point2D;
  };
  point2: {
    screen: Point2D;
    world: Point2D;
  };
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  realDistance: number;
}

export interface ImportWizardState {
  step: 'level' | 'calibration' | 'preview' | 'complete';
  file?: File;
  selectedLevelId?: string;
  newLevelName?: string;
  calibration?: CalibrationData;
  floorplan?: FloorplanDoc;
}

export interface LevelSystemConfig {
  enableAutoSave: boolean;
  defaultUnits: FloorplanDoc['units'];
  maxLevels: number;
  firebaseCollection: string;
  defaultLevels: Omit<Level, 'id'>[];
}

export const DEFAULT_LEVEL_CONFIG: LevelSystemConfig = {
  enableAutoSave: true,
  defaultUnits: 'mm',
  maxLevels: 50,
  firebaseCollection: 'dxf-viewer-levels',
  defaultLevels: [
    { name: 'Ισόγειο', order: 0, isDefault: true, visible: true },
    { name: '1ος Όροφος', order: 1, isDefault: false, visible: true },
  ],
};

export interface LevelSystemSettings {
  showLevelNumbers: boolean;
  allowLevelReordering: boolean;
  enableLevelDuplication: boolean;
  showFloorplanThumbnails: boolean;
  autoSelectNewLevel: boolean;
}

export const DEFAULT_LEVEL_SETTINGS: LevelSystemSettings = {
  showLevelNumbers: true,
  allowLevelReordering: true,
  enableLevelDuplication: true,
  showFloorplanThumbnails: true,
  autoSelectNewLevel: true,
};

export const LEVELS_EXPORT_VERSION = '1.0' as const;

/**
 * Shared interface for Import Wizard actions to eliminate duplicates
 * Used by both hooks/common/useImportWizard.ts and systems/levels/useLevels.ts
 */
export interface ImportWizardActions {
  startImportWizard: (file: File) => void;
  setImportWizardStep: (step: ImportWizardState['step']) => void;
  setSelectedLevel: (levelId?: string, newLevelName?: string) => void;
  setCalibration: (calibration: CalibrationData) => void;
  cancelImportWizard?: () => void;
}
