'use client';

/**
 * ADR-408 DHW — Bridge μεταξύ του contextual MEP water heater ribbon tab και
 * του active `MepWaterHeaterEntity` params.
 *
 * Mirrors `useRibbonMepBoilerBridge` 1:1 with DHW semantics:
 *   - combobox/action pattern: water heater and boiler share the same parametric
 *     skeleton (width/length/bodyHeight/mountingElevation/connectorDiameter/
 *     thermalOutput + close/delete) plus the DHW-specific `tankCapacityL` field.
 *   - fold-in «Δίκτυο» panel: the water heater is a DHW SOURCE — it can source a
 *     domestic-hot-water pipe network, so the «Δίκτυο» panel appears iff the heater
 *     sources ≥1 `MepSystem` (mirror of the boiler `hasNetwork` panel).
 *
 * ⚠️ Connectors: `UpdateMepWaterHeaterParamsCommand` ΗΔΗ ξανακάνει seed τους 2
 * connectors (cold-inlet / hot-outlet) από το `width` μέσα στο `applyPatch`,
 * οπότε ο bridge ΔΕΝ τους προ-υπολογίζει (≠ manifold bridge).
 *
 * No-ops για commandKeys εκτός `MEP_WATER_HEATER_RIBBON_KEYS` ώστε να composeί
 * με τα υπόλοιπα bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  MepWaterHeaterEntity,
  MepWaterHeaterParams,
} from '../../../bim/types/mep-water-heater-types';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepWaterHeaterParamsCommand } from '../../../core/commands/entity-commands/UpdateMepWaterHeaterParamsCommand';
import {
  MEP_WATER_HEATER_RIBBON_KEYS,
  MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS,
  MEP_WATER_HEATER_RIBBON_VISIBILITY_KEYS,
  isMepWaterHeaterRibbonKey,
  isMepWaterHeaterVisibilityKey,
} from './bridge/mep-water-heater-command-keys';
import { EventBus } from '../../../systems/events/EventBus';
import {
  useActiveSceneManager,
  useResolveSelectedEntity,
  useStableBridge,
  readNumericParamState,
  type RibbonComboboxState,
  type LevelSceneWriter,
  type PrimaryIdSelection,
  type RibbonEntityBridgeCoreNoToggles,
} from './ribbon-entity-bridge-shared';
import { useManagedNetworkVisibility } from './ribbon-mep-network-visibility';

export interface UseRibbonMepWaterHeaterBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: PrimaryIdSelection;
}

export type RibbonMepWaterHeaterBridge = RibbonEntityBridgeCoreNoToggles;

/** commandKey → numeric `MepWaterHeaterParams` field. */
const NUMBER_KEY_TO_FIELD: Readonly<Record<string, keyof MepWaterHeaterParams>> = {
  [MEP_WATER_HEATER_RIBBON_KEYS.params.width]: 'width',
  [MEP_WATER_HEATER_RIBBON_KEYS.params.length]: 'length',
  [MEP_WATER_HEATER_RIBBON_KEYS.params.bodyHeight]: 'bodyHeightMm',
  [MEP_WATER_HEATER_RIBBON_KEYS.params.mountingElevation]: 'mountingElevationMm',
  [MEP_WATER_HEATER_RIBBON_KEYS.params.connectorDiameter]: 'connectorDiameterMm',
  [MEP_WATER_HEATER_RIBBON_KEYS.params.thermalOutput]: 'thermalOutputW',
  [MEP_WATER_HEATER_RIBBON_KEYS.params.tankCapacityL]: 'tankCapacityL',
};

/** Inline type guard — avoids a dependency on the central entities.ts (not yet wired). */
function isMepWaterHeaterEntity(entity: unknown): entity is MepWaterHeaterEntity {
  return (
    typeof entity === 'object' &&
    entity !== null &&
    (entity as { type?: string }).type === 'mep-water-heater'
  );
}

export function useRibbonMepWaterHeaterBridge(
  props: UseRibbonMepWaterHeaterBridgeProps,
): RibbonMepWaterHeaterBridge {
  const { levelManager, universalSelection } = props;
  const { execute: executeCommand } = useCommandHistory();
  const { t } = useTranslation('dxf-viewer-shell');

  const resolveWaterHeater = useResolveSelectedEntity(levelManager, universalSelection, isMepWaterHeaterEntity);
  const buildSceneManager = useActiveSceneManager(levelManager);

  /**
   * Dispatch the params patch through `UpdateMepWaterHeaterParamsCommand`. The command
   * re-seeds the two connectors from `width` itself (cold-inlet / hot-outlet ports at
   * body ends), so the bridge does not pre-build them (≠ manifold bridge).
   */
  const dispatchParams = useCallback(
    (waterHeater: MepWaterHeaterEntity, nextParams: MepWaterHeaterParams): void => {
      const sm = buildSceneManager();
      if (!sm) return;
      executeCommand(
        new UpdateMepWaterHeaterParamsCommand(
          waterHeater.id,
          nextParams,
          waterHeater.params,
          sm,
          false,
        ),
      );
    },
    [executeCommand, buildSceneManager],
  );

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!isMepWaterHeaterRibbonKey(commandKey)) return null;
      const waterHeater = resolveWaterHeater();
      if (!waterHeater) return null;
      // `thermalOutputW` and `tankCapacityL` are optional — absent ⇒ blank combobox.
      return readNumericParamState(waterHeater.params, commandKey, NUMBER_KEY_TO_FIELD);
    },
    [resolveWaterHeater],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      if (!isMepWaterHeaterRibbonKey(commandKey)) return;
      const waterHeater = resolveWaterHeater();
      if (!waterHeater) return;
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const nextParams = { ...waterHeater.params, [field]: numeric } as MepWaterHeaterParams;
      dispatchParams(waterHeater, nextParams);
    },
    [resolveWaterHeater, dispatchParams],
  );

  const onAction = useCallback(
    (action: string): void => {
      // ADR-363 — «Κλείσιμο» handled centrally in routeRibbonAction (single SSoT).
      if (action !== MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS.delete) return;
      const waterHeater = resolveWaterHeater();
      if (!waterHeater) return;
      const confirmed = window.confirm(
        t('ribbon.commands.mepWaterHeaterEditor.deleteConfirm'),
      );
      if (!confirmed) return;
      EventBus.emit('bim:mep-water-heater-delete-requested', {
        waterHeaterId: waterHeater.id,
      });
    },
    [resolveWaterHeater, universalSelection, t],
  );

  // ADR-408 DHW fold-in — «Δίκτυο» panel εμφανίζεται iff ο θερμοσίφωνας τροφοδοτεί
  // ≥1 domestic-hot-water δίκτυο. Mirror του boiler `hasNetwork`.
  const getPanelVisibility = useManagedNetworkVisibility(
    resolveWaterHeater,
    isMepWaterHeaterVisibilityKey,
    MEP_WATER_HEATER_RIBBON_VISIBILITY_KEYS.hasNetwork,
  );

  return useStableBridge({ onComboboxChange, getComboboxState, onAction, getPanelVisibility });
}

/** Type guard used by `useRibbonCommands` composer (panel visibility). */
export function isMepWaterHeaterPanelVisibilityKey(visibilityKey: string): boolean {
  return isMepWaterHeaterVisibilityKey(visibilityKey);
}
