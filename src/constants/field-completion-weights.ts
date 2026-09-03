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

import { propertyClassOf, type PropertyTypeCanonical } from '@/constants/property-types';
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
/**
 * **Η ΓΗ** — οικόπεδο (`plot`) και αγροτεμάχιο (`parcel`). ADR-842 Α6, 2026-09-02.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΕΣΣΕΡΑ ΠΕΔΙΑ, ΟΛΑ ΚΡΙΣΙΜΑ — ΚΑΙ Η ΣΙΩΠΗ ΤΩΝ ΥΠΟΛΟΙΠΩΝ ΔΕΚΑΤΡΙΩΝ ΕΙΝΑΙ ΤΟ ΘΕΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα οικόπεδο **δεν έχει** υπνοδωμάτια, μπάνια, ενεργειακή κλάση, θέρμανση, ψύξη,
 * κουφώματα, υαλοπίνακες, δάπεδα ούτε εσωτερικά χαρακτηριστικά. Τα κλειδιά που
 * λείπουν από αυτόν τον πίνακα γίνονται **`exempt`** — έξω από τον παρονομαστή, ίδιος
 * μηχανισμός με το {@link AUXILIARY_MATRIX} της αποθήκης. Ο άνθρωπος **δεν** μαθαίνει
 * ποτέ ότι «λείπει η ενεργειακή κλάση» από το χωράφι του.
 *
 * ⛔ **ΓΙ' ΑΥΤΟ ΤΟ `?? FIELD_WEIGHTS.apartment` ΔΕΝ ΗΤΑΝ ΘΕΡΑΠΕΙΑ** — θα ήταν η ίδια
 * αστοχία που το §8 #3 μέτρησε για την `'Αποθήκη'`: παρονομαστής **23,0 αντί 9,0**
 * *(+156%)*, και **υπνοδωμάτια ως κρίσιμα** από χώρο που δεν έχει.
 *
 * 📐 **Η ΕΠΙΛΟΓΗ ΤΩΝ ΤΕΣΣΑΡΩΝ ΕΙΝΑΙ ΕΡΕΥΝΑ, ΟΧΙ ΓΝΩΜΗ** *(2026-09-02)*. Τρία
 * ανεξάρτητα portals συγκλίνουν στο ίδιο πυρήνα για γη:
 *
 * | Πηγή | Τι ζητά για γη |
 * |---|---|
 * | **Zillow / CRMLS Land form** | `Lot Size` · `Lot Features` · `Survey` · φωτογραφίες — και ρητά *«bedrooms/bathrooms **when applicable**»* |
 * | **idealista** *(suelo/terreno)* | superficie · calificación urbanística · servicios · acceso |
 * | **Spitogatos** *(οικόπεδο)* | εμβαδόν · Σ.Δ. / κάλυψη · άρτιο-οικοδομήσιμο · εντός/εκτός σχεδίου |
 *
 * ⇒ Από όσα **έχει σήμερα το μοντέλο μας**, τα ζητούμενα είναι ακριβώς τέσσερα:
 * **ταυτότητα · εμβαδόν · τοπογραφικό · φωτογραφίες**. Παρονομαστής **8,0**.
 *
 * 🔴 **ΤΟ `floorplan` ΕΙΝΑΙ ΤΟ ΤΟΠΟΓΡΑΦΙΚΟ, ΚΑΙ ΕΙΝΑΙ ΚΡΙΣΙΜΟ.** Ίδιο επιχείρημα με
 * την αποθήκη *(«σε κενό χώρο η φωτογραφία δείχνει έναν τοίχο, ενώ το **σχήμα** είναι
 * όλη η πληροφορία»)*, μόνο εντονότερο: για οικόπεδο το διάγραμμα είναι το έγγραφο
 * **από το οποίο κρίνεται η αγορά** — όρια, πρόσοψη, εμβαδόν. Το `Survey` του CRMLS.
 *
 * ⚠️ **ΤΙ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΡΩΤΗΣΕΙ ΑΥΤΟΣ Ο ΠΙΝΑΚΑΣ, ΔΗΛΩΜΕΝΟ ΑΝΤΙ ΝΑ ΚΡΥΦΤΕΙ**: το
 * **δικαίωμα δόμησης** *(Σ.Δ. · κάλυψη · άρτιο/οικοδομήσιμο · εντός/εκτός σχεδίου)*
 * και οι **παροχές/πρόσβαση** *(ρεύμα · νερό · αποχέτευση · δρόμος)* είναι, και στις
 * τρεις πηγές, **τα σημαντικότερα πεδία μιας αγγελίας γης** — και **δεν υπάρχουν στο
 * μοντέλο**: ούτε στο `OwnerProperty`, ούτε στα 27 πεδία του `PublicListing`. Βάρος σε
 * κλειδί που κανείς δεν μπορεί να συμπληρώσει θα ήταν μετρητής που **δεν φτάνει ποτέ
 * στο 100%**. Το κενό είναι καταγεγραμμένο ως εκκρεμότητα, όχι ως παράλειψη.
 */
