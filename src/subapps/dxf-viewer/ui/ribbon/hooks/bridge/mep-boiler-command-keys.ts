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
    /** % — seasonal appliance efficiency (Revit «Nominal Efficiency»). Drives ErP class. */
    efficiency: 'mepBoiler.params.efficiency',
    /** mm — COMBI DHW connector diameter (hot outlet + cold inlet). Combi-only panel. */
    dhwConnectorDiameter: 'mepBoiler.params.dhwConnectorDiameter',
    /** mm — combustion flue (καπναγωγός) diameter. Gas/oil-only panel («Καπναγωγός»). */
    flueDiameter: 'mepBoiler.params.flueDiameter',
    /** mm — combustion fuel supply (τροφοδοσία καυσίμου) diameter. Gas/oil-only panel («Καύσιμο»). */
    fuelDiameter: 'mepBoiler.params.fuelDiameter',
    /** mm — condensate drain (αποχέτευση συμπυκνωμάτων) diameter. Condensing-only panel («Συμπύκνωση»). */
    condensateDiameter: 'mepBoiler.params.condensateDiameter',
  },
  /**
   * String (non-numeric) combobox params — model catalog picker.
   *   - `modelId`: Type Catalog picker (ADR-408). Picking populates geometry+thermal
   *     from the catalog; «Παραμετρικό» (clear) reverts to hand-authored dims.
   */
  stringParams: {
    modelId: 'mepBoiler.params.modelId',
    /**
     * `flueTermination`: combustion-flue VENT TERMINAL picker (Revit «Vent Terminal»,
     * καμινάδα). A static enum (roof cowl / through-wall / concentric), NOT a catalog —
     * routed by `isMepBoilerFlueTerminationKey`, distinct from the dynamic model picker.
     * Lives in the «Καπναγωγός» panel (combustion-only).
     */
    flueTermination: 'mepBoiler.params.flueTermination',
    /**
     * `fuelType`: standalone HEATING FUEL / energy-source picker (Revit editable
     * instance parameter — gas / oil / electric / heat-pump, or unset). A static enum
     * (`BOILER_FUEL_TYPES`), NOT a catalog — routed by `isMepBoilerFuelTypeKey`, distinct
     * from the dynamic model picker. Setting it on a parametric boiler is what opens the
     * combustion panels («Καπναγωγός»/«Καύσιμο») and drives the ErP primary-energy factor;
     * the model catalog also fills it, but this instance param can override independently.
     * Lives in the «Μοντέλο» panel next to the model picker.
     */
    fuelType: 'mepBoiler.params.fuelType',
  },
  /**
   * Boolean toggle params (Revit Yes/No parameter → ribbon toggle button).
   *   - `producesDhw`: COMBI flag (ADR-408 Εύρος Β — combi). ON → the boiler also produces
   *     domestic hot water (DHW hot outlet + cold inlet connectors seeded → sources a DHW
   *     network + member of the cold network). Mirror του roof `slopeUnitPercent` toggle.
   *   - `dhwRecirculation`: RECIRCULATION flag (ADR-408 Εύρος Β — combi + recirc). Combi-gated:
   *     ON (with combi) → a recirc return inlet is seeded on the same DHW network (re-heat loop).
   */
  toggles: {
    producesDhw: 'mepBoiler.params.producesDhw',
    dhwRecirculation: 'mepBoiler.params.dhwRecirculation',
    /**
     * `condensing`: CONDENSING flag (ADR-408 Εύρος Β — condensate drain). ON → the boiler
     * drains acidic condensate to the sanitary network (a `boiler-condensate` connector is
     * seeded, REUSING `sanitary-drainage`). Lives in the combustion-gated «Καπναγωγός» panel
     * (condensate = the liquid product of flue-gas condensation). Mirror του producesDhw toggle.
     */
    condensing: 'mepBoiler.params.condensing',
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
    /** EU ErP energy class (A+++…G) — derived from seasonalEfficiencyPercent + fuelType. */
    erpClass: 'mepBoiler.readout.erpClass',
  },
} as const;

export type MepBoilerRibbonNumberCommandKey =
  | typeof MEP_BOILER_RIBBON_KEYS.params.width
  | typeof MEP_BOILER_RIBBON_KEYS.params.length
  | typeof MEP_BOILER_RIBBON_KEYS.params.bodyHeight
  | typeof MEP_BOILER_RIBBON_KEYS.params.mountingElevation
  | typeof MEP_BOILER_RIBBON_KEYS.params.connectorDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.thermalOutput
  | typeof MEP_BOILER_RIBBON_KEYS.params.dhwConnectorDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.flueDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.fuelDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.condensateDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.efficiency;

export const MEP_BOILER_RIBBON_NUMBER_KEYS: readonly MepBoilerRibbonNumberCommandKey[] = [
  MEP_BOILER_RIBBON_KEYS.params.width,
  MEP_BOILER_RIBBON_KEYS.params.length,
  MEP_BOILER_RIBBON_KEYS.params.bodyHeight,
  MEP_BOILER_RIBBON_KEYS.params.mountingElevation,
  MEP_BOILER_RIBBON_KEYS.params.connectorDiameter,
  MEP_BOILER_RIBBON_KEYS.params.thermalOutput,
  MEP_BOILER_RIBBON_KEYS.params.dhwConnectorDiameter,
  MEP_BOILER_RIBBON_KEYS.params.flueDiameter,
  MEP_BOILER_RIBBON_KEYS.params.fuelDiameter,
  MEP_BOILER_RIBBON_KEYS.params.condensateDiameter,
  MEP_BOILER_RIBBON_KEYS.params.efficiency,
];

