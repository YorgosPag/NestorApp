/**
 * =============================================================================
 * ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΔΙΟΙΚΗΤΙΚΗΣ ΙΕΡΑΡΧΙΑΣ — μία γραμμή ανά επίπεδο (ADR-772)
 * =============================================================================
 *
 * ## Τι διορθώνει
 *
 * Η οθόνη (`AddressWithHierarchy`) ρωτά **οκτώ** διοικητικά επίπεδα × (Id + Name).
 * Η αποθήκευση κρατούσε **όσα ήξερε ο κάθε μετατροπέας**, **χωρίς κανένα μήνυμα**.
 * Μέτρηση 2026-08-08, ανά **κατεύθυνση** (όχι ανά όνομα — το grep ονομάτων έλεγε «8/8»
 * για αρχεία που μετέφεραν 5):
 *
 * | Μετατροπέας | → φόρμα | ← αποθήκευση | Ids |
 * |---|---|---|---|
 * | `location-converters.ts` | 6/8 | 6/8 (+ έχανε το `country`) | 0/8 |
 * | `CompanyAddressesSection.tsx` | 8/8 | 8/8 | 2/8 |
 * | `BuildingAddressesEditor.tsx` | **5/8** | **5/8** | 0/8 |
 * | `AddressesSectionWithFullscreen.tsx` | 8/8 | 8/8 | 2/8 |
 * | `FrontageAddressCreateDialog.tsx` | — | **2/8** | 0/8 |
 *
 * 🔑 **Τρία διαφορετικά σχήματα απώλειας**, όχι ένα: (α) ο μετατροπέας ξεχνά επίπεδο·
 * (β) το **δοχείο** δεν έχει καν πεδίο· (γ) ο **καλών** ξαναδιαλέγει με το χέρι
 * υποσύνολο από σωστό αποτέλεσμα (`FrontageAddressCreateDialog`).
 *
 * ## Ο μηχανισμός
 *
 * `Readonly<Record<AdminLevelKey, …>>` πάνω στο **`keyof AdminPath`** — την αυθεντία των
 * επιπέδων (`useAdministrativeHierarchy.ts`). Νέο επίπεδο ⇒ **δεν μεταγλωττίζεται**.
 * Κάθε όνομα πεδίου τυπώνεται ως `keyof <το πραγματικό δοχείο>` ⇒ μετονομασία πεδίου
 * σε οποιοδήποτε δοχείο ⇒ **δεν μεταγλωττίζεται**. Ίδιο πρότυπο με το `SOURCE_ENTRIES`
 * του ADR-769.
 *
 * ⚠️ **Καμία σιωπηλή μαντεψιά**: το κελί δεν επιτρέπεται να λείπει. Δοχείο που δεν κρατά
 * ένα επίπεδο το δηλώνει **ρητά** με `NOT_STORED`. Η διαφορά «δεν το κρατάμε» / «ξεχάστηκε»
 * είναι ακριβώς αυτή που κόστισε τα δεδομένα.
 *
 * @module utils/address/administrative-hierarchy-vocabulary
 * @see ADR-772 — το λεξιλόγιο της διοικητικής ιεραρχίας
 * @see ADR-332 D15 — ο πρόγονος (`HIERARCHY_PROJECTION`), που κάλυπτε μόνο τις επαφές
 */

import type { AdminPath } from '@/hooks/useAdministrativeHierarchy';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/address-with-hierarchy-config';
import type { ProjectAddress } from '@/types/project/addresses';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import type { AddressInfo } from '@/types/contacts';

// =============================================================================
// ΚΛΕΙΔΙΑ
// =============================================================================

/**
 * Τα οκτώ επίπεδα, **από την αυθεντία**. Δεν ξαναγράφονται εδώ: το `AdminPath` είναι ο
 * τύπος που επιστρέφει το `resolvePath` του `useAdministrativeHierarchy`, δηλαδή αυτό
 * που **πραγματικά** παράγει η ιεραρχία. Ένα ένατο επίπεδο εκεί σπάει τη μεταγλώττιση
 * εδώ — που είναι όλο το νόημα.
 */
export type AdminLevelKey = keyof AdminPath;

/** Τα ταχυδρομικά πεδία — εκτός διοικητικής ιεραρχίας, ίδια διαδρομή απώλειας. */
export type PostalFieldKey = 'street' | 'number' | 'postalCode' | 'country';

