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
    /** W — minimum modulating output (Revit «Turndown Ratio»; absent ⇒ on/off appliance). */
    minThermalOutput: 'mepBoiler.params.minThermalOutput',
    /** % — seasonal appliance efficiency (Revit «Nominal Efficiency»). Drives ErP class. */
    efficiency: 'mepBoiler.params.efficiency',
    /** mg/kWh — measured NOx emissions (Revit «NOx Emission»). Drives the Ecodesign compliance class. */
    nox: 'mepBoiler.params.nox',
    /** dB(A) — measured sound power level L_WA (Revit «Sound»). Drives the placement-suitability band. */
    soundPower: 'mepBoiler.params.soundPower',
    /** mm — COMBI DHW connector diameter (hot outlet + cold inlet). Combi-only panel. */
    dhwConnectorDiameter: 'mepBoiler.params.dhwConnectorDiameter',
    /** mm — combustion flue (καπναγωγός) diameter. Gas/oil-only panel («Καπναγωγός»). */
    flueDiameter: 'mepBoiler.params.flueDiameter',
    /** mm — combustion fuel supply (τροφοδοσία καυσίμου) diameter. Gas/oil-only panel («Καύσιμο»). */
    fuelDiameter: 'mepBoiler.params.fuelDiameter',
    /** mm — condensate drain (αποχέτευση συμπυκνωμάτων) diameter. Condensing-only panel («Συμπύκνωση»). */
    condensateDiameter: 'mepBoiler.params.condensateDiameter',
    /** mm — service-clearance distance (Revit «Clearances»). «Καθαρός χώρος» panel. */
    serviceClearance: 'mepBoiler.params.serviceClearance',
    /** L — expansion-vessel volume (Revit accessory). Lives in the always-visible «Ασφάλεια» panel. */
    expansionVesselVolume: 'mepBoiler.params.expansionVesselVolume',
    /** kg — appliance dry weight (Revit «Weight», structural loading). «Εγκατάσταση» panel. */
    weight: 'mepBoiler.params.weight',
    /** L — boiler water content (IFC water storage). «Εγκατάσταση» panel; feeds the vessel readout. */
    waterContent: 'mepBoiler.params.waterContent',
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
     * `reliefValvePressure`: SAFETY RELIEF VALVE set-pressure picker (Revit «Safety Relief
     * Valve» set pressure). A static enum of standard valve ratings (`BOILER_RELIEF_PRESSURES_BAR`),
     * NOT a catalog — routed by `isMepBoilerReliefPressureKey`, distinct from the model picker. A
     * string combobox (NOT a generic number) because the set-pressures are fractional (1.5/2.5
     * bar) and the numeric path would round them. Lives in the always-visible «Ασφάλεια» panel.
     */
    reliefValvePressure: 'mepBoiler.params.reliefValvePressure',
    /**
     * `systemPressure`: PRESSURE GAUGE system (cold fill) pressure picker (the gauge dial reading).
     * A static enum of standard fill pressures (`BOILER_SYSTEM_PRESSURES_BAR`), NOT a catalog —
     * routed by `isMepBoilerSystemPressureKey`, distinct from the model picker. A string combobox
     * (NOT a generic number) because the fill pressures are fractional (1.2 / 1.5 bar) and the
     * numeric path would round them. DISTINCT from `reliefValvePressure` (the valve SET pressure).
     * Lives in the always-visible «Ασφάλεια» panel.
     */
    systemPressure: 'mepBoiler.params.systemPressure',
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
    /**
     * `mountingType`: standalone MOUNTING picker (Revit «Mounting» type-property — wall-hung /
     * floor-standing). A static enum (`MEP_BOILER_MOUNTING_TYPES`), NOT a catalog — routed by
     * `isMepBoilerMountingTypeKey`, distinct from the dynamic model picker. No clear sentinel
     * (a boiler is always one or the other; absent ⇒ wall-hung default). The model catalog also
     * fills it (floor-standing for the oil-floor presets), but this instance param overrides
     * independently. Lives in the «Μοντέλο» panel next to the fuel picker.
     */
    mountingType: 'mepBoiler.params.mountingType',
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
    /**
     * `condensateNeutraliser`: CONDENSATE NEUTRALISER flag (εξουδετερωτής). ON (with
     * `condensing`) → the plan symbol draws an in-line cartridge box on the condensate drain.
     * Lives in the condensing-gated «Συμπύκνωση» panel next to the condensate diameter.
     */
    condensateNeutraliser: 'mepBoiler.params.condensateNeutraliser',
    /**
     * `showServiceClearance`: SERVICE CLEARANCE flag (Revit Mechanical Equipment
     * «Clearances»). ON → the plan symbol + placement ghost draw a dashed «keep-clear»
     * envelope offset outward from the footprint (maintenance-access zone). Visualisation
     * only — no connector impact. Lives in the always-visible «Καθαρός χώρος» panel.
     */
    showServiceClearance: 'mepBoiler.params.showServiceClearance',
    /**
     * `safetyReliefValve`: SAFETY RELIEF VALVE flag (Revit «Safety Relief Valve»). ON → the plan
     * symbol draws a relief-valve body glyph on the boiler body (code-mandatory pressure-relief
     * device). Visualisation only — no connector. Lives in the always-visible «Ασφάλεια» panel.
     */
    safetyReliefValve: 'mepBoiler.params.safetyReliefValve',
    /**
     * `expansionVessel`: EXPANSION VESSEL flag (Revit accessory, IFC `IfcTank` EXPANSION). ON → the
     * plan symbol draws a diaphragm-vessel body glyph on the boiler body (the sealed-system partner
     * of the relief valve). Visualisation only — no connector. Lives in the always-visible «Ασφάλεια»
     * panel next to the relief-valve toggle.
     */
    expansionVessel: 'mepBoiler.params.expansionVessel',
    /**
     * `pressureGauge`: PRESSURE GAUGE flag (Revit accessory, IFC `IfcSensor` PRESSURE). ON → the
     * plan symbol draws a dial-gauge body glyph on the boiler body (the third sealed-system
     * instrument: relief valve + expansion vessel + gauge). Visualisation only — no connector.
     * Lives in the always-visible «Ασφάλεια» panel next to the expansion-vessel toggle.
     */
    pressureGauge: 'mepBoiler.params.pressureGauge',
    /**
     * `fillingLoop`: FILLING LOOP flag (βρόχος πλήρωσης, Revit/IFC `IfcValve` CHECK). ON → the plan
     * symbol draws a filling-loop body glyph (double-check valve + flexible loop + isolation ticks) —
     * the sealed-system charging device. Visualisation only — no connector, no extra pressure (the
     * fill target is the gauge's `systemPressure`). Lives in the always-visible «Ασφάλεια» panel,
     * completing the sealed-system family (valve + vessel + gauge + filling loop).
     */
    fillingLoop: 'mepBoiler.params.fillingLoop',
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
    /** EU Ecodesign NOx compliance verdict — derived from noxMgKwh + fuelType (resolveNoxClass). */
    noxClass: 'mepBoiler.readout.noxClass',
    /** Placement-suitability band (quiet/standard/loud) — derived from soundPowerDbA (resolveAcousticBand). */
    acousticBand: 'mepBoiler.readout.acousticBand',
    /** L — indicative recommended expansion-vessel size — derived from waterContentL (resolveRecommendedExpansionVesselL). */
    recommendedVessel: 'mepBoiler.readout.recommendedVessel',
  },
} as const;

