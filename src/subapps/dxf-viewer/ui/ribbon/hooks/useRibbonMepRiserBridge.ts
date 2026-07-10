'use client';

/**
 * ADR-408 Φ15 Phase-2 — Bridge between the contextual «Κατακόρυφη Στήλη» ribbon
 * tab and the active MEP riser placement tool (`mepRiserToolBridgeStore`).
 *
 * Drawing-mode ONLY (mirror of `useRibbonMepFixtureLibraryBridge`): the riser is
 * placed via the tool, so the ribbon reads/writes the tool handle. The Revit
 * base/top constraint maps to floors — the base is the **current** floor, the
 * «Έως όροφο» combobox picks the top floor (datum-relative mm via the same SSoT
 * the 3D floor stack uses). «Διάμετρος» drives the DN.
 *
 * No-ops for commandKeys outside `MEP_RISER_*` so it composes with the other
 * bridges in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { mepRiserToolBridgeStore } from './bridge/mep-riser-tool-bridge-store';
import {
  MEP_RISER_RIBBON_KEYS,
  isMepRiserKey,
} from './bridge/mep-riser-command-keys';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import {
  resolveBuildingDatumElevationM,
  resolveFloorDatumRelativeElevationMm,
} from '../../../bim-3d/scene/floor-stack-elevation';
import { DEFAULT_RISER_HEIGHT_MM } from '../../../bim/types/mep-segment-types';
import { useStableBridge } from './ribbon-entity-bridge-shared';

export interface RibbonMepRiserBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
}

/** A building floor resolved to its datum-relative top elevation (mm). */
interface FloorWithMm {
  readonly id: string;
  readonly name: string;
  readonly topMm: number;
}

export function useRibbonMepRiserBridge(): RibbonMepRiserBridge {
  const toolHandle = mepRiserToolBridgeStore.use();
  const isActive = !!toolHandle && toolHandle.isActive;

  // Resolve the current building/floor from the level system (read-only).
  const levelsApi = useLevelsOptional();
  const currentLevel = levelsApi
    ? levelsApi.levels.find((l) => l.id === levelsApi.currentLevelId) ?? null
    : null;
  const buildingId = currentLevel?.buildingId ?? null;
  const currentFloorId = currentLevel?.floorId ?? null;

  // Subscribe to the building's floors only while the tool is active.
  const { floors } = useFloorsByBuilding(buildingId, isActive);

  const datumM = useMemo(() => resolveBuildingDatumElevationM(floors), [floors]);

  const currentFloorBaseMm = useMemo((): number => {
    const cf = floors.find((f) => f.id === currentFloorId);
    if (!cf) return 0; // degenerate — no linked floor → datum.
    return resolveFloorDatumRelativeElevationMm(cf.elevation, datumM);
  }, [floors, currentFloorId, datumM]);

  // Floors strictly above the current one — the valid «Έως όροφο» targets.
  const floorsAbove = useMemo<FloorWithMm[]>(() => {
    return floors
      .map((f) => ({
        id: f.id,
        name: f.name,
        topMm: resolveFloorDatumRelativeElevationMm(f.elevation, datumM),
      }))
      .filter((f) => f.topMm > currentFloorBaseMm);
  }, [floors, datumM, currentFloorBaseMm]);

  // Align the span to the current floor once per activation (Revit base/top
  // default): base = current floor, top = nearest floor above (or +default).
  const initKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isActive) {
      initKeyRef.current = null;
      return;
    }
    if (floors.length === 0) return;
    const key = `${buildingId ?? ''}:${currentFloorId ?? ''}`;
    if (initKeyRef.current === key) return;
    const handle = mepRiserToolBridgeStore.get();
    if (!handle) return;
    const defaultTop = floorsAbove[0]?.topMm ?? currentFloorBaseMm + DEFAULT_RISER_HEIGHT_MM;
    handle.setSpanMm(currentFloorBaseMm, defaultTop);
    initKeyRef.current = key;
  }, [isActive, floors.length, buildingId, currentFloorId, currentFloorBaseMm, floorsAbove]);

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!toolHandle || !toolHandle.isActive) return null;
      if (commandKey === MEP_RISER_RIBBON_KEYS.stringParams.toFloor) {
        const options = floorsAbove.map((f) => ({
          value: f.id,
          labelKey: f.name,
          isLiteralLabel: true,
        }));
        const match = floorsAbove.find((f) => f.topMm === toolHandle.topElevationMm);
        return { value: match?.id ?? null, options };
      }
      if (isMepRiserKey(commandKey)) {
        return { value: String(toolHandle.diameterMm), options: [] };
      }
      return null;
    },
    [toolHandle, floorsAbove],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const handle = mepRiserToolBridgeStore.get();
      if (!handle || !handle.isActive) return;
      if (commandKey === MEP_RISER_RIBBON_KEYS.stringParams.toFloor) {
        const selected = floorsAbove.find((f) => f.id === value);
        if (!selected) return;
        handle.setSpanMm(currentFloorBaseMm, selected.topMm);
        return;
      }
      if (isMepRiserKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return;
        handle.setDiameter(numeric);
      }
    },
    [floorsAbove, currentFloorBaseMm],
  );

  return useStableBridge({ onComboboxChange, getComboboxState });
}
