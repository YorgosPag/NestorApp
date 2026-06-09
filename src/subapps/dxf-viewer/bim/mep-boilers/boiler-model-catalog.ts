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
   * Whether the model is a CONDENSING appliance (Revit «Condensing» Yes/No) — extracts
   * latent flue-gas heat and therefore produces acidic condensate that must drain to the
   * sanitary system. `true` for the gas condensing presets; `false` for traditional
   * floor-standing oil, heat-pumps and direct-electric (no combustion condensate). Drives
   * `MepBoilerParams.condensing` (→ the `boiler-condensate` drain connector).
   */
  readonly condensing: boolean;
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
    widthMm: 450,
    depthMm: 350,
    bodyHeightMm: 700,
    connectorDiameterMm: 22,
    fuelType: 'gas',
    seasonalEfficiencyPercent: 94,
    condensing: true,
  },
  {
    id: 'gas-condensing-35',
    labelKey: 'Επίτοιχος αερίου συμπύκνωσης 35 kW',
    thermalOutputW: 35000,
    widthMm: 450,
    depthMm: 350,
    bodyHeightMm: 750,
    connectorDiameterMm: 22,
    fuelType: 'gas',
    seasonalEfficiencyPercent: 93,
    condensing: true,
  },
  {
    id: 'gas-system-28',
    labelKey: 'Αερίου 28 kW',
    thermalOutputW: 28000,
    widthMm: 450,
    depthMm: 350,
    bodyHeightMm: 700,
    connectorDiameterMm: 22,
    fuelType: 'gas',
    seasonalEfficiencyPercent: 91,
    condensing: true,
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
    condensing: false,
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
    condensing: false,
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
    condensing: false,
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
    condensing: false,
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
    width: model.widthMm,
    length: model.depthMm,
    bodyHeightMm: model.bodyHeightMm,
    connectorDiameterMm: model.connectorDiameterMm,
    seasonalEfficiencyPercent: model.seasonalEfficiencyPercent,
    condensing: model.condensing,
  };
}

/**
 * Returns a new `MepBoilerParams` with the model-catalog overrides removed
 * (pure — preserves all other fields). Used when the user selects «Παραμετρικό»
 * (clear sentinel) in the Model picker.
 */
export function clearBoilerModel(params: MepBoilerParams): MepBoilerParams {
  // Omit modelId, fuelType, the seasonal efficiency and the condensing flag — all are
  // Type-Catalog properties (≠ thermalOutputW/geometry which the user may keep and
  // re-size). Back to a purely parametric boiler.
  const {
    modelId: _modelId,
    fuelType: _fuelType,
    seasonalEfficiencyPercent: _seasonalEfficiencyPercent,
    condensing: _condensing,
    ...rest
  } = params;
  return rest as MepBoilerParams;
}
