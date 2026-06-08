/**
 * ADR-422 L0 — Thermal-space contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-thermal-space-tab.ts`) and the bridge
 * (`useRibbonThermalSpaceBridge`). Mirrors `floor-finish-command-keys.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

export const THERMAL_SPACE_RIBBON_KEYS = {
  stringParams: {
    /** Use-type selector (ThermalSpaceUseType). */
    useType: 'thermalSpace.params.useType',
    /** Thermal-bridge level override (ThermalBridgeLevel, ADR-422 L1.5). */
    thermalBridgeLevel: 'thermalSpace.params.thermalBridgeLevel',
    /** Heating-operation / reheat mode override (ReheatMode, ADR-422 L1.5). */
    reheatMode: 'thermalSpace.params.reheatMode',
  },
  params: {
    /** °C — design indoor temperature override (Ti). */
    setpointTempC: 'thermalSpace.params.setpointTempC',
    /** 1/h — air changes per hour override (n). */
    airChangesPerHour: 'thermalSpace.params.airChangesPerHour',
    /** mm — clear ceiling height (volume = area × height). */
    ceilingHeightMm: 'thermalSpace.params.ceilingHeightMm',
  },
  actions: {
    /** Close selection (return to Select tool). */
    close: 'thermalSpace.action.close',
    /** Delete entity. */
    delete: 'thermalSpace.action.delete',
  },
  readouts: {
    /** W — total heat load Φ (read-only, ADR-422 L1). */
    heatLoadTotalW: 'thermalSpace.readout.heatLoadTotalW',
    /** W/m² — specific heat load (read-only, ADR-422 L1). */
    heatLoadSpecific: 'thermalSpace.readout.heatLoadSpecific',
  },
} as const;

export type ThermalSpaceRibbonNumberCommandKey =
  | typeof THERMAL_SPACE_RIBBON_KEYS.params.setpointTempC
  | typeof THERMAL_SPACE_RIBBON_KEYS.params.airChangesPerHour
  | typeof THERMAL_SPACE_RIBBON_KEYS.params.ceilingHeightMm;

export type ThermalSpaceRibbonStringCommandKey =
  | typeof THERMAL_SPACE_RIBBON_KEYS.stringParams.useType
  | typeof THERMAL_SPACE_RIBBON_KEYS.stringParams.thermalBridgeLevel
  | typeof THERMAL_SPACE_RIBBON_KEYS.stringParams.reheatMode;

export type ThermalSpaceRibbonActionKey =
  | typeof THERMAL_SPACE_RIBBON_KEYS.actions.close
  | typeof THERMAL_SPACE_RIBBON_KEYS.actions.delete;

export type ThermalSpaceRibbonReadoutKey =
  | typeof THERMAL_SPACE_RIBBON_KEYS.readouts.heatLoadTotalW
  | typeof THERMAL_SPACE_RIBBON_KEYS.readouts.heatLoadSpecific;

const NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>([
  THERMAL_SPACE_RIBBON_KEYS.params.setpointTempC,
  THERMAL_SPACE_RIBBON_KEYS.params.airChangesPerHour,
  THERMAL_SPACE_RIBBON_KEYS.params.ceilingHeightMm,
]);
const STRING_KEY_SET: ReadonlySet<string> = new Set<string>([
  THERMAL_SPACE_RIBBON_KEYS.stringParams.useType,
  THERMAL_SPACE_RIBBON_KEYS.stringParams.thermalBridgeLevel,
  THERMAL_SPACE_RIBBON_KEYS.stringParams.reheatMode,
]);
const ACTION_KEY_SET: ReadonlySet<string> = new Set<string>([
  THERMAL_SPACE_RIBBON_KEYS.actions.close,
  THERMAL_SPACE_RIBBON_KEYS.actions.delete,
]);
const READOUT_KEY_SET: ReadonlySet<string> = new Set<string>([
  THERMAL_SPACE_RIBBON_KEYS.readouts.heatLoadTotalW,
  THERMAL_SPACE_RIBBON_KEYS.readouts.heatLoadSpecific,
]);

export function isThermalSpaceRibbonNumberKey(commandKey: string): commandKey is ThermalSpaceRibbonNumberCommandKey {
  return NUMBER_KEY_SET.has(commandKey);
}

export function isThermalSpaceRibbonStringKey(commandKey: string): commandKey is ThermalSpaceRibbonStringCommandKey {
  return STRING_KEY_SET.has(commandKey);
}

export function isThermalSpaceRibbonActionKey(commandKey: string): commandKey is ThermalSpaceRibbonActionKey {
  return ACTION_KEY_SET.has(commandKey);
}

export function isThermalSpaceRibbonReadoutKey(commandKey: string): commandKey is ThermalSpaceRibbonReadoutKey {
  return READOUT_KEY_SET.has(commandKey);
}
