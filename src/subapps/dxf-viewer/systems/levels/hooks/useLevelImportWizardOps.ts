'use client';
import { useCallback } from 'react';
import type { Level, FloorplanDoc, ImportWizardState, CalibrationData } from '../config';
import { DEFAULT_IMPORT_WIZARD_STATE } from '../LevelsSystem.types';
import type { SceneUnits } from '../../../utils/scene-units';
import { useImportWizard } from '../../../hooks/common/useImportWizard';

interface UseLevelImportWizardOpsParams {
  levels: Level[];
  floorplans: Record<string, FloorplanDoc>;
  setLevels: React.Dispatch<React.SetStateAction<Level[]>>;
  setFloorplans: React.Dispatch<React.SetStateAction<Record<string, FloorplanDoc>>>;
  setCurrentLevelId: React.Dispatch<React.SetStateAction<string | null>>;
  setImportWizard: React.Dispatch<React.SetStateAction<ImportWizardState>>;
}

export interface LevelImportWizardOps {
  startImportWizard: (file: File) => void;
  setImportWizardStep: (step: ImportWizardState['step']) => void;
  setSelectedLevel: (levelId?: string, newLevelName?: string) => void;
  setUserDrawingUnits: (units: SceneUnits | 'auto') => void;
  setCalibration: (calibration: CalibrationData) => void;
  completeImport: () => FloorplanDoc | null;
  cancelImportWizard: () => void;
}

/**
 * 🏢 ENTERPRISE: Import-wizard operations for the Levels system.
 *
 * Extracted from `LevelsSystem.tsx` (SRP / file-size limit, N.7.1). Wraps the
 * shared `useImportWizard` hook and mirrors each step into the local
 * `importWizard` UI state so the wizard stays the single source of truth for
 * the in-progress import.
 */
export function useLevelImportWizardOps({
  levels,
  floorplans,
  setLevels,
  setFloorplans,
  setCurrentLevelId,
  setImportWizard,
}: UseLevelImportWizardOpsParams): LevelImportWizardOps {
  const importWizardHook = useImportWizard();

  const startImportWizard = useCallback(
    (file: File) => {
      setImportWizard(prev => ({ ...prev, file, step: 'level' }));
      importWizardHook.startImportWizard(file);
    },
    [importWizardHook, setImportWizard]
  );

  const setImportWizardStep = useCallback(
    (step: ImportWizardState['step']) => {
      setImportWizard(prev => ({ ...prev, step }));
      importWizardHook.setImportWizardStep(step);
    },
    [importWizardHook, setImportWizard]
  );

  const setSelectedLevel = useCallback(
    (levelId?: string, newLevelName?: string) => {
      setImportWizard(prev => ({ ...prev, selectedLevelId: levelId, newLevelName }));
      importWizardHook.setSelectedLevel(levelId, newLevelName);
    },
    [importWizardHook, setImportWizard]
  );

  const setUserDrawingUnits = useCallback(
    (units: SceneUnits | 'auto') => {
      setImportWizard(prev => ({ ...prev, userDrawingUnits: units }));
      importWizardHook.setUserDrawingUnits?.(units);
    },
    [importWizardHook, setImportWizard]
  );

  const setCalibration = useCallback(
    (calibration: CalibrationData) => {
      setImportWizard(prev => ({ ...prev, calibration }));
      importWizardHook.setCalibration(calibration);
    },
    [importWizardHook, setImportWizard]
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
  }, [importWizardHook, levels, floorplans, setLevels, setFloorplans, setCurrentLevelId, setImportWizard]);

  const cancelImportWizard = useCallback(() => {
    setImportWizard(DEFAULT_IMPORT_WIZARD_STATE);
    importWizardHook.cancelImportWizard();
  }, [importWizardHook, setImportWizard]);

  return {
    startImportWizard,
    setImportWizardStep,
    setSelectedLevel,
    setUserDrawingUnits,
    setCalibration,
    completeImport,
    cancelImportWizard,
  };
}
