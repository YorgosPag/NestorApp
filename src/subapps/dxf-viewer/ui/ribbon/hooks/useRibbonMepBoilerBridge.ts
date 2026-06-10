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
  BOILER_RELIEF_PRESSURES_BAR,
  DEFAULT_BOILER_RELIEF_PRESSURE_BAR,
  BOILER_SYSTEM_PRESSURES_BAR,
  DEFAULT_BOILER_SYSTEM_PRESSURE_BAR,
} from '../../../bim/types/mep-boiler-types';
import {
  listBoilerModels,
  resolveBoilerModel,
  applyBoilerModelToParams,
  clearBoilerModel,
  BOILER_FUEL_TYPES,
  isBoilerFuelType,
  MEP_BOILER_MOUNTING_TYPES,
  DEFAULT_BOILER_MOUNTING_TYPE,
  isMepBoilerMountingType,
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
  isMepBoilerFlueTerminationKey,
  isMepBoilerFuelTypeKey,
  isMepBoilerMountingTypeKey,
  isMepBoilerReliefPressureKey,
  isMepBoilerSystemPressureKey,
  isMepBoilerToggleKey,
  isMepBoilerVisibilityKey,
} from './bridge/mep-boiler-command-keys';
import {
  TOGGLE_KEY_TO_FIELD,
  NUMBER_KEY_TO_FIELD,
} from './bridge/mep-boiler-param-maps';
import {
  FLUE_TERMINATION_TYPES,
  DEFAULT_FLUE_TERMINATION,
  isFlueTerminationType,
} from '../../../bim/mep-boilers/boiler-flue-terminal';
import { resolveErpClass } from '../../../bim/mep-boilers/boiler-efficiency';
import { resolveNoxClass } from '../../../bim/mep-boilers/boiler-nox';
import { resolveAcousticBand, type AcousticBand } from '../../../bim/mep-boilers/boiler-acoustics';
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
import type { RibbonComboboxState, RibbonToggleState } from '../context/RibbonCommandContext';
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
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

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
        // ErP energy class — independent of sizing (depends on efficiency + fuelType),
        // so it is resolved BEFORE the sizing guard. Disabled (read-only) combobox.
        if (commandKey === MEP_BOILER_RIBBON_KEYS.readouts.erpClass) {
          const boiler = resolveBoiler();
          const eff = boiler?.params.seasonalEfficiencyPercent;
          if (!boiler || typeof eff !== 'number') {
            return { value: '—', options: [], disabled: true };
          }
          return {
            value: resolveErpClass(eff, boiler.params.fuelType),
            options: [],
            disabled: true,
          };
        }
        // NOx compliance verdict — independent of sizing (depends on noxMgKwh + fuelType), so it
        // is resolved BEFORE the sizing guard, alongside the ErP class. Disabled (read-only) combobox.
        // `null` (non-combustion fuel / no measured value) → the «—» placeholder.
        if (commandKey === MEP_BOILER_RIBBON_KEYS.readouts.noxClass) {
          const boiler = resolveBoiler();
          const nox = resolveNoxClass(boiler?.params.noxMgKwh, boiler?.params.fuelType);
          if (!boiler || nox === null) {
            return { value: '—', options: [], disabled: true };
          }
          return {
            value: t(
              nox === 'compliant'
                ? 'ribbon.commands.mepBoilerEditor.noxCompliant'
                : 'ribbon.commands.mepBoilerEditor.noxExceeds',
            ),
            options: [],
            disabled: true,
          };
        }
        // Sound power (L_WA) placement-suitability band — independent of sizing (depends only on
        // soundPowerDbA), so it is resolved BEFORE the sizing guard, alongside ErP/NOx. Disabled
        // (read-only) combobox. `null` (absent/non-positive value) → the «—» placeholder. The band
        // is a guidance heuristic (NOT a legal limit) — see `boiler-acoustics.ts`.
        if (commandKey === MEP_BOILER_RIBBON_KEYS.readouts.acousticBand) {
          const boiler = resolveBoiler();
          const band = resolveAcousticBand(boiler?.params.soundPowerDbA);
          if (!boiler || band === null) {
            return { value: '—', options: [], disabled: true };
          }
          const BAND_LABEL_KEY: Readonly<Record<AcousticBand, string>> = {
            quiet: 'ribbon.commands.mepBoilerEditor.acousticQuiet',
            standard: 'ribbon.commands.mepBoilerEditor.acousticStandard',
            loud: 'ribbon.commands.mepBoilerEditor.acousticLoud',
          };
          return { value: t(BAND_LABEL_KEY[band]), options: [], disabled: true };
        }
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
      // ADR-408 — SAFETY RELIEF VALVE set-pressure picker (static enum of standard valve
      // ratings). Checked BEFORE the model-catalog branch (passes `isMepBoilerRibbonStringKey`).
      // A string combobox — the set-pressures are fractional (1.5/2.5 bar) so the generic numeric
      // path (which rounds) is unsuitable. Value/options stringify the standard bar ratings.
      if (isMepBoilerReliefPressureKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return null;
        const bar = boiler.params.reliefValvePressureBar ?? DEFAULT_BOILER_RELIEF_PRESSURE_BAR;
        return {
          value: String(bar),
          options: BOILER_RELIEF_PRESSURES_BAR.map((p) => ({
            value: String(p),
            labelKey: String(p),
            isLiteralLabel: true,
          })),
        };
      }
      // ADR-408 — PRESSURE GAUGE system (cold fill) pressure picker (static enum of standard fill
      // pressures). Checked BEFORE the model-catalog branch (passes `isMepBoilerRibbonStringKey`).
      // A string combobox — the fill pressures are fractional (1.2/1.5 bar) so the generic numeric
      // path (which rounds) is unsuitable. DISTINCT from the relief-valve set-pressure branch above.
      if (isMepBoilerSystemPressureKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return null;
        const bar = boiler.params.systemPressureBar ?? DEFAULT_BOILER_SYSTEM_PRESSURE_BAR;
        return {
          value: String(bar),
          options: BOILER_SYSTEM_PRESSURES_BAR.map((p) => ({
            value: String(p),
            labelKey: String(p),
            isLiteralLabel: true,
          })),
        };
      }
      // ADR-408 — standalone HEATING FUEL picker (static enum, Revit editable instance
      // parameter). Checked BEFORE the model-catalog branch (both pass
      // `isMepBoilerRibbonStringKey`). Supplies the 4 fuel options + an «Απροσδιόριστο»
      // (clear) sentinel so a parametric boiler can have no fuel; reuses the tag fuel
      // labels (SSoT). Value falls back to the clear sentinel when unset.
      if (isMepBoilerFuelTypeKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return null;
        return {
          value: boiler.params.fuelType ?? SELECT_CLEAR_VALUE,
          options: [
            {
              value: SELECT_CLEAR_VALUE,
              labelKey: 'ribbon.commands.mepBoilerEditor.fuelTypeUnset',
              isLiteralLabel: false,
            },
            ...BOILER_FUEL_TYPES.map((fuel) => ({
              value: fuel,
              labelKey: `ribbon.commands.mepBoilerTag.fuelTypes.${fuel}`,
              isLiteralLabel: false,
            })),
          ],
        };
      }
      // ADR-408 — standalone MOUNTING picker (static enum, Revit «Mounting» type-property).
      // Checked BEFORE the model-catalog branch (both pass `isMepBoilerRibbonStringKey`). No clear
      // sentinel — a boiler is always wall-hung or floor-standing; the value falls back to the
      // wall-hung default when unset. Reuses the tag mounting labels (SSoT).
      if (isMepBoilerMountingTypeKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return null;
        return {
          value: boiler.params.mountingType ?? DEFAULT_BOILER_MOUNTING_TYPE,
          options: MEP_BOILER_MOUNTING_TYPES.map((mt) => ({
            value: mt,
            labelKey: `ribbon.commands.mepBoilerTag.mountingTypes.${mt}`,
            isLiteralLabel: false,
          })),
        };
      }
      // ADR-408 Vent Terminal — flue-termination picker (static enum). Checked BEFORE the
      // model-catalog branch (both pass `isMepBoilerRibbonStringKey`). Supplies the 3 type
      // options + the current value, defaulting to the roof cowl when unset.
      if (isMepBoilerFlueTerminationKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return null;
        return {
          value: boiler.params.flueTermination ?? DEFAULT_FLUE_TERMINATION,
          options: FLUE_TERMINATION_TYPES.map((type) => ({
            value: type,
            labelKey: `ribbon.commands.mepBoilerEditor.flueTerminationTypes.${type}`,
            isLiteralLabel: false,
          })),
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
      // ADR-408 — SAFETY RELIEF VALVE set-pressure change (static enum). Checked before the
      // model-catalog branch; parses the standard bar rating and persists `reliefValvePressureBar`.
      if (isMepBoilerReliefPressureKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return;
        const bar = Number.parseFloat(value);
        if (!Number.isFinite(bar) || bar <= 0) return;
        dispatchParams(boiler, { ...boiler.params, reliefValvePressureBar: bar });
        return;
      }
      // ADR-408 — PRESSURE GAUGE system (cold fill) pressure change (static enum). Checked before
      // the model-catalog branch; parses the standard bar value and persists `systemPressureBar`.
      // DISTINCT from the relief-valve set-pressure branch above (system fill vs valve lift).
      if (isMepBoilerSystemPressureKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return;
        const bar = Number.parseFloat(value);
        if (!Number.isFinite(bar) || bar <= 0) return;
        dispatchParams(boiler, { ...boiler.params, systemPressureBar: bar });
        return;
      }
      // ADR-408 — standalone HEATING FUEL change (static enum, Revit instance param). Checked
      // before the model-catalog branch. The «Απροσδιόριστο» sentinel removes `fuelType`
      // (parametric boiler with no fuel); otherwise persist the validated fuel. The command
      // re-seeds connectors (flue/fuel appear or vanish) and the combustion panels open or
      // close for free. Does NOT touch `modelId` (Revit instance override ≠ family default).
      if (isMepBoilerFuelTypeKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return;
        if (isSelectClearValue(value)) {
          const { fuelType: _fuelType, ...rest } = boiler.params;
          dispatchParams(boiler, rest as MepBoilerParams);
        } else if (isBoilerFuelType(value)) {
          dispatchParams(boiler, { ...boiler.params, fuelType: value });
        }
        return;
      }
      // ADR-408 — standalone MOUNTING change (static enum, Revit «Mounting» type-property).
      // Checked before the model-catalog branch; persists the validated mounting type. No clear
      // sentinel (always wall-hung or floor-standing). Does NOT touch `modelId` (instance override
      // ≠ family default). Data-only — no connector re-seed (mounting affects 3D elevation, deferred).
      if (isMepBoilerMountingTypeKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return;
        if (!isMepBoilerMountingType(value)) return;
        dispatchParams(boiler, { ...boiler.params, mountingType: value });
        return;
      }
      // ADR-408 Vent Terminal — flue-termination change (static enum). Checked before the
      // model-catalog branch; persists `flueTermination` via the same params command.
      if (isMepBoilerFlueTerminationKey(commandKey)) {
        const boiler = resolveBoiler();
        if (!boiler) return;
        if (!isFlueTerminationType(value)) return;
        dispatchParams(boiler, { ...boiler.params, flueTermination: value });
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

  // ADR-408 Εύρος Β (combi) — Revit Yes/No toggles routed by commandKey:
  //   - «Παραγωγή ΖΝΧ» (producesDhw): ON → DHW hot outlet + cold inlet connectors.
  //   - «Ανακυκλοφορία ΖΝΧ» (dhwRecirculation): ON (combi-gated) → recirc return inlet.
  // The command re-seeds connectors (applyPatch → buildBoilerConnectors) for both.
  const onToggle = useCallback(
    (commandKey: string, nextValue: boolean): void => {
      if (!isMepBoilerToggleKey(commandKey)) return;
      const boiler = resolveBoiler();
      if (!boiler) return;
      const field = TOGGLE_KEY_TO_FIELD[commandKey];
      dispatchParams(boiler, { ...boiler.params, [field]: nextValue });
    },
    [resolveBoiler, dispatchParams],
  );

  const getToggleState = useCallback(
    (commandKey: string): RibbonToggleState => {
      if (!isMepBoilerToggleKey(commandKey)) return false;
      const boiler = resolveBoiler();
      if (!boiler) return false;
      const field = TOGGLE_KEY_TO_FIELD[commandKey];
      return boiler.params[field] === true;
    },
    [resolveBoiler],
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
      if (visibilityKey === MEP_BOILER_RIBBON_VISIBILITY_KEYS.combi) {
        // ADR-408 Εύρος Β (combi) — «ΖΝΧ» panel (DHW diameter) εμφανίζεται μόνο όταν ο
        // λέβητας είναι combi (Revit "params appear by type"). Mirror Revit Yes/No gate.
        return boiler.params.producesDhw === true;
      }
      if (visibilityKey === MEP_BOILER_RIBBON_VISIBILITY_KEYS.combustion) {
        // ADR-408 (duct foundation) — «Καπναγωγός» panel (flue diameter) εμφανίζεται μόνο
        // για λέβητα καύσης (αερίου/πετρελαίου)· ηλεκτρικός/αντλία θερμότητας → χωρίς
        // καπναγωγό. Mirror του combi gate, αλλά οδηγείται από `fuelType` (Type Catalog).
        return boiler.params.fuelType === 'gas' || boiler.params.fuelType === 'oil';
      }
      if (visibilityKey === MEP_BOILER_RIBBON_VISIBILITY_KEYS.condensing) {
        // ADR-408 Εύρος Β (condensate drain) — «Συμπύκνωση» panel (condensate diameter)
        // εμφανίζεται μόνο όταν ο λέβητας είναι συμπύκνωσης (`condensing`). Revit-grade
        // explicit flag (≠ inferred από efficiency)· mirror του combi gate.
        return boiler.params.condensing === true;
      }
      return false;
    },
    [resolveBoiler],
  );

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer (panel visibility). */
export function isMepBoilerPanelVisibilityKey(visibilityKey: string): boolean {
  return isMepBoilerVisibilityKey(visibilityKey);
}
