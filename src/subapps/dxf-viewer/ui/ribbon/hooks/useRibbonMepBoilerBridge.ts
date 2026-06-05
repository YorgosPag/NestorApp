'use client';

/**
 * ADR-408 Εύρος Β #2 — Bridge μεταξύ του contextual MEP boiler ribbon tab και
 * του active `MepBoilerEntity` params.
 *
 * Συνδυάζει:
 *   - `useRibbonMepRadiatorBridge` (combobox/action pattern): το καλοριφέρ και ο
 *     λέβητας μοιράζονται τον ίδιο παραμετρικό σκελετό (width/length/bodyHeight/
 *     mountingElevation/connectorDiameter/thermalOutput + close/delete).
 *   - `useRibbonMepManifoldBridge.getPanelVisibility` (fold-in «Δίκτυο» panel): ο
 *     λέβητας είναι ΥΔΡΟΝΙΚΗ ΠΗΓΗ — μπορεί να τροφοδοτεί δίκτυο σωλήνων, οπότε
 *     το «Δίκτυο» panel εμφανίζεται iff ο λέβητας sources ≥1 `MepSystem`.
 *
 * ⚠️ Connectors: Αντίθετα με τον manifold bridge, ο `UpdateMepBoilerParamsCommand`
 * ΗΔΗ ξανακάνει seed τους 2 connectors (supply/return) από το `width` μέσα στο
 * `applyPatch`, οπότε ο bridge ΔΕΝ τους προ-υπολογίζει. Συνεπής με τον radiator.
 *
 * No-ops για commandKeys εκτός `MEP_BOILER_RIBBON_KEYS` ώστε να composeί με τα
 * υπόλοιπα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isMepBoilerEntity } from '../../../types/entities';
import type {
  MepBoilerEntity,
  MepBoilerParams,
} from '../../../bim/types/mep-boiler-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepBoilerParamsCommand } from '../../../core/commands/entity-commands/UpdateMepBoilerParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  MEP_BOILER_RIBBON_KEYS,
  MEP_BOILER_RIBBON_KEYS_ACTIONS,
  MEP_BOILER_RIBBON_VISIBILITY_KEYS,
  isMepBoilerRibbonKey,
  isMepBoilerVisibilityKey,
} from './bridge/mep-boiler-command-keys';
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
  'getPrimaryId' | 'clearAll'
>;

export interface UseRibbonMepBoilerBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonMepBoilerBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

/** commandKey → numeric `MepBoilerParams` field. */
const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof MepBoilerParams>> = {
  [MEP_BOILER_RIBBON_KEYS.params.width]: 'width',
  [MEP_BOILER_RIBBON_KEYS.params.length]: 'length',
  [MEP_BOILER_RIBBON_KEYS.params.bodyHeight]: 'bodyHeightMm',
  [MEP_BOILER_RIBBON_KEYS.params.mountingElevation]: 'mountingElevationMm',
  [MEP_BOILER_RIBBON_KEYS.params.connectorDiameter]: 'connectorDiameterMm',
  [MEP_BOILER_RIBBON_KEYS.params.thermalOutput]: 'thermalOutputW',
};

export function useRibbonMepBoilerBridge(
  props: UseRibbonMepBoilerBridgeProps,
): RibbonMepBoilerBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveBoiler = useCallback((): MepBoilerEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isMepBoilerEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  /**
   * Dispatch the params patch through `UpdateMepBoilerParamsCommand`. The command
   * re-seeds the two connectors from `width` itself (supply/return ports at body
   * ends), so the bridge does not pre-build them (≠ manifold bridge).
   */
  const dispatchParams = useCallback(
    (boiler: MepBoilerEntity, nextParams: MepBoilerParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateMepBoilerParamsCommand(boiler.id, nextParams, boiler.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!isMepBoilerRibbonKey(commandKey)) return null;
      const boiler = resolveBoiler();
      if (!boiler) return null;
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const raw = boiler.params[field];
      // `thermalOutputW` είναι optional — absent ⇒ blank combobox (unspecified).
      if (typeof raw !== 'number') return null;
      return { value: String(Math.round(raw)), options: [] };
    },
    [resolveBoiler],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isMepBoilerRibbonKey(commandKey)) return;
      const boiler = resolveBoiler();
      if (!boiler) return;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const nextParams = { ...boiler.params, [field]: numeric } as MepBoilerParams;
      dispatchParams(boiler, nextParams);
    },
    [resolveBoiler, dispatchParams],
  );

  const onAction = useCallback(
    (action: string): void => {
      if (action === MEP_BOILER_RIBBON_KEYS_ACTIONS.close) {
        universalSelection.clearAll();
        return;
      }
      if (action !== MEP_BOILER_RIBBON_KEYS_ACTIONS.delete) return;
      const boiler = resolveBoiler();
      if (!boiler) return;
      const confirmed = window.confirm(t('ribbon.commands.mepBoilerEditor.deleteConfirm'));
      if (!confirmed) return;
      EventBus.emit('bim:mep-boiler-delete-requested', { boilerId: boiler.id });
    },
    [resolveBoiler, universalSelection, t],
  );

  const getPanelVisibility = useCallback(
    (visibilityKey: string): boolean => {
      if (!isMepBoilerVisibilityKey(visibilityKey)) return true;
      const boiler = resolveBoiler();
      if (!boiler) return false;
      if (visibilityKey === MEP_BOILER_RIBBON_VISIBILITY_KEYS.hasNetwork) {
        // ADR-408 Εύρος Β fold-in — «Δίκτυο» panel εμφανίζεται iff ο λέβητας
        // τροφοδοτεί ≥1 υδρονικό δίκτυο (Revit "System Properties" from the
        // equipment). Mirror του manifold `hasNetwork` panel (ADR-408 Φ13).
        const systems = useMepSystemStore.getState().getSystems();
        return resolveManagedSystems([boiler], systems).length > 0;
      }
      return false;
    },
    [resolveBoiler],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer (panel visibility). */
export function isMepBoilerPanelVisibilityKey(visibilityKey: string): boolean {
  return isMepBoilerVisibilityKey(visibilityKey);
}
