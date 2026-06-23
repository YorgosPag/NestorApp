'use client';

/**
 * ADR-408 Εύρος Β #1 — Bridge μεταξύ του contextual MEP radiator ribbon tab και
 * του active `MepRadiatorEntity` params.
 *
 * Mirror του `useRibbonMepManifoldBridge` (selected-entity branch) αλλά λιτότερο:
 * το καλοριφέρ είναι ΤΕΡΜΑΤΙΚΟ — δεν έχει classification (σταθερή ροή supply/
 * return), ούτε outlet count, ούτε διαχείριση δικτύου. Κάθε combobox change
 * δρομολογείται μέσω `UpdateMepRadiatorParamsCommand` (`useCommandHistory().
 * execute`) ώστε η αλλαγή να είναι undoable + geometry/validation να
 * επανυπολογίζονται atomically. `useMepRadiatorPersistence` picks up την αλλαγή
 * μέσω debounced auto-save.
 *
 * ⚠️ Connectors: ΑΝΤΙΘΕΤΑ με τον manifold bridge, ο `UpdateMepRadiatorParamsCommand`
 * ΗΔΗ ξανακάνει seed τους 2 connectors (supply/return) από το `width` μέσα στο
 * `applyPatch`, οπότε ο bridge ΔΕΝ τους προ-υπολογίζει. Επίσης — όπως και το
 * radiator grip path (`commitMepRadiatorGripDrag`) — δεν γίνεται propagation
 * υψομέτρου στους συνδεδεμένους σωλήνες (συνεπής συμπεριφορά· τυχόν host-follow
 * θα μπει ενιαία σε grip + tab σε μελλοντικό follow-up).
 *
 * No-ops για commandKeys εκτός `MEP_RADIATOR_RIBBON_KEYS` ώστε να composeί με τα
 * υπόλοιπα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isMepRadiatorEntity } from '../../../types/entities';
import type {
  MepRadiatorEntity,
  MepRadiatorParams,
} from '../../../bim/types/mep-radiator-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepRadiatorParamsCommand } from '../../../core/commands/entity-commands/UpdateMepRadiatorParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  MEP_RADIATOR_RIBBON_KEYS,
  MEP_RADIATOR_RIBBON_KEYS_ACTIONS,
  isMepRadiatorRibbonKey,
  isMepRadiatorRibbonStringKey,
  isMepRadiatorRibbonReadoutKey,
} from './bridge/mep-radiator-command-keys';
import { useRadiatorSizing } from '../../../hooks/data/useRadiatorSizing';
import {
  DEFAULT_SYSTEM_REGIME_PRESET_ID,
  type SystemRegimePresetId,
} from '../../../bim/thermal/sizing/radiator-sizing-config';
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

export interface UseRibbonMepRadiatorBridgeProps {
  readonly levelManager: LevelManagerLike;
  readonly universalSelection: UniversalSelectionLike;
}

export interface RibbonMepRadiatorBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onAction: (action: string) => void;
}

/** commandKey → numeric `MepRadiatorParams` field. */
const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof MepRadiatorParams>> = {
  [MEP_RADIATOR_RIBBON_KEYS.params.width]: 'width',
  [MEP_RADIATOR_RIBBON_KEYS.params.length]: 'length',
  [MEP_RADIATOR_RIBBON_KEYS.params.bodyHeight]: 'bodyHeightMm',
  [MEP_RADIATOR_RIBBON_KEYS.params.mountingElevation]: 'mountingElevationMm',
  [MEP_RADIATOR_RIBBON_KEYS.params.connectorDiameter]: 'connectorDiameterMm',
  [MEP_RADIATOR_RIBBON_KEYS.params.thermalOutput]: 'thermalOutputW',
};

