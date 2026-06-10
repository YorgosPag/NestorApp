/**
 * Boiler Model Catalog (Type Catalog) — SSoT (ADR-408 Εύρος Β #2).
 *
 * Αποτελεί τον κατάλογο τύπων λέβητα ανά κατασκευαστή/καύσιμο, παράλληλος με
 * `sanitary-fixture-mesh-catalog.ts` για τα sanitary fixtures (ADR-411). Κάθε
 * `BoilerModelPreset` χαρτογραφεί ένα εμπορικό μοντέλο σε `MepBoilerParams`
 * πεδία: θερμική ισχύς, διαστάσεις κουτιού, διάμετρος σύνδεσης + τύπος καυσίμου.
 *
 * Το `id` αποθηκεύεται στο `MepBoilerParams.modelId` (persisted). Τα labels
 * είναι literal ονόματα προϊόντων (isLiteralLabel: true στο ribbon) — απαλλαγμένα
 * από i18n key, σύμφωνα με το `isLiteralLabel` convention (N.11 sanctioned exception).
 *
 * SSoT exports:
 *   - `BOILER_MODEL_CATALOG`      readonly array
 *   - `listBoilerModels()`        returns the full list
 *   - `resolveBoilerModel(id)`    lookup by id
 *   - `applyBoilerModelToParams`  pure merge → new MepBoilerParams
 *   - `clearBoilerModel`          removes modelId/fuelType overrides
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { MepBoilerParams } from '../types/mep-boiler-types';

// ─── Fuel type ────────────────────────────────────────────────────────────────

/**
 * Heating fuel / energy source discriminator. Persisted in
 * `MepBoilerParams.fuelType`.
 */
export type BoilerFuelType = 'gas' | 'oil' | 'electric' | 'heat-pump';

/**
 * Runtime SSoT of the four `BoilerFuelType` members — the single source for the
 * standalone «Τύπος Καυσίμου» instance-param picker options, the `isBoilerFuelType`
 * runtime validation guard, and any future enumeration. Ordered combustion-first
 * (gas/oil → open the «Καπναγωγός»/«Καύσιμο» panels) then non-combustion.
 */
export const BOILER_FUEL_TYPES: readonly BoilerFuelType[] = [
  'gas',
  'oil',
  'electric',
  'heat-pump',
] as const;

/**
 * Runtime type guard for an arbitrary string against `BoilerFuelType`. Used by the
 * ribbon bridge to validate a picked combobox value before persisting it (≠ the
 * compile-time `BoilerFuelType` union which cannot validate runtime input).
 */
export function isBoilerFuelType(value: string): value is BoilerFuelType {
  return (BOILER_FUEL_TYPES as readonly string[]).includes(value);
}

// ─── Mounting type ────────────────────────────────────────────────────────────

/**
 * Boiler MOUNTING type (Revit «Mounting» type-property; the boiler-family split
 * «Wall-Hung Boiler» vs «Floor-Standing Boiler»). Persisted in
 * `MepBoilerParams.mountingType`.
 *   - `'wall-hung'`     — επίτοιχος: hung on the wall at a `mountingElevationMm`
 *     vertical centre (the original boiler slice). The default when absent.
 *   - `'floor-standing'` — επιδαπέδιος: sits on the floor (no mounting elevation);
 *     a larger cabinet (e.g. the oil-floor catalog presets).
 *
 * Modelled as an additive type-property (NOT a new `MepBoilerKind` member) so it
 * carries ZERO exhaustive-`switch(kind)` risk and needs no 3D-converter touch — the
 * Revit-grade move (Revit keeps mounting as a type parameter, not a family
 * discriminator here).
 */
export type MepBoilerMountingType = 'wall-hung' | 'floor-standing';

/**
 * Runtime SSoT of the two `MepBoilerMountingType` members — the single source for the
 * «Τοποθέτηση» instance-param picker options, the `isMepBoilerMountingType` runtime
 * validation guard, and any future enumeration. Ordered wall-hung-first (the default).
 */
export const MEP_BOILER_MOUNTING_TYPES: readonly MepBoilerMountingType[] = [
  'wall-hung',
  'floor-standing',
] as const;

/**
 * Default boiler mounting type — `'wall-hung'` (the original επίτοιχος slice). Used
 * when `MepBoilerParams.mountingType` is absent, so pre-mounting-type boilers stay
 * επίτοιχοι with zero regression.
 */
export const DEFAULT_BOILER_MOUNTING_TYPE: MepBoilerMountingType = 'wall-hung';