const LAND_MATRIX: readonly FieldWeightEntry[] = [
  ...CRITICAL_IDENTITY,
  ...CRITICAL_MEDIA,
];

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

  // ─── Γη (ADR-777 §8.32 · βάρη ADR-842 Α6) ──────────────────────────────
  // ⚠️ Δικό του αντίγραφο ο καθένας — μοιρασμένη αναφορά σημαίνει ότι ένα `.sort()`
  // σε οποιονδήποτε καταναλωτή μεταβάλλει τη SSoT για όλους (μάθημα Φ1, ADR-842).
  plot: [...LAND_MATRIX],
  parcel: [...LAND_MATRIX],
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
  if (canonical === null) return FIELD_WEIGHTS.apartment;

  const entries = FIELD_WEIGHTS[canonical];

  // ──────────────────────────────────────────────────────────────────────────
  // 🔴 ΚΕΝΟ ΓΡΑΜΜΗΣ — fail-fast στην ανάπτυξη, ΠΟΤΕ λευκή οθόνη στην παραγωγή
  // ──────────────────────────────────────────────────────────────────────────
  //
  // Ο `Record<PropertyTypeCanonical, …>` **υπόσχεται** ότι αυτό δεν συμβαίνει, και ο
  // μεταγλωττιστής θα το έπιανε. Στις 2026-09-02 δεν το έπιασε: ο `npm run typecheck`
  // πέθαινε σε OOM, το `plot` μπήκε στο λεξιλόγιο 13 ημέρες νωρίτερα χωρίς γραμμή, και
  // το `weightEntries.map(…)` **ΕΡΙΞΕ ΟΛΟΚΛΗΡΗ** τη `/offers/<id>` για **κάθε**
  // οικόπεδο (5 στα 5 ζωντανά).
  //
  // 🔑 Η στάση είναι **ασύμμετρη επίτηδες**, το πρότυπο fail-fast ⊕ graceful
  // degradation: ο μηχανικός το μαθαίνει **αμέσως και θορυβωδώς**· ο άνθρωπος που
  // κοιτάζει το ακίνητό του **δεν πληρώνει** το κενό μας με λευκή οθόνη.
  //
  // ⛔ **ΤΟ ΕΦΕΔΡΙΚΟ ΔΕΝ ΕΙΝΑΙ `apartment`** — αυτό θα ζητούσε υπνοδωμάτια και
  // ενεργειακή κλάση από άγνωστο είδος (η αστοχία του §8 #3, +156% παρονομαστής).
  // Είναι η {@link CRITICAL_IDENTITY}: **τι είναι** και **πόσο μεγάλο** — τα δύο που
  // ισχύουν για κάθε ακίνητο που μπορεί να υπάρξει.
  if (entries === undefined) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        `[field-completion-weights] Το είδος «${canonical}» δεν έχει γραμμή στο FIELD_WEIGHTS. ` +
          'Πρόσθεσέ την — μη σβήσεις αυτόν τον έλεγχο (ADR-842 Α6).',
      );
    }
    return CRITICAL_IDENTITY;
  }

  return entries;
}


// =============================================================================
// 6. LABEL RESOLUTION — «πώς λέγεται αυτό το πεδίο ΓΙΑ ΑΥΤΟ το ακίνητο;»
// =============================================================================

