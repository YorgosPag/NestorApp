/**
 * @fileoverview **ΠΟΤΕ ΘΕΩΡΕΙΤΑΙ ΔΗΛΩΜΕΝΟ** — η κρίση πάνω στα δεδομένα μιας αγγελίας.
 * @related ADR-842 §7 (Φ3) · ADR-777 §7 (Α5 κανόνας 27 · Α7) · ./listing-disclosure
 * @module lib/listings/listing-attribute-declared
 *
 * 🔑 **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (N.7.1) — ΚΑΙ ΕΙΝΑΙ SPLIT, ΟΧΙ TRIM.** Το
 * `listing-disclosure.ts` απαντά *«με ποιον τρόπο γίνεται ορατό κάθε πεδίο;»* — μια
 * **δήλωση**, σταθερή, ανεξάρτητη από οποιαδήποτε αγγελία. Εδώ απαντάται *«έχει τιμή
 * αυτό το πεδίο σε **αυτή** την αγγελία;»* — **κρίση πάνω σε δεδομένα**. Δύο ερωτήματα
 * που έτυχε να ζουν μαζί όσο το δεύτερο είχε τέσσερα σκέλη· η Φ3 τα έκανε **είκοσι
 * δύο**, και ο διαχωρισμός θα ήταν σωστός ούτως ή άλλως.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ `switch` — Η ΕΓΓΥΗΣΗ ΕΙΝΑΙ Η ΙΔΙΑ, ΤΟ ΚΟΣΤΟΣ ΟΧΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι τη Φ3 η κρίση ήταν εξαντλητικό `switch` με `assertNever` στο `default` — και
 * η εγγύηση που έδινε ήταν η σωστή: *«νέα ιδιότητα δεν μεταγλωττίζεται μέχρι κάποιος
 * να απαντήσει πότε θεωρείται δηλωμένη»*. Με 22 σκέλη όμως η συνάρτηση περνούσε το
 * όριο των **40 γραμμών** (N.7.1), και το προφανές ξεμπλοκάρισμα — σπάσιμο σε δύο
 * `switch` ανά ομάδα — θα **κατέστρεφε** την εγγύηση: δύο μερικά `switch` που το ένα
 * καλεί το άλλο δεν είναι εξαντλητικά, είναι **δύο ελλιπείς λίστες που συμφωνούν
 * μεταξύ τους** (το σχήμα που το `listing-disclosure.ts` έχει ήδη πληρώσει).
 *
 * 🔑 Το `Record<ListingAttributeKey, …>` δίνει **ακριβώς την ίδια** εγγύηση —
 * κλειδί που λείπει είναι **σφάλμα μεταγλώττισης** — χωρίς να είναι συνάρτηση. Είναι
 * το ίδιο ιδίωμα που το `.i18n-shell-slice.json` δέχεται ρητά ως απόδειξη ασφάλειας
 * για δυναμικά κλειδιά: *«επειδή ο τύπος είναι πλήρες Record πάνω σε union, νέο μέλος
 * ΣΠΑΕΙ ΤΗ ΜΕΤΑΓΛΩΤΤΙΣΗ αν δεν πάρει γραμμή»*.
 *
 * ⚠️ **Η τιμή του πίνακα ΔΕΝ ξαναγράφει το κλειδί της.** Ένα `areaSqm:
 * declaredWhenNotNull('areaSqm')` θα ήταν αυτο-αναφορικό διπλότυπο, ελεύθερο να
 * αποκλίνει σιωπηλά (`areaSqm: declaredWhenNotNull('floor')` μεταγλωττίζεται μια χαρά
 * και λέει ψέματα). Γι' αυτό η συνηθισμένη περίπτωση είναι **σταθερά-απάντηση**
 * (`'value-present'`) και όχι κλείσιμο πάνω στο όνομα.
 */

import { normalizePropertyType } from '@/constants/property-type-aliases';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import type { PublicListing } from '@/types/public-listing';

import {
  LISTING_ATTRIBUTE_KEYS,
  LISTING_FEATURE_SET_KEYS,
  type ListingAttributeKey,
  type ListingFeatureSetKey,
} from './listing-disclosure';