/**
 * Πεδία που **δεν** είναι διοικητικά επίπεδα αλλά ταξιδεύουν **πάντα** μαζί με την
 * ιεραρχία, ακόμη κι όταν ο καλών δεν θέλει τα ταχυδρομικά.
 *
 * ⚠️ Σήμερα: μόνο το `neighborhood`. Ο πρόγονος (`HIERARCHY_PROJECTION`) το είχε μέσα στον
 * πίνακα της ιεραρχίας με το σχόλιο «εκτός ιεραρχίας, αλλά **ίδιο μονοπάτι**». Όταν το
 * μετακίνησα στα ταχυδρομικά, η «Περιοχή / Συνοικία» των επαφών **εξαφανίστηκε** — το
 * έπιασε το `address-info-builder.test.ts`. Η διάκριση «ταξιδεύει πάντα» / «ταξιδεύει με
 * τα ταχυδρομικά» είναι πραγματική και γι' αυτό είναι χωριστός πίνακας.
 */
export type HierarchyAdjacentFieldKey = 'neighborhood';

/**
 * Τα επίπεδα πεδία διεύθυνσης της φόρμας επαφής, όπως τα περιμένουν οι mappers.
 *
 * ⚠️ Ζει **εδώ** (μετακόμισε από το `utils/contacts/address-info-builder.ts`, ADR-772):
 * είναι ένα από τα λεξιλόγια του πίνακα, άρα ο πίνακας πρέπει να το τυπώνει. Το
 * `address-info-builder` το επανεξάγει για τους υπάρχοντες καταναλωτές.
 */
export interface FlatAddressFormFields {
  street: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  settlement: string;
  settlementId: string | null;
  community: string;
  municipalUnit: string;
  municipality: string;
  municipalityId: string | null;
  regionalUnit: string;
  region: string;
  decentAdmin: string;
  majorGeo: string;
  neighborhood: string;
}

// =============================================================================
// ΤΑ ΛΕΞΙΛΟΓΙΑ
// =============================================================================

/** Τα δοχεία που μιλούν για διοικητική ιεραρχία, με το όνομα του καθενός. */
interface VocabularyContainers {
  /** Η **φόρμα** — `AddressWithHierarchy`. Ζευγάρια `*Id` + `*Name`, και τα 8 επίπεδα. */
  form: AddressWithHierarchyValue;
  /** Διεύθυνση έργου (έργα, κτίρια, πρόσωπα οικοπέδου). */
  projectAddress: ProjectAddress;
  /** Εγγραφή διεύθυνσης επαφής — η **αυθεντική** λίστα της φόρμας επαφών. */
  companyAddress: CompanyAddress;
  /** Το **παράγωγο** `contact.addresses[]`. */
  addressInfo: AddressInfo;
  /** Τα επίπεδα πεδία της φόρμας επαφής. */
  contactFlat: FlatAddressFormFields;
}

export type AddressVocabulary = keyof VocabularyContainers;

/**
 * Ρητή δήλωση «αυτό το δοχείο **δεν** κρατά αυτή την τιμή».
 *
 * 🔑 Υπάρχει για να μην μπορεί ένα κελί να **λείπει**. Το κενό κελί είναι ακριβώς η
 * σιωπή που έκρυβε την απώλεια· το `NOT_STORED` είναι η ίδια πληροφορία **γραμμένη**,
 * άρα ελέγξιμη από άνθρωπο και από test.
 */
export const NOT_STORED = 'not-stored' as const;
export type NotStored = typeof NOT_STORED;

/**
 * Αλυσίδα ονομάτων, **μη κενή**.
 *
 * Ανάγνωση = **πρώτο μη-κενό** της αλυσίδας· γραφή = **πρώτο** όνομα (το κανονικό).
 * Τα υπόλοιπα είναι αναγνωστικά εναλλακτικά παλαιών εγγραφών — π.χ. το `CompanyAddress`
 * κουβαλά ΚΑΙ `regionName` (από την ιεραρχία) ΚΑΙ `region` (ελεύθερο ταχυδρομικό).
 */
type FieldChain<V extends AddressVocabulary> = readonly [
  Extract<keyof VocabularyContainers[V], string>,
  ...Extract<keyof VocabularyContainers[V], string>[],
];

type Slot<V extends AddressVocabulary> = FieldChain<V> | NotStored;

/** Ένα διοικητικό επίπεδο σε **κάθε** λεξιλόγιο — όνομα και ταυτότητα. */
type LevelBinding = {
  readonly [V in AddressVocabulary]: {
    readonly name: Slot<V>;
    readonly id: Slot<V>;
  };
};

/** Ένα ταχυδρομικό πεδίο σε κάθε λεξιλόγιο — μόνο όνομα (δεν έχουν ταυτότητα). */
type PostalBinding = {
  readonly [V in AddressVocabulary]: Slot<V>;
};