export type MepBoilerRibbonNumberCommandKey =
  | typeof MEP_BOILER_RIBBON_KEYS.params.width
  | typeof MEP_BOILER_RIBBON_KEYS.params.length
  | typeof MEP_BOILER_RIBBON_KEYS.params.bodyHeight
  | typeof MEP_BOILER_RIBBON_KEYS.params.mountingElevation
  | typeof MEP_BOILER_RIBBON_KEYS.params.connectorDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.thermalOutput
  | typeof MEP_BOILER_RIBBON_KEYS.params.minThermalOutput
  | typeof MEP_BOILER_RIBBON_KEYS.params.dhwConnectorDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.flueDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.fuelDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.condensateDiameter
  | typeof MEP_BOILER_RIBBON_KEYS.params.serviceClearance
  | typeof MEP_BOILER_RIBBON_KEYS.params.expansionVesselVolume
  | typeof MEP_BOILER_RIBBON_KEYS.params.efficiency
  | typeof MEP_BOILER_RIBBON_KEYS.params.nox
  | typeof MEP_BOILER_RIBBON_KEYS.params.soundPower
  | typeof MEP_BOILER_RIBBON_KEYS.params.weight
  | typeof MEP_BOILER_RIBBON_KEYS.params.waterContent;

export const MEP_BOILER_RIBBON_NUMBER_KEYS: readonly MepBoilerRibbonNumberCommandKey[] = [
  MEP_BOILER_RIBBON_KEYS.params.width,
  MEP_BOILER_RIBBON_KEYS.params.length,
  MEP_BOILER_RIBBON_KEYS.params.bodyHeight,
  MEP_BOILER_RIBBON_KEYS.params.mountingElevation,
  MEP_BOILER_RIBBON_KEYS.params.connectorDiameter,
  MEP_BOILER_RIBBON_KEYS.params.thermalOutput,
  MEP_BOILER_RIBBON_KEYS.params.minThermalOutput,
  MEP_BOILER_RIBBON_KEYS.params.dhwConnectorDiameter,
  MEP_BOILER_RIBBON_KEYS.params.flueDiameter,
  MEP_BOILER_RIBBON_KEYS.params.fuelDiameter,
  MEP_BOILER_RIBBON_KEYS.params.condensateDiameter,
  MEP_BOILER_RIBBON_KEYS.params.serviceClearance,
  MEP_BOILER_RIBBON_KEYS.params.expansionVesselVolume,
  MEP_BOILER_RIBBON_KEYS.params.efficiency,
  MEP_BOILER_RIBBON_KEYS.params.nox,
  MEP_BOILER_RIBBON_KEYS.params.soundPower,
  MEP_BOILER_RIBBON_KEYS.params.weight,
  MEP_BOILER_RIBBON_KEYS.params.waterContent,
];

