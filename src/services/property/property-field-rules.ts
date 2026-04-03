/**
 * =============================================================================
 * Property Field Rules — Centralized Cross-Field Validation (Google Pattern)
 * =============================================================================
 *
 * Non-blocking contextual warnings for unusual field combinations.
 * Google Contacts pattern: "This date is in the future — are you sure?"
 *
 * SSoT for all property field compatibility rules.
 * Extend this file when adding new cross-field validations.
 *
 * @module services/property/property-field-rules
 * @since 2026-04-04
 */

import type { PropertyType } from '@/types/property';

// =============================================================================
// TYPES
// =============================================================================

export interface FieldWarning {
  /** i18n key for the warning title (used in ConfirmDialog) */
  titleKey: string;
  /** i18n key for the warning description */
  descriptionKey: string;
  /** Interpolation params for the i18n keys */
  params?: Record<string, string | number>;
}

// =============================================================================
// CONSTANTS — SSoT for property type classification
// =============================================================================

/**
 * Residential property types — basement placement is unusual for these.
 * Storage, parking, shop, office, hall are commonly found in basements.
 */
const RESIDENTIAL_TYPES: ReadonlySet<PropertyType> = new Set([
  'studio',
  'apartment',
  'apartment_1br',
  'apartment_2br',
  'apartment_3br',
  'maisonette',
  'penthouse',
  'loft',
  'detached_house',
  'villa',
]);

// =============================================================================
// RULES
// =============================================================================

/**
 * Check if a floor number represents a basement level.
 */
function isBasementFloor(floor: number): boolean {
  return floor < 0;
}

/**
 * Evaluate whether a floor + property type combination is unusual.
 * Returns a FieldWarning if the combination warrants user confirmation,
 * or null if the combination is normal.
 *
 * @example
 * ```ts
 * const warning = evaluateFloorTypeCompatibility(-1, 'apartment');
 * // → { titleKey: 'fieldWarnings.basementResidential.title', ... }
 *
 * const noWarning = evaluateFloorTypeCompatibility(-1, 'storage');
 * // → null (storage in basement is normal)
 * ```
 */
export function evaluateFloorTypeCompatibility(
  floor: number,
  propertyType: string | undefined,
): FieldWarning | null {
  if (!propertyType) return null;
  if (!isBasementFloor(floor)) return null;
  if (!RESIDENTIAL_TYPES.has(propertyType as PropertyType)) return null;

  return {
    titleKey: 'fieldWarnings.basementResidential.title',
    descriptionKey: 'fieldWarnings.basementResidential.description',
  };
}
