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

import { makeKeySetGuard } from './make-key-set-guard';

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

/** True for ANY underfloor combobox key (routes the combobox to this bridge). */
export const isMepUnderfloorRibbonKey = makeKeySetGuard([
  ...MEP_UNDERFLOOR_RIBBON_NUMBER_KEYS,
  MEP_UNDERFLOOR_RIBBON_KEYS.params.patternType,
  MEP_UNDERFLOOR_RIBBON_KEYS.params.totalLength,
]);

/** True only for the editable numeric param keys. */
export const isMepUnderfloorNumberKey = makeKeySetGuard(MEP_UNDERFLOOR_RIBBON_NUMBER_KEYS);

export const MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS = {
  close: 'mepUnderfloor.actions.close',
  delete: 'mepUnderfloor.actions.delete',
} as const;

export const isMepUnderfloorActionKey = makeKeySetGuard(
  Object.values(MEP_UNDERFLOOR_RIBBON_KEYS_ACTIONS),
);

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

export const isMepUnderfloorVisibilityKey = makeKeySetGuard<MepUnderfloorRibbonVisibilityKey>([
  MEP_UNDERFLOOR_RIBBON_VISIBILITY_KEYS.hasNetwork,
]);
