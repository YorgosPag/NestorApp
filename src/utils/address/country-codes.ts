/**
 * =============================================================================
 * ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΧΩΡΑΣ — μία γραμμή ανά χώρα (ADR-332 D12 · D27 Φάση Α)
 * =============================================================================
 *
 * ## Η αρχή
 *
 * 🔑 **Ο κωδικός είναι το σταθερό μισό, το όνομα το κινούμενο.** Αποθηκεύεται ο
 * **κωδικός** (ISO 3166-1 alpha-2), εμφανίζεται **παραγόμενο** όνομα. Είναι η πρακτική
 * που ορίζει το `schema.org/addressCountry` και που το έργο **ήδη τηρεί** αλλού: το
 * `birthCountry` αποθηκεύει `'GR'` και δείχνει `common:countries.greece`
 * (`config/vocabulary/options/individual.ts`). **Η διεύθυνση ήταν η εξαίρεση.**
 *
 * ## Τι διόρθωσε (μετρημένο ζωντανά, 2026-09-12 — εύρημα Ζ4α)
 *
 * Μετά από «Ναι, ενημέρωσε» σε σύρσιμο πινέζας, το υποκατάστημα κρατούσε
 * `country: 'Ελλάδα'` — την **ετικέτα** που επιστρέφει ο Nominatim με `accept-language: el`
 * — ενώ **όλες** οι άλλες εγγραφές του ίδιου εγγράφου είχαν `'GR'`. Η **σύγκριση** περνούσε
 * ήδη από εδώ (`diffAddressFields.comparable`), η **γραφή** ποτέ: συγκρίναμε σε ταυτότητα
 * και αποθηκεύαμε σε ετικέτα.
 *
 * ## Γιατί ΕΝΑ σημείο
 *
 * Το ίδιο ερώτημα («είναι ελληνική αυτή η διεύθυνση;») απαντιόταν σε δύο θέσεις με
 * διαφορετικό λεξιλόγιο: πλήρης χάρτης στο `geocoding-engine.ts`, inline αλυσίδα `||` με
 * έξι τιμές στο `AddressWithHierarchy.tsx`. Κάθε νέα ορθογραφία («ΕΛΛΑΣ», NFD από
 * clipboard macOS) έπρεπε να προστεθεί και στα δύο· μια ξεχασμένη προσθήκη περνούσε
 * **αθόρυβα** και άλλαζε συμπεριφορά.
 *
 * ⚠️ **Ουδέτερο στρώσης, σκόπιμα**: το εισάγει ο διακομιστής (`api/geocoding/geocoding-engine`)
 * **και** ο περιηγητής. Καμία εξάρτηση από React, `fs` ή i18n runtime — μόνο τα **κλειδιά**
 * των ετικετών, που είναι σκέτα strings.
 *
 * @module utils/address/country-codes
 * @see ADR-332 D12 — ακεραιότητα χώρας στο geocoding
 * @see ADR-332 D27 Φάση Α — η χώρα αποθηκεύεται ως κωδικός
 */

import { normalizeGreekText } from '@/utils/greek-text';

/** ISO 3166-1 alpha-2 της Ελλάδας — το κλειδί κάθε «ελληνικού» κανόνα. Πεζά (κλειδί ευρετηρίου). */
export const GREECE_COUNTRY_CODE = 'gr';

/**
 * Μία γραμμή ανά χώρα: **ταυτότητα**, **ετικέτα** και **ό,τι σημαίνει αυτή τη χώρα**.
 *
 * 🔑 Τα `aliases` δεν είναι «εναλλακτικές ορθογραφίες για ευκολία» — είναι ό,τι **φτάνει
 * πραγματικά**: πληκτρολόγηση ανθρώπου, επικόλληση, αποθηκευμένη παλιά εγγραφή («Greece»
 * από το `GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY`) και ετικέτα μηχανής («Ελλάδα» από τον
 * Nominatim με `accept-language: el`). Η αναζήτηση γίνεται **χωρίς τόνους και πεζοκεφαλαία**,
 * οπότε ο πίνακας μένει αναγνώσιμος και το ευρετήριο κάνει τη δουλειά.
 *
 * ⚠️ Ο κωδικός `gb` κρατά το **παλιό** κλειδί ετικέτας `countries.uk`: το κλειδί είναι
 * αποθηκευμένη ταυτότητα μετάφρασης, η ετικέτα του λέει ήδη «Ηνωμένο Βασίλειο», και μια
 * μετονομασία θα έσπαγε το `VOCAB_COUNTRY_OPTIONS` **χωρίς να κερδίσει τίποτα**.
 */
