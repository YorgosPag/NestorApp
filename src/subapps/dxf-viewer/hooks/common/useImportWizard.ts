'use client';
import { useCallback, useMemo, useState } from 'react';
import type { ImportWizardState, CalibrationData, FloorplanDoc, Level, ImportWizardActions as SharedImportWizardActions } from '../../systems/levels';
import type { SceneUnits } from '../../utils/scene-units';
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

  // ⚡ PERF (ribbon/top-bar cascade, profile 2026-06-28) — every method is wrapped
  // in useCallback and the return object in useMemo so this hook is reference-stable
  // across renders. Previously the bare object literal + 9 fresh function literals
  // unconditionally broke the LevelsContext `useMemo` (which threads these 7 wizard
  // callbacks as deps via useLevelImportWizardOps) → `levelManager` changed identity
  // on every LevelsSystem render → all ~40 ribbon bridges churned → the whole Radix
  // ribbon tree (Tooltip ×903) re-rendered. `setImportWizard` is a stable useState
  // setter, so the action callbacks that don't read state carry empty deps.
  const startImportWizard = useCallback((file: File) => {

    setImportWizard({
      step: 'level',
      file,
      selectedLevelId: undefined,
      newLevelName: undefined,
      calibration: undefined,
      floorplan: undefined
    });
  }, []);

  const setImportWizardStep = useCallback((step: ImportWizardState['step']) => {
    setImportWizard(prev => ({ ...prev, step }));
  }, []);

  const setSelectedLevel = useCallback((levelId?: string, newLevelName?: string) => {

    setImportWizard(prev => ({
      ...prev,
      selectedLevelId: levelId,
      newLevelName: newLevelName
    }));
  }, []);

  const setUserDrawingUnits = useCallback((userDrawingUnits: SceneUnits | 'auto') => {
    setImportWizard(prev => ({ ...prev, userDrawingUnits }));
  }, []);

  const setCalibration = useCallback((calibration: CalibrationData) => {
    setImportWizard(prev => ({ ...prev, calibration }));
  }, []);

  const validateImportData = useCallback((): string | null => {
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
  }, [importWizard]);

  const completeImport = useCallback((
    levels: Level[],
    floorplans: Record<string, FloorplanDoc>
  ) => {
    const { file, selectedLevelId, newLevelName, calibration, userDrawingUnits } = importWizard;

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

    // ADR-368 — store user-specified drawing units (overrides resolveSceneUnits heuristic at render time).
    if (userDrawingUnits && userDrawingUnits !== 'auto') {
      floorplanData.userDrawingUnits = userDrawingUnits;
    }

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
  }, [importWizard, validateImportData]);

  const cancelImportWizard = useCallback(() => {

    setImportWizard(createInitialWizardState());
  }, []);

  return useMemo(
    () => ({
      importWizard,
      startImportWizard,
      setImportWizardStep,
      setSelectedLevel,
      setUserDrawingUnits,
      setCalibration,
      completeImport,
      cancelImportWizard,
      validateImportData
    }),
    [
      importWizard,
      startImportWizard,
      setImportWizardStep,
      setSelectedLevel,
      setUserDrawingUnits,
      setCalibration,
      completeImport,
      cancelImportWizard,
      validateImportData
    ],
  );
}
