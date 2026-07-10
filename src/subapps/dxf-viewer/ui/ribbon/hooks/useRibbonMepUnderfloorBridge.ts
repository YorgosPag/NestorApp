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

import { useCallback } from 'react';
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
import {
  MEP_UNDERFLOOR_RIBBON_KEYS,
  MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS,
  MEP_UNDERFLOOR_RIBBON_VISIBILITY_KEYS,
  isMepUnderfloorRibbonKey,
  isMepUnderfloorNumberKey,
  isMepUnderfloorVisibilityKey,
} from './bridge/mep-underfloor-command-keys';
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

export interface UseRibbonMepUnderfloorBridgeProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: PrimaryIdSelection;
}

export type RibbonMepUnderfloorBridge = RibbonEntityBridgeCoreNoToggles;

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

  const resolveUnderfloor = useResolveSelectedEntity(levelManager, universalSelection, isMepUnderfloorEntity);
  const buildSceneManager = useActiveSceneManager(levelManager);

  /**
   * Dispatch the params patch through `UpdateMepUnderfloorParamsCommand`. The two
   * entry connectors are derived from the footprint + spacing, so rebuild them via
   * `buildUnderfloorConnectors` before dispatch (the command recomputes geometry only).
   */
  const dispatchParams = useCallback(
    (underfloor: MepUnderfloorEntity, nextParams: MepUnderfloorParams): void => {
      const sm = buildSceneManager();
      if (!sm) return;
      const withConnectors: MepUnderfloorParams = {
        ...nextParams,
        connectors: buildUnderfloorConnectors(nextParams),
      };
      executeCommand(
        new UpdateMepUnderfloorParamsCommand(underfloor.id, withConnectors, underfloor.params, sm, false),
      );
    },
    [executeCommand, buildSceneManager],
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

      // `thermalOutputW` is optional — absent ⇒ blank combobox (unspecified).
      return readNumericParamState(underfloor.params, commandKey, NUMBER_KEY_TO_FIELD);
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

  // Fold-in «Δίκτυο» panel shows iff the loop is a member of ≥1 hydronic network
  // (Revit "System Properties" from the terminal). Mirror of the boiler/manifold
  // `hasNetwork` panel (ADR-408 Φ13).
  const getPanelVisibility = useManagedNetworkVisibility(
    resolveUnderfloor,
    isMepUnderfloorVisibilityKey,
    MEP_UNDERFLOOR_RIBBON_VISIBILITY_KEYS.hasNetwork,
  );

  return useStableBridge({ onComboboxChange, getComboboxState, onAction, getPanelVisibility });
}

/** Type guard used by `useRibbonCommands` composer (panel visibility). */
export function isMepUnderfloorPanelVisibilityKey(visibilityKey: string): boolean {
  return isMepUnderfloorVisibilityKey(visibilityKey);
}