export function useRibbonMepRadiatorBridge(
  props: UseRibbonMepRadiatorBridgeProps,
): RibbonMepRadiatorBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveRadiator = useCallback((): MepRadiatorEntity | null => {
    const id = universalSelection.getPrimaryId();
    if (!id || !levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene) return null;
    const e = scene.entities.find((x) => x.id === id);
    if (!e || !isMepRadiatorEntity(e)) return null;
    return e;
  }, [levelManager, universalSelection]);

  // ADR-422 L2 — sizing read-model for the selected radiator. Computed only when a
  // radiator is selected (contextual tab active). Reuses the L1 heat-load SSoT.
  const selectedRadiator = resolveRadiator();
  const scene = levelManager.currentLevelId
    ? levelManager.getLevelScene(levelManager.currentLevelId)
    : null;
  const sizing = useRadiatorSizing(scene, !!selectedRadiator);

  /**
   * Dispatch the params patch through `UpdateMepRadiatorParamsCommand`. The
   * command re-seeds the two connectors from `width` itself, so the bridge does
   * not pre-build them (≠ manifold bridge).
   */
  const dispatchParams = useCallback(
    (radiator: MepRadiatorEntity, nextParams: MepRadiatorParams): void => {
      if (!levelManager.currentLevelId) return;
      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      executeCommand(
        new UpdateMepRadiatorParamsCommand(radiator.id, nextParams, radiator.params, sm, false),
      );
    },
    [executeCommand, levelManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      const radiator = resolveRadiator();
      if (!radiator) return null;

      // ADR-422 L2 — ΔΤ regime selector (editable). Effective value (default if unset).
      if (isMepRadiatorRibbonStringKey(commandKey)) {
        return {
          value: radiator.params.systemRegimePreset ?? DEFAULT_SYSTEM_REGIME_PRESET_ID,
          options: [],
        };
      }

      // ADR-422 L2 — derived sizing readouts (read-only).
      if (isMepRadiatorRibbonReadoutKey(commandKey)) {
        const r = sizing.get(radiator.id);
        if (!r) return { value: '—', options: [], disabled: true };
        if (commandKey === MEP_RADIATOR_RIBBON_KEYS.readouts.requiredOutputW) {
          return { value: `${Math.round(r.requiredNominalW).toLocaleString('el-GR')} W`, options: [], disabled: true };
        }
        if (commandKey === MEP_RADIATOR_RIBBON_KEYS.readouts.correctionFactor) {
          return { value: `×${r.correctionFactor.toFixed(2)}`, options: [], disabled: true };
        }
        const label =
          r.adequate === null
            ? '—'
            : t(r.adequate
                ? 'ribbon.commands.mepRadiatorEditor.adequate'
                : 'ribbon.commands.mepRadiatorEditor.inadequate');
        return { value: label, options: [], disabled: true };
      }

      if (!isMepRadiatorRibbonKey(commandKey)) return null;
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const raw = radiator.params[field];
      // `thermalOutputW` is optional — absent ⇒ blank combobox (unspecified).
      if (typeof raw !== 'number') return null;
      return { value: String(Math.round(raw)), options: [] };
    },
    [resolveRadiator, sizing, t],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      const radiator = resolveRadiator();
      if (!radiator) return;

      // ADR-422 L2 — regime write (per-radiator override, undoable via command).
      if (isMepRadiatorRibbonStringKey(commandKey)) {
        const nextParams: MepRadiatorParams = {
          ...radiator.params,
          systemRegimePreset: value as SystemRegimePresetId,
        };
        dispatchParams(radiator, nextParams);
        return;
      }

      if (!isMepRadiatorRibbonKey(commandKey)) return;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const nextParams = { ...radiator.params, [field]: numeric } as MepRadiatorParams;
      dispatchParams(radiator, nextParams);
    },
    [resolveRadiator, dispatchParams],
  );

  const onAction = useCallback(
    (action: string): void => {
      // ADR-363 — «Κλείσιμο» handled centrally in routeRibbonAction (single SSoT).
      if (action !== MEP_RADIATOR_RIBBON_KEYS_ACTIONS.delete) return;
      const radiator = resolveRadiator();
      if (!radiator) return;
      const confirmed = window.confirm(t('ribbon.commands.mepRadiatorEditor.deleteConfirm'));
      if (!confirmed) return;
      EventBus.emit('bim:mep-radiator-delete-requested', { radiatorId: radiator.id });
    },
    [resolveRadiator, universalSelection, t],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onAction }),
    [onComboboxChange, getComboboxState, onAction],
  );
}