interface CountryEntry {
  /** ISO 3166-1 alpha-2, **πεζά** — το κλειδί του ευρετηρίου. */
  readonly code: string;
  /** Το i18n κλειδί της ετικέτας (namespace `common`). */
  readonly labelKey: string;
  /** Ό,τι γράφει άνθρωπος ή μηχανή και σημαίνει αυτή τη χώρα. */
  readonly aliases: readonly string[];
}

const COUNTRY_TABLE: readonly CountryEntry[] = [
  { code: 'gr', labelKey: 'common:countries.greece', aliases: ['greece', 'ελλάδα', 'ελλας', 'hellas'] },
  { code: 'cy', labelKey: 'common:countries.cyprus', aliases: ['cyprus', 'κύπρος'] },
  { code: 'de', labelKey: 'common:countries.germany', aliases: ['germany', 'γερμανία'] },
  { code: 'fr', labelKey: 'common:countries.france', aliases: ['france', 'γαλλία'] },
  { code: 'it', labelKey: 'common:countries.italy', aliases: ['italy', 'ιταλία'] },
  { code: 'es', labelKey: 'common:countries.spain', aliases: ['spain', 'ισπανία'] },
  { code: 'gb', labelKey: 'common:countries.uk', aliases: ['uk', 'united kingdom', 'ηνωμένο βασίλειο'] },
  { code: 'us', labelKey: 'common:countries.usa', aliases: ['us', 'usa', 'united states', 'ηπα'] },
  { code: 'au', labelKey: 'common:countries.australia', aliases: ['australia', 'αυστραλία'] },
  { code: 'ca', labelKey: 'common:countries.canada', aliases: ['canada', 'καναδάς'] },
  { code: 'bg', labelKey: 'common:countries.bulgaria', aliases: ['bulgaria', 'βουλγαρία'] },
  { code: 'al', labelKey: 'common:countries.albania', aliases: ['albania', 'αλβανία'] },
  { code: 'mk', labelKey: 'common:countries.northMacedonia', aliases: ['north macedonia', 'βόρεια μακεδονία'] },
  { code: 'ro', labelKey: 'common:countries.romania', aliases: ['romania', 'ρουμανία'] },
  { code: 'tr', labelKey: 'common:countries.turkey', aliases: ['turkey', 'τουρκία'] },
  { code: 'rs', labelKey: 'common:countries.serbia', aliases: ['serbia', 'σερβία'] },
];

/**
 * Accent- και case-insensitive ευρετήριο: **κάθε** γραφή → ISO code.
 *
 * Ο ίδιος ο κωδικός είναι alias του εαυτού του, ώστε μια ήδη κανονική τιμή (`'GR'`) να
 * περνά χωρίς ειδική περίπτωση — μία διαδρομή, όχι δύο.
 */
const COUNTRY_CODE_INDEX: ReadonlyMap<string, string> = new Map(
  COUNTRY_TABLE.flatMap((entry) =>
    [entry.code, ...entry.aliases].map((name) => [normalizeGreekText(name), entry.code] as const),
  ),
);

/** ISO code (πεζά) → το i18n κλειδί της ετικέτας του. */
const COUNTRY_LABEL_KEYS: ReadonlyMap<string, string> = new Map(
  COUNTRY_TABLE.map((entry) => [entry.code, entry.labelKey]),
);

/** ISO alpha-2 (**πεζά**) για το δοσμένο όνομα/κωδικό χώρας, ή `null` αν είναι άγνωστο. */
export function countryNameToCode(country: string | undefined | null): string | null {
  if (!country) return null;
  return COUNTRY_CODE_INDEX.get(normalizeGreekText(country.trim())) ?? null;
}

