'use client';
import { useState } from 'react';
import type { ImportWizardState, CalibrationData, FloorplanDoc, Level, ImportWizardActions as SharedImportWizardActions } from '../../systems/levels';
import { LevelOperations, FloorplanOperations } from '../../systems/levels';

const createInitialWizardState = (): ImportWizardState => ({
  step: 'level',
  file: undefined,
  selectedLevelId: undefined,
  newLevelName: undefined,
  calibration: undefined,
  floorplan: undefined
});

export interface ImportWizardActions extends SharedImportWizardActions {
  importWizard: ImportWizardState;
  completeImport: (
    levels: Level[],
    floorplans: Record<string, FloorplanDoc>
  ) => {
    updatedLevels: Level[];
    updatedFloorplans: Record<string, FloorplanDoc>;
    floorplan: FloorplanDoc | null;
    levelId: string | null;
  } | null;
  cancelImportWizard: () => void;
  validateImportData: () => string | null;
}

export function useImportWizard(): ImportWizardActions {
  const [importWizard, setImportWizard] = useState<ImportWizardState>(createInitialWizardState);

  const startImportWizard = (file: File) => {

    setImportWizard({ 
      step: 'level', 
      file,
      selectedLevelId: undefined,
      newLevelName: undefined,
      calibration: undefined,
      floorplan: undefined
    });
  };

  const setImportWizardStep = (step: ImportWizardState['step']) => {
    setImportWizard(prev => ({ ...prev, step }));
  };

  const setSelectedLevel = (levelId?: string, newLevelName?: string) => {

    setImportWizard(prev => ({
      ...prev,
      selectedLevelId: levelId,
      newLevelName: newLevelName
    }));
  };

  const setCalibration = (calibration: CalibrationData) => {
    setImportWizard(prev => ({ ...prev, calibration }));
  };

  const validateImportData = (): string | null => {
    const { file, selectedLevelId, newLevelName } = importWizard;
    
    if (!file) {
      return 'Δεν έχει επιλεγεί αρχείο';
    }
    
    if (!selectedLevelId && !newLevelName) {
      return 'Δεν έχει επιλεγεί ή δημιουργηθεί επίπεδο';
    }
    
    if (newLevelName && !newLevelName.trim()) {
      return 'Το όνομα του νέου επιπέδου δεν μπορεί να είναι κενό';
    }
    
    return null;
  };

  const completeImport = (
    levels: Level[],
    floorplans: Record<string, FloorplanDoc>
  ) => {
    const { file, selectedLevelId, newLevelName, calibration } = importWizard;

    const validationError = validateImportData();
    if (validationError) {

      return null;
    }

    let updatedLevels = levels;
    let levelId = selectedLevelId;

    // Create new level if needed
    if (!levelId && newLevelName) {
      const validationError = LevelOperations.validateLevelName(newLevelName, levels);
      if (validationError) {

        return null;
      }

      const result = LevelOperations.addLevel(levels, newLevelName, false);
      updatedLevels = result.levels;
      levelId = result.newLevelId;
    }

    if (!levelId || !file) return null;

    // Create floorplan
    const floorplanData = FloorplanOperations.createFloorplan(
      levelId,
      file.name,
      file.name.replace('.dxf', '')
    );

    // Apply calibration if available
    if (calibration) {
      floorplanData.units = calibration.units;
      floorplanData.calibrated = true;
      // Additional transform logic could be applied here
    }

    const { floorplans: updatedFloorplans, floorplanId } = 
      FloorplanOperations.addFloorplan(floorplans, floorplanData);

    const floorplan = updatedFloorplans[floorplanId];

    // Reset wizard state
    setImportWizard(createInitialWizardState());

    return {
      updatedLevels,
      updatedFloorplans,
      floorplan,
      levelId
    };
  };

  const cancelImportWizard = () => {

    setImportWizard(createInitialWizardState());
  };

  return {
    importWizard,
    startImportWizard,
    setImportWizardStep,
    setSelectedLevel,
    setCalibration,
    completeImport,
    cancelImportWizard,
    validateImportData
  };
}
