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
import { RESIDENTIAL_PROPERTY_TYPES } from '@/constants/property-types';

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
// CONSTANTS — derived from SSoT (@/constants/property-types, ADR-145)
// =============================================================================

/**
 * Residential property types — basement placement is unusual for these.
 * Shop, office, hall, storage (commercial/auxiliary) are commonly found in basements.
 * Derived from SSoT `RESIDENTIAL_PROPERTY_TYPES` (includes deprecated underscore values).
 */
const RESIDENTIAL_TYPES: ReadonlySet<PropertyType> = new Set(
  RESIDENTIAL_PROPERTY_TYPES,
);

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
