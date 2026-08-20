/**
 * =============================================================================
 * SSoT: Η ΓΕΦΥΡΑ ΑΝΑΜΕΣΑ ΣΕ ΕΛΕΥΘΕΡΟ ΚΕΙΜΕΝΟ ΚΑΙ ΕΙΔΟΣ ΑΚΙΝΗΤΟΥ
 * =============================================================================
 *
 * **Δύο κατευθύνσεις, ένα θέμα**: «*αυτό που έγραψε άνθρωπος ή μηχανή, ποιο είδος
 * είναι;*» ({@link normalizePropertyType}) και «*αυτό το είδος, πώς λέγεται στα
 * ελληνικά όταν δεν υπάρχει `t()`;*» ({@link getPropertyTypeLabelEL}).
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΟΧΙ ΚΟΨΙΜΟ ΓΙΑ ΝΑ ΧΩΡΕΣΕΙ** (ADR-777 §8.32):
 * το `constants/property-types.ts` απαντά *«ποια είδη υπάρχουν και τι κατηγορία
 * είναι»* — είναι **μοντέλο**, το διαβάζουν **46 αρχεία**, και ταξιδεύει στον
 * πελάτη. Αυτό εδώ απαντά *«τι μου έγραψαν»* — είναι **αναγνώριση**, το εισάγουν
 * **τέσσερα** σημεία (δημόσια αγγελία · αναζήτηση AI · πύλη γραφής · στατιστικά
 * διαχειριστή), και όλα είναι διαδρομές που δέχονται **ανεπεξέργαστη είσοδο**.
 * Δύο ερωτήσεις, δύο αρχεία.
 *
 * **Layering**: leaf module — εξαρτάται **μόνο** από το `property-types`.
 *
 * @module constants/property-type-aliases
 * @enterprise ADR-287 Batch 11A/11B — alias resolution
 * @see ADR-777 §8.32 — ο δεύτερος άξονας (κατηγορία) και ο διαχωρισμός ευθυνών
 */

import {
  type PropertyTypeCanonical,
  PROPERTY_TYPES,
} from './property-types';

// =============================================================================
// 1. ΕΛΛΗΝΙΚΕΣ ΕΤΙΚΕΤΕΣ (server-side, χωρίς i18n runtime)
// =============================================================================

/**
 * Greek display labels για PropertyType values. Χρησιμοποιείται σε server-side
 * AI pipeline replies (Telegram/email) όπου δεν υπάρχει `t()` runtime.
 *
 * 🔴 **ΕΙΝΑΙ ΚΑΘΡΕΦΤΗΣ ΤΟΥ `properties-enums.json` (el), ΚΑΙ ΕΙΧΕ ΗΔΗ ΑΠΟΚΛΙΝΕΙ.**
 * Μέχρι τις 2026-08-20 έγραφε `loft: 'Loft'` ενώ το locale έλεγε **«Σοφίτα»** —
 * μία απόκλιση στις δώδεκα, σε πίνακα που το ίδιο του το σχόλιο ζητούσε από
 * **άνθρωπο** να συντηρεί («*αν αλλάξουν οι ελληνικές μεταφράσεις, ενημέρωσε και
 * αυτό το map*»). Είναι το σχήμα των δύο χειρόγραφων λιστών namespace του CHECK
 * 3.34, που είχαν αποκλίνει κατά **63**: **οδηγία σε σχόλιο δεν είναι πύλη.**
 *
 * ⚠️ **ΔΕΝ παράγεται με `import` του JSON**, και η απόφαση είναι μετρημένη: το
 * `properties-enums.json` (el) είναι **10.543 bytes** και αυτό το module το
 * φορτώνουν διαδρομές πελάτη· ο καθρέφτης κοστίζει **12 γραμμές**. Αντ' αυτού
 * φυλάσσεται από **άγκυρα** (`__tests__/property-type-classes.test.ts`), που
 * συγκρίνει κάθε τιμή με το locale και κοκκινίζει στην πρώτη απόκλιση.
 */
