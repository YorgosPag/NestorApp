/**
 * ADR-408 Εύρος Β — MEP boiler (λέβητας) contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-mep-boiler-tab.ts`) and the bridge mappings
 * (`useRibbonMepBoilerBridge`). Mirrors `MEP_RADIATOR_RIBBON_KEYS` for the numeric
 * params (geometry/thermal), and adds `MEP_BOILER_RIBBON_VISIBILITY_KEYS` from
 * `MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS` — because the boiler is a HYDRONIC SOURCE
 * (like the manifold) and can source a pipe network, so its «Δίκτυο» fold-in panel
 * uses the same self-hiding visibility mechanic.
 *
 * No classification key: a boiler's supply role is fixed as hydronic-supply by
 * physics (≠ manifold which can be cold/hot/sanitary/hydronic).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

export const MEP_BOILER_RIBBON_KEYS = {
  params: {
    /** mm — body width (the largest horizontal dimension of the boiler cabinet). */
    width: 'mepBoiler.params.width',
    /** mm — footprint depth (front-to-back depth of the boiler). */
    length: 'mepBoiler.params.length',
    /** mm — body vertical height (3D box extent). */
    bodyHeight: 'mepBoiler.params.bodyHeight',
    /** mm — mounting elevation above FFL (vertical centre, wall-mounted). */
    mountingElevation: 'mepBoiler.params.mountingElevation',
    /** mm — supply/return connector nominal diameter (shared by both ports). */
    connectorDiameter: 'mepBoiler.params.connectorDiameter',
    /** W — nominal catalogue thermal output (optional; absent ⇒ unspecified). */
    thermalOutput: 'mepBoiler.params.thermalOutput',
  },
  /**
   * String (non-numeric) combobox params — model catalog picker.
   *   - `modelId`: Type Catalog picker (ADR-408). Picking populates geometry+thermal
   *     from the catalog; «Παραμετρικό» (clear) reverts to hand-authored dims.
   */
  stringParams: {
    modelId: 'mepBoiler.params.modelId',
    /**
     * COMBI toggle (ADR-408 Εύρος Β — combi). Yes/No combobox: when «Ναι», the boiler
     * also produces domestic hot water (a third `domestic-hot-water` out connector is
     * seeded → it can source a DHW network). Mirrors the wall `flip` Yes/No combobox.
     */
    producesDhw: 'mepBoiler.params.producesDhw',
  },
  /**
   * ADR-422 L2 — read-only sizing readouts (Revit «Heating Loads → Equipment»).
   * Computed (not editable): απαιτούμενη ισχύς από το θερμικό φορτίο των χώρων που
   * εξυπηρετεί ο λέβητας vs εγκατεστημένη `thermalOutputW` + δείκτης επάρκειας.
   */
  readouts: {
    /** kW — required output = ΣΦ served spaces × pickup factor. */
    requiredOutputW: 'mepBoiler.readout.requiredOutputW',
    /** kW — installed output (= thermalOutputW). */
    installedOutputW: 'mepBoiler.readout.installedOutputW',
    /** adequacy status label (ok / undersized / oversized / unknown). */
    adequacyStatus: 'mepBoiler.readout.adequacyStatus',
  },
} as const;

export type MepBoilerRibbonNumberCommandKey =
  | typeof MEP_BOILER_RIBBON_KEYS.params.width
  | typeof MEP_BOILER_RIBBON_KEYS.params.length
  | typeof MEP_BOILER_RIBBON_KEYS.params.bodyHeight
  | typeof MEP_BOILER_RIBBON_KEYS.params.mountingElevation
  | typeof MEP_BOILER_RIBBON_KEYS.params.connectorDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.thermalOutput;

