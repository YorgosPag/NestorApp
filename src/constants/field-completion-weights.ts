/**
 * =============================================================================
 * SSoT: Property Field Completion Weights (Per-Type Matrix)
 * =============================================================================
 *
 * **Single Source of Truth** για per-type field weights που χρησιμοποιούνται
 * στον completion meter (profile-strength indicator). Κάθε τύπος ακινήτου έχει
 * τη δική του λίστα relevant fields με assigned weight + critical flag.
 *
 * **Weights** (semantically meaningful):
 *   - `2` — Critical: field that defines the listing (type, area, price class,
 *     photos, floorplan, κλπ). Highest impact in score, surfaces first in
 *     "what's missing" breakdown.
 *   - `1` — Normal: standard descriptive field (heating, cooling, finishes,
 *     orientation σε non-standalone types).
 *   - `0.5` — Optional: nice-to-have hints (security features σε residential,
 *     WC-only fields, auxiliary commercial finishes).
 *
 * **Absence of a field from the per-type list = EXEMPT** (skipped from
 * denominator). Matches Batch 25 pattern: storage/hall skip finishes/systems/
 * ΠΕΑ because they're legitimately irrelevant — not missing data.
 *
 * **Google pattern**: Google My Business completion score applies different
 * weight per field category (primary info > contact info > media > optional
 * attributes). LinkedIn All-Star uses fixed weights (photo 20%, headline 10%,
 * summary 20%, etc.). Spitogatos/Idealista emphasize media+floorplan as
 * differentiators (search-filterable).
 *
 * **Layering**: Leaf module — depends only on `property-types.ts`. Safe to
 * import anywhere (server, client, tests).
 *
 * @module constants/field-completion-weights
 * @enterprise ADR-287 — Completion Meter (Batch 28)
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';
import { normalizePropertyType } from '@/constants/property-type-aliases';

// =============================================================================
// 1. FIELD KEY UNION — Canonical list of scorable fields
// =============================================================================

/**
 * All scorable field keys for the completion meter. Mirrors
 * `PropertyFieldsFormData` subset + 2 media fields (photos, floorplan) —
 * the meter treats them uniformly.
 */