// ============================================================================
// 1. ΟΙ ΙΔΙΟΤΗΤΕΣ — «πότε θεωρείται δηλωμένο;»
// ============================================================================

/**
 * Η απάντηση για μία ιδιότητα.
 *
 * 🔴 **`'value-present'` ΣΗΜΑΙΝΕΙ «ΔΕΝ ΕΙΝΑΙ `null`», ΚΑΙ ΤΙΠΟΤΑ ΑΛΛΟ.** Το `0` είναι
 * **ΤΙΜΗ**, σε τουλάχιστον πέντε πεδία αυτού του σχήματος: `floor: 0` = ισόγειο,
 * `bedrooms: 0` = γκαρσονιέρα, `wc: 0` = χωρίς ξεχωριστό WC, `balconies: 0` = χωρίς
 * μπαλκόνι, `bathrooms: 0` = πραγματικό μηδέν. Ένας έλεγχος αληθοφάνειας
 * (`if (listing.x)`) θα τα έκρυβε **όλα** ως «δεν δηλώθηκε» — δηλαδή θα χρέωνε στον
 * κάτοχο παράλειψη για κάτι που **δήλωσε ρητά**.
 */
type AttributeDeclaredRule = 'value-present' | ((listing: PublicListing) => boolean);

/**
 * **Κάθε ιδιότητα, και πότε θεωρείται δηλωμένη.** Εξαντλητικό `Record` — δες την
 * κεφαλίδα για το γιατί δεν είναι `switch`.
 */
const ATTRIBUTE_DECLARED: Record<ListingAttributeKey, AttributeDeclaredRule> = {
  /**
   * 🔴 **«Δηλωμένο» σημαίνει ΟΝΟΜΑΣΙΜΟ, όχι «μη κενό» — και είναι η ΜΟΝΗ ιδιότητα με
   * δική της κρίση.** Ο τύπος `PropertyType` περιλαμβάνει **παλαιές ελληνικές** τιμές
   * του Firestore και **@deprecated** παραλλαγές· ένα `type` που ο
   * `normalizePropertyType` δεν αναγνωρίζει **δεν έχει ετικέτα** να ζωγραφιστεί. Αν
   * το μετρούσαμε ως δηλωμένο, η λογιστική θα έλεγε «4 από 4» ενώ η οθόνη θα έδειχνε
   * **τρεις** γραμμές — το ίδιο ψέμα με τη λίστα που λέει 11 και τον χάρτη που
   * δείχνει 10 (κανόνας 27).
   */
  type: (listing) => normalizePropertyType(listing.type) !== null,

  areaSqm: 'value-present',
  floor: 'value-present',
  bedrooms: 'value-present',

  // ── ADR-842 Φ3 ────────────────────────────────────────────────────────────
  energyClass: 'value-present',
  condition: 'value-present',
  renovationYear: 'value-present',
  bathrooms: 'value-present',
  wc: 'value-present',
  totalRooms: 'value-present',

  /**
   * 🔴 **ΔΕΥΤΕΡΗ ΙΔΙΟΤΗΤΑ ΜΕ ΔΙΚΗ ΤΗΣ ΚΡΙΣΗ — ΚΑΙ ΤΟ ΕΡΩΤΗΜΑ ΕΙΝΑΙ ΤΟΥ Α7.**
   *
   * Το `levels` είναι το μόνο πεδίο που κουβαλά **προέλευση** (ADR-842 Φ5 · §8 #7).
   * Άρα το *«έχει τιμή;»* δεν αρκεί: ένα χαρακτηριστικό που **συμπέρανε μοντέλο** και
   * **δεν το ενέκρινε άνθρωπος** έχει τιμή και **δεν επιτρέπεται να φτάσει στον
   * αγοραστή** (Α7).
   *
   * 🔑 **Ο κανόνας ΔΕΝ ξαναγράφεται εδώ — ρωτιέται.** Το `isPubliclyPresentable` είναι
   * η **μία** θέση όπου ζει το Α7 (*«και ΜΟΝΟ εδώ»*)· αυτή η γραμμή είναι
   * **καταναλωτής** του, όχι δεύτερη υλοποίηση. Ένα `provenance !== 'inferred'` εδώ θα
   * ήταν το δεύτερο αντίγραφο — και θα σταματούσε να ρωτά αύριο.
   *
   * ⚠️ **Ζώνη ΚΑΙ τιράντες (N.7.2 #4)**: ο γραφέας δεν παράγει σήμερα `inferred`. Αυτό
   * είναι κατάσταση του **σημερινού** γραφέα, όχι εγγύηση του σχήματος — και η οθόνη
   * του αγοραστή είναι το λάθος σημείο για να το ανακαλύψουμε.
   */
  levels: (listing) => listing.levels !== null && isPubliclyPresentable(listing.levels),

  balconies: 'value-present',
  netAreaSqm: 'value-present',
  balconyAreaSqm: 'value-present',
  terraceAreaSqm: 'value-present',
  gardenAreaSqm: 'value-present',
  heatingType: 'value-present',
  heatingFuel: 'value-present',
  coolingType: 'value-present',
  waterHeating: 'value-present',
  windowFrames: 'value-present',
  glazing: 'value-present',
};

