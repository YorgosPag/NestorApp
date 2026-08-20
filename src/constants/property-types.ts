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
 *
 * 🔴 **2026-08-20 (ADR-777 §8.32) — ΜΠΗΚΕ Η ΓΗ.** Μέχρι σήμερα και οι **δώδεκα**
 * τιμές ήταν **χτισμένες μονάδες**, ενώ η εφαρμογή πρόσφερε την **αντιπαροχή** ως
 * είδος διάθεσης (`OFFER_KINDS`) και ο κανόνας του τομέα λέει *«η αντιπαροχή αφορά
 * **ΜΟΝΟ** το οικόπεδο»* (Giorgio 2026-08-20). Δηλαδή: **πόρτα προς δωμάτιο που δεν
 * υπήρχε** — ο ιδιοκτήτης καλούνταν να δηλώσει αντιπαροχή για *διαμέρισμα*, και ο
 * εργολάβος να **ζητήσει** οικόπεδο διαλέγοντας από την ίδια λίστα.
 *
 * ⚠️ **Η σειρά των υπαρχόντων ΔΕΝ άλλαξε** — τα νέα μπαίνουν στο **τέλος**. Ο πίνακας
 * είναι «σε σειρά εμφάνισης» και μια αναδιάταξη θα μετακινούσε σιωπηλά κάθε dropdown
 * της εφαρμογής.
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
  'plot',
  'parcel',
] as const;

/** Canonical TypeScript union — derived automatically from `PROPERTY_TYPES`. */
export type PropertyTypeCanonical = (typeof PROPERTY_TYPES)[number];

// =============================================================================
// 1a. Η ΚΑΤΗΓΟΡΙΑ — ο ΔΕΥΤΕΡΟΣ άξονας (ADR-777 §8.32)
// =============================================================================

/**
 * **Τι είδους πράγμα είναι** — ο άξονας πάνω από το είδος.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΠΡΟΤΥΠΟ, ΚΑΙ ΠΟΥ ΤΟ ΞΕΠΕΡΝΑΜΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **RESO Data Dictionary** — το πρότυπο που τρέχει ολόκληρη η βορειοαμερικανική
 * αγορά — δεν έχει **ένα** πεδίο για το «τι είναι», έχει **δύο**: `PropertyType`
 * (10 τιμές, με τη **Land** ισότιμη προς Residential/Commercial) και
 * `PropertySubType` (31 τιμές, με δικές της για τη γη: *Unimproved Land ·
 * Agriculture · Ranch · Farm*). Το **IFC/Revit/ArchiCAD** λέει το ίδιο από την
 * πλευρά του μηχανικού: το `IfcSite` κάθεται **πάνω** από το `IfcBuilding` — η γη
 * δεν είναι «είδος μονάδας», είναι **άλλο σκαλί** της ιεραρχίας.
 *
 * 🏆 **Πού είμαστε ΚΑΘΑΡΟΤΕΡΟΙ από το RESO**: εκείνο **μολύνει** τον άξονα του
 * είδους με τη **συναλλαγή** — `Commercial Lease` · `Commercial Sale` ·
 * `Residential Lease` είναι **PropertyTypes**, δηλαδή το ίδιο πράγμα μετριέται δύο
 * φορές (είδος × συναλλαγή), ακριβώς το *combinatorial explosion* που το
 * `types/property-offers.ts` **απέρριψε γραπτώς** για τον δικό μας κώδικα (7 → 11
 * τιμές). Επειδή η συναλλαγή ζει **ήδη** σε δικό της άξονα (`OFFER_KINDS`:
 * sell · leaseOut · exchange), **αυτός** ο άξονας μένει καθαρός: **τρεις** τιμές,
 * καμία σύνθετη.
 *
 * ⚠️ **`agricultural` ΔΕΝ είναι τέταρτη κατηγορία**, και είναι απόφαση: το
 * αγροτεμάχιο **είναι γη** — αυτό που αλλάζει είναι το *καθεστώς δόμησης*, όχι το
 * είδος του πράγματος. Τέταρτη κατηγορία θα ξανάφερνε τη σύνθεση που μόλις
 * αποφύγαμε (γη × καθεστώς).
 */
export const PROPERTY_CLASSES = ['land', 'residential', 'commercial'] as const;

/** Η κατηγορία ενός είδους — ο δεύτερος άξονας. */
export type PropertyClass = (typeof PROPERTY_CLASSES)[number];

