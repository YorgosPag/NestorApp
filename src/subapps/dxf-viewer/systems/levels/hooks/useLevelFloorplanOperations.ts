'use client';
import { useCallback, useMemo } from 'react';
import { FloorplanOperations, CalibrationOperations } from '../utils';
import type { FloorplanDoc, CalibrationData } from '../config';

interface UseLevelFloorplanOperationsParams {
  floorplans: Record<string, FloorplanDoc>;
  setFloorplans: React.Dispatch<React.SetStateAction<Record<string, FloorplanDoc>>>;
  onFloorplanAdd?: (floorplan: FloorplanDoc) => void;
  onFloorplanRemove?: (floorplanId: string) => void;
}

export interface LevelFloorplanOperations {
  addFloorplan: (floorplan: Omit<FloorplanDoc, 'id' | 'importedAt'>) => string;
  removeFloorplan: (floorplanId: string) => void;
  updateFloorplan: (floorplanId: string, updates: Partial<FloorplanDoc>) => void;
  getFloorplansForLevel: (levelId: string) => FloorplanDoc[];
  calibrateFloorplan: (floorplanId: string, calibration: CalibrationData) => void;
}

/**
 * 🏢 ENTERPRISE: Floorplan operations for the Levels system.
 *
 * Extracted from `LevelsSystem.tsx` (SRP / file-size limit, N.7.1) — sibling of
 * `useLevelOperations` and `useLevelImportWizardOps`. Owns no state: `floorplans`
 * and its setter are injected, so `LevelsSystem` stays the SSoT.
 *
 * ⚠️ NOT to be confused with `useFloorplanOperations` in `../useLevels.ts` — that
 * one is the **consumer-side** selector (reads these very functions back out of the
 * context). This hook is the **producer**.
 */
export function useLevelFloorplanOperations({
  floorplans,
  setFloorplans,
  onFloorplanAdd,
  onFloorplanRemove,
}: UseLevelFloorplanOperationsParams): LevelFloorplanOperations {
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
    [floorplans, setFloorplans, onFloorplanAdd]
  );

  const removeFloorplan = useCallback(
    (floorplanId: string) => {
      setFloorplans(prev => {
        const updated = FloorplanOperations.removeFloorplan(prev, floorplanId);
        onFloorplanRemove?.(floorplanId);
        return updated;
      });
    },
    [setFloorplans, onFloorplanRemove]
  );

  const updateFloorplan = useCallback(
    (floorplanId: string, updates: Partial<FloorplanDoc>) => {
      setFloorplans(prev => {
        const floorplan = prev[floorplanId];
        if (!floorplan) return prev;

        return {
          ...prev,
          [floorplanId]: { ...floorplan, ...updates },
        };
      });
    },
    [setFloorplans]
  );

  const getFloorplansForLevel = useCallback(
    (levelId: string): FloorplanDoc[] => {
      return FloorplanOperations.getFloorplansForLevel(floorplans, levelId);
    },
    [floorplans]
  );

  const calibrateFloorplan = useCallback(
    (floorplanId: string, calibration: CalibrationData) => {
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
    },
    [setFloorplans]
  );

  // Σταθερό δέμα — βλ. σχόλιο στο `useLevelOperations`.
  return useMemo<LevelFloorplanOperations>(
    () => ({
      addFloorplan,
      removeFloorplan,
      updateFloorplan,
      getFloorplansForLevel,
      calibrateFloorplan,
    }),
    [addFloorplan, removeFloorplan, updateFloorplan, getFloorplansForLevel, calibrateFloorplan],
  );
}
