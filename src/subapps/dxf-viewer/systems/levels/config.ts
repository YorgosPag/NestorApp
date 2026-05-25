/**
 * LEVELS SYSTEM - Configuration
 * Types, interfaces, and configuration for level management
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { BimRenderSettings } from '../../config/bim-render-settings-types';

/** 🏢 ADR-309 Phase 3: Context-aware floorplan type — set by wizard on import */
export type FloorplanType = 'project' | 'building' | 'floor' | 'unit';

export interface Level {
  id: string;
  name: string;
  order: number;
  isDefault: boolean;
  visible: boolean;
  floorId?: string;    // Σύνδεση με building floor (ADR-237, SPEC-237A)
  buildingId?: string; // Building ID del piano collegato — derivato al link-time (ADR-237)
  /** 🏢 ENTERPRISE: Persistent link to cadFiles/files document ID for scene auto-load */
  sceneFileId?: string;
  /** 🏢 ENTERPRISE: Original filename for display in Levels panel */
  sceneFileName?: string;
  /** 🏢 ADR-309 Phase 3: Type of floorplan — drives context-aware title in LevelPanel */
  floorplanType?: FloorplanType;
  /** 🏢 ADR-309 Phase 3: Human-readable entity label (e.g. "Κτίριο Α", "1ος Όροφος") */
  entityLabel?: string;
  /** 🏢 ADR-309 Phase 3: Project ID — set by wizard on import */
  projectId?: string;
  /** ADR-375 Phase B.2: per-view BIM render settings (Revit ViewPlan equivalent). */
  bimRenderSettings?: BimRenderSettings;
  /** ADR-375 Phase B.3: FK → dxf_viewer_view_templates. When set, signals that
   *  bimRenderSettings is a snapshot of the linked template; edits to the
   *  template are fanned out to all levels with the same FK. */
  appliedViewTemplateId?: string | null;
}

export interface FloorplanDoc {
  id: string;
  levelId: string;
  name: string;
  fileName: string;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  /**
   * ADR-368 — user-specified drawing coordinate units. When set, overrides
   * the DXF $INSUNITS declaration and resolveSceneUnits() heuristic so that
   * Greek DXF files (declared mm, actual meters) render dimensions correctly
   * without any patch-chain heuristics. Absent = auto-detect (legacy path).
   */
  userDrawingUnits?: SceneUnits;
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
  step: 'level' | 'units' | 'calibration' | 'preview' | 'complete';
  file?: File;
  selectedLevelId?: string;
  newLevelName?: string;
  /** ADR-368 — 'auto' = use resolveSceneUnits() heuristic; explicit value overrides. */
  userDrawingUnits?: SceneUnits | 'auto';
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
  firebaseCollection: 'dxf_viewer_levels',
  defaultLevels: [
    { name: 'Επίπεδο 1', order: 0, isDefault: true, visible: true },
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
  /** ADR-368 — set drawing-coordinate unit override from the wizard units step. */
  setUserDrawingUnits?: (units: SceneUnits | 'auto') => void;
  setCalibration: (calibration: CalibrationData) => void;
  cancelImportWizard?: () => void;
}