/**
 * Runtime type guard for an arbitrary string against `MepBoilerMountingType`. Used by
 * the ribbon bridge to validate a picked combobox value before persisting it (mirror
 * of `isBoilerFuelType`).
 */
export function isMepBoilerMountingType(value: string): value is MepBoilerMountingType {
  return (MEP_BOILER_MOUNTING_TYPES as readonly string[]).includes(value);
}

// ─── Preset interface ─────────────────────────────────────────────────────────

export interface BoilerModelPreset {
  /**
   * Catalog id — persisted in `MepBoilerParams.modelId`. Stable, kebab-case.
   * Once assigned to a saved document it MUST NOT change.
   */
  readonly id: string;
  /**
   * Literal product label (Greek). Rendered with `isLiteralLabel: true` in the
   * ribbon combobox (N.11 sanctioned literal — product names are not i18n keys).
   */
  readonly labelKey: string;
  /** W — nominal catalogue thermal output (heat input at rated conditions). */
  readonly thermalOutputW: number;
  /**
   * W — MINIMUM modulating output (Revit «Turndown Ratio», IFC part-load family). Set on
   * MODULATING presets (modern gas condensing modulate to ~25–30% of nominal → ~4:1 turndown);
   * OMITTED for fixed-output / on-off presets (traditional oil, direct-electric). Drives the
   * turndown ratio (`resolveTurndownRatio`) on the plan tag. Optional/additive.
   */
  readonly minThermalOutputW?: number;
  /** mm — cabinet width along the wall (local X; the dimension where both connectors sit). */
  readonly widthMm: number;
  /** mm — cabinet depth front-to-back (local Y). Maps to `MepBoilerParams.length`. */
  readonly depthMm: number;
  /** mm — cabinet vertical height (3D box extent). */
  readonly bodyHeightMm: number;
  /** mm — nominal supply/return connector diameter. */
  readonly connectorDiameterMm: number;
  /** Heating fuel / energy source. */
  readonly fuelType: BoilerFuelType;
  /**
   * % — seasonal APPLIANCE efficiency (Revit «Nominal Efficiency», IFC
   * `Pset_BoilerTypeCommon.NominalEfficiency`). Drives the ErP energy class via
   * `resolveErpClass` (primary-energy adjusted). Realistic ranges: condensing gas
   * ≈90–96, oil ≈85–90, direct electric ≈99, heat-pump ≈120–160 (SCOP-derived η_s).
   */
  readonly seasonalEfficiencyPercent: number;
  /**
   * mg/kWh — measured NOx emissions (Revit «NOx Emission», EU Ecodesign 813/2013). Set on the
   * COMBUSTION presets (gas/oil) and resolved against the per-fuel legal ceiling by
   * `resolveNoxClass`; OMITTED for electric/heat-pump (no combustion → no NOx). Modern gas
   * condensing ≈30–45 (Class 6, ≤56); oil ≈110–115 (≤120). Optional/additive — drives
   * `MepBoilerParams.noxMgKwh` (the «NOx» readout + plan-tag line).
   */
  readonly noxMgKwh?: number;
  /**
   * dB(A) — internal SOUND POWER LEVEL `L_WA` (Revit Mechanical Equipment «Sound», IFC
   * `Pset_SoundAttenuation`). Set on EVERY preset (a pump/fan/burner all emit noise, ≠ NOx
   * which is combustion-only): wall-hung gas ≈45–49, floor-standing oil ≈55–60, heat-pump
   * ≈50–58, direct-electric ≈40. Resolved to a placement-suitability band by
   * `resolveAcousticBand`; drives `MepBoilerParams.soundPowerDbA` (the «Θόρυβος» readout +
   * plan-tag line). Optional/additive.
   */
  readonly soundPowerDbA?: number;
  /**
   * Whether the model is a CONDENSING appliance (Revit «Condensing» Yes/No) — extracts
   * latent flue-gas heat and therefore produces acidic condensate that must drain to the
   * sanitary system. `true` for the gas condensing presets; `false` for traditional
   * floor-standing oil, heat-pumps and direct-electric (no combustion condensate). Drives
   * `MepBoilerParams.condensing` (→ the `boiler-condensate` drain connector).
   */
  readonly condensing: boolean;
  /**
   * MOUNTING type (Revit «Mounting» type-property) — `'floor-standing'` for the larger
   * oil-floor cabinets, OMITTED (⇒ `'wall-hung'` default) for the wall-hung gas/electric
   * presets. Drives `MepBoilerParams.mountingType` (the «Τοποθέτηση» readout + plan-tag
   * line; floor-standing boilers ignore the wall-mounting elevation). Optional/additive.
   */
  readonly mountingType?: MepBoilerMountingType;
  /**
   * kg — appliance dry WEIGHT (Revit «Weight»). Structural-loading datum: floor-standing
   * oil cabinets are heavy (~120–180 kg), wall-hung gas units light (~35–40 kg). Drives
   * `MepBoilerParams.weightKg` (the «Βάρος» plan-tag line). Optional/additive.
   */
  readonly weightKg?: number;
  /**
   * L — boiler WATER CONTENT (IFC `Pset_BoilerTypeCommon.WaterStorageCapacity`). System
   * water held in the heat exchanger / body; feeds the recommended expansion-vessel sizing.
   * Drives `MepBoilerParams.waterContentL` (the «Νερό» plan-tag line + «Προτεινόμενο δοχείο»
   * readout). Optional/additive.
   */
  readonly waterContentL?: number;
}

