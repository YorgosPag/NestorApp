/**
 * 🏢 BUILDING FEATURES REGISTRY - Single Source of Truth
 *
 * @fileoverview Central registry for building feature keys.
 * All building features MUST be defined here.
 *
 * @enterprise Fortune 500 compliant - Zero hardcoded labels
 * @i18n All labels come from i18n translations (storageForm.features.building.*)
 * @author Enterprise Architecture Team
 * @since 2026-01-12
 */

// ============================================================================
// BUILDING FEATURES REGISTRY - Keys + i18n paths only (NO LABELS)
// ============================================================================

/**
 * Central registry of all building features.
 * Each key maps to its i18n translation path.
 *
 * @usage
 * - DB stores: BuildingFeatureKey (e.g., 'autonomousHeating')
 * - UI displays: t(BUILDING_FEATURES.autonomousHeating.i18nKey)
 */
export const BUILDING_FEATURES = {
  // Heating & Climate
  autonomousHeating: { i18nKey: 'storageForm.features.building.autonomousHeating' },
  solarHeating: { i18nKey: 'storageForm.features.building.solarHeating' },
  vrvClimate: { i18nKey: 'storageForm.features.building.vrvClimate' },
  smartClimate: { i18nKey: 'storageForm.features.building.smartClimate' },
  warehouseClimate: { i18nKey: 'storageForm.features.building.warehouseClimate' },

  // Ventilation
  automaticVentilation: { i18nKey: 'storageForm.features.building.automaticVentilation' },
  naturalVentilation: { i18nKey: 'storageForm.features.building.naturalVentilation' },

  // Parking & Transport
  parkingSpaces: { i18nKey: 'storageForm.features.building.parkingSpaces' },
  electricVehicleCharging: { i18nKey: 'storageForm.features.building.electricVehicleCharging' },
  teslaVwCharging: { i18nKey: 'storageForm.features.building.teslaVwCharging' },
  parkingGuidanceSystem: { i18nKey: 'storageForm.features.building.parkingGuidanceSystem' },
  carWash: { i18nKey: 'storageForm.features.building.carWash' },
  carWashPlural: { i18nKey: 'storageForm.features.building.carWashPlural' },

  // Elevators & Access
  elevator: { i18nKey: 'storageForm.features.building.elevator' },
  escalatorsAllFloors: { i18nKey: 'storageForm.features.building.escalatorsAllFloors' },
  disabilityAccess: { i18nKey: 'storageForm.features.building.disabilityAccess' },
  loadingAccess: { i18nKey: 'storageForm.features.building.loadingAccess' },
  loadingRamps: { i18nKey: 'storageForm.features.building.loadingRamps' },
  accessControl: { i18nKey: 'storageForm.features.building.accessControl' },

  // Security
  securityCameras247: { i18nKey: 'storageForm.features.building.securityCameras247' },
  securitySystems: { i18nKey: 'storageForm.features.building.securitySystems' },
  mechanicalSecurity: { i18nKey: 'storageForm.features.building.mechanicalSecurity' },
  emergencyExits: { i18nKey: 'storageForm.features.building.emergencyExits' },

  // Fire Safety
  fireSuppression: { i18nKey: 'storageForm.features.building.fireSuppression' },
  gasFireSuppression: { i18nKey: 'storageForm.features.building.gasFireSuppression' },

  // Energy & Power
  energyClassAPlus: { i18nKey: 'storageForm.features.building.energyClassAPlus' },
  powerSupply1000kw: { i18nKey: 'storageForm.features.building.powerSupply1000kw' },

  // Architecture & Design
  balconiesWithView: { i18nKey: 'storageForm.features.building.balconiesWithView' },
  shopWindows: { i18nKey: 'storageForm.features.building.shopWindows' },
  naturalLightingAtrium: { i18nKey: 'storageForm.features.building.naturalLightingAtrium' },
  highQualityAcoustics: { i18nKey: 'storageForm.features.building.highQualityAcoustics' },

  // Industrial & Warehouse
  craneBridge20Tons: { i18nKey: 'storageForm.features.building.craneBridge20Tons' },
  dustRemovalSystems: { i18nKey: 'storageForm.features.building.dustRemovalSystems' },
  highShelving12m: { i18nKey: 'storageForm.features.building.highShelving12m' },
  rfidTracking: { i18nKey: 'storageForm.features.building.rfidTracking' },

  // Automation & Technology
  automationSystems: { i18nKey: 'storageForm.features.building.automationSystems' },
  monitoringSystems: { i18nKey: 'storageForm.features.building.monitoringSystems' },
  videoConferencingAllRooms: { i18nKey: 'storageForm.features.building.videoConferencingAllRooms' },
  shopManagementSystem: { i18nKey: 'storageForm.features.building.shopManagementSystem' },

  // Amenities
  staffCafeteria: { i18nKey: 'storageForm.features.building.staffCafeteria' },
  foodCourt800Seats: { i18nKey: 'storageForm.features.building.foodCourt800Seats' },
  cinema8Rooms: { i18nKey: 'storageForm.features.building.cinema8Rooms' },
  playground300sqm: { i18nKey: 'storageForm.features.building.playground300sqm' },
} as const;

