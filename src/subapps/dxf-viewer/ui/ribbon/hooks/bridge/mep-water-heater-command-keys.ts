/**
 * ADR-408 DHW — MEP water heater (θερμοσίφωνας) contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-mep-water-heater-tab.ts`) and the bridge mappings
 * (`useRibbonMepWaterHeaterBridge`). Mirrors `MEP_BOILER_RIBBON_KEYS` for the numeric
 * params (geometry/thermal), and adds `MEP_WATER_HEATER_RIBBON_VISIBILITY_KEYS` from
 * `MEP_BOILER_RIBBON_VISIBILITY_KEYS` — because the water heater is a DHW SOURCE
 * (like the boiler) and can source a pipe network, so its «Δίκτυο» fold-in panel
 * uses the same self-hiding visibility mechanic.
 *
 * DHW difference vs boiler: adds `tankCapacityL` (litres) in the thermal group.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

export const MEP_WATER_HEATER_RIBBON_KEYS = {
  params: {
    /** mm — body width (the largest horizontal dimension of the water heater cabinet). */
    width: 'mepWaterHeater.params.width',
    /** mm — footprint depth (front-to-back depth of the tank). */
    length: 'mepWaterHeater.params.length',
    /** mm — body vertical height (3D box extent). */
    bodyHeight: 'mepWaterHeater.params.bodyHeight',
    /** mm — mounting elevation above FFL (vertical centre, wall-mounted). */
    mountingElevation: 'mepWaterHeater.params.mountingElevation',
    /** mm — cold-inlet / hot-outlet connector nominal diameter (shared by both ports). */
    connectorDiameter: 'mepWaterHeater.params.connectorDiameter',
    /** W — nominal catalogue heating element power (optional; absent ⇒ unspecified). */
    thermalOutput: 'mepWaterHeater.params.thermalOutput',
    /** L — storage tank capacity in litres (optional; absent ⇒ unspecified). */
    tankCapacityL: 'mepWaterHeater.params.tankCapacityL',
  },
} as const;

export type MepWaterHeaterRibbonNumberCommandKey =
  | typeof MEP_WATER_HEATER_RIBBON_KEYS.params.width
  | typeof MEP_WATER_HEATER_RIBBON_KEYS.params.length
  | typeof MEP_WATER_HEATER_RIBBON_KEYS.params.bodyHeight
  | typeof MEP_WATER_HEATER_RIBBON_KEYS.params.mountingElevation
  | typeof MEP_WATER_HEATER_RIBBON_KEYS.params.connectorDiameter
  | typeof MEP_WATER_HEATER_RIBBON_KEYS.params.thermalOutput
  | typeof MEP_WATER_HEATER_RIBBON_KEYS.params.tankCapacityL;

export const MEP_WATER_HEATER_RIBBON_NUMBER_KEYS: readonly MepWaterHeaterRibbonNumberCommandKey[] =
  [
    MEP_WATER_HEATER_RIBBON_KEYS.params.width,
    MEP_WATER_HEATER_RIBBON_KEYS.params.length,
    MEP_WATER_HEATER_RIBBON_KEYS.params.bodyHeight,
    MEP_WATER_HEATER_RIBBON_KEYS.params.mountingElevation,
    MEP_WATER_HEATER_RIBBON_KEYS.params.connectorDiameter,
    MEP_WATER_HEATER_RIBBON_KEYS.params.thermalOutput,
    MEP_WATER_HEATER_RIBBON_KEYS.params.tankCapacityL,
  ];

export const MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS = {
  close: 'mepWaterHeater.actions.close',
  delete: 'mepWaterHeater.actions.delete',
} as const;

const MEP_WATER_HEATER_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS),
);

export function isMepWaterHeaterActionKey(action: string): boolean {
  return MEP_WATER_HEATER_ACTION_KEY_SET.has(action);
}

/**
 * Panel visibility keys.
 *   - `hasNetwork`: το «Δίκτυο» panel εμφανίζεται μόνο εφόσον ο θερμοσίφωνας
 *     τροφοδοτεί ≥1 `MepSystem` domestic-hot-water (mirror του boiler `hasNetwork`).
 */
export const MEP_WATER_HEATER_RIBBON_VISIBILITY_KEYS = {
  hasNetwork: 'mepWaterHeater.visibility.hasNetwork',
} as const;

export type MepWaterHeaterRibbonVisibilityKey =
  typeof MEP_WATER_HEATER_RIBBON_VISIBILITY_KEYS.hasNetwork;

const MEP_WATER_HEATER_VISIBILITY_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_WATER_HEATER_RIBBON_VISIBILITY_KEYS.hasNetwork,
]);

export function isMepWaterHeaterVisibilityKey(
  key: string,
): key is MepWaterHeaterRibbonVisibilityKey {
  return MEP_WATER_HEATER_VISIBILITY_KEY_SET.has(key);
}

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const MEP_WATER_HEATER_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(
  MEP_WATER_HEATER_RIBBON_NUMBER_KEYS,
);

export function isMepWaterHeaterRibbonKey(commandKey: string): boolean {
  return MEP_WATER_HEATER_NUMBER_KEY_SET.has(commandKey);
}