// ─── Catalog data ─────────────────────────────────────────────────────────────

/**
 * Realistic Greek-labelled boiler catalog entries spanning 4 fuel types.
 * Dimensions are representative of current European residential/light-commercial
 * equipment (EN 15502 / EN 14511 compliant range).
 *
 * Connector diameters: DN22 (3/4" BSP) for wall-hung gas/electric (≤35 kW);
 * DN28 (1" BSP) for floor-standing oil/large heat-pump (30–45 kW).
 */
export const BOILER_MODEL_CATALOG: readonly BoilerModelPreset[] = [
  {
    id: 'gas-condensing-24',
    labelKey: 'Επίτοιχος αερίου συμπύκνωσης 24 kW',
    thermalOutputW: 24000,
    minThermalOutputW: 6000,
    widthMm: 450,
    depthMm: 350,
    bodyHeightMm: 700,
    connectorDiameterMm: 22,
    fuelType: 'gas',
    seasonalEfficiencyPercent: 94,
    noxMgKwh: 32,
    soundPowerDbA: 45,
    condensing: true,
    weightKg: 35,
    waterContentL: 2.5,
  },
  {
    id: 'gas-condensing-35',
    labelKey: 'Επίτοιχος αερίου συμπύκνωσης 35 kW',
    thermalOutputW: 35000,
    minThermalOutputW: 9000,
    widthMm: 450,
    depthMm: 350,
    bodyHeightMm: 750,
    connectorDiameterMm: 22,
    fuelType: 'gas',
    seasonalEfficiencyPercent: 93,
    noxMgKwh: 38,
    soundPowerDbA: 48,
    condensing: true,
    weightKg: 40,
    waterContentL: 3,
  },
  {
    id: 'gas-system-28',
    labelKey: 'Αερίου 28 kW',
    thermalOutputW: 28000,
    minThermalOutputW: 7000,
    widthMm: 450,
    depthMm: 350,
    bodyHeightMm: 700,
    connectorDiameterMm: 22,
    fuelType: 'gas',
    seasonalEfficiencyPercent: 91,
    noxMgKwh: 45,
    soundPowerDbA: 47,
    condensing: true,
    weightKg: 37,
    waterContentL: 2.8,
  },
  {
    id: 'oil-floor-30',
    labelKey: 'Πετρελαίου επιδαπέδιος 30 kW',
    thermalOutputW: 30000,
    widthMm: 600,
    depthMm: 600,
    bodyHeightMm: 1200,
    connectorDiameterMm: 28,
    fuelType: 'oil',
    seasonalEfficiencyPercent: 89,
    noxMgKwh: 110,
    soundPowerDbA: 56,
    condensing: false,
    mountingType: 'floor-standing',
    weightKg: 130,
    waterContentL: 28,
  },
  {
    id: 'oil-floor-45',
    labelKey: 'Πετρελαίου επιδαπέδιος 45 kW',
    thermalOutputW: 45000,
    widthMm: 700,
    depthMm: 650,
    bodyHeightMm: 1300,
    connectorDiameterMm: 28,
    fuelType: 'oil',
    seasonalEfficiencyPercent: 88,
    noxMgKwh: 115,
    soundPowerDbA: 58,
    condensing: false,
    mountingType: 'floor-standing',
    weightKg: 165,
    waterContentL: 38,
  },
  {
    id: 'heatpump-12',
    labelKey: 'Αντλία θερμότητας 12 kW',
    thermalOutputW: 12000,
    widthMm: 1000,
    depthMm: 400,
    bodyHeightMm: 800,
    connectorDiameterMm: 28,
    fuelType: 'heat-pump',
    seasonalEfficiencyPercent: 156,
    soundPowerDbA: 52,
    condensing: false,
    weightKg: 80,
    waterContentL: 3,
  },
  {
    id: 'electric-9',
    labelKey: 'Ηλεκτρικός 9 kW',
    thermalOutputW: 9000,
    widthMm: 400,
    depthMm: 250,
    bodyHeightMm: 700,
    connectorDiameterMm: 22,
    fuelType: 'electric',
    seasonalEfficiencyPercent: 99,
    soundPowerDbA: 40,
    condensing: false,
    weightKg: 22,
    waterContentL: 4,
  },
] as const;

