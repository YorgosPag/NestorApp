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
  };
}

/**
 * Returns a new `MepBoilerParams` with the model-catalog overrides removed
 * (pure — preserves all other fields). Used when the user selects «Παραμετρικό»
 * (clear sentinel) in the Model picker.
 */
export function clearBoilerModel(params: MepBoilerParams): MepBoilerParams {
  // Omit modelId and fuelType — back to a purely parametric boiler.
  const { modelId: _modelId, fuelType: _fuelType, ...rest } = params;
  return rest as MepBoilerParams;
}
