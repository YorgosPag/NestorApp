/**
 * ADR-408 Φ12 — MEP manifold (συλλέκτης) contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-mep-manifold-tab.ts`) and the bridge mappings
 * (`useRibbonMepManifoldBridge`). Mirrors `MEP_FIXTURE_RIBBON_KEYS`.
 *
 * The «Δίκτυο» panel folded into this tab reuses the domain-agnostic
 * `mep-circuit-*` widgets + `MEP_PIPE_NETWORK_RIBBON_ACTIONS` (handled by the
 * existing pipe-network bridge) — so NO network keys live here.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const MEP_MANIFOLD_RIBBON_KEYS = {
  params: {
    /** mm — bar width (the run along which outlets line up). */
    width: 'mepManifold.params.width',
    /** mm — footprint depth. */
    length: 'mepManifold.params.length',
    /** mm — body vertical height (3D box extent). */
    bodyHeight: 'mepManifold.params.bodyHeight',
    /** mm — mounting elevation above FFL (vertical centre, floor level). */
    mountingElevation: 'mepManifold.params.mountingElevation',
    /** Count — number of outlet connectors (re-seeds connectors on change). */
    outletCount: 'mepManifold.params.outletCount',
    /** mm — inlet connector nominal diameter. */
    inletDiameter: 'mepManifold.params.inletDiameter',
    /** mm — outlet connector nominal diameter. */
    outletDiameter: 'mepManifold.params.outletDiameter',
    /**
     * Hydraulic system classification (ADR-408 Φ-heating) — ύδρευση/θέρμανση.
     * STRING enum (not numeric): handled by a dedicated bridge branch, separate
     * from the numeric combobox set, since its value is a classification token.
     */
    classification: 'mepManifold.params.classification',
  },
} as const;

export type MepManifoldRibbonNumberCommandKey =
  | typeof MEP_MANIFOLD_RIBBON_KEYS.params.width
  | typeof MEP_MANIFOLD_RIBBON_KEYS.params.length
  | typeof MEP_MANIFOLD_RIBBON_KEYS.params.bodyHeight
  | typeof MEP_MANIFOLD_RIBBON_KEYS.params.mountingElevation
  | typeof MEP_MANIFOLD_RIBBON_KEYS.params.outletCount
  | typeof MEP_MANIFOLD_RIBBON_KEYS.params.inletDiameter
  | typeof MEP_MANIFOLD_RIBBON_KEYS.params.outletDiameter;

export const MEP_MANIFOLD_RIBBON_NUMBER_KEYS: readonly MepManifoldRibbonNumberCommandKey[] = [
  MEP_MANIFOLD_RIBBON_KEYS.params.width,
  MEP_MANIFOLD_RIBBON_KEYS.params.length,
  MEP_MANIFOLD_RIBBON_KEYS.params.bodyHeight,
  MEP_MANIFOLD_RIBBON_KEYS.params.mountingElevation,
  MEP_MANIFOLD_RIBBON_KEYS.params.outletCount,
  MEP_MANIFOLD_RIBBON_KEYS.params.inletDiameter,
  MEP_MANIFOLD_RIBBON_KEYS.params.outletDiameter,
];

export const MEP_MANIFOLD_RIBBON_KEYS_ACTIONS = {
  close: 'mepManifold.actions.close',
  delete: 'mepManifold.actions.delete',
} as const;

export const isMepManifoldActionKey = makeKeySetGuard(
  Object.values(MEP_MANIFOLD_RIBBON_KEYS_ACTIONS),
);

/**
 * Panel visibility keys.
 *   - `hasNetwork`: the «Δίκτυο» panel is visible iff the manifold sources ≥1
 *     plumbing `MepSystem` (mirror of the fixture `hasCircuit` panel).
 */
export const MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS = {
  hasNetwork: 'mepManifold.visibility.hasNetwork',
} as const;

export type MepManifoldRibbonVisibilityKey =
  typeof MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS.hasNetwork;

export const isMepManifoldVisibilityKey = makeKeySetGuard<MepManifoldRibbonVisibilityKey>([
  MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS.hasNetwork,
]);

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

export const isMepManifoldRibbonKey = makeKeySetGuard(MEP_MANIFOLD_RIBBON_NUMBER_KEYS);

/**
 * The manifold classification combobox key (ADR-408 Φ-heating). Kept OUT of the
 * numeric key set so the bridge routes it through its string-enum branch
 * (`systemClassification` patch + connector re-seed) rather than `parseFloat`.
 */
export function isMepManifoldClassificationKey(commandKey: string): boolean {
  return commandKey === MEP_MANIFOLD_RIBBON_KEYS.params.classification;
}