export const FIELD_KEYS = [
  'type',
  'areaGross',
  'areaNet',
  'bedrooms',
  'bathrooms',
  'orientations',
  'condition',
  'energyClass',
  'heatingType',
  'coolingType',
  'windowFrames',
  'glazing',
  'flooring',
  'interiorFeatures',
  'securityFeatures',
  'floorplan',
  'photos',
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

// =============================================================================
// 2. WEIGHT ENTRY — per-field configuration within a type's matrix
// =============================================================================

export interface FieldWeightEntry {
  /** Field identifier (canonical) */
  readonly key: FieldKey;
  /** Relative weight: 2 (critical), 1 (normal), 0.5 (optional) */
  readonly weight: 2 | 1 | 0.5;
  /** Critical flag — surfaces first in "missing" breakdown */
  readonly critical: boolean;
}

// =============================================================================
// 3. SHARED FIELD SUBSETS — avoid repetition across types
// =============================================================================

const CRITICAL_IDENTITY: readonly FieldWeightEntry[] = [
  { key: 'type', weight: 2, critical: true },
  { key: 'areaGross', weight: 2, critical: true },
];

const CRITICAL_MEDIA: readonly FieldWeightEntry[] = [
  { key: 'floorplan', weight: 2, critical: true },
  { key: 'photos', weight: 2, critical: true },
];

/**
 * **Φινιρίσματα + μέσα ενός ΕΜΠΟΡΙΚΟΥ χώρου** — η ουρά που `shop` και `office`
 * μοιράζονται αυτούσια.
 *
 * 🔑 **Εξαγωγή, όχι αντιγραφή (N.0.2 · N.18)**: το `jscpd` μέτρησε τα δύο ως
 * **κλώνο 8 γραμμών / 77 tokens**. Το αρχείο έχει ήδη αυτό το ιδίωμα
 * ({@link CRITICAL_IDENTITY} · {@link CRITICAL_MEDIA} · {@link RESIDENTIAL_CORE}) —
 * απλώς δεν είχε εφαρμοστεί στους εμπορικούς.
 *
 * ⚠️ **Ό,τι ΔΙΑΦΕΡΕΙ μένει ρητό στον κάθε τύπο** (η θέρμανση/ψύξη είναι `0.5` στο
 * κατάστημα και `1` στο γραφείο, και το γραφείο έχει μπάνια): μια «παραμετροποίηση»
 * που θα τα έκρυβε πίσω από ορίσματα θα έκανε τον πίνακα **δυσανάγνωστο** για να
 * σώσει τέσσερις γραμμές.
 */
const COMMERCIAL_FINISHES_AND_MEDIA: readonly FieldWeightEntry[] = [
  { key: 'windowFrames', weight: 0.5, critical: false },
  { key: 'glazing', weight: 0.5, critical: false },
  { key: 'flooring', weight: 0.5, critical: false },
  { key: 'securityFeatures', weight: 0.5, critical: false },
  ...CRITICAL_MEDIA,
];

/**
 * **Ο πίνακας ενός ΒΟΗΘΗΤΙΚΟΥ χώρου** (αίθουσα · αποθήκη) — **ταυτόσημος** για τους
 * δύο, μετρημένα: το `jscpd` τους βρήκε κλώνο **7 γραμμών / 67 tokens**.
 *
 * 🔑 **Η κάτοψη είναι ΚΡΙΣΙΜΗ και οι φωτογραφίες όχι**, και είναι το αντίθετο από
 * κάθε άλλον τύπο: σε έναν κενό βοηθητικό χώρο η φωτογραφία δείχνει έναν τοίχο, ενώ
 * το **σχήμα** είναι όλη η πληροφορία.
 *
 * ⚠️ **Κάθε τύπος παίρνει ΔΙΚΟ του αντίγραφο** (`[...AUXILIARY_MATRIX]`) και όχι την
 * ίδια αναφορά — το μάθημα της Φ1 (ADR-842): μοιρασμένη αναφορά σημαίνει ότι ένα
 * `.sort()` σε οποιονδήποτε καταναλωτή μεταβάλλει τη SSoT για **όλους**.
 */
const AUXILIARY_MATRIX: readonly FieldWeightEntry[] = [
  ...CRITICAL_IDENTITY,
  { key: 'areaNet', weight: 0.5, critical: false },
  { key: 'condition', weight: 1, critical: false },
  { key: 'securityFeatures', weight: 0.5, critical: false },
  { key: 'floorplan', weight: 2, critical: true },
  { key: 'photos', weight: 1, critical: false },
];

const RESIDENTIAL_CORE: readonly FieldWeightEntry[] = [
  ...CRITICAL_IDENTITY,
  { key: 'areaNet', weight: 1, critical: false },
  { key: 'bathrooms', weight: 1, critical: false },
  { key: 'condition', weight: 2, critical: true },
  { key: 'energyClass', weight: 2, critical: true },
  { key: 'heatingType', weight: 1, critical: false },
  { key: 'coolingType', weight: 1, critical: false },
  { key: 'windowFrames', weight: 1, critical: false },
  { key: 'glazing', weight: 1, critical: false },
  { key: 'flooring', weight: 1, critical: false },
  { key: 'securityFeatures', weight: 0.5, critical: false },
  ...CRITICAL_MEDIA,
];

// =============================================================================
// 4. PER-TYPE MATRIX — canonical source of truth
// =============================================================================

/**
 * Per-type field weights. Any field NOT listed is **exempt** from scoring
 * for that type (skipped from denominator). Addition of new field keys:
 * 1) add to `FIELD_KEYS`, 2) extend per-type entries as needed, 3) add
 * i18n label in `properties.json` under `completion.fields.*`.
 */
export const FIELD_WEIGHTS: Record<PropertyTypeCanonical, readonly FieldWeightEntry[]> = {
  // ─── Residential — small units ─────────────────────────────────────────
  studio: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 0.5, critical: false },
    { key: 'interiorFeatures', weight: 0.5, critical: false },
  ],

  apartment_1br: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 1, critical: false },
    { key: 'interiorFeatures', weight: 0.5, critical: false },
  ],

  // ─── Residential — family units ────────────────────────────────────────
  apartment: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 2, critical: true },
    { key: 'interiorFeatures', weight: 0.5, critical: false },
  ],

  maisonette: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 2, critical: true },
    { key: 'interiorFeatures', weight: 0.5, critical: false },
  ],

  // ─── Residential — luxury ──────────────────────────────────────────────
  penthouse: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 2, critical: true },
    { key: 'interiorFeatures', weight: 1, critical: false },
  ],

  loft: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 1, critical: false },
    { key: 'bedrooms', weight: 1, critical: false },
    { key: 'interiorFeatures', weight: 0.5, critical: false },
  ],

  // ─── Residential — standalone (Family B) ───────────────────────────────
  detached_house: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 2, critical: true },
    { key: 'bedrooms', weight: 2, critical: true },
    { key: 'interiorFeatures', weight: 1, critical: false },
  ],

  villa: [
    ...RESIDENTIAL_CORE,
    { key: 'orientations', weight: 2, critical: true },
    { key: 'bedrooms', weight: 2, critical: true },
    { key: 'interiorFeatures', weight: 1, critical: false },
  ],

  // ─── Commercial — shop ─────────────────────────────────────────────────
  shop: [
    ...CRITICAL_IDENTITY,
    { key: 'areaNet', weight: 1, critical: false },
    { key: 'condition', weight: 1, critical: false },
    { key: 'energyClass', weight: 1, critical: false },
    // Θέρμανση/ψύξη **μισό** βάρος: σε κατάστημα είναι δευτερεύουσες έναντι της θέσης.
    { key: 'heatingType', weight: 0.5, critical: false },
    { key: 'coolingType', weight: 0.5, critical: false },
    ...COMMERCIAL_FINISHES_AND_MEDIA,
  ],

  // ─── Commercial — office ───────────────────────────────────────────────
  office: [
    ...CRITICAL_IDENTITY,
    { key: 'areaNet', weight: 1, critical: false },
    { key: 'bathrooms', weight: 1, critical: false },
    { key: 'condition', weight: 1, critical: false },
    { key: 'energyClass', weight: 1, critical: false },
    // **Πλήρες** βάρος, σε αντίθεση με το κατάστημα: κλιματισμός γραφείου = συνθήκες
    // εργασίας, δηλαδή κριτήριο επιλογής και όχι λεπτομέρεια.
    { key: 'heatingType', weight: 1, critical: false },
    { key: 'coolingType', weight: 1, critical: false },
    ...COMMERCIAL_FINISHES_AND_MEDIA,
  ],

  // ─── Auxiliary — hall (αίθουσα) ────────────────────────────────────────
  hall: [...AUXILIARY_MATRIX],

  // ─── Auxiliary — storage (αποθήκη) ─────────────────────────────────────
  storage: [...AUXILIARY_MATRIX],
};