/**
 * Το i18n κλειδί της ετικέτας ενός πεδίου, **για τη συγκεκριμένη κλάση ακινήτου**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ ΗΡΘΕ ΑΠΟ ΤΗΝ **ΟΘΟΝΗ**, ΟΧΙ ΑΠΟ ΤΕΣΤ *(2026-09-03, ADR-842 §7.6.8)*
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετά τη διόρθωση της Α6, η `/offers/<οικόπεδο>` απέδιδε σωστά — και έλεγε
 * **«Τι λείπει: Κάτοψη»**. Η βαθμολόγηση ήταν σωστή *(το `floorplan` για τη γη **είναι**
 * το τοπογραφικό — το `Survey` του CRMLS, §7.6.4)*, αλλά η **λέξη** ζητούσε από
 * ιδιοκτήτη οικοπέδου **σχέδιο ορόφου κτιρίου που δεν υπάρχει**. Το ίδιο και το
 * `areaGross` = *«Μικτή επιφάνεια»*: μικτό ⇄ καθαρό είναι διάκριση **κτίσματος**· η γη
 * έχει απλώς **εμβαδόν**.
 *
 * ⚠️ **Καμία μηχανή δεν μπορούσε να το πιάσει.** Η βαθμολογία ήταν σωστή, ο δείκτης
 * σωστός, τα tests πράσινα — μόνο η **ανάγνωση** ήταν λάθος. Γι' αυτό η επαλήθευση στην
 * οθόνη δεν είναι τελετουργικό.
 *
 * 🔑 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ COMPONENT**: τις ίδιες ετικέτες τις διαβάζουν **δύο**
 * ανεξάρτητες οθόνες — ο δείκτης του ιδιώτη (`OwnerListingCompletion`) και η ανάλυση της
 * εταιρείας (`PropertyCompletionBreakdown`). Διόρθωση στη μία θα άφηνε την άλλη να λέει
 * «Κάτοψη» για το ίδιο οικόπεδο· δηλαδή **δύο αυθεντίες για το ίδιο όνομα**, η κλάση που
 * μόλις καθαρίστηκε από αυτό το ADR.
 *
 * ⚠️ **Η υπερκάλυψη είναι ΜΕΡΙΚΗ, επίτηδες**: το `completion.fields.land.*` δηλώνει
 * **μόνο** τα πεδία που όντως λέγονται αλλιώς. Ό,τι δεν δηλώνεται εκεί πέφτει στο γενικό
 * — ώστε ένα νέο `FIELD_KEY` να μη χρειάζεται γραμμή σε κάθε κλάση για να έχει όνομα.
 *
 * @param fieldKey το πεδίο
 * @param propertyType το είδος του ακινήτου *(δέχεται `unknown`: τα έγγραφα Firestore
 *   φτάνουν ως ωμό cast, και το `null` είναι έγκυρη απάντηση «δεν ξέρω»)*
 * @returns κλειδί **χωρίς** πρόθεμα namespace, π.χ. `completion.fields.land.floorplan`
 */
export function completionFieldLabelKey(fieldKey: FieldKey, propertyType: unknown): string {
  return propertyClassOf(normalizePropertyType(propertyType)) === 'land'
    && (LAND_LABELLED_FIELDS as readonly string[]).includes(fieldKey)
      ? `completion.fields.land.${fieldKey}`
      : `completion.fields.${fieldKey}`;
}

/**
 * Τα πεδία που η γη **ονομάζει αλλιώς** — και ο πίνακας ζει δίπλα στη συνάρτηση, όχι
 * μέσα στα locales, γιατί είναι **ισχυρισμός του τομέα** και όχι μετάφραση.
 *
 * ⛔ **Πρόσθεσε εδώ ΜΟΝΟ αν προσθέσεις και τα δύο locale κλειδιά** — η άγκυρα
 * `property-type-coverage` το εκτελεί και κοκκινίζει σε κλειδί που δεν λύνεται.
 */
const LAND_LABELLED_FIELDS = ['areaGross', 'floorplan', 'photos'] as const;