/**
 * **Η μορφή που γράφεται σε αποθηκευμένη διεύθυνση**: ISO 3166-1 alpha-2, **κεφαλαία**.
 *
 * 🔑 Τρεις εκβάσεις, και καμία δεν είναι μαντεψιά:
 * - **κενό** ⇒ `undefined`. «Δεν είπε χώρα» ≠ «είπε Ελλάδα». Ο καλών αποφασίζει αν θα βάλει
 *   την προεπιλογή — δες {@link DEFAULT_STORED_COUNTRY_CODE}.
 * - **γνωστή** ⇒ ο κωδικός. «Ελλάδα», «Greece», «GR», «ελλας» καταλήγουν όλα σε `'GR'`.
 * - **άγνωστη** ⇒ **το κείμενο αυτούσιο** (trimmed). Μια χώρα εκτός πίνακα είναι δεδομένο
 *   του ανθρώπου· το να το πετάξουμε θα ήταν **απώλεια**, και το να επινοήσουμε κωδικό
 *   θα ήταν **ψέμα**. Ίδιος κανόνας με το `comparable()` του `diffAddressFields`, που ήδη
 *   πέφτει σε σύγκριση κειμένου για άγνωστο όνομα.
 *
 * ⚠️ **ΚΕΦΑΛΑΙΑ, και δεν είναι αισθητική**: `'GR'` είναι η μορφή που **ήδη υπάρχει** στα
 * δεδομένα των επαφών (`address-info-builder`), άρα η αλλαγή δεν γεννά τρίτη διάλεκτο.
 * Η ανάγνωση παραμένει ανεκτική σε **κάθε** παλιά γραφή, οπότε καμία μετάπτωση δεν
 * απαιτείται για ορθότητα.
 */
export function toStoredCountryCode(country: string | undefined | null): string | undefined {
  const trimmed = country?.trim();
  if (!trimmed) return undefined;
  const code = countryNameToCode(trimmed);
  return code ? code.toUpperCase() : trimmed;
}

/**
 * Η προεπιλεγμένη αποθηκευμένη χώρα, όταν ο άνθρωπος **δεν δήλωσε** καμία.
 *
 * 🔑 **Δηλωμένη ρύθμιση, όχι επινόηση**: η ίδια απόφαση που κάνει το {@link isGreekAddressCountry}
 * να μετρά την κενή χώρα ως ελληνική. Ήταν γραμμένη **δύο φορές με διαφορετικό αποτέλεσμα** —
 * το `hqEntryFromFlatFields` **παρέλειπε** το πεδίο, το `address-info-builder` έγραφε `'GR'`
 * (εύρημα **Ζ4δ**: η αυθεντική εγγραφή και το παράγωγό της διαφωνούσαν μέσα στο ίδιο έγγραφο).
 */
export const DEFAULT_STORED_COUNTRY_CODE = GREECE_COUNTRY_CODE.toUpperCase();

/**
 * Το i18n κλειδί για την **εμφάνιση** μιας αποθηκευμένης χώρας, ή `null` για άγνωστη.
 *
 * `null` σημαίνει «δεν έχω μετάφραση γι' αυτό» — ο καλών δείχνει **την ίδια την τιμή**, που
 * για άγνωστη χώρα είναι το κείμενο που έγραψε ο άνθρωπος. Ποτέ ωμό `'GR'` στην οθόνη.
 */
export function countryLabelKey(country: string | undefined | null): string | null {
  const code = countryNameToCode(country);
  return code ? (COUNTRY_LABEL_KEYS.get(code) ?? null) : null;
}

/**
 * Οι χώρες ως επιλογές **επιλογέα** — αποθηκευμένη τιμή + κλειδί ετικέτας.
 *
 * 🏆 **Επιλογέας, ποτέ ελεύθερο κείμενο** — η πρακτική κάθε σοβαρής φόρμας διεύθυνσης
 * (Google · Stripe · Amazon). Ένα ελεύθερο `<Input>` πάνω σε **κωδικό** είναι αντίφαση:
 * ή δείχνει `'GR'` στον άνθρωπο, ή αποθηκεύει «Ελλάδα» — και το δεύτερο **ήταν** το Ζ4α.
 */
export const ADDRESS_COUNTRY_OPTIONS: readonly { readonly value: string; readonly labelKey: string }[] =
  COUNTRY_TABLE.map((entry) => ({ value: entry.code.toUpperCase(), labelKey: entry.labelKey }));

/**
 * Είναι ελληνική η διεύθυνση με αυτή τη χώρα;
 *
 * **Η κενή χώρα μετράει ως ελληνική**: η φόρμα ξεκινά με κενό πεδίο και ο χρήστης
 * σπάνια το συμπληρώνει για εγχώρια διεύθυνση. Αν το κενό μετρούσε ως «ξένη», η
 * ελληνική ιεραρχία και η μάσκα Τ.Κ. θα έσβηναν στην πιο συνηθισμένη περίπτωση.
 */
export function isGreekAddressCountry(country: string | undefined | null): boolean {
  const trimmed = country?.trim();
  if (!trimmed) return true;
  return countryNameToCode(trimmed) === GREECE_COUNTRY_CODE;
}