/**
 * **Κάθε είδος → η κατηγορία του.** Ρητά, εξαντλητικά, ένα προς ένα.
 *
 * 🔴 **ΓΙΑΤΙ ΡΗΤΟΣ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΣΥΜΠΛΗΡΩΜΑ — ΤΟ ΠΛΗΡΩΣΑΜΕ ΗΔΗ ΜΙΑ ΦΟΡΑ.**
 * Μέχρι σήμερα η κατηγορία υπήρχε ως **δυάδα με συμπλήρωμα**: το
 * {@link COMMERCIAL_PROPERTY_TYPES} ήταν σκληρή λίστα τεσσάρων και το
 * {@link RESIDENTIAL_PROPERTY_TYPES} οριζόταν ως *«όλα τα υπόλοιπα»*. Συνέπεια,
 * μετρημένη: **το `plot` θα βαφτιζόταν σιωπηλά «κατοικία»** — και ο κανόνας του
 * υπογείου (`property-field-rules.ts`) θα ρωτούσε *«είναι περίεργο να υπάρχει
 * οικόπεδο στο υπόγειο;»*. Ένα σύνολο ορισμένο ως «ό,τι περισσεύει» **δίνει
 * κατηγορία σε τιμές που κανείς δεν εξέτασε**.
 *
 * ⚠️ Ο `Record<PropertyTypeCanonical, PropertyClass>` κάνει τον **μεταγλωττιστή**
 * φρουρό: νέο είδος **δεν μεταγλωττίζεται** μέχρι κάποιος να απαντήσει «τι είναι».
 * Αυτή είναι η ουσία της αλλαγής — όχι οι δύο νέες τιμές.
 */
export const PROPERTY_TYPE_CLASS: Record<PropertyTypeCanonical, PropertyClass> = {
  studio: 'residential',
  apartment_1br: 'residential',
  apartment: 'residential',
  maisonette: 'residential',
  penthouse: 'residential',
  loft: 'residential',
  detached_house: 'residential',
  villa: 'residential',
  shop: 'commercial',
  office: 'commercial',
  hall: 'commercial',
  storage: 'commercial',
  plot: 'land',
  parcel: 'land',
};

/**
 * Τα είδη μιας κατηγορίας — **παραγόμενα**, ποτέ χειρόγραφα.
 *
 * ⚠️ Διατηρεί τη σειρά του {@link PROPERTY_TYPES} (σειρά εμφάνισης), ώστε ένα
 * dropdown φιλτραρισμένο κατά κατηγορία να μη δείχνει άλλη σειρά από το πλήρες.
 */
export function propertyTypesOfClass(
  klass: PropertyClass,
): readonly PropertyTypeCanonical[] {
  return PROPERTY_TYPES.filter((type) => PROPERTY_TYPE_CLASS[type] === klass);
}

/**
 * Η κατηγορία μιας **αβέβαιης** τιμής — `null` όταν δεν είναι κανονικό είδος.
 *
 * ⚠️ Δέχεται `unknown` επίτηδες: οι πραγματικοί καταναλωτές διαβάζουν από Firestore,
 * όπου ζουν ακόμη `DEPRECATED_PROPERTY_TYPES` και `LEGACY_GREEK_PROPERTY_TYPES`.
 * Για ελεύθερο κείμενο, πέρνα το πρώτα από το `normalizePropertyType`
 * (`constants/property-type-aliases`) — αυτό εδώ **δεν** μαντεύει.
 */
export function propertyClassOf(type: unknown): PropertyClass | null {
  return isCanonicalPropertyType(type) ? PROPERTY_TYPE_CLASS[type] : null;
}

/**
 * **Είναι γη;** — το κατηγόρημα που ξεκλειδώνει την αντιπαροχή.
 *
 * 🔑 Ζει **εδώ, δίπλα στον πίνακα**, και όχι στη φόρμα που το χρειάστηκε πρώτη: δύο
 * οθόνες με χειρόγραφο `type === 'plot' || type === 'parcel'` θα ήταν δύο αυθεντίες
 * για το «τι είναι γη», και η τρίτη τιμή γης θα προστίθετο **στη μία**.
 */
export function isLandPropertyType(type: unknown): boolean {
  return propertyClassOf(type) === 'land';
}