/** Έχει **δηλωθεί** αυτή η ιδιότητα για τη συγκεκριμένη αγγελία; */
export function isAttributeDeclared(
  listing: PublicListing,
  key: ListingAttributeKey
): boolean {
  const rule = ATTRIBUTE_DECLARED[key];
  return rule === 'value-present' ? listing[key] !== null : rule(listing);
}

// ============================================================================
// 2. ΤΑ ΣΥΝΟΛΑ — τρεις καταστάσεις, όχι δύο (ADR-842 Φ3)
// ============================================================================

/**
 * 🏆 **Η ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΚΑΝΕΝΑ PORTAL ΔΕΝ ΕΧΕΙ.**
 *
 * | Κατάσταση | Δεδομένο | Ποιος τη δημιούργησε | Τι λέει η οθόνη |
 * |---|---|---|---|
 * | `never-asked` | `null` | **εμείς** — δικό μας χρέος | «δεν έχει δηλωθεί» |
 * | `declared-none` | `[]` | **ο κάτοχος** — απάντησε «καμία» | «καμία» — **γεγονός** |
 * | `declared` | `[…]` | ο κάτοχος | οι ίδιες οι τιμές |
 *
 * 🔴 Σε Zillow · idealista · Spitogatos οι δύο πρώτες καταλήγουν στην **ίδια σιωπή**:
 * ένα ακίνητο που **δήλωσε** ότι δεν έχει καμία παροχή φαίνεται ίδιο με ένα που
 * **δεν ρωτήθηκε ποτέ**. Είναι το ίδιο σχήμα με το `never-asked` / `owner-declined`
 * της θέσης (Α5 §3) και με το *«0 = κανείς δεν κοίταξε»* των πυλών μας — μεταφερμένο
 * στην οθόνη του αγοραστή, όπου έχει και **εμπορική** συνέπεια: «καμία παροχή» είναι
 * πληροφορία τιμής, «άγνωστο» δεν είναι.
 *
 * ⚠️ **`declared-none` ΜΕΤΡΑΕΙ ΩΣ ΔΗΛΩΜΕΝΟ στη λογιστική**, και είναι ολόκληρο το
 * νόημα: ο κάτοχος **απάντησε**. Μια λογιστική που το χρέωνε ως κενό θα ζητούσε από
 * τον άνθρωπο να ξαναπεί κάτι που είπε.
 */
export type ListingFeatureSetState = 'never-asked' | 'declared-none' | 'declared';

/**
 * Οι τιμές ενός συνόλου — ή `null` όταν **κανείς δεν ρώτησε**.
 *
 * ⚠️ Η ανάγνωση είναι `listing[key]` και είναι **ολική εξ ορισμού**: κάθε κλειδί με
 * ρόλο `'feature-set'` έχει τύπο `readonly T[] | null`. Δεν υπάρχει εδώ πίνακας
 * κρίσης, γιατί δεν υπάρχει κρίση — και ένας τελετουργικός πίνακας θα ήταν φρουρός
 * χωρίς απόδειξη ζωής (ADR-749 §5).
 */
export function listingFeatureSetValues(
  listing: PublicListing,
  key: ListingFeatureSetKey
): readonly string[] | null {
  return listing[key];
}