// ============================================================================
// TYPE EXPORTS - Derived from registry (Single Source of Truth)
// ============================================================================

/**
 * Type-safe building feature key.
 * Use this instead of string for features field.
 */
export type BuildingFeatureKey = keyof typeof BUILDING_FEATURES;

/**
 * Array of all valid building feature keys.
 * Useful for UI dropdowns/selects.
 */
export const BUILDING_FEATURE_KEYS = Object.keys(BUILDING_FEATURES) as BuildingFeatureKey[];

/**
 * Feature definition with i18n key.
 */
export interface BuildingFeatureDefinition {
  readonly i18nKey: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the i18n key for a building feature.
 * @param key - The building feature key
 * @returns The i18n translation path
 */
export function getBuildingFeatureI18nKey(key: BuildingFeatureKey): string {
  return BUILDING_FEATURES[key].i18nKey;
}

/**
 * Check if a string is a valid BuildingFeatureKey.
 * @param value - String to validate
 * @returns Type guard for BuildingFeatureKey
 */
export function isBuildingFeatureKey(value: string): value is BuildingFeatureKey {
  return value in BUILDING_FEATURES;
}

/**
 * Get all features as array of { key, i18nKey } objects.
 * Useful for UI rendering.
 */
export function getBuildingFeaturesForUI(): Array<{ key: BuildingFeatureKey; i18nKey: string }> {
  return BUILDING_FEATURE_KEYS.map(key => ({
    key,
    i18nKey: BUILDING_FEATURES[key].i18nKey,
  }));
}

// ============================================================================
// RUNTIME VALIDATION - For dynamic/parsed inputs (env vars, user input, etc.)
// ============================================================================

/**
 * Validate and assert an array of strings as BuildingFeatureKey[].
 * Use this for dynamic inputs (env vars, DB reads, user input).
 *
 * @param values - Array of strings to validate
 * @param context - Optional context for error messages (e.g., 'env.FEATURES')
 * @returns Validated BuildingFeatureKey array
 * @throws Error if any value is not a valid BuildingFeatureKey
 *
 * @example
 * // Runtime validation for env vars
 * const features = assertBuildingFeatureKeys(
 *   process.env.FEATURES?.split(',') || [],
 *   'NEXT_PUBLIC_SAMPLE_BUILDING_1_FEATURES'
 * );
 */
export function assertBuildingFeatureKeys(
  values: readonly string[],
  context?: string
): BuildingFeatureKey[] {
  const invalid: string[] = [];
  const valid: BuildingFeatureKey[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed === '') continue; // Skip empty strings

    if (isBuildingFeatureKey(trimmed)) {
      valid.push(trimmed);
    } else {
      invalid.push(trimmed);
    }
  }

  if (invalid.length > 0) {
    const contextMsg = context ? ` in ${context}` : '';
    throw new Error(
      `Invalid BuildingFeatureKey(s)${contextMsg}: ${invalid.join(', ')}. ` +
      `Valid keys are: ${BUILDING_FEATURE_KEYS.join(', ')}`
    );
  }

  return valid;
}

/**
 * Filter valid BuildingFeatureKey values from a comma-separated string.
 * Invalid keys are silently dropped (not thrown).
 *
 * Use this when you want lenient parsing that ignores invalid values.
 * For strict validation that throws on invalid, use assertBuildingFeatureKeys().
 *
 * @param input - Comma-separated string of feature keys
 * @returns Array containing only valid BuildingFeatureKey values
 *
 * @example
 * filterBuildingFeatureKeys('elevator,invalid,parkingSpaces')
 * // Returns: ['elevator', 'parkingSpaces']
 */
export function filterBuildingFeatureKeys(input: string | undefined): BuildingFeatureKey[] {
  if (!input || input.trim() === '') return [];

  const values = input.split(',').map(s => s.trim()).filter(Boolean);
  return values.filter(isBuildingFeatureKey);
}