export const PROPERTY_TYPE_LABELS_EL: Record<PropertyTypeCanonical, string> = {
  studio: 'Στούντιο',
  apartment_1br: 'Γκαρσονιέρα',
  apartment: 'Διαμέρισμα',
  maisonette: 'Μεζονέτα',
  penthouse: 'Ρετιρέ',
  loft: 'Σοφίτα',
  detached_house: 'Μονοκατοικία',
  villa: 'Βίλα',
  shop: 'Κατάστημα',
  office: 'Γραφείο',
  hall: 'Αίθουσα',
  storage: 'Αποθήκη',
  plot: 'Οικόπεδο',
  parcel: 'Αγροτεμάχιο',
};

// =============================================================================
// 2. ALIAS RESOLUTION — Greek ↔ English normalization (ADR-287 Batch 11A)
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
 * ⚠️ **Η αυτο-απεικόνιση των κανονικών τιμών είναι ΥΠΟΧΡΕΩΤΙΚΗ και φυλάσσεται**:
 * χωρίς αυτήν, ένα νέο είδος περνά ολόκληρη την εφαρμογή και **σκοντάφτει μόνο
 * εδώ**, επιστρέφοντας `null` — δηλαδή «άγνωστο είδος» για είδος που **μόλις
 * προσθέσαμε**. Άγκυρα: `property-type-classes.test.ts` (κάθε τιμή του
 * `PROPERTY_TYPES` πρέπει να επιστρέφει τον εαυτό της).
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
  'plot': 'plot',
  'parcel': 'parcel',

  // Deprecated underscore — collapse to 'apartment' family (Γιώργος 2026-04-05)
  'apartment_2br': 'apartment',
  'apartment_3br': 'apartment',

  // Legacy English variants
  'store': 'shop',
  'detached house': 'detached_house',
  'detached-house': 'detached_house',
  'land': 'plot',
  'lot': 'plot',

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

  // Greek — loft (⚠️ το locale λέει «Σοφίτα», όχι «Loft»)
  'σοφίτα': 'loft',
  'σοφιτα': 'loft',

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

  // Greek — plot (ΓΗ, ADR-777 §8.32)
  'οικόπεδο': 'plot',
  'οικοπεδο': 'plot',
  'γη': 'plot',

  // Greek — parcel (ΓΗ εκτός σχεδίου)
  'αγροτεμάχιο': 'parcel',
  'αγροτεμαχιο': 'parcel',
  'χωράφι': 'parcel',
  'χωραφι': 'parcel',
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
 * normalizePropertyType('οικόπεδο')        // → 'plot'
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
 * ⚠️ **Η γη ΔΕΝ έχει οικογένεια**: `plot` και `parcel` είναι **διαφορετικά**
 * πράγματα (εντός/εκτός σχεδίου) και ένα ταίριασμα μεταξύ τους θα έστελνε
 * εργολάβο σε χωράφι. Δες {@link PROPERTY_TYPE_CLASS} για τον άξονα που τα ενώνει
 * όταν η ερώτηση είναι *«είναι γη;»* — που είναι **άλλη** ερώτηση από *«είναι το
 * ίδιο;»*.
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

/**
 * Convenience helper: resolve any input (canonical, alias, Greek with/without
 * tones, legacy Greek label, deprecated underscore) στο αντίστοιχο Greek display
 * label από το {@link PROPERTY_TYPE_LABELS_EL}.
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
 * getPropertyTypeLabelEL('οικόπεδο')        // → 'Οικόπεδο'
 * getPropertyTypeLabelEL('parking')         // → null (unknown)
 */
export function getPropertyTypeLabelEL(raw: unknown): string | null {
  const canonical = normalizePropertyType(raw);
  if (canonical === null) return null;
  return PROPERTY_TYPE_LABELS_EL[canonical];
}

/**
 * Κάθε κανονικό είδος **πρέπει** να αναγνωρίζει τον εαυτό του.
 *
 * 🔑 Εξάγεται ώστε η άγκυρα να μη γράψει **δεύτερη** εκδοχή του ελέγχου: η ερώτηση
 * *«λείπει κανένα είδος από τον πίνακα αναγνώρισης;»* απαντιέται **εδώ**, δίπλα
 * στον πίνακα, και η άγκυρα απλώς **απαιτεί κενό αποτέλεσμα**.
 *
 * @returns Τα είδη που **δεν** αυτο-απεικονίζονται — κενό όταν όλα είναι εντάξει.
 */
export function propertyTypesMissingSelfAlias(): readonly PropertyTypeCanonical[] {
  return PROPERTY_TYPES.filter((type) => normalizePropertyType(type) !== type);
}
