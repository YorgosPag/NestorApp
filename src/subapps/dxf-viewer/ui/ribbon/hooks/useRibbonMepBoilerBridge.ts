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
import { isMepBoilerEntity, isThermalSpaceEntity } from '../../../types/entities';
import type {
  MepBoilerEntity,
  MepBoilerParams,
} from '../../../bim/types/mep-boiler-types';
import {
  listBoilerModels,
  resolveBoilerModel,
  applyBoilerModelToParams,
  clearBoilerModel,
} from '../../../bim/mep-boilers/boiler-model-catalog';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import { useCommandHistory } from '../../../core/commands';
import { UpdateMepBoilerParamsCommand } from '../../../core/commands/entity-commands/UpdateMepBoilerParamsCommand';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  MEP_BOILER_RIBBON_KEYS,
  MEP_BOILER_RIBBON_KEYS_ACTIONS,
  MEP_BOILER_RIBBON_VISIBILITY_KEYS,
  isMepBoilerRibbonKey,
  isMepBoilerReadoutKey,
  isMepBoilerRibbonStringKey,
  isMepBoilerVisibilityKey,
} from './bridge/mep-boiler-command-keys';
import { EventBus } from '../../../systems/events/EventBus';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import { resolveManagedSystems } from '../../../bim/mep-systems/mep-circuit-editor';
import { useSpaceHeatLoads } from '../../../hooks/data/useSpaceHeatLoads';
import {
  computeHeatingEquipmentSizing,
  type HeatingEquipmentSizingStatus,
} from '../../../bim/thermal/heating-equipment-sizing';
import {
  resolveSourceServedSpaces,
  sumServedHeatLoadW,
} from '../../../bim/thermal/resolve-source-served-spaces';
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

  // ADR-422 L2 — sizing readout (Revit «Heating Loads → Equipment»). Computed only
  // when a boiler is selected (the contextual tab is active). Required output =
  // ΣΦ of the spaces served by the boiler's hydronic network × pickup factor, with
  // a floor-total fallback when the boiler sources no network yet. Reuses the same
  // SSoT heat-load inputs as the analytical overlay (low-freq, ADR-040-safe).
  const selectedBoiler = resolveBoiler();
  const scene = levelManager.currentLevelId
    ? levelManager.getLevelScene(levelManager.currentLevelId)
    : null;
  const heatLoads = useSpaceHeatLoads(scene, !!selectedBoiler);

  const sizing = useMemo(() => {
    if (!selectedBoiler) return null;
    const systems = useMepSystemStore.getState().getSystems();
    const sceneEntities = scene?.entities ?? [];
    const spaces = sceneEntities.filter(isThermalSpaceEntity);
    const served = resolveSourceServedSpaces(selectedBoiler, systems, sceneEntities, spaces);
    const requiredLoadW =
      served.length > 0 && heatLoads
        ? sumServedHeatLoadW(served, heatLoads)
        : heatLoads?.totalW ?? 0;
    return computeHeatingEquipmentSizing({
      requiredLoadW,
      installedW: selectedBoiler.params.thermalOutputW,
    });
  }, [selectedBoiler, scene, heatLoads]);

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
      // ADR-422 L2 — read-only sizing readouts (disabled combobox). Resolved before
      // the editable-key guard so they don't fall through to the params path.
      if (isMepBoilerReadoutKey(commandKey)) {
        if (!sizing) return { value: '—', options: [], disabled: true };
        if (commandKey === MEP_BOILER_RIBBON_KEYS.readouts.adequacyStatus) {
          const status: HeatingEquipmentSizingStatus = sizing.status;
          return {
            value: t(`ribbon.commands.mepBoilerEditor.sizingStatus.${status}`),
            options: [],
            disabled: true,
          };
        }
        const w =
          commandKey === MEP_BOILER_RIBBON_KEYS.readouts.requiredOutputW
            ? sizing.requiredWithMarginW
            : sizing.installedW;
        if (w == null) return { value: '—', options: [], disabled: true };
        const kW = (w / 1000).toLocaleString('el-GR', { maximumFractionDigits: 1 });
        return { value: `${kW} kW`, options: [], disabled: true };
      }
      // ADR-408 Εύρος Β (combi) — «Παραγωγή ΖΝΧ» Yes/No selector. Resolved before the
      // model-picker branch (both are string keys). Mirror of the wall `flip` Yes/No
      // combobox; «Ναι» → producesDhw=true → a third DHW out connector is seeded.
      if (commandKey === MEP_BOILER_RIBBON_KEYS.stringParams.producesDhw) {
        const boiler = resolveBoiler();
        if (!boiler) return null;
        return {
          value: boiler.params.producesDhw ? 'true' : 'false',
          options: [
            { value: 'false', labelKey: 'ribbon.commands.mepBoilerEditor.producesDhwNo', isLiteralLabel: false },
            { value: 'true', labelKey: 'ribbon.commands.mepBoilerEditor.producesDhwYes', isLiteralLabel: false },
          ],
        };
      }
      // ADR-408 Type Catalog — model picker (string commandKey branch).
      // Returns dynamic options from BOILER_MODEL_CATALOG + the clear («Παραμετρικό»)
      // sentinel. Pattern mirrors the fixture assetId branch (ADR-411).
      if (isMepBoilerRibbonStringKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return null;
        return {
          value: boiler.params.modelId ?? SELECT_CLEAR_VALUE,
          options: [
            {
              value: SELECT_CLEAR_VALUE,
              labelKey: 'ribbon.commands.mepBoilerEditor.modelCustom',
              isLiteralLabel: false,
            },
            ...listBoilerModels().map((m) => ({
              value: m.id,
              labelKey: m.labelKey,
              isLiteralLabel: true,
            })),
          ],
        };
      }
      if (!isMepBoilerRibbonKey(commandKey)) return null;
      const boiler = resolveBoiler();
      if (!boiler) return null;
      const field = NUMBER_KEY_TO_FIELD[commandKey];
      const raw = boiler.params[field];
      // `thermalOutputW` είναι optional — absent ⇒ blank combobox (unspecified).
      if (typeof raw !== 'number') return null;
      return { value: String(Math.round(raw)), options: [] };
    },
    [resolveBoiler, sizing, t],
  );

  const onComboboxChange = useCallback(
    (commandKey: string, value: string): void => {
      // ADR-408 Εύρος Β (combi) — «Παραγωγή ΖΝΧ» Yes/No selector (string; before the
      // model-picker + numeric guards). Toggling re-seeds connectors via the command
      // (applyPatch → buildBoilerConnectors reads producesDhw → adds/removes DHW outlet).
      if (commandKey === MEP_BOILER_RIBBON_KEYS.stringParams.producesDhw) {
        const boiler = resolveBoiler();
        if (!boiler) return;
        dispatchParams(boiler, { ...boiler.params, producesDhw: value === 'true' });
        return;
      }
      // ADR-408 Type Catalog — model picker branch (string; must run before the
      // numeric guard which would otherwise discard it).
      if (isMepBoilerRibbonStringKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return;
        if (isSelectClearValue(value)) {
          dispatchParams(boiler, clearBoilerModel(boiler.params));
        } else {
          const m = resolveBoilerModel(value);
          if (m) {
            dispatchParams(boiler, applyBoilerModelToParams(boiler.params, m));
          }
        }
        return;
      }
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
