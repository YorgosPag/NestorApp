/**
 * OVERRIDE ENGINE για DXF Settings
 * Διαχειρίζεται την κληρονομικότητα General → Special settings
 */

import type {
  LineSettings,
  TextSettings,
  GripSettings,
  DxfSettings,
  PartialDxfSettings
} from './types';

// ============================================================================
// MERGE FUNCTIONS - General + Override = Effective
// ============================================================================

/**
 * Συγχώνευση general settings με override για να πάρουμε τα effective settings
 * @param general - Οι γενικές ρυθμίσεις (base)
 * @param override - Οι ειδικές ρυθμίσεις (partial overrides)
 * @returns Τα effective settings (merged)
 */
export function mergeSettings<T extends Record<string, any>>(
  general: T,
  override: Partial<T> | null | undefined
): T {
  if (!override || Object.keys(override).length === 0) {
    return general;
  }

  // Deep merge για nested objects όπως colors
  const merged = { ...general };

  for (const key in override) {
    const overrideValue = override[key];
    const generalValue = general[key];

    if (overrideValue !== undefined) {
      if (
        typeof overrideValue === 'object' &&
        overrideValue !== null &&
        !Array.isArray(overrideValue) &&
        typeof generalValue === 'object' &&
        generalValue !== null &&
        !Array.isArray(generalValue)
      ) {
        // Deep merge για nested objects
        merged[key] = { ...generalValue, ...overrideValue };
      } else {
        // Direct assignment για primitives και arrays
        merged[key] = overrideValue;
      }
    }
  }

  return merged;
}

/**
 * Merge για LineSettings
 */
export function mergeLineSettings(
  general: LineSettings,
  override: Partial<LineSettings> | null
): LineSettings {
  return mergeSettings(general, override);
}

/**
 * Merge για TextSettings
 */
export function mergeTextSettings(
  general: TextSettings,
  override: Partial<TextSettings> | null
): TextSettings {
  return mergeSettings(general, override);
}

/**
 * Merge για GripSettings
 */
export function mergeGripSettings(
  general: GripSettings,
  override: Partial<GripSettings> | null
): GripSettings {
  return mergeSettings(general, override);
}

/**
 * Merge για όλα τα DxfSettings
 */
export function mergeDxfSettings(
  general: DxfSettings,
  override: PartialDxfSettings | null
): DxfSettings {
  if (!override) return general;

  return {
    line: mergeLineSettings(general.line, override.line || null),
    text: mergeTextSettings(general.text, override.text || null),
    grip: mergeGripSettings(general.grip, override.grip || null),
  };
}

// ============================================================================
// DIFF FUNCTIONS - Υπολογισμός διαφορών
// ============================================================================

/**
 * Υπολογίζει τη διαφορά μεταξύ δύο settings objects
 * Επιστρέφει μόνο τα πεδία που άλλαξαν
 * @param from - Τα αρχικά settings
 * @param to - Τα νέα settings
 * @returns Μόνο τα πεδία που άλλαξαν
 */
export function diffSettings<T extends Record<string, any>>(
  from: T,
  to: T
): Partial<T> {
  const diff: Partial<T> = {};

  for (const key in to) {
    const fromValue = from[key];
    const toValue = to[key];

    // Check for deep equality για objects
    if (
      typeof toValue === 'object' &&
      toValue !== null &&
      !Array.isArray(toValue)
    ) {
      if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
        diff[key] = toValue;
      }
    } else if (fromValue !== toValue) {
      diff[key] = toValue;
    }
  }

  return diff;
}

/**
 * Diff για LineSettings
 */
export function diffLineSettings(
  from: LineSettings,
  to: LineSettings
): Partial<LineSettings> {
  return diffSettings(from, to);
}

/**
 * Diff για TextSettings
 */
export function diffTextSettings(
  from: TextSettings,
  to: TextSettings
): Partial<TextSettings> {
  return diffSettings(from, to);
}

/**
 * Diff για GripSettings
 */
export function diffGripSettings(
  from: GripSettings,
  to: GripSettings
): Partial<GripSettings> {
  return diffSettings(from, to);
}

// ============================================================================
// EXTRACTION FUNCTIONS - Εξαγωγή overrides από effective settings
// ============================================================================

/**
 * Εξάγει μόνο τα overrides από τα effective settings
 * συγκρίνοντάς τα με τα general settings
 * @param general - Οι γενικές ρυθμίσεις
 * @param effective - Τα effective settings (merged)
 * @returns Μόνο τα overrides (deltas)
 */
export function extractOverrides<T extends Record<string, any>>(
  general: T,
  effective: T
): Partial<T> | null {
  const overrides = diffSettings(general, effective);

  // Αν δεν υπάρχουν διαφορές, επιστρέφουμε null
  if (Object.keys(overrides).length === 0) {
    return null;
  }

  return overrides;
}

// ============================================================================
// CLEAR FUNCTIONS - Καθαρισμός overrides
// ============================================================================

/**
 * Καθαρίζει συγκεκριμένα πεδία από τα overrides
 * @param overrides - Τα τρέχοντα overrides
 * @param fields - Τα πεδία που θέλουμε να καθαρίσουμε
 * @returns Τα νέα overrides χωρίς τα specified fields
 */
export function clearOverrideFields<T extends Record<string, any>>(
  overrides: Partial<T> | null,
  fields: Array<keyof T>
): Partial<T> | null {
  if (!overrides) return null;

  const newOverrides = { ...overrides };

  for (const field of fields) {
    delete newOverrides[field];
  }

  // Αν δεν έμεινε τίποτα, επιστρέφουμε null
  if (Object.keys(newOverrides).length === 0) {
    return null;
  }

  return newOverrides;
}

// ============================================================================
// VALIDATION - Έλεγχος για έγκυρα overrides
// ============================================================================

/**
 * Ελέγχει αν ένα entity έχει overrides
 * @param overrides - Τα overrides του entity
 * @returns true αν υπάρχουν overrides
 */
export function hasOverrides(overrides: PartialDxfSettings | null | undefined): boolean {
  if (!overrides) return false;

  const hasLineOverrides = overrides.line && Object.keys(overrides.line).length > 0;
  const hasTextOverrides = overrides.text && Object.keys(overrides.text).length > 0;
  const hasGripOverrides = overrides.grip && Object.keys(overrides.grip).length > 0;

  return !!(hasLineOverrides || hasTextOverrides || hasGripOverrides);
}

/**
 * Καθαρίζει τα empty overrides από ένα object
 * @param overrides - Τα overrides
 * @returns Καθαρισμένα overrides ή null αν είναι empty
 */
export function cleanEmptyOverrides(overrides: PartialDxfSettings | null): PartialDxfSettings | null {
  if (!overrides) return null;

  const cleaned: PartialDxfSettings = {};

  if (overrides.line && Object.keys(overrides.line).length > 0) {
    cleaned.line = overrides.line;
  }

  if (overrides.text && Object.keys(overrides.text).length > 0) {
    cleaned.text = overrides.text;
  }

  if (overrides.grip && Object.keys(overrides.grip).length > 0) {
    cleaned.grip = overrides.grip;
  }

  if (Object.keys(cleaned).length === 0) {
    return null;
  }

  return cleaned;
}