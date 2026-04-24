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
// 1b. CREATABLE SUBSET — types available in unit-creation dropdowns
// =============================================================================

/**
 * Types that appear in unit-creation dropdowns (`AddPropertyDialog`,
 * `PropertyFieldsEditForm`, `NewUnitHierarchySection`). Excludes `storage` —
 * αποθήκες δημιουργούνται από dedicated storage-management σελίδα, όχι από το
 * γενικό property unit dialog (Γιώργος request 2026-04-17).
 *
 * **Canonical array** (`PROPERTY_TYPES`) παραμένει πλήρες — storage διατηρείται
 * για Firestore backward compat, filters/reports/search, super-admin views.
 * Αυτό το derived array χρησιμοποιείται **μόνο** από UI creation/edit dropdowns.
 */
export const CREATABLE_PROPERTY_TYPES: readonly PropertyTypeCanonical[] =
  PROPERTY_TYPES.filter((t) => t !== 'storage');

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


// =============================================================================
// 7. RESIDENTIAL vs COMMERCIAL CLASSIFICATION
// =============================================================================

/**
 * Commercial/auxiliary property types — εμπορικοί χώροι & βοηθητικές εγκαταστάσεις.
 * Χρησιμοποιούνται για cross-field validations (π.χ. basement residential warning).
 */
export const COMMERCIAL_PROPERTY_TYPES = [
  'shop',
  'office',
  'hall',
  'storage',
] as const satisfies readonly PropertyTypeCanonical[];
/**
 * Residential property types — derived complement of COMMERCIAL_PROPERTY_TYPES.
 * Basement placement is unusual για residential types (field-rule warning trigger).
 * Περιλαμβάνει τα 2 deprecated underscore values (apartment_2br/3br) για
 * backward compat με παλιά Firestore data.
 */
export const RESIDENTIAL_PROPERTY_TYPES: readonly (
  | PropertyTypeCanonical
  | DeprecatedPropertyType
)[] = [
  ...PROPERTY_TYPES.filter(
    (t) => !(COMMERCIAL_PROPERTY_TYPES as readonly string[]).includes(t),
  ),
  ...DEPRECATED_PROPERTY_TYPES,
];

// =============================================================================
// 8. UNION WITH DEPRECATED (για report-builder, AI search, legacy dropdowns)
// =============================================================================

/**
 * All canonical + deprecated underscore types (14 total).
 * Χρησιμοποιείται από report-builder και AI search ώστε να ταιριάζουν
 * και τα παλιά Firestore records (apartment_2br/3br).
 */
export const ALL_PROPERTY_TYPES_WITH_DEPRECATED = [
  ...PROPERTY_TYPES,
  ...DEPRECATED_PROPERTY_TYPES,
] as const;

// =============================================================================
// 9. GREEK DISPLAY LABELS (server-side, no i18n runtime)
// =============================================================================

/**
 * Greek display labels για PropertyType values. Χρησιμοποιείται σε server-side
 * AI pipeline replies (Telegram/email) όπου δεν υπάρχει `t()` runtime.
 * Οι τιμές mirror-ουν το `src/i18n/locales/el/properties-enums.json` (types.*).
 *
 * **Διατήρηση**: Αν αλλάξουν οι ελληνικές μεταφράσεις στο i18n JSON, ενημέρωσε
 * και αυτό το map.
 */
export const PROPERTY_TYPE_LABELS_EL: Record<PropertyTypeCanonical, string> = {
  studio: 'Στούντιο',
  apartment_1br: 'Γκαρσονιέρα',
  apartment: 'Διαμέρισμα',
  maisonette: 'Μεζονέτα',
  penthouse: 'Ρετιρέ',
  loft: 'Loft',
  detached_house: 'Μονοκατοικία',
  villa: 'Βίλα',
  shop: 'Κατάστημα',
  office: 'Γραφείο',
  hall: 'Αίθουσα',
  storage: 'Αποθήκη',
};

// =============================================================================
// 10. ALIAS RESOLUTION — Greek ↔ English normalization (ADR-287 Batch 11A)
// =============================================================================
//
// Consumers across the codebase (AI pipeline property search, admin stats,
// legacy Firestore data) receive property type values σε πολλαπλές μορφές:
//   - Canonical English underscore: 'apartment', 'shop', 'maisonette', ...
//   - Deprecated English:           'apartment_2br'/'apartment_3br' → 'apartment'
//   - Legacy English:               'store' → 'shop'
//   - Greek (user text):            'διαμέρισμα', '2δ', 'κατάστημα', 'μεζονέτα', ...
//   - Legacy Greek labels (Firestore pre-2026-01-24): 'Στούντιο', 'Διαμέρισμα 2Δ', ...
//
// Ο `normalizePropertyType()` resolver παρέχει το **μοναδικό σημείο** μετατροπής
// από οποιαδήποτε από αυτές τις μορφές στην canonical τιμή, εξαλείφοντας
// hardcoded alias maps σε consumers (π.χ. UC-003 property search fuzzy matching).

/**
 * Alias map: user-facing / legacy input → canonical `PropertyTypeCanonical`.
 *
 * Keys αποθηκεύονται **lowercase** — ο resolver κάνει `.trim().toLowerCase()`
 * στην είσοδο πριν το lookup. Περιέχει:
 *   - Canonical values (self-mapping) για idempotency
 *   - Deprecated underscore ('apartment_2br'/'apartment_3br' → 'apartment' family collapse)
 *   - Legacy English ('store' → 'shop')
 *   - Greek aliases σε πολλαπλές μορφές (με/χωρίς τόνους, short forms 2δ/3δ)
 *   - Legacy Greek display labels (lowercase keys από παλιά Firestore data)
 *
 * **Προσθήκη νέου alias**: Πρόσθεσε entry εδώ — δεν χρειάζεται αλλαγή αλλού.
 *
 * @note 'apartment_1br' παραμένει canonical (Γκαρσονιέρα) — ΔΕΝ καταρρέει στο 'apartment'.
 */
export const PROPERTY_TYPE_ALIASES: Record<string, PropertyTypeCanonical> = {
  // Canonical (self-mapping — guarantees idempotency)
  'studio': 'studio',
  'apartment_1br': 'apartment_1br',
  'apartment': 'apartment',
  'maisonette': 'maisonette',
  'penthouse': 'penthouse',
  'loft': 'loft',
  'detached_house': 'detached_house',
  'villa': 'villa',
  'shop': 'shop',
  'office': 'office',
  'hall': 'hall',
  'storage': 'storage',

  // Deprecated underscore — collapse to 'apartment' family (Γιώργος 2026-04-05)
  'apartment_2br': 'apartment',
  'apartment_3br': 'apartment',

  // Legacy English variants
  'store': 'shop',
  'detached house': 'detached_house',
  'detached-house': 'detached_house',

  // Greek — studio
  'στούντιο': 'studio',
  'στουντιο': 'studio',

  // Greek — apartment_1br (Γκαρσονιέρα)
  'γκαρσονιέρα': 'apartment_1br',
  'γκαρσονιερα': 'apartment_1br',

  // Greek — apartment (Διαμέρισμα + legacy 2Δ/3Δ variants)
  'διαμέρισμα': 'apartment',
  'διαμερισμα': 'apartment',
  'διαμέρισμα 2δ': 'apartment',
  'διαμερισμα 2δ': 'apartment',
  'διαμέρισμα 3δ': 'apartment',
  'διαμερισμα 3δ': 'apartment',
  '2δ': 'apartment',
  '3δ': 'apartment',

  // Greek — maisonette
  'μεζονέτα': 'maisonette',
  'μεζονετα': 'maisonette',

  // Greek — penthouse
  'ρετιρέ': 'penthouse',
  'ρετιρε': 'penthouse',
  'πενθάουζ': 'penthouse',
  'πενθαουζ': 'penthouse',

  // Greek — detached_house
  'μονοκατοικία': 'detached_house',
  'μονοκατοικια': 'detached_house',

  // Greek — villa
  'βίλα': 'villa',
  'βιλα': 'villa',

  // Greek — shop
  'κατάστημα': 'shop',
  'καταστημα': 'shop',
  'μαγαζί': 'shop',
  'μαγαζι': 'shop',

  // Greek — office
  'γραφείο': 'office',
  'γραφειο': 'office',

  // Greek — hall
  'αίθουσα': 'hall',
  'αιθουσα': 'hall',

  // Greek — storage
  'αποθήκη': 'storage',
  'αποθηκη': 'storage',
};

/**
 * Normalize any user-facing or legacy input to the canonical `PropertyTypeCanonical`.
 *
 * Safe to call with untrusted input (Firestore data, AI-extracted entities,
 * user message text). Returns `null` αν το value δεν αντιστοιχεί σε γνωστό
 * alias — ο consumer μπορεί να το ταξινομήσει ως "unknown" ή να το απορρίψει.
 *
 * @param raw — Οποιοδήποτε string (με ή χωρίς whitespace, case-insensitive)
 * @returns Canonical `PropertyTypeCanonical` ή `null` αν unknown
 *
 * @example
 * normalizePropertyType('διαμέρισμα')      // → 'apartment'
 * normalizePropertyType('  STORE  ')       // → 'shop'
 * normalizePropertyType('apartment_2br')   // → 'apartment' (family collapse)
 * normalizePropertyType('apartment')       // → 'apartment' (idempotent)
 * normalizePropertyType('κάτι τυχαίο')     // → null
 */
export function normalizePropertyType(
  raw: unknown,
): PropertyTypeCanonical | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if (key.length === 0) return null;
  return PROPERTY_TYPE_ALIASES[key] ?? null;
}

/**
 * Check whether two property type inputs match semantically after normalization.
 *
 * Handles the common AI-pipeline use case: user searches for "διαμέρισμα" and
 * we need to match stored units with type "apartment" OR "apartment_2br" OR
 * "apartment_3br" (all canonicalize to 'apartment'). Also treats the apartment
 * family (`apartment` + `apartment_1br`) as compatible για search-by-family.
 *
 * @param a — First property type (canonical, alias, or Greek)
 * @param b — Second property type (canonical, alias, or Greek)
 * @returns `true` αν τα δύο inputs αναφέρονται στον ίδιο canonical τύπο (ή στο
 *   ίδιο apartment family), `false` αλλιώς (ή αν κάποιο από τα δύο είναι unknown).
 */
export function arePropertyTypesEquivalent(
  a: unknown,
  b: unknown,
): boolean {
  const canonicalA = normalizePropertyType(a);
  const canonicalB = normalizePropertyType(b);
  if (canonicalA === null || canonicalB === null) return false;
  if (canonicalA === canonicalB) return true;

  // Apartment family expansion: a generic "apartment" search matches the
  // more specific "apartment_1br" (Γκαρσονιέρα) and vice versa. Preserves
  // the legacy fuzzy-matching behaviour of UC-003 property search.
  const apartmentFamily: ReadonlySet<PropertyTypeCanonical> = new Set([
    'apartment',
    'apartment_1br',
  ]);
  return apartmentFamily.has(canonicalA) && apartmentFamily.has(canonicalB);
}

// =============================================================================
// 11. LEGACY GREEK RESOLVER + LABEL HELPER (ADR-287 Batch 11B)
// =============================================================================
//
// Παλιά Firestore records (pre-2026-01-24) αποθηκεύουν property type σε
// capitalized Greek label form ('Στούντιο', 'Διαμέρισμα 2Δ', ...). Αυτές οι
// τιμές ορίζονται στο `LEGACY_GREEK_PROPERTY_TYPES` (section 5b) — τώρα
// αποκτούν dedicated resolver + reverse label helper.

/**
 * Narrow resolver: accepts **only** a value from `LEGACY_GREEK_PROPERTY_TYPES`
 * (the 7 capitalized Greek label strings historically persisted στο Firestore)
 * και επιστρέφει το canonical `PropertyTypeCanonical`. Άλλες μορφές (English
 * canonical, lowercase Greek, general aliases) επιστρέφουν `null` — χρησιμοποίησε
 * το πιο γενικό `normalizePropertyType()` όταν θέλεις να δεχτείς οποιοδήποτε input.
 *
 * Διπλά 2Δ/3Δ variants καταρρέουν στο 'apartment' (family collapse, consistent
 * με Batch 11A semantics: Γιώργος 2026-04-05 decision).
 *
 * @param raw — Expected: ακριβώς ένα από τα `LEGACY_GREEK_PROPERTY_TYPES` strings.
 *   Δέχεται whitespace (trimmed). Ο έλεγχος είναι case-sensitive — τα παλιά
 *   Firestore records έχουν τη γνωστή capitalized μορφή.
 * @returns Canonical `PropertyTypeCanonical` ή `null` αν το input δεν είναι
 *   γνωστός legacy Greek label.
 *
 * @example
 * normalizeLegacyGreekPropertyType('Στούντιο')      // → 'studio'
 * normalizeLegacyGreekPropertyType('Γκαρσονιέρα')   // → 'apartment_1br'
 * normalizeLegacyGreekPropertyType('Διαμέρισμα 2Δ') // → 'apartment' (family collapse)
 * normalizeLegacyGreekPropertyType('Διαμέρισμα 3Δ') // → 'apartment' (family collapse)
 * normalizeLegacyGreekPropertyType('apartment')     // → null (not legacy Greek)
 * normalizeLegacyGreekPropertyType('διαμέρισμα')    // → null (lowercase, use normalizePropertyType)
 */

/**
 * Convenience helper: resolve any input (canonical, alias, Greek with/without
 * tones, legacy Greek label, deprecated underscore) στο αντίστοιχο Greek display
 * label από το `PROPERTY_TYPE_LABELS_EL`.
 *
 * Χρησιμοποιείται σε server-side AI pipeline replies (Telegram/email) όπου
 * εμφανίζουμε breakdown ανά property type και θέλουμε consistent Ελληνικά
 * labels ανεξαρτήτως της raw μορφής στο Firestore.
 *
 * @param raw — Οποιοδήποτε string (canonical underscore, Greek, alias)
 * @returns Greek label από `PROPERTY_TYPE_LABELS_EL` ή `null` αν unknown.
 *   Consumers τυπικά κάνουν fallback στο raw input για display.
 *
 * @example
 * getPropertyTypeLabelEL('apartment')       // → 'Διαμέρισμα'
 * getPropertyTypeLabelEL('apartment_2br')   // → 'Διαμέρισμα' (family collapse)
 * getPropertyTypeLabelEL('store')           // → 'Κατάστημα'
 * getPropertyTypeLabelEL('Στούντιο')        // → 'Στούντιο' (via legacy resolver path)
 * getPropertyTypeLabelEL('parking')         // → null (unknown)
 */
export function getPropertyTypeLabelEL(raw: unknown): string | null {
  const canonical = normalizePropertyType(raw);
  if (canonical === null) return null;
  return PROPERTY_TYPE_LABELS_EL[canonical];
}
