/**
 * ADR-408 Εύρος Β #1 — MEP radiator (καλοριφέρ) contextual ribbon command-key
 * registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-mep-radiator-tab.ts`) and the bridge mappings
 * (`useRibbonMepRadiatorBridge`). Mirrors `MEP_MANIFOLD_RIBBON_KEYS`, but the
 * radiator is a TERMINAL (Revit space heater): it has NO user-chosen system
 * classification (supply/return is fixed by physics) and NO outlet count (exactly
 * two connectors). It also does not source a network, so there is no `hasNetwork`
 * visibility panel — hence no visibility keys here.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

export const MEP_RADIATOR_RIBBON_KEYS = {
  params: {
    /** mm — body width (the run along the wall, the two connectors sit at its ends). */
    width: 'mepRadiator.params.width',
    /** mm — footprint depth (radiator panel thickness). */
    length: 'mepRadiator.params.length',
    /** mm — body vertical height (3D box extent). */
    bodyHeight: 'mepRadiator.params.bodyHeight',
    /** mm — mounting elevation above FFL (vertical centre, wall-mounted). */
    mountingElevation: 'mepRadiator.params.mountingElevation',
    /** mm — supply/return connector nominal diameter (shared by both ports). */
    connectorDiameter: 'mepRadiator.params.connectorDiameter',
    /** W — nominal catalogue thermal output (optional; absent ⇒ unspecified). */
    thermalOutput: 'mepRadiator.params.thermalOutput',
  },
  stringParams: {
    /** ADR-422 L2 — ΔΤ regime preset id (system supply/return temperatures). */
    systemRegime: 'mepRadiator.params.systemRegime',
  },
  readouts: {
    /** W — required nominal output @ΔΤ50K (read-only, ADR-422 L2). */
    requiredOutputW: 'mepRadiator.readout.requiredOutputW',
    /** EN 442 correction factor ×N.NN (read-only, ADR-422 L2). */
    correctionFactor: 'mepRadiator.readout.correctionFactor',
    /** Adequacy vs catalogue (read-only, ADR-422 L2). */
    adequacy: 'mepRadiator.readout.adequacy',
  },
} as const;

export type MepRadiatorRibbonNumberCommandKey =
  | typeof MEP_RADIATOR_RIBBON_KEYS.params.width
  | typeof MEP_RADIATOR_RIBBON_KEYS.params.length
  | typeof MEP_RADIATOR_RIBBON_KEYS.params.bodyHeight
  | typeof MEP_RADIATOR_RIBBON_KEYS.params.mountingElevation
  | typeof MEP_RADIATOR_RIBBON_KEYS.params.connectorDiameter
  | typeof MEP_RADIATOR_RIBBON_KEYS.params.thermalOutput;

export const MEP_RADIATOR_RIBBON_NUMBER_KEYS: readonly MepRadiatorRibbonNumberCommandKey[] = [
  MEP_RADIATOR_RIBBON_KEYS.params.width,
  MEP_RADIATOR_RIBBON_KEYS.params.length,
  MEP_RADIATOR_RIBBON_KEYS.params.bodyHeight,
  MEP_RADIATOR_RIBBON_KEYS.params.mountingElevation,
  MEP_RADIATOR_RIBBON_KEYS.params.connectorDiameter,
  MEP_RADIATOR_RIBBON_KEYS.params.thermalOutput,
];

export const MEP_RADIATOR_RIBBON_KEYS_ACTIONS = {
  close: 'mepRadiator.actions.close',
  delete: 'mepRadiator.actions.delete',
} as const;

const MEP_RADIATOR_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(MEP_RADIATOR_RIBBON_KEYS_ACTIONS),
);

export function isMepRadiatorActionKey(action: string): boolean {
  return MEP_RADIATOR_ACTION_KEY_SET.has(action);
}

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const MEP_RADIATOR_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(
  MEP_RADIATOR_RIBBON_NUMBER_KEYS,
);

export function isMepRadiatorRibbonKey(commandKey: string): boolean {
  return MEP_RADIATOR_NUMBER_KEY_SET.has(commandKey);
}

// ─── ADR-422 L2 — string (regime) + readout (sizing) key guards ───────────────

export function isMepRadiatorRibbonStringKey(commandKey: string): boolean {
  return commandKey === MEP_RADIATOR_RIBBON_KEYS.stringParams.systemRegime;
}

const MEP_RADIATOR_READOUT_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(MEP_RADIATOR_RIBBON_KEYS.readouts),
);

export function isMepRadiatorRibbonReadoutKey(commandKey: string): boolean {
  return MEP_RADIATOR_READOUT_KEY_SET.has(commandKey);
}