// =============================================================================
// Ο ΠΙΝΑΚΑΣ — 8 ΕΠΙΠΕΔΑ
// =============================================================================

/**
 * Μία γραμμή ανά επίπεδο. **Ξεχασμένο επίπεδο ⇒ σφάλμα μεταγλώττισης.**
 *
 * ⚠️ **Η σύγκρουση `community` / `neighborhood` είναι ΔΗΛΩΜΕΝΗ, όχι λυμένη** (ADR-772 §5):
 * τα **έργα** αποθηκεύουν την Κοινότητα στο `neighborhood`, και το ίδιο πεδίο ζωγραφίζεται
 * ως «Περιοχή / Συνοικία» (`LocationInlineForm.tsx` `showNeighborhoodRegion`) **και**
 * τροφοδοτεί τον γεωκωδικοποιητή. Οι **επαφές** δηλώνουν ρητά ότι το `neighborhood` είναι
 * ελεύθερο κείμενο **εκτός** ιεραρχίας και έχουν χωριστό `communityName`.
 * ⛔ **ΜΗΝ «διορθώσεις» εδώ τα έργα σε δικό τους `community` πεδίο** χωρίς εντολή: είναι
 * αλλαγή **ορατής συμπεριφοράς** (το πεδίο θα άδειαζε σε υπάρχουσες εγγραφές) και ερώτημα
 * τομέα («Κοινότητα == Συνοικία;»), όχι τεχνική εκκρεμότητα. Ο πίνακας εδώ **περιγράφει
 * τι ισχύει**, που είναι η δουλειά του.
 */
export const ADMIN_LEVEL_VOCABULARY: Readonly<Record<AdminLevelKey, LevelBinding>> = {
  settlement: {
    // Ο οικισμός είναι η «πόλη» σε κάθε δοχείο αποθήκευσης — δεν υπάρχει χωριστό πεδίο.
    form: { name: ['settlementName'], id: ['settlementId'] },
    projectAddress: { name: ['city'], id: ['settlementId'] },
    companyAddress: { name: ['city'], id: ['settlementId'] },
    addressInfo: { name: ['settlement', 'city'], id: ['settlementId'] },
    contactFlat: { name: ['settlement', 'city'], id: ['settlementId'] },
  },
  community: {
    form: { name: ['communityName'], id: ['communityId'] },
    // ⚠️ Βλ. τη σύγκρουση παραπάνω — τα έργα την κρατούν εδώ, όπως πάντα.
    projectAddress: { name: ['neighborhood'], id: NOT_STORED },
    companyAddress: { name: ['communityName'], id: NOT_STORED },
    addressInfo: { name: ['community'], id: NOT_STORED },
    contactFlat: { name: ['community'], id: NOT_STORED },
  },
  municipalUnit: {
    form: { name: ['municipalUnitName'], id: ['municipalUnitId'] },
    projectAddress: { name: ['municipalUnit'], id: ['municipalUnitId'] },
    companyAddress: { name: ['municipalUnitName'], id: NOT_STORED },
    addressInfo: { name: ['municipalUnit'], id: NOT_STORED },
    contactFlat: { name: ['municipalUnit'], id: NOT_STORED },
  },
  municipality: {
    form: { name: ['municipalityName'], id: ['municipalityId'] },
    projectAddress: { name: ['municipality'], id: ['municipalityId'] },
    companyAddress: { name: ['municipalityName'], id: ['municipalityId'] },
    addressInfo: { name: ['municipality'], id: ['municipalityId'] },
    contactFlat: { name: ['municipality'], id: ['municipalityId'] },
  },
  regionalUnit: {
    form: { name: ['regionalUnitName'], id: ['regionalUnitId'] },
    projectAddress: { name: ['regionalUnit'], id: ['regionalUnitId'] },
    companyAddress: { name: ['regionalUnitName'], id: NOT_STORED },
    addressInfo: { name: ['regionalUnit'], id: NOT_STORED },
    contactFlat: { name: ['regionalUnit'], id: NOT_STORED },
  },
  region: {
    form: { name: ['regionName'], id: ['regionId'] },
    projectAddress: { name: ['region'], id: ['regionId'] },
    // Ο αναγνώστης προτιμά το `regionName` (ιεραρχία) και πέφτει στο `region`
    // (ελεύθερο ταχυδρομικό) — η σειρά ΕΙΝΑΙ ο κανόνας, μην την αλλάξεις.
    companyAddress: { name: ['regionName', 'region'], id: NOT_STORED },
    addressInfo: { name: ['region'], id: NOT_STORED },
    contactFlat: { name: ['region'], id: NOT_STORED },
  },
  decentAdmin: {
    form: { name: ['decentAdminName'], id: ['decentAdminId'] },
    // ADR-772: ήταν σταθερά `''` στον μετατροπέα έργων — η οθόνη το ρωτούσε, κανείς
    // δεν το κρατούσε. Πλέον υπάρχει πεδίο ΚΑΙ δήλωση στο Zod σχήμα.
    projectAddress: { name: ['decentAdmin'], id: ['decentAdminId'] },
    companyAddress: { name: ['decentAdminName'], id: NOT_STORED },
    addressInfo: { name: ['decentAdmin'], id: NOT_STORED },
    contactFlat: { name: ['decentAdmin'], id: NOT_STORED },
  },
  majorGeo: {
    form: { name: ['majorGeoName'], id: ['majorGeoId'] },
    projectAddress: { name: ['majorGeo'], id: ['majorGeoId'] },
    companyAddress: { name: ['majorGeoName'], id: NOT_STORED },
    addressInfo: { name: ['majorGeo'], id: NOT_STORED },
    contactFlat: { name: ['majorGeo'], id: NOT_STORED },
  },
};

