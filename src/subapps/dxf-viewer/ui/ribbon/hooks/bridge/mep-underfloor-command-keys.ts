/**
 * ADR-408 Εύρος Β #3 — MEP underfloor (ενδοδαπέδια) contextual ribbon command-key
 * registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-mep-underfloor-tab.ts`) and the bridge mappings
 * (`useRibbonMepUnderfloorBridge`). Mirrors `MEP_BOILER_RIBBON_KEYS` but for the
 * area-loop params: editable numbers (spacing/clearance/screed/connector/thermal), a
 * string `patternType` selector, and a read-only `totalLength` readout (computed BOQ
 * pipe length). The underfloor is a HYDRONIC TERMINAL that is a member of a pipe
 * network, so its «Δίκτυο» fold-in panel reuses the same self-hiding visibility key.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

export const MEP_UNDERFLOOR_RIBBON_KEYS = {
  params: {
    /** mm — centre-to-centre pipe spacing of the serpentine rows. */
    pipeSpacing: 'mepUnderfloor.params.pipeSpacing',
    /** mm — inset from the room walls before the field starts. */
    edgeClearance: 'mepUnderfloor.params.edgeClearance',
    /** enum — serpentine layout pattern (boustrophedon | counterflow-spiral). */
    patternType: 'mepUnderfloor.params.patternType',
    /** mm — pipe centreline elevation above storey FFL. */
    screedOffset: 'mepUnderfloor.params.screedOffset',
    /** mm — supply/return connector nominal diameter. */
    connectorDiameter: 'mepUnderfloor.params.connectorDiameter',
    /** W — nominal catalogue thermal output (optional; absent ⇒ unspecified). */
    thermalOutput: 'mepUnderfloor.params.thermalOutput',
    /** m — computed total developed pipe length (read-only BOQ readout). */
    totalLength: 'mepUnderfloor.params.totalLength',
  },
} as const;

/** Editable numeric param command keys. */
export const MEP_UNDERFLOOR_RIBBON_NUMBER_KEYS: readonly string[] = [
  MEP_UNDERFLOOR_RIBBON_KEYS.params.pipeSpacing,
  MEP_UNDERFLOOR_RIBBON_KEYS.params.edgeClearance,
  MEP_UNDERFLOOR_RIBBON_KEYS.params.screedOffset,
  MEP_UNDERFLOOR_RIBBON_KEYS.params.connectorDiameter,
  MEP_UNDERFLOOR_RIBBON_KEYS.params.thermalOutput,
];

/** All underfloor param keys (number + pattern + readout) — for composer routing. */
const MEP_UNDERFLOOR_ALL_KEY_SET: ReadonlySet<string> = new Set<string>([
  ...MEP_UNDERFLOOR_RIBBON_NUMBER_KEYS,
  MEP_UNDERFLOOR_RIBBON_KEYS.params.patternType,
  MEP_UNDERFLOOR_RIBBON_KEYS.params.totalLength,
]);

const MEP_UNDERFLOOR_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(
  MEP_UNDERFLOOR_RIBBON_NUMBER_KEYS,
);

/** True for ANY underfloor combobox key (routes the combobox to this bridge). */
export function isMepUnderfloorRibbonKey(commandKey: string): boolean {
  return MEP_UNDERFLOOR_ALL_KEY_SET.has(commandKey);
}

/** True only for the editable numeric param keys. */
export function isMepUnderfloorNumberKey(commandKey: string): boolean {
  return MEP_UNDERFLOOR_NUMBER_KEY_SET.has(commandKey);
}

export const MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS = {
  close: 'mepUnderfloor.actions.close',
  delete: 'mepUnderfloor.actions.delete',
} as const;

const MEP_UNDERFLOOR_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS),
);

export function isMepUnderfloorActionKey(action: string): boolean {
  return MEP_UNDERFLOOR_ACTION_KEY_SET.has(action);
}

/**
 * Panel visibility keys.
 *   - `hasNetwork`: the «Δίκτυο» panel shows only when the loop is a member of ≥1
 *     hydronic `MepSystem` (mirror of the boiler/manifold `hasNetwork` panel).
 */
export const MEP_UNDERFLOOR_RIBBON_VISIBILITY_KEYS = {
  hasNetwork: 'mepUnderfloor.visibility.hasNetwork',
} as const;

export type MepUnderfloorRibbonVisibilityKey =
  typeof MEP_UNDERFLOOR_RIBBON_VISIBILITY_KEYS.hasNetwork;

const MEP_UNDERFLOOR_VISIBILITY_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_UNDERFLOOR_RIBBON_VISIBILITY_KEYS.hasNetwork,
]);

export function isMepUnderfloorVisibilityKey(
  key: string,
): key is MepUnderfloorRibbonVisibilityKey {
  return MEP_UNDERFLOOR_VISIBILITY_KEY_SET.has(key);
}
