/**
 * =============================================================================
 * SSoT: PropertyType Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για όλους τους τύπους ακινήτων (PropertyType).
 * Πριν από αυτό το module, το ίδιο concept ήταν διάσπαρτο σε 8+ αρχεία με
 * 3 διαφορετικά bug categories (hyphen mismatch, incomplete lists, shadow types).
 *
 * **Layering**: Αυτό είναι leaf module — **καμία** εξάρτηση από components,
 * hooks, ή services. Ασφαλές για import παντού (server, client, tests).
 *
 * **Προσθήκη νέου τύπου**: Πρόσθεσε entry στο `PROPERTY_TYPES` array +
 * i18n keys σε `properties-enums.json` (el + en). Τα πάντα άλλα derive αυτόματα.
 *
 * @module constants/property-types
 * @enterprise ADR-145 — PropertyType SSoT
 * @see ADR-233 (initial 14-type set), ADR-284 (Family A/B discriminator)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Single point of addition για νέους τύπους
// =============================================================================

/**
 * All canonical PropertyType values, in UI display order.
 * Underscore-style keys only (NEVER hyphens like `apartment-2br`).
 *
 * 2026-04-05: Αφαιρέθηκαν `apartment_2br`, `apartment_3br` (Γιώργος request) —
 * κρατάμε μόνο το γενικό `apartment`. Οι τιμές αυτές παραμένουν στο `PropertyType`
 * union (`DEPRECATED_PROPERTY_TYPES`) για backward-compat με παλιά Firestore records.
 */
export const PROPERTY_TYPES = [
  'studio',
  'apartment_1br',
  'apartment',
  'maisonette',
  'penthouse',
  'loft',
  'detached_house',
  'villa',
  'shop',
  'office',
  'hall',
  'storage',
] as const;

/** Canonical TypeScript union — derived automatically from `PROPERTY_TYPES`. */
export type PropertyTypeCanonical = (typeof PROPERTY_TYPES)[number];

// =============================================================================
// 2. STANDALONE DISCRIMINATOR — ADR-284 Family B
// =============================================================================

/**
 * Standalone unit types (ADR-284 Family B). These attach directly to a Project
 * **without** Building/Floor placement. All other types belong to Family A
 * (in-building) and require the full Project → Building → Floor chain.
 */
export const STANDALONE_UNIT_TYPES = ['detached_house', 'villa'] as const;

export type StandaloneUnitType = (typeof STANDALONE_UNIT_TYPES)[number];

/**
 * Discriminator — returns `true` if `type` is a Family B standalone unit.
 * Handles unknown input safely (returns `false` for non-string / empty / unknown).
 */
export function isStandaloneUnitType(type: unknown): type is StandaloneUnitType {
  return (
    typeof type === 'string' &&
    type.length > 0 &&
    (STANDALONE_UNIT_TYPES as readonly string[]).includes(type)
  );
}

// =============================================================================
// 3. IN-BUILDING SUBSET (Family A) — derived from PROPERTY_TYPES \ STANDALONE
// =============================================================================

/** Family A — types that require full Project/Building/Floor hierarchy. */
export const IN_BUILDING_UNIT_TYPES: readonly PropertyTypeCanonical[] =
  PROPERTY_TYPES.filter(
    (t) => !(STANDALONE_UNIT_TYPES as readonly string[]).includes(t),
  );

// =============================================================================
// 4. i18n KEY MAPPING — namespace "properties"
// =============================================================================

/**
 * Maps each PropertyType value → i18n translation key under the "properties"
 * namespace (see `src/i18n/locales/{el,en}/properties-enums.json`).
 *
 * Resolve in UI via: `t(PROPERTY_TYPE_I18N_KEYS[type])`.
 */
export const PROPERTY_TYPE_I18N_KEYS: Record<PropertyTypeCanonical, string> = {
  studio: 'types.studio',
  apartment_1br: 'types.apartment_1br',
  apartment: 'types.apartment',
  maisonette: 'types.maisonette',
  penthouse: 'types.penthouse',
  loft: 'types.loft',
  detached_house: 'types.detached_house',
  villa: 'types.villa',
  shop: 'types.shop',
  office: 'types.office',
  hall: 'types.hall',
  storage: 'types.storage',
};

// =============================================================================
// 5a. DEPRECATED UNDERSCORE VALUES — Firestore backward compatibility
// =============================================================================

/**
 * Property types που αφαιρέθηκαν από το dropdown (2026-04-05) αλλά ενδέχεται να
 * υπάρχουν ακόμα σε Firestore records. Παραμένουν στο `PropertyType` union
 * ώστε old data να περνάει type-checks. Δεν εμφανίζονται σε νέα dropdowns.
 */
export const DEPRECATED_PROPERTY_TYPES = [
  'apartment_2br',
  'apartment_3br',
] as const;

export type DeprecatedPropertyType = (typeof DEPRECATED_PROPERTY_TYPES)[number];

// =============================================================================
// 5b. LEGACY GREEK VALUES — Firestore backward compatibility
// =============================================================================

/**
 * Legacy Greek values that may still exist σε Firestore documents (pre-2026-01-24).
 * ΔΕΝ εμφανίζονται σε νέα dropdowns. UI εφαρμόζει i18n fallback:
 *   `t(`types.${unit.type}`, { defaultValue: unit.type })`
 */
export const LEGACY_GREEK_PROPERTY_TYPES = [
  'Στούντιο',
  'Γκαρσονιέρα',
  'Διαμέρισμα 2Δ',
  'Διαμέρισμα 3Δ',
  'Μεζονέτα',
  'Κατάστημα',
  'Αποθήκη',
] as const;

export type LegacyGreekPropertyType = (typeof LEGACY_GREEK_PROPERTY_TYPES)[number];

// =============================================================================
// 6. RUNTIME TYPE GUARD
// =============================================================================

/** Returns `true` if `value` is one of the 12 canonical underscore-style types. */
export function isPropertyType(value: unknown): value is PropertyTypeCanonical {
  return (
    typeof value === 'string' &&
    (PROPERTY_TYPES as readonly string[]).includes(value)
  );
}