/** Τα είδη γης — `plot` (εντός σχεδίου) · `parcel` (εκτός). */
export const LAND_PROPERTY_TYPES: readonly PropertyTypeCanonical[] =
  propertyTypesOfClass('land');

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
 *
 * 🔴 **Η ΓΗ ΕΞΑΙΡΕΙΤΑΙ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΛΕΙΨΗ** (ADR-777 §8.32): αυτά τα dropdowns
 * δημιουργούν **μονάδα μέσα σε έργο/κτίριο/όροφο** — ένα οικόπεδο δεν είναι μονάδα
 * κτιρίου, και το επίπεδο Α το λέει ήδη ρητά (*«το κτίριο δεν κρατά δική του θέση —
 * την κληρονομεί από τη γη»*, `types/geo/public-place.ts`). Χωρίς αυτή τη γραμμή, η
 * φόρμα «νέα μονάδα» θα πρόσφερε «Οικόπεδο» ως όροφο πολυκατοικίας.
 *
 * ⚠️ **Ο ιδιώτης ΔΕΝ περνά από εδώ** — η φόρμα της προσφοράς (`OwnerPropertyFields`)
 * διαβάζει το πλήρες {@link PROPERTY_TYPES}, γι' αυτό και βλέπει τη γη. Επαληθεύτηκε
 * πριν την αλλαγή· αν κάποια μέρα αλλάξει, η γη θα εξαφανιστεί από την **μόνη** οθόνη
 * που τη χρειάζεται.
 */
export const CREATABLE_PROPERTY_TYPES: readonly PropertyTypeCanonical[] =
  PROPERTY_TYPES.filter((t) => t !== 'storage' && !isLandPropertyType(t));

/**
 * Discriminator — `true` αν το `type` είναι **κανονική** τιμή του {@link PROPERTY_TYPES}.
 *
 * 🔴 **Χρειάζεται επειδή το `PropertyType` ΔΕΝ είναι μόνο οι κανονικές τιμές**: η ένωση
 * περιλαμβάνει και `DEPRECATED_PROPERTY_TYPES` και `LegacyGreekPropertyType` για
 * συμβατότητα με παλιά έγγραφα Firestore. Άρα το {@link PROPERTY_TYPE_I18N_KEYS}
 * —που καλύπτει **μόνο** τις κανονικές— είναι **μερική** απεικόνιση, και μια οθόνη
 * που το δεικτοδοτεί χωρίς έλεγχο βάφει `undefined` ⇒ **ωμό κλειδί** ή κενό κελί.
 *
 * ⚠️ Ζει **εδώ, δίπλα στον πίνακα**, και όχι στην οθόνη που το χρειάστηκε πρώτη: δύο
 * οθόνες με χειρόγραφο `includes(...)` θα ήταν δύο αυθεντίες για το «τι είναι κανονικό
 * είδος» — ίδιο σχήμα με τον {@link isStandaloneUnitType} από κάτω, γι' αυτό και ίδια
 * θέση.
 *
 * @see ADR-777 Α14 — η κάρτα της προσφοράς ήταν ο πρώτος καταναλωτής.
 */
export function isCanonicalPropertyType(type: unknown): type is PropertyTypeCanonical {
  return (
    typeof type === 'string' && (PROPERTY_TYPES as readonly string[]).includes(type)
  );
}

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
  plot: 'types.plot',
  parcel: 'types.parcel',
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
 *
 * ⚠️ **Παράγεται από το {@link PROPERTY_TYPE_CLASS}** (ADR-777 §8.32) — ήταν σκληρή
 * λίστα τεσσάρων. Ίδιες τιμές, μία αυθεντία.
 */
export const COMMERCIAL_PROPERTY_TYPES: readonly PropertyTypeCanonical[] =
  propertyTypesOfClass('commercial');
/**
 * Residential property types. Basement placement is unusual για residential types
 * (field-rule warning trigger). Περιλαμβάνει τα 2 deprecated underscore values
 * (apartment_2br/3br) για backward compat με παλιά Firestore data.
 *
 * 🔴 **ΗΤΑΝ ΣΥΜΠΛΗΡΩΜΑ, ΚΑΙ ΤΟ ΣΥΜΠΛΗΡΩΜΑ ΗΤΑΝ ΤΟ ΕΛΑΤΤΩΜΑ** (ADR-777 §8.32):
 * οριζόταν ως *«όλα τα είδη μείον τα εμπορικά»*, άρα **κάθε** νέα τιμή γινόταν
 * αυτόματα «κατοικία» χωρίς κανείς να την εξετάσει. Η προσθήκη της γης θα είχε
 * βαφτίσει το **οικόπεδο κατοικία** και ο μοναδικός καταναλωτής
 * (`property-field-rules.ts`) θα προειδοποιούσε ότι *«είναι ασυνήθιστο να βρίσκεται
 * σε υπόγειο»*. Παράγεται πλέον με **ρητή** ανάθεση.
 */
export const RESIDENTIAL_PROPERTY_TYPES: readonly (
  | PropertyTypeCanonical
  | DeprecatedPropertyType
)[] = [...propertyTypesOfClass('residential'), ...DEPRECATED_PROPERTY_TYPES];

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
