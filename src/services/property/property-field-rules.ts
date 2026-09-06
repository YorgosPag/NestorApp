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

import { resolvedPropertyClassOf } from '@/constants/property-classification';

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
  // 🔴 **Ο ΕΝΑΣ ΚΡΙΤΗΣ, ΟΧΙ ΤΕΤΑΡΤΟ ΤΟΠΙΚΟ ΣΥΝΟΛΟ** (ADR-842 §7.6.11 / §7.6.12). Εδώ
  //    ζούσε `RESIDENTIAL_TYPES.has(propertyType as PropertyType)` — ένα **τέταρτο**
  //    αντίγραφο του «τι είναι κατοικία», με ισχυρισμό πάνω σε `string | undefined`.
  //    Το `resolvedPropertyClassOf` κανονικοποιεί **και** ταξινομεί, οπότε μια
  //    `'Μονοκατοικία'` κρίνεται πλέον σωστά αντί να προσπερνιέται σιωπηλά.
  if (resolvedPropertyClassOf(propertyType) !== 'residential') return null;

  return {
    titleKey: 'fieldWarnings.basementResidential.title',
    descriptionKey: 'fieldWarnings.basementResidential.description',
  };
}