// ─── Toggle keys (Revit Yes/No params) ───────────────────────────────────────

export type MepBoilerRibbonToggleCommandKey =
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.producesDhw
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.dhwRecirculation
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.condensing
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.condensateNeutraliser
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.showServiceClearance
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.safetyReliefValve
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.expansionVessel
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.pressureGauge
  | typeof MEP_BOILER_RIBBON_KEYS.toggles.fillingLoop;

export const MEP_BOILER_RIBBON_TOGGLE_KEYS: readonly MepBoilerRibbonToggleCommandKey[] = [
  MEP_BOILER_RIBBON_KEYS.toggles.producesDhw,
  MEP_BOILER_RIBBON_KEYS.toggles.dhwRecirculation,
  MEP_BOILER_RIBBON_KEYS.toggles.condensing,
  MEP_BOILER_RIBBON_KEYS.toggles.condensateNeutraliser,
  MEP_BOILER_RIBBON_KEYS.toggles.showServiceClearance,
  MEP_BOILER_RIBBON_KEYS.toggles.safetyReliefValve,
  MEP_BOILER_RIBBON_KEYS.toggles.expansionVessel,
  MEP_BOILER_RIBBON_KEYS.toggles.pressureGauge,
  MEP_BOILER_RIBBON_KEYS.toggles.fillingLoop,
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
  | typeof MEP_BOILER_RIBBON_KEYS.readouts.erpClass
  | typeof MEP_BOILER_RIBBON_KEYS.readouts.noxClass
  | typeof MEP_BOILER_RIBBON_KEYS.readouts.acousticBand
  | typeof MEP_BOILER_RIBBON_KEYS.readouts.recommendedVessel;

const MEP_BOILER_READOUT_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_BOILER_RIBBON_KEYS.readouts.requiredOutputW,
  MEP_BOILER_RIBBON_KEYS.readouts.installedOutputW,
  MEP_BOILER_RIBBON_KEYS.readouts.adequacyStatus,
  MEP_BOILER_RIBBON_KEYS.readouts.erpClass,
  MEP_BOILER_RIBBON_KEYS.readouts.noxClass,
  MEP_BOILER_RIBBON_KEYS.readouts.acousticBand,
  MEP_BOILER_RIBBON_KEYS.readouts.recommendedVessel,
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
  | typeof MEP_BOILER_RIBBON_KEYS.stringParams.fuelType
  | typeof MEP_BOILER_RIBBON_KEYS.stringParams.mountingType
  | typeof MEP_BOILER_RIBBON_KEYS.stringParams.reliefValvePressure
  | typeof MEP_BOILER_RIBBON_KEYS.stringParams.systemPressure;

export const MEP_BOILER_STRING_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_BOILER_RIBBON_KEYS.stringParams.modelId,
  MEP_BOILER_RIBBON_KEYS.stringParams.flueTermination,
  MEP_BOILER_RIBBON_KEYS.stringParams.fuelType,
  MEP_BOILER_RIBBON_KEYS.stringParams.mountingType,
  MEP_BOILER_RIBBON_KEYS.stringParams.reliefValvePressure,
  MEP_BOILER_RIBBON_KEYS.stringParams.systemPressure,
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

/**
 * Returns `true` for the standalone MOUNTING picker specifically (a static enum of
 * `MEP_BOILER_MOUNTING_TYPES`, NOT the dynamic model catalog). The bridge checks this BEFORE
 * the model-picker logic so the two string comboboxes don't cross-talk (mirror of
 * `isMepBoilerFuelTypeKey`).
 */
export function isMepBoilerMountingTypeKey(commandKey: string): boolean {
  return commandKey === MEP_BOILER_RIBBON_KEYS.stringParams.mountingType;
}

/**
 * Returns `true` for the SAFETY RELIEF VALVE set-pressure picker specifically (a static enum of
 * standard valve ratings, NOT the dynamic model catalog). The bridge checks this BEFORE the
 * model-picker logic so the string comboboxes don't cross-talk (mirror of
 * `isMepBoilerFuelTypeKey`).
 */
export function isMepBoilerReliefPressureKey(commandKey: string): boolean {
  return commandKey === MEP_BOILER_RIBBON_KEYS.stringParams.reliefValvePressure;
}

/**
 * Returns `true` for the PRESSURE GAUGE system-pressure picker specifically (a static enum of
 * standard cold-fill pressures, NOT the dynamic model catalog). The bridge checks this BEFORE the
 * model-picker logic so the string comboboxes don't cross-talk (mirror of
 * `isMepBoilerReliefPressureKey`). DISTINCT from the relief-valve set-pressure picker.
 */
export function isMepBoilerSystemPressureKey(commandKey: string): boolean {
  return commandKey === MEP_BOILER_RIBBON_KEYS.stringParams.systemPressure;
}
