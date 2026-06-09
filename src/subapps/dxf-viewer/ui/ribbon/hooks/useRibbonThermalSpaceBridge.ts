'use client';

/**
 * ADR-422 L0 — Bridge μεταξύ contextual Thermal Space ribbon tab και active
 * `ThermalSpaceEntity` params.
 *
 * Mirror του `useRibbonFloorFinishBridge` (ADR-419): read state via
 * `getComboboxState`, write via `onComboboxChange`. Κάθε mutation routes μέσω
 * `UpdateThermalSpaceParamsCommand` (undoable + geometry recompute atomically).
 * `useThermalSpacePersistence` picks up the patched entity (500ms debounce).
 *
 * setpoint/ACH = per-space overrides — εμφανίζεται η EFFECTIVE τιμή (default
 * χρήσης αν δεν υπάρχει override)· η αλλαγή γράφει override (Revit «instance»).
 *
 * No-ops για commandKeys εκτός `THERMAL_SPACE_RIBBON_KEYS` ώστε να composeί
 * με τα υπόλοιπα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isThermalSpaceEntity } from '../../../types/entities';
import type {
  ThermalSpaceEntity,
  ThermalSpaceParams,
  ThermalSpaceUseType,
} from '../../../bim/types/thermal-space-types';
import {
  resolveThermalSpaceSetpointC,
  resolveThermalSpaceAch,
} from '../../../bim/thermal/thermal-space-use-catalog';
import {
  DEFAULT_REHEAT_MODE,
  DEFAULT_THERMAL_BRIDGE_LEVEL,
  type ReheatMode,
  type ThermalBridgeLevel,
} from '../../../bim/thermal/heat-load/heat-load-config';
import {
  DEFAULT_SOLAR_SHADING_LEVEL,
  type SolarShadingLevel,
} from '../../../bim/thermal/heat-load/annual-gains-config';
import { useCommandHistory } from '../../../core/commands';
import { UpdateThermalSpaceParamsCommand } from '../../../core/commands/entity-commands/UpdateThermalSpaceParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  THERMAL_SPACE_RIBBON_KEYS,
  isThermalSpaceRibbonNumberKey,
  isThermalSpaceRibbonStringKey,
  isThermalSpaceRibbonActionKey,
  isThermalSpaceRibbonReadoutKey,
} from './bridge/thermal-space-command-keys';
import { useSpaceHeatLoads } from '../../../hooks/data/useSpaceHeatLoads';
import { EventBus } from '../../../systems/events/EventBus';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import type { useLevels } from '../../../systems/levels';
import type { useUniversalSelection } from '../../../systems/selection';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getPrimaryId'
>;

export interface UseRibbonThermalSpaceBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonThermalSpaceBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onAction: (action: string) => void;
}

export function useRibbonThermalSpaceBridge(
  props: UseRibbonThermalSpaceBridgeProps,
): RibbonThermalSpaceBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveThermalSpace = useCallback((): ThermalSpaceEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isThermalSpaceEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  // ADR-422 L1 — heat-load readout for the selected space. Computed only when a
  // thermal space is selected (the contextual tab is active). Reuses the same
  // SSoT input-gathering as the analytical overlay.
  const selectedSpace = resolveThermalSpace();
  const scene = levelManager.currentLevelId
    ? levelManager.getLevelScene(levelManager.currentLevelId)
    : null;
  const heatLoads = useSpaceHeatLoads(scene, !!selectedSpace);

  const dispatchParams = useCallback(
    (ts: ThermalSpaceEntity, nextParams: ThermalSpaceParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateThermalSpaceParamsCommand(ts.id, nextParams, ts.params, sm, false),
      );
      EventBus.emit('bim:thermal-space-params-updated', { thermalSpaceId: ts.id });
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const ts = resolveThermalSpace();
      if (!ts) return null;
      if (isThermalSpaceRibbonReadoutKey(commandKey)) {
        const result = heatLoads?.results.get(ts.id) ?? null;
        if (!result) return { value: '—', options: [], disabled: true };
        const value =
          commandKey === THERMAL_SPACE_RIBBON_KEYS.readouts.heatLoadTotalW
            ? `${Math.round(result.totalW).toLocaleString('el-GR')} W`
            : `${Math.round(result.specificLoadWperM2).toLocaleString('el-GR')} W/m²`;
        return { value, options: [], disabled: true };
      }
      if (isThermalSpaceRibbonStringKey(commandKey)) {
        if (commandKey === THERMAL_SPACE_RIBBON_KEYS.stringParams.thermalBridgeLevel) {
          return { value: ts.params.thermalBridgeLevel ?? DEFAULT_THERMAL_BRIDGE_LEVEL, options: [] };
        }
        if (commandKey === THERMAL_SPACE_RIBBON_KEYS.stringParams.reheatMode) {
          return { value: ts.params.reheatMode ?? DEFAULT_REHEAT_MODE, options: [] };
        }
        if (commandKey === THERMAL_SPACE_RIBBON_KEYS.stringParams.solarShadingLevel) {
          return { value: ts.params.solarShadingLevel ?? DEFAULT_SOLAR_SHADING_LEVEL, options: [] };
        }
        return { value: ts.params.useType, options: [] };
      }
      if (isThermalSpaceRibbonNumberKey(commandKey)) {
        if (commandKey === THERMAL_SPACE_RIBBON_KEYS.params.setpointTempC) {
          return { value: String(resolveThermalSpaceSetpointC(ts.params)), options: [] };
        }
        if (commandKey === THERMAL_SPACE_RIBBON_KEYS.params.airChangesPerHour) {
          return { value: String(resolveThermalSpaceAch(ts.params)), options: [] };
        }
        return { value: String(Math.round(ts.params.ceilingHeightMm)), options: [] };
      }
      return null;
    },
    [resolveThermalSpace, heatLoads],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const ts = resolveThermalSpace();
      if (!ts) return;

      if (isThermalSpaceRibbonStringKey(commandKey)) {
        if (commandKey === THERMAL_SPACE_RIBBON_KEYS.stringParams.thermalBridgeLevel) {
          dispatchParams(ts, { ...ts.params, thermalBridgeLevel: value as ThermalBridgeLevel });
          return;
        }
        if (commandKey === THERMAL_SPACE_RIBBON_KEYS.stringParams.reheatMode) {
          dispatchParams(ts, { ...ts.params, reheatMode: value as ReheatMode });
          return;
        }
        if (commandKey === THERMAL_SPACE_RIBBON_KEYS.stringParams.solarShadingLevel) {
          dispatchParams(ts, { ...ts.params, solarShadingLevel: value as SolarShadingLevel });
          return;
        }
        const nextParams: ThermalSpaceParams = { ...ts.params, useType: value as ThermalSpaceUseType };
        dispatchParams(ts, nextParams);
        return;
      }

      if (isThermalSpaceRibbonNumberKey(commandKey)) {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric) || numeric <= 0) return;
        if (commandKey === THERMAL_SPACE_RIBBON_KEYS.params.setpointTempC) {
          dispatchParams(ts, { ...ts.params, setpointTempC: numeric });
          return;
        }
        if (commandKey === THERMAL_SPACE_RIBBON_KEYS.params.airChangesPerHour) {
          dispatchParams(ts, { ...ts.params, airChangesPerHour: numeric });
          return;
        }
        dispatchParams(ts, { ...ts.params, ceilingHeightMm: numeric });
      }
    },
    [resolveThermalSpace, dispatchParams],
  );

  const onAction = useCallback(
    (action: string): void => {
      if (!isThermalSpaceRibbonActionKey(action)) return;
      if (action === THERMAL_SPACE_RIBBON_KEYS.actions.delete) {
        const ts = resolveThermalSpace();
        if (!ts) return;
        const confirmed = window.confirm(t('ribbon.commands.thermalSpaceEditor.deleteConfirm'));
        if (!confirmed) return;
        EventBus.emit('bim:thermal-space-delete-requested', { id: ts.id });
        return;
      }
      if (action === THERMAL_SPACE_RIBBON_KEYS.actions.close) {
        EventBus.emit('bim:select-none' as Parameters<typeof EventBus.emit>[0], undefined);
      }
    },
    [resolveThermalSpace, t],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onAction }),
    [onComboboxChange, getComboboxState, onAction],
  );
}

/** Type guard — exposed so `useRibbonCommands` can route thermal-space action keys. */
export function isThermalSpaceActionKey(action: string): boolean {
  return isThermalSpaceRibbonActionKey(action);
}