// =============================================================================
// 5. LOOKUP HELPER — safe accessor with fallback
// =============================================================================

/**
 * Returns the weight entries for a given property type. Το είδος περνά **πρώτα** από
 * την αυθεντία των συνωνύμων· ό,τι δεν αναγνωρίζεται πέφτει στον πίνακα του
 * `apartment` — συντηρητική προεπιλογή που καλύπτει το μεγαλύτερο μέρος του ελληνικού
 * οικιστικού αποθέματος.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ADR-842 §8 #3 — ΤΟ «ΣΙΩΠΗΛΑ ΛΑΘΟΣ ΠΑΡΟΝΟΜΑΣΤΗΣ», ΜΕΤΡΗΜΕΝΟ (2026-09-02)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι σήμερα ο έλεγχος ήταν `type in FIELD_WEIGHTS` — δηλαδή **ακριβής** ταύτιση με
 * κανονική τιμή. Ο `PropertyType` όμως είναι **υπερσύνολο**: περιλαμβάνει `@deprecated`
 * παραλλαγές και **παλαιές ελληνικές** τιμές Firestore. Καθεμιά τους έπεφτε στο
 * `apartment`, και σε **τέσσερις από τις εννέα** αυτό είναι **λάθος πίνακας**:
 *
 * | Αποθηκευμένο | Σωστός πίνακας | Παρονομαστής σωστού | Τι έδινε το fallback |
 * |---|---|---|---|
 * | `'Αποθήκη'` | `storage` | **9,0** | **23,0** *(+156%)* — και ζητούσε **υπνοδωμάτια** από αποθήκη, ως **κρίσιμα** |
 * | `'Κατάστημα'` | `shop` | **14,0** | **23,0** *(+64%)* |
 * | `'Στούντιο'` | `studio` | 21,5 | 23,0 — και τα υπνοδωμάτια από `0,5` **μη κρίσιμα** σε `2` **κρίσιμα** |
 * | `'Γκαρσονιέρα'` | `apartment_1br` | 22,0 | 23,0 |
 *
 * *(Οι υπόλοιπες πέντε — `apartment_2br` · `apartment_3br` · `'Διαμέρισμα 2Δ'` ·
 * `'Διαμέρισμα 3Δ'` · `'Μεζονέτα'` — έπεφταν σε πίνακα **ταυτόσημο** με τον σωστό, άρα
 * ήταν τύχη, όχι δομή.)*
 *
 * 🔑 **Η θεραπεία ΔΕΝ αγγίζει βάρη ούτε `FIELD_KEYS` (ADR-842 Α5)** — ρωτά την
 * **υπάρχουσα** αυθεντία `normalizePropertyType`, που δηλώνει τον εαυτό της *«μοναδικό
 * σημείο μετατροπής»* και χρησιμοποιείται ήδη από τη Φ3 στο `isAttributeDeclared` και
 * στο `listing-attribute-value`. Δεύτερος πίνακας συνωνύμων εδώ θα ήταν ο κλασικός
 * κλώνος του N.0.2.
 *
 * ⚠️ **ΜΗΔΕΝ αλλαγή για τα σημερινά δεδομένα, μετρημένη**: και τα **8** ζωντανά
 * `properties` έχουν κανονικό είδος (`apartment` · `maisonette`), για τα οποία ο
 * `normalizePropertyType` είναι **ταυτοτικός** (η αυτο-απεικόνιση των κανονικών τιμών
 * είναι υποχρεωτική και φυλάσσεται από άγκυρα). Άρα η γραμμή **δεν** διορθώνει ζωντανό
 * ελάττωμα — **αποτρέπει το πρώτο**.
 */
export function getFieldWeightsForType(
  type: PropertyTypeCanonical | string | null | undefined,
): readonly FieldWeightEntry[] {
  const canonical = normalizePropertyType(type);
  return canonical === null ? FIELD_WEIGHTS.apartment : FIELD_WEIGHTS[canonical];
}

