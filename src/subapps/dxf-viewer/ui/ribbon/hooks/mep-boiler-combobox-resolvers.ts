/**
 * ADR-408 Εύρος Β #2 — Pure combobox-state resolvers extracted from
 * `useRibbonMepBoilerBridge` to keep that hook <500 LOC (Google SRP, CLAUDE.md N.7.1).
 *
 * Two resolvers, each owning a disjoint family of MEP-boiler ribbon combobox keys:
 *   - `resolveBoilerReadoutComboboxState` — read-only readouts (ErP / NOx / acoustic
 *     band / recommended expansion-vessel / ADR-422 L2 sizing). Always returns a state.
 *   - `resolveBoilerEnumComboboxState` — static-enum pickers (relief & system pressure /
 *     fuel / mounting / flue-termination / model catalog). Returns `undefined` when no
 *     enum branch matches so the caller falls through to the numeric-param path.
 *
 * Both are pure (no React): the hook owns the `resolveBoiler` / `sizing` / `t` inputs
 * and dispatches the result. @see ./useRibbonMepBoilerBridge
 */

import type { TFunction } from 'i18next';
import type { MepBoilerEntity } from '../../../bim/types/mep-boiler-types';
import {
  BOILER_RELIEF_PRESSURES_BAR,
  DEFAULT_BOILER_RELIEF_PRESSURE_BAR,
  BOILER_SYSTEM_PRESSURES_BAR,
  DEFAULT_BOILER_SYSTEM_PRESSURE_BAR,
} from '../../../bim/types/mep-boiler-types';
import {
  listBoilerModels,
  BOILER_FUEL_TYPES,
  MEP_BOILER_MOUNTING_TYPES,
  DEFAULT_BOILER_MOUNTING_TYPE,
} from '../../../bim/mep-boilers/boiler-model-catalog';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import {
  MEP_BOILER_RIBBON_KEYS,
  isMepBoilerReliefPressureKey,
  isMepBoilerSystemPressureKey,
  isMepBoilerFuelTypeKey,
  isMepBoilerMountingTypeKey,
  isMepBoilerFlueTerminationKey,
  isMepBoilerRibbonStringKey,
} from './bridge/mep-boiler-command-keys';
import {
  FLUE_TERMINATION_TYPES,
  DEFAULT_FLUE_TERMINATION,
} from '../../../bim/mep-boilers/boiler-flue-terminal';
import { resolveErpClass } from '../../../bim/mep-boilers/boiler-efficiency';
import { resolveNoxClass } from '../../../bim/mep-boilers/boiler-nox';
import { resolveAcousticBand, type AcousticBand } from '../../../bim/mep-boilers/boiler-acoustics';
import { resolveRecommendedExpansionVesselL } from '../../../bim/mep-boilers/boiler-expansion-sizing';
import {
  computeHeatingEquipmentSizing,
  type HeatingEquipmentSizingStatus,
} from '../../../bim/thermal/heating-equipment-sizing';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';

type BoilerSizing = ReturnType<typeof computeHeatingEquipmentSizing>;

/**
 * Read-only readout combobox state (ADR-422 L2 + ErP/NOx/acoustic/vessel).
 * Caller guards with `isMepBoilerReadoutKey(commandKey)` — every readout key resolves
 * to a disabled state here (placeholder «—» when the input is unavailable).
 */
export function resolveBoilerReadoutComboboxState(
  commandKey: string,
  boiler: MepBoilerEntity | null,
  sizing: BoilerSizing | null,
  t: TFunction,
): RibbonComboboxState {
  // ErP energy class — independent of sizing (depends on efficiency + fuelType), so it
  // is resolved BEFORE the sizing guard. Disabled (read-only) combobox.
  if (commandKey === MEP_BOILER_RIBBON_KEYS.readouts.erpClass) {
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
  // Recommended expansion-vessel size — independent of sizing (depends only on waterContentL),
  // so it is resolved BEFORE the sizing guard, alongside ErP/NOx/acoustic. Disabled (read-only)
  // combobox. `null` (absent/non-positive water content) → the «—» placeholder. The figure is an
  // indicative engineering estimate (NOT code-exact) — see `boiler-expansion-sizing.ts`.
  if (commandKey === MEP_BOILER_RIBBON_KEYS.readouts.recommendedVessel) {
    const litres = resolveRecommendedExpansionVesselL(boiler?.params.waterContentL);
    if (!boiler || litres === null) {
      return { value: '—', options: [], disabled: true };
    }
    return { value: `${litres} L`, options: [], disabled: true };
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

/**
 * Static-enum picker combobox state (relief/system pressure, fuel, mounting, flue
 * termination, model catalog). Returns `null` when the branch matched but no boiler is
 * selected, and `undefined` when NO enum branch matched (caller continues to the numeric
 * param path). Branch order is significant: the specific string keys are checked before
 * the broad `isMepBoilerRibbonStringKey` model-catalog branch (all pass that guard).
 */
export function resolveBoilerEnumComboboxState(
  commandKey: string,
  boiler: MepBoilerEntity | null,
): RibbonComboboxState | null | undefined {
  // ADR-408 — SAFETY RELIEF VALVE set-pressure picker (static enum of standard valve
  // ratings). A string combobox — the set-pressures are fractional (1.5/2.5 bar) so the
  // generic numeric path (which rounds) is unsuitable.
  if (isMepBoilerReliefPressureKey(commandKey)) {
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
  // pressures). DISTINCT from the relief-valve set-pressure branch above.
  if (isMepBoilerSystemPressureKey(commandKey)) {
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
  // parameter). Supplies the 4 fuel options + an «Απροσδιόριστο» (clear) sentinel so a
  // parametric boiler can have no fuel; reuses the tag fuel labels (SSoT).
  if (isMepBoilerFuelTypeKey(commandKey)) {
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
  // ADR-408 — standalone MOUNTING picker (static enum, Revit «Mounting» type-property). No
  // clear sentinel — a boiler is always wall-hung or floor-standing; the value falls back to
  // the wall-hung default when unset. Reuses the tag mounting labels (SSoT).
  if (isMepBoilerMountingTypeKey(commandKey)) {
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
  // ADR-408 Vent Terminal — flue-termination picker (static enum). Supplies the 3 type
  // options + the current value, defaulting to the roof cowl when unset.
  if (isMepBoilerFlueTerminationKey(commandKey)) {
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
  // ADR-408 Type Catalog — model picker (broad string commandKey branch; MUST stay last
  // among the string branches). Returns dynamic options from BOILER_MODEL_CATALOG + the
  // clear («Παραμετρικό») sentinel. Pattern mirrors the fixture assetId branch (ADR-411).
  if (isMepBoilerRibbonStringKey(commandKey)) {
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
  return undefined;
}