// ─── Toggle keys (Revit Yes/No params) ───────────────────────────────────────

export type MepBoilerRibbonToggleCommandKey =
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.producesDhw
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.dhwRecirculation
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.condensing;

export const MEP_BOILER_RIBBON_TOGGLE_KEYS: readonly MepBoilerRibbonToggleCommandKey[] = [
  MEP_BOILER_RIBBON_KEYS.toggles.producesDhw,
  MEP_BOILER_RIBBON_KEYS.toggles.dhwRecirculation,
  MEP_BOILER_RIBBON_KEYS.toggles.condensing,
];

const MEP_BOILER_TOGGLE_KEY_SET: ReadonlySet<string> = new Set<string>(
  MEP_BOILER_RIBBON_TOGGLE_KEYS,
);

/** Returns `true` when `commandKey` is a boiler boolean-toggle param (combi flag). */
export function isMepBoilerToggleKey(commandKey: string): boolean {
  return MEP_BOILER_TOGGLE_KEY_SET.has(commandKey);
}

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
  /** The «ΖΝΧ» panel (DHW diameter) shows only when the boiler is a combi (`producesDhw`). */
  combi: 'mepBoiler.visibility.combi',
  /** The «Καπναγωγός» panel (flue diameter) shows only for a combustion boiler (`fuelType` gas/oil). */
  combustion: 'mepBoiler.visibility.combustion',
  /** The «Συμπύκνωση» panel (condensate diameter) shows only for a condensing boiler (`condensing`). */
  condensing: 'mepBoiler.visibility.condensing',
} as const;

export type MepBoilerRibbonVisibilityKey =
  | typeof MEP_BOILER_RIBBON_VISIBILITY_KEYS.hasNetwork
  | typeof MEP_BOILER_RIBBON_VISIBILITY_KEYS.combi
  | typeof MEP_BOILER_RIBBON_VISIBILITY_KEYS.combustion
  | typeof MEP_BOILER_RIBBON_VISIBILITY_KEYS.condensing;

const MEP_BOILER_VISIBILITY_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_BOILER_RIBBON_VISIBILITY_KEYS.hasNetwork,
  MEP_BOILER_RIBBON_VISIBILITY_KEYS.combi,
  MEP_BOILER_RIBBON_VISIBILITY_KEYS.combustion,
  MEP_BOILER_RIBBON_VISIBILITY_KEYS.condensing,
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
  | typeof MEP_BOILER_RIBBON_KEYS.readouts.adequacyStatus
  | typeof MEP_BOILER_RIBBON_KEYS.readouts.erpClass;

const MEP_BOILER_READOUT_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_BOILER_RIBBON_KEYS.readouts.requiredOutputW,
  MEP_BOILER_RIBBON_KEYS.readouts.installedOutputW,
  MEP_BOILER_RIBBON_KEYS.readouts.adequacyStatus,
  MEP_BOILER_RIBBON_KEYS.readouts.erpClass,
]);

/** Read-only sizing readouts — served by the bridge as `disabled` combobox state. */
export function isMepBoilerReadoutKey(commandKey: string): commandKey is MepBoilerRibbonReadoutKey {
  return MEP_BOILER_READOUT_KEY_SET.has(commandKey);
}

// ─── String param key guards (model catalog picker) ──────────────────────────

/** String (non-numeric) commandKeys: the model-catalog picker + the flue-terminal picker. */
export type MepBoilerRibbonStringCommandKey =
  | typeof MEP_BOILER_RIBBON_KEYS.stringParams.modelId
  | typeof MEP_BOILER_RIBBON_KEYS.stringParams.flueTermination
  | typeof MEP_BOILER_RIBBON_KEYS.stringParams.fuelType;

export const MEP_BOILER_STRING_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_BOILER_RIBBON_KEYS.stringParams.modelId,
  MEP_BOILER_RIBBON_KEYS.stringParams.flueTermination,
  MEP_BOILER_RIBBON_KEYS.stringParams.fuelType,
]);

/**
 * Returns `true` when `commandKey` is a boiler string-combobox param (model picker OR
 * flue-terminal picker) — not numeric, not a toggle, not a readout, not an action. The
 * composer routes ALL of these to the boiler bridge; the bridge then splits by specific
 * key. Mirror of `isMepRadiatorRibbonStringKey` (ADR-408 Εύρος Β).
 */
export function isMepBoilerRibbonStringKey(commandKey: string): boolean {
  return MEP_BOILER_STRING_KEY_SET.has(commandKey);
}

/**
 * Returns `true` for the flue VENT TERMINAL picker specifically (a static enum, NOT the
 * dynamic model catalog). The bridge checks this BEFORE the model-picker logic so the
 * two string comboboxes don't cross-talk.
 */
export function isMepBoilerFlueTerminationKey(commandKey: string): boolean {
  return commandKey === MEP_BOILER_RIBBON_KEYS.stringParams.flueTermination;
}

/**
 * Returns `true` for the standalone HEATING FUEL picker specifically (a static enum of
 * `BOILER_FUEL_TYPES`, NOT the dynamic model catalog). The bridge checks this BEFORE the
 * model-picker logic so the two string comboboxes don't cross-talk (mirror of
 * `isMepBoilerFlueTerminationKey`).
 */
export function isMepBoilerFuelTypeKey(commandKey: string): boolean {
  return commandKey === MEP_BOILER_RIBBON_KEYS.stringParams.fuelType;
}