// ─── Lookup functions ─────────────────────────────────────────────────────────

/** Returns all catalog entries (use as picker option source). */
export function listBoilerModels(): readonly BoilerModelPreset[] {
  return BOILER_MODEL_CATALOG;
}

/**
 * Looks up a preset by its persisted `id`.
 * Returns `undefined` for an unrecognised id (defensive — handles legacy data).
 */
export function resolveBoilerModel(modelId: string): BoilerModelPreset | undefined {
  return BOILER_MODEL_CATALOG.find((m) => m.id === modelId);
}

// ─── Pure param helpers ────────────────────────────────────────────────────────

/**
 * Returns a new `MepBoilerParams` with the preset's geometry + thermalOutputW
 * applied (pure — does NOT mutate `params`). The connector dimensions, position,
 * rotation, mounting elevation, and systemClassification are preserved.
 *
 * Mapping:
 *   preset.widthMm         → params.width
 *   preset.depthMm         → params.length
 *   preset.bodyHeightMm    → params.bodyHeightMm
 *   preset.connectorDiameterMm → params.connectorDiameterMm
 *   preset.thermalOutputW  → params.thermalOutputW
 *   preset.minThermalOutputW → params.minThermalOutputW (modulating presets only)
 *   preset.fuelType        → params.fuelType
 *   preset.seasonalEfficiencyPercent → params.seasonalEfficiencyPercent
 *   preset.id              → params.modelId
 */
export function applyBoilerModelToParams(
  params: MepBoilerParams,
  model: BoilerModelPreset,
): MepBoilerParams {
  return {
    ...params,
    modelId: model.id,
    fuelType: model.fuelType,
    thermalOutputW: model.thermalOutputW,
    // Modulating presets carry a minimum; on/off presets clear it (undefined ⇒ no turndown).
    minThermalOutputW: model.minThermalOutputW,
    width: model.widthMm,
    length: model.depthMm,
    bodyHeightMm: model.bodyHeightMm,
    connectorDiameterMm: model.connectorDiameterMm,
    seasonalEfficiencyPercent: model.seasonalEfficiencyPercent,
    // Combustion presets carry a NOx figure; electric/heat-pump clear it (undefined ⇒ no NOx).
    noxMgKwh: model.noxMgKwh,
    // Every preset carries a sound power figure (all appliances emit noise); absent ⇒ unspecified.
    soundPowerDbA: model.soundPowerDbA,
    condensing: model.condensing,
    // Floor-standing presets (oil-floor) carry the mounting type; wall-hung presets clear it
    // (undefined ⇒ DEFAULT_BOILER_MOUNTING_TYPE = wall-hung).
    mountingType: model.mountingType,
    // Installation data (physical Type-properties) — appliance weight + water content.
    weightKg: model.weightKg,
    waterContentL: model.waterContentL,
  };
}

/**
 * Returns a new `MepBoilerParams` with the model-catalog overrides removed
 * (pure — preserves all other fields). Used when the user selects «Παραμετρικό»
 * (clear sentinel) in the Model picker.
 */
export function clearBoilerModel(params: MepBoilerParams): MepBoilerParams {
  // Omit modelId, fuelType, the seasonal efficiency, the NOx figure, the sound power, the condensing
  // flag and the minimum modulating output — all are Type-Catalog properties (≠ thermalOutputW/geometry
  // which the user may keep and re-size). Back to a purely parametric boiler.
  const {
    modelId: _modelId,
    fuelType: _fuelType,
    seasonalEfficiencyPercent: _seasonalEfficiencyPercent,
    noxMgKwh: _noxMgKwh,
    soundPowerDbA: _soundPowerDbA,
    condensing: _condensing,
    minThermalOutputW: _minThermalOutputW,
    mountingType: _mountingType,
    weightKg: _weightKg,
    waterContentL: _waterContentL,
    ...rest
  } = params;
  return rest as MepBoilerParams;
}
