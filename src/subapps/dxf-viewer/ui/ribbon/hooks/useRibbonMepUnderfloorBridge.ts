'use client';

/**
 * ADR-408 Εύρος Β #3 — Bridge between the contextual MEP underfloor ribbon tab and
 * the active `MepUnderfloorEntity` params.
 *
 * Mirrors `useRibbonMepBoilerBridge` (combobox/action/visibility pattern), adapted
 * for the area-loop params:
 *   - editable numbers (spacing/clearance/screed/connector/thermal) → dispatched via
 *     `UpdateMepUnderfloorParamsCommand` (undoable);
 *   - `patternType` string selector → same command, string value;
 *   - `totalLength` read-only readout → `getComboboxState` returns the computed
 *     `geometry.totalLengthM`; `onComboboxChange` is a no-op for it.
 *
 * ⚠️ Connectors: unlike the boiler command, `UpdateMepUnderfloorParamsCommand` only
 * recomputes `geometry` (not connectors). Because the two entry connectors are derived
 * from the footprint + spacing (loop-entry points), the bridge rebuilds them via the
 * `buildUnderfloorConnectors` SSoT before dispatch (same posture as the manifold bridge).
 *
 * Returns `null` for commandKeys outside the underfloor key set so it composes with
 * the other bridges in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isMepUnderfloorEntity } from '../../../types/entities';
import type {
  MepUnderfloorEntity,
  MepUnderfloorParams,
  MepUnderfloorPattern,
} from '../../../bim/types/mep-underfloor-types';
import { buildUnderfloorConnectors } from '../../../bim/mep-underfloor/mep-underfloor-geometry';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepUnderfloorParamsCommand } from '../../../core/commands/entity-commands/UpdateMepUnderfloorParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  MEP_UNDERFLOOR_RIBBON_KEYS,
  MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS,
  MEP_UNDERFLOOR_RIBBON_VISIBILITY_KEYS,
  isMepUnderfloorRibbonKey,
  isMepUnderfloorNumberKey,
  isMepUnderfloorVisibilityKey,
} from './bridge/mep-underfloor-command-keys';
import { EventBus } from '../../../systems/events/EventBus';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { resolveManagedSystems } from '../../../bim/mep-systems/mep-circuit-editor';
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

export interface UseRibbonMepUnderfloorBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonMepUnderfloorBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/** Editable numeric commandKey → `MepUnderfloorParams` field. */
const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof MepUnderfloorParams>> = {
  [MEP_UNDERFLOOR_RIBBON_KEYS.params.pipeSpacing]: 'pipeSpacingMm',
  [MEP_UNDERFLOOR_RIBBON_KEYS.params.edgeClearance]: 'edgeClearanceMm',
  [MEP_UNDERFLOOR_RIBBON_KEYS.params.screedOffset]: 'screedOffsetMm',
  [MEP_UNDERFLOOR_RIBBON_KEYS.params.connectorDiameter]: 'connectorDiameterMm',
  [MEP_UNDERFLOOR_RIBBON_KEYS.params.thermalOutput]: 'thermalOutputW',
};

const PATTERN_VALUES: ReadonlySet<string> = new Set<string>([
  'boustrophedon',
  'counterflow-spiral',
  'spiral',
]);

export function useRibbonMepUnderfloorBridge(
  props: UseRibbonMepUnderfloorBridgeProps,
): RibbonMepUnderfloorBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveUnderfloor = useCallback((): MepUnderfloorEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isMepUnderfloorEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch through `UpdateMepUnderfloorParamsCommand`. The two
   * entry connectors are derived from the footprint + spacing, so rebuild them via
   * `buildUnderfloorConnectors` before dispatch (the command recomputes geometry only).
   */
  const dispatchParams = useCallback(
    (underfloor: MepUnderfloorEntity, nextParams: MepUnderfloorParams): void => {
      if (!levelManager.currentLevelId) return;
      const withConnectors: MepUnderfloorParams = {
        ...nextParams,
        connectors: buildUnderfloorConnectors(nextParams),
      };
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateMepUnderfloorParamsCommand(underfloor.id, withConnectors, underfloor.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!isMepUnderfloorRibbonKey(commandKey)) return null;
      const underfloor = resolveUnderfloor();
      if (!underfloor) return null;

      // Read-only computed BOQ pipe length (m, 1-decimal).
      if (commandKey === MEP_UNDERFLOOR_RIBBON_KEYS.params.totalLength) {
        const m = underfloor.geometry?.totalLengthM ?? 0;
        return { value: (Math.round(m * 10) / 10).toFixed(1), options: [] };
      }

      // Serpentine layout pattern (string).
      if (commandKey === MEP_UNDERFLOOR_RIBBON_KEYS.params.patternType) {
        return { value: underfloor.params.patternType, options: [] };
      }

      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const raw = underfloor.params[field];
      // `thermalOutputW` is optional — absent ⇒ blank combobox (unspecified).
      if (typeof raw !== 'number') return null;
      return { value: String(Math.round(raw)), options: [] };
    },
    [resolveUnderfloor],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isMepUnderfloorRibbonKey(commandKey)) return;
      const underfloor = resolveUnderfloor();
      if (!underfloor) return;

      // Read-only readout — never dispatches.
      if (commandKey === MEP_UNDERFLOOR_RIBBON_KEYS.params.totalLength) return;

      if (commandKey === MEP_UNDERFLOOR_RIBBON_KEYS.params.patternType) {
        if (!PATTERN_VALUES.has(value)) return;
        const nextParams = { ...underfloor.params, patternType: value as MepUnderfloorPattern };
        dispatchParams(underfloor, nextParams);
        return;
      }

      if (!isMepUnderfloorNumberKey(commandKey)) return;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const nextParams = { ...underfloor.params, [field]: numeric } as MepUnderfloorParams;
      dispatchParams(underfloor, nextParams);
    },
    [resolveUnderfloor, dispatchParams],
  );

  const onAction = useCallback(
    (action: string): void => {
      // ADR-363 — «Κλείσιμο» handled centrally in routeRibbonAction (single SSoT).
      if (action !== MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS.delete) return;
      const underfloor = resolveUnderfloor();
      if (!underfloor) return;
      const confirmed = window.confirm(t('ribbon.commands.mepUnderfloorEditor.deleteConfirm'));
      if (!confirmed) return;
      EventBus.emit('bim:mep-underfloor-delete-requested', { underfloorId: underfloor.id });
    },
    [resolveUnderfloor, universalSelection, t],
  );

  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (!isMepUnderfloorVisibilityKey(visibilityKey)) return true;
      const underfloor = resolveUnderfloor();
      if (!underfloor) return false;
      if (visibilityKey === MEP_UNDERFLOOR_RIBBON_VISIBILITY_KEYS.hasNetwork) {
        // Fold-in «Δίκτυο» panel shows iff the loop is a member of ≥1 hydronic
        // network (Revit "System Properties" from the terminal). Mirror of the
        // boiler/manifold `hasNetwork` panel (ADR-408 Φ13).
        const systems = useMepSystemStore.getState().getSystems();
        return resolveManagedSystems([underfloor], systems).length > 0;
      }
      return false;
    },
    [resolveUnderfloor],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer (panel visibility). */
export function isMepUnderfloorPanelVisibilityKey(visibilityKey: string): boolean {
  return isMepUnderfloorVisibilityKey(visibilityKey);
}