/** Σε ποια από τις **τρεις** καταστάσεις είναι αυτό το σύνολο; */
export function featureSetState(
  listing: PublicListing,
  key: ListingFeatureSetKey
): ListingFeatureSetState {
  const values = listingFeatureSetValues(listing, key);
  if (values === null) return 'never-asked';
  return values.length === 0 ? 'declared-none' : 'declared';
}

// ============================================================================
// 3. ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ (κανόνας 27, στο επίπεδο ΠΕΔΙΟΥ)
// ============================================================================

/**
 * **«3 από 4 στοιχεία δηλωμένα»** — *πάντα*, ακόμη και όταν είναι 4 από 4.
 *
 * 🔑 Είναι η `ListingLedger` της οθόνης 2, μια βαθμίδα πιο κάτω: εκείνη μετρά
 * **αγγελίες**, αυτή μετρά **πεδία μιας αγγελίας**. Ίδιος κανόνας, ίδιος λόγος — ένας
 * αναγνώστης που βλέπει τρεις γραμμές δεν ξέρει αν έλειπε μία ή δέκα.
 *
 * ⚠️ **Τα δύο μέρη είναι ξεχωριστά πεδία, ΟΧΙ ένα με αφαίρεση**: ένας καταναλωτής που
 * υπολογίζει `total - declared` θα έχει δίκιο μέχρι την πρώτη τρίτη κατηγορία, και
 * μετά θα κλείνει **λάθος, σιωπηλά**.
 *
 * 🔴 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΜΕΓΑΛΩΣΕ ΑΠΟ 4 ΣΕ 27 ΣΤΗ Φ3, ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ**: η λογιστική
 * μετρά **ό,τι η οθόνη υπόσχεται να δείξει**. Αν τα σύνολα έμεναν έξω, το «6 από 22»
 * θα ήταν αληθές για τις ιδιότητες και **ψευδές για τη σελίδα** — ακριβώς η κλάση
 * σφάλματος που η ίδια η λογιστική υπάρχει για να αποκλείσει.
 */
export interface ListingAttributeLedger {
  readonly total: number;
  readonly declared: number;
  readonly undeclared: number;
}

/** Η λογιστική **όλων** των στοιχείων μιας αγγελίας. **Καθαρή συνάρτηση.** */
export function listingAttributeLedger(listing: PublicListing): ListingAttributeLedger {
  return ledgerOver(listing, LISTING_ATTRIBUTE_KEYS, LISTING_FEATURE_SET_KEYS);
}

/**
 * Η **ίδια** λογιστική πάνω σε **υποσύνολο** κλειδιών — αυτό που χρειάζεται κάθε ομάδα
 * της οθόνης (ADR-842 Φ3).
 *
 * 🔑 **Μία μηχανή, δύο εμβέλειες.** Ένας δεύτερος μετρητής «ανά ομάδα» θα ήταν
 * δεύτερη αλήθεια για το ίδιο ερώτημα (ADR-749) — και θα αποκλίνει την ημέρα που
 * αλλάξει ο ορισμός του «δηλωμένο» για τα σύνολα.
 */
export function ledgerOver(
  listing: PublicListing,
  attributeKeys: readonly ListingAttributeKey[],
  featureSetKeys: readonly ListingFeatureSetKey[]
): ListingAttributeLedger {
  const declaredAttributes = attributeKeys.filter((key) =>
    isAttributeDeclared(listing, key)
  ).length;
  const declaredSets = featureSetKeys.filter(
    (key) => featureSetState(listing, key) !== 'never-asked'
  ).length;

  const total = attributeKeys.length + featureSetKeys.length;
  const declared = declaredAttributes + declaredSets;

  return { total, declared, undeclared: total - declared };
}

/**
 * Κλείνει το άθροισμα;
 *
 * 🔴 **Υπάρχει για να αποτύχει θορυβωδώς**, όπως το `ledgerBalances` του
 * `types/public-listing.ts`. Ίδιο εργαλείο, ίδιο επιχείρημα: μια λογιστική που δεν
 * μπορεί να πέσει έξω δεν είναι λογιστική, είναι διακόσμηση.
 */
export function attributeLedgerBalances(ledger: ListingAttributeLedger): boolean {
  return ledger.declared + ledger.undeclared === ledger.total;
}