export const MEP_BOILER_RIBBON_NUMBER_KEYS: readonly MepBoilerRibbonNumberCommandKey[] = [
  MEP_BOILER_RIBBON_KEYS.params.width,
  MEP_BOILER_RIBBON_KEYS.params.length,
  MEP_BOILER_RIBBON_KEYS.params.bodyHeight,
  MEP_BOILER_RIBBON_KEYS.params.mountingElevation,
  MEP_BOILER_RIBBON_KEYS.params.connectorDiameter,
  MEP_BOILER_RIBBON_KEYS.params.thermalOutput,
];

export const MEP_BOILER_RIBBON_KEYS_ACTIONS = {
  close: 'mepBoiler.actions.close',
  delete: 'mepBoiler.actions.delete',
} as const;

const MEP_BOILER_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(MEP_BOILER_RIBBON_KEYS_ACTIONS),
);

export function isMepBoilerActionKey(action: string): boolean {
  return MEP_BOILER_ACTION_KEY_SET.has(action);
}

/**
 * Panel visibility keys.
 *   - `hasNetwork`: το «Δίκτυο» panel εμφανίζεται μόνο εφόσον ο λέβητας τροφοδοτεί
 *     ≥1 υδρονικό `MepSystem` (mirror του manifold `hasNetwork` panel).
 */
export const MEP_BOILER_RIBBON_VISIBILITY_KEYS = {
  hasNetwork: 'mepBoiler.visibility.hasNetwork',
} as const;

export type MepBoilerRibbonVisibilityKey =
  typeof MEP_BOILER_RIBBON_VISIBILITY_KEYS.hasNetwork;

const MEP_BOILER_VISIBILITY_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_BOILER_RIBBON_VISIBILITY_KEYS.hasNetwork,
]);

export function isMepBoilerVisibilityKey(
  key: string,
): key is MepBoilerRibbonVisibilityKey {
  return MEP_BOILER_VISIBILITY_KEY_SET.has(key);
}

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const MEP_BOILER_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(
  MEP_BOILER_RIBBON_NUMBER_KEYS,
);

export function isMepBoilerRibbonKey(commandKey: string): boolean {
  return MEP_BOILER_NUMBER_KEY_SET.has(commandKey);
}

// ─── Read-only sizing readout keys (ADR-422 L2) ──────────────────────────────

export type MepBoilerRibbonReadoutKey =
  | typeof MEP_BOILER_RIBBON_KEYS.readouts.requiredOutputW
  | typeof MEP_BOILER_RIBBON_KEYS.readouts.installedOutputW
  | typeof MEP_BOILER_RIBBON_KEYS.readouts.adequacyStatus;

const MEP_BOILER_READOUT_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_BOILER_RIBBON_KEYS.readouts.requiredOutputW,
  MEP_BOILER_RIBBON_KEYS.readouts.installedOutputW,
  MEP_BOILER_RIBBON_KEYS.readouts.adequacyStatus,
]);

/** Read-only sizing readouts — served by the bridge as `disabled` combobox state. */
export function isMepBoilerReadoutKey(commandKey: string): commandKey is MepBoilerRibbonReadoutKey {
  return MEP_BOILER_READOUT_KEY_SET.has(commandKey);
}

// ─── String param key guards (model catalog picker) ──────────────────────────

/** The string commandKeys: model-catalog picker + combi Yes/No selector. */
export type MepBoilerRibbonStringCommandKey =
  | typeof MEP_BOILER_RIBBON_KEYS.stringParams.modelId
  | typeof MEP_BOILER_RIBBON_KEYS.stringParams.producesDhw;

export const MEP_BOILER_STRING_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_BOILER_RIBBON_KEYS.stringParams.modelId,
  MEP_BOILER_RIBBON_KEYS.stringParams.producesDhw,
]);

/**
 * Returns `true` when `commandKey` is a boiler string (combobox) param — the
 * model-catalog picker OR the combi Yes/No selector (not a numeric param, not a
 * readout, not an action). Mirror of `isMepRadiatorRibbonStringKey` (ADR-408 Εύρος Β).
 */
export function isMepBoilerRibbonStringKey(commandKey: string): boolean {
  return MEP_BOILER_STRING_KEY_SET.has(commandKey);
}