// =============================================================================
// Ο ΠΙΝΑΚΑΣ — ΤΑΧΥΔΡΟΜΙΚΑ ΠΕΔΙΑ
// =============================================================================

/**
 * Τα μη-ιεραρχικά πεδία που ταξίδευαν στην **ίδια** διαδρομή και χάνονταν το ίδιο.
 *
 * 🔑 Το `number` λέγεται **`streetNumber`** στη φόρμα επαφής — μία λέξη διαφορά που ήταν
 * γραμμένη με το χέρι σε κάθε mapper. Το `country` **δεν υπάρχει** στα επίπεδα πεδία
 * (ζει ως `hqAddressCountry` στο `ContactFormData`, εκτός αυτού του λεξιλογίου) και
 * δηλώνεται `NOT_STORED` αντί να λείπει σιωπηλά.
 */
export const POSTAL_FIELD_VOCABULARY: Readonly<Record<PostalFieldKey, PostalBinding>> = {
  street: {
    form: ['street'],
    projectAddress: ['street'],
    companyAddress: ['street'],
    addressInfo: ['street'],
    contactFlat: ['street'],
  },
  number: {
    form: ['number'],
    projectAddress: ['number'],
    companyAddress: ['number'],
    addressInfo: ['number'],
    contactFlat: ['streetNumber'],
  },
  postalCode: {
    form: ['postalCode'],
    projectAddress: ['postalCode'],
    companyAddress: ['postalCode'],
    addressInfo: ['postalCode'],
    contactFlat: ['postalCode'],
  },
  country: {
    form: ['country'],
    projectAddress: ['country'],
    companyAddress: ['country'],
    addressInfo: ['country'],
    contactFlat: NOT_STORED,
  },
};

/**
 * Ό,τι ταξιδεύει **πάντα** με την ιεραρχία. Βλ. `HierarchyAdjacentFieldKey`.
 */
export const HIERARCHY_ADJACENT_VOCABULARY: Readonly<
  Record<HierarchyAdjacentFieldKey, PostalBinding>
> = {
  neighborhood: {
    // Η φόρμα ιεραρχίας δεν έχει δικό της πεδίο συνοικίας: το `AddressEditor` το
    // ζωγραφίζει χωριστά και το δένει στο επίπεδο «Κοινότητα» (βλ. σύγκρουση παραπάνω).
    form: NOT_STORED,
    // 🔴 **ΕΝΑΣ ιδιοκτήτης ανά πεδίο.** Στα έργα το `neighborhood` το κατέχει το επίπεδο
    // **Κοινότητα** (§5) — αν το διεκδικούσε και αυτή η γραμμή, δύο κανόνες θα έγραφαν στο
    // ίδιο πεδίο και ο νικητής θα ήταν η σειρά του βρόχου, δηλαδή τύχη. Το βρήκε ο έλεγχος
    // μετάλλαξης Μ11: η αλλαγή αυτού του κελιού **δεν άλλαζε τίποτα**, που είναι ο ορισμός
    // του νεκρού κανόνα. Άγκυρα: «κανένα πεδίο με δύο διεκδικητές» παρακάτω στα tests.
    projectAddress: NOT_STORED,
    companyAddress: ['neighborhood'],
    addressInfo: ['neighborhood'],
    contactFlat: ['neighborhood'],
  },
};
