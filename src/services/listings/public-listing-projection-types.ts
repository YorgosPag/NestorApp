/**
 * @fileoverview **ΟΙ ΕΙΣΟΔΟΙ ΤΗΣ ΠΡΟΒΟΛΗΣ** — το συμβόλαιο, χωριστά από τη μηχανή.
 * @related ADR-841 §7 Α12.10 · ADR-777 §7 · ./public-listing-projection.ts
 * @module services/listings/public-listing-projection-types
 *
 * 🔑 **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (N.7.1, 2026-09-01).** Το `public-listing-projection.ts`
 * ήταν στις **499** γραμμές — **μία** κάτω από το όριο των 500. Δηλαδή **οποιαδήποτε**
 * προσθήκη, όσο μικρή, θα το έσπαγε: το αρχείο δεν ήταν «σχεδόν γεμάτο», ήταν
 * **δομικά ανίκανο να δεχτεί πεδίο**.
 *
 * ⚠️ Η θεραπεία είναι **ΕΞΑΓΩΓΗ, ποτέ ψαλίδισμα σχολίων**: το «γιατί» κάθε πεδίου είναι
 * ο λόγος που το πεδίο υπάρχει. Εδώ ζει το **συμβόλαιο** (τι δέχεται η προβολή) και
 * εκεί η **μηχανή** (τι κάνει) — διαχωρισμός ευθύνης που θα ήταν σωστός ούτως ή άλλως.
 *
 * ⚠️ **Τα ονόματα επανεξάγονται** από το `public-listing-projection.ts` ⇒ κανένας από
 * τους υπάρχοντες καταναλωτές δεν άλλαξε γραμμή.
 */

import type { CommercialStatus } from '@/constants/commercial-statuses';
import type { LegalityClaim } from '@/lib/legality/legality-claim';
import type { PlaceRef } from '@/types/geo/public-place';
import type {
  ListingAuthorship,
  ListingPosition,
  PublicAgencyIdentity,
} from '@/types/public-listing';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

import type { LegalityBearingProperty } from './legality-projection';

// ============================================================================
// ΕΙΣΟΔΟΙ — δομικές, ΟΧΙ δεμένες σε ονομασμένο τύπο
// ============================================================================

/**
 * Το ακίνητο όπως το βλέπει η προβολή.
 *
 * Δομικός τύπος, **ίδιο ιδίωμα με το `PricedPropertyLike`** — και ο λόγος είναι ο ίδιος:
 * ο κώδικας κουβαλά **δύο** σχήματα `Property` (`@/types/property`,
 * `@/types/property-viewer`) συν τα ωμά δεδομένα Firestore του διακομιστή. Ένας
 * ονομασμένος τύπος εδώ θα ανάγκαζε cast σε **κάθε** καλούντα — δηλαδή θα μετέτρεπε
 * μια πραγματική ασυμφωνία σχημάτων σε `as`, που είναι το αντίθετο του ελέγχου.
 */
export interface ProjectableProperty {
  readonly id: string;
  readonly name?: string | null;
  readonly type?: string | null;
  readonly commercialStatus?: CommercialStatus | string | null;
  readonly status?: string | null;
  readonly offerKinds?: readonly string[] | null;
  readonly commercial?: {
    readonly askingPrice?: number | null;
    readonly finalPrice?: number | null;
    readonly rentPrice?: number | null;
    /** Τιμή **ανά διανυκτέρευση** (ADR-835). Παράγεται από `deriveCommercialAmounts`. */
    readonly nightlyRate?: number | null;
  } | null;
  /**
   * **Οι όροι διαμονής** (ADR-835 §4.5). Παράγονται από `deriveStayTerms`.
   *
   * ⚠️ **`null`/απόν = δεν υπάρχει ζωντανή βραχυχρόνια διάθεση.** Η διάκριση από ένα
   * αντικείμενο με μηδενικά είναι ολόκληρος κάδος της αναζήτησης — δες
   * `deriveStayTerms`.
   */
  readonly stay?: {
    readonly minNights?: number | null;
    readonly maxGuests?: number | null;
  } | null;
  readonly areas?: {
    readonly gross?: number | null;
    /** ADR-842 Φ3 — δες τη σημείωση των λεξιλογικών πεδίων παρακάτω. */
    readonly net?: number | null;
    readonly balcony?: number | null;
    readonly terrace?: number | null;
    readonly garden?: number | null;
  } | null;
  /** @deprecated επίπεδο πεδίο· διαβάζεται ως έσχατο εφεδρικό. */
  readonly area?: number | null;
  readonly floor?: number | null;
  readonly layout?: {
    readonly bedrooms?: number | null;
    /** ADR-842 Φ3 — `0` είναι **υπαρκτή τιμή** σε καθένα από αυτά. */
    readonly bathrooms?: number | null;
    readonly wc?: number | null;
    readonly totalRooms?: number | null;
    /**
     * Η **δήλωση** του κατόχου για τα επίπεδα — δες το αδελφό {@link ProjectableProperty.levels}
     * στη ρίζα, που είναι η **δομή**. Δύο πηγές, ένα ερώτημα (ADR-842 §8 #7).
     */
    readonly levels?: number | null;
    readonly balconies?: number | null;
  } | null;

  // ── Η ΔΟΜΗ ΤΩΝ ΕΠΙΠΕΔΩΝ (ADR-842 Φ5 · §8 #7) ──────────────────────────────
  /**
   * 🔴 **ΟΜΩΝΥΜΟ ΜΕ ΤΟ `layout.levels` ΚΑΙ ΔΙΑΦΟΡΕΤΙΚΟ ΠΡΑΓΜΑ — ΚΑΙ ΤΑ ΔΥΟ ΥΠΑΡΧΟΥΝ
   * ΖΩΝΤΑΝΑ ΣΤΟ ΙΔΙΟ ΕΓΓΡΑΦΟ.**
   *
   * `layout.levels` = ο **αριθμός** που δήλωσε άνθρωπος. Αυτό εδώ = οι **εγγραφές
   * ορόφων** στις οποίες απλώνεται η μονάδα, φτιαγμένες όταν ο άνθρωπος τη συνέδεσε με
   * τους ορόφους του κτηρίου. Μετρημένο 2026-09-02: το `prop_2d612992` έχει **δύο**
   * εγγραφές εδώ και **καμία** τιμή εκεί.
   *
   * ⚠️ **Δομικός τύπος, `unknown` μέλη**: η πηγή είναι ωμό έγγραφο Firestore και το
   * μόνο που ρωτάμε είναι **πόσες** είναι. Μια υπόσχεση για το σχήμα κάθε εγγραφής θα
   * ήταν *«υπόσχεση που η βάση δεν δίνει»* — ο λόγος που όλο αυτό το αρχείο δηλώνει
   * `unknown` αντί για τους ονομαστικούς τύπους.
   */
  readonly levels?: readonly unknown[] | null;
  /** Δηλωμένη πολυεπίπεδη φύση. Δες {@link ProjectableProperty.levels}. */
  readonly isMultiLevel?: boolean | null;

  // ── ΤΑ ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ (ADR-842 Φ3) ─────────────────────────────────────────
  /**
   * 🔴 **`unknown` ΚΑΙ ΟΧΙ `ConditionType` — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΤΕΜΠΕΛΙΑ.**
   *
   * Αυτός ο τύπος είναι **δομικός** και ο βασικός του παραγωγός διαβάζει **ωμό έγγραφο
   * Firestore** (`publish-public-listing.ts` · `rebuild-public-listings`). Ένα
   * `readonly condition?: ConditionType` εδώ θα ήταν **υπόσχεση που η βάση δεν δίνει
   * σε κανέναν**: ακριβώς η κλάση ψέματος που γέννησε το `public-listing-schema.ts`
   * (*«ο τύπος έλεγε την αλήθεια για τον ΓΡΑΦΕΑ και ψέματα για τη ΒΑΣΗ»*), και θα
   * μετέτρεπε μια πραγματική ασυμφωνία σε σιωπηλό `as`.
   *
   * ⇒ Η κρίση *«είναι αυτή η τιμή ονομάσιμη;»* γίνεται **μία φορά**, στο
   * `public-listing-attributes.ts`, έναντι της αυθεντίας της Φ1. Ο τύπος εδώ λέει
   * μόνο **τι σχήμα** έχει το έγγραφο, ποτέ τι **τιμές** κουβαλά.
   */
  readonly condition?: unknown;
  readonly renovationYear?: number | null;
  readonly energy?: { readonly class?: unknown } | null;
  readonly systemsOverride?: {
    readonly heatingType?: unknown;
    readonly heatingFuel?: unknown;
    readonly coolingType?: unknown;
    readonly waterHeating?: unknown;
  } | null;
  readonly finishes?: {
    readonly flooring?: unknown;
    readonly windowFrames?: unknown;
    readonly glazing?: unknown;
  } | null;
  readonly orientations?: unknown;
  readonly interiorFeatures?: unknown;
  readonly securityFeatures?: unknown;
  /** ⚠️ Το όνομα του `Property`· στη δημόσια αγγελία γίνεται `amenities`. */
  readonly propertyAmenities?: unknown;
  /**
   * 🔶 **Ο ΚΑΤΟΧΟΣ ΑΡΝΗΘΗΚΕ να δηλώσει θέση** (Α5 §3).
   *
   * ⚠️ **Κανένας γραφέας δεν υπάρχει σήμερα, και το δηλώνω αντί να το υπονοώ:** το
   * πεδίο θα το γράψει η **φόρμα του κατόχου**, όταν υλοποιηθεί το «*υποχρεωτικό
   * ΕΡΩΤΗΜΑ, όχι υποχρεωτική ΑΠΑΝΤΗΣΗ*». Μέχρι τότε **κάθε** αγγελία χωρίς θέση είναι
   * `never-asked` — που είναι και η **αλήθεια** για τα σημερινά ακίνητα: φτιάχτηκαν
   * πριν υπάρξει το ερώτημα, άρα η έλλειψη είναι **δικό μας** χρέος, όχι επιλογή τους.
   */
  readonly locationDisclosure?: 'declined' | null;

  /**
   * 🔴 **ΠΟΙΟΣ ΔΗΛΩΝΕΙ ΤΗΝ ΑΓΓΕΛΙΑ** (§8.33) — **προαιρετικό, με ΓΡΑΜΜΕΝΟ κανόνα για
   * την απουσία**, όχι σιωπηλή προεπιλογή.
   *
   * Απόν ⇒ **`'agency'`**, και ο λόγος είναι μετρημένος: ο **μόνος** παραγωγός που το
   * παραλείπει είναι η διαδρομή του `properties` (`publish-public-listing.ts` και
   * `rebuild-public-listings`), που διαβάζει **ωμό έγγραφο Firestore** με `as
   * ProjectableProperty`. Εκείνα τα ακίνητα ανήκουν **εξ ορισμού σε εταιρεία**: το
   * `assertPropertyCreatePolicy` απαιτεί `projectId` **ΠΑΝΤΑ**, και κάθε έργο ανήκει
   * σε εταιρεία. Δεν υπάρχει έγγραφο εκεί που να είναι δήλωση ιδιώτη.
   *
   * ⚠️ **Η προεπιλογή είναι προς την ΑΚΡΙΒΗ κατεύθυνση, όχι προς την εύκολη.** Ένα
   * `'owner-declared'` ως προεπιλογή θα έλεγε στον επισκέπτη ότι μια αγγελία εταιρείας
   * είναι δήλωση ιδιώτη — δηλαδή θα **αφαιρούσε** γνώση που έχουμε. Άγκυρα: `Υ3`.
   */
  readonly authorship?: ListingAuthorship | null;
  /**
   * **Οι αξιώσεις νομιμότητας** (Α17 · ADR-838). Δες {@link LegalityBearingProperty}
   * για το δηλωμένο κενό: **κανένας γραφέας δεν τις γράφει ακόμη**, και καμία αξίωση
   * **δεν παράγεται** από υπάρχοντα πεδία.
   */
  readonly legality?: readonly LegalityClaim[] | null;
  /**
   * **Τα αρχεία που ο άνθρωπος ΔΙΑΛΕΞΕ να δημοσιεύσει** (Α12) — μονοπάτια στον
   * **ιδιωτικό** κάδο, ποτέ bytes και ποτέ URL.
   *
   * 🔴 **ΔΗΛΩΜΕΝΟ ΚΕΝΟ, όπως το {@link legality}: κανένας γραφέας δεν το γεμίζει
   * ακόμη**, και αυτό είναι **απόφαση ασφαλείας**, όχι εκκρεμότητα. Μετρημένο ότι το
   * `OwnerPropertyMedia` (`types/owner-property.ts:162-171`) έχει **μόνο**
   * `storagePath` · `fileName` · `sizeBytes` · `uploadedAt` — **καμία σημαία
   * δημοσίευσης**. Αυτόματη δημοσίευση **όλων** όσων ανέβασε ο κάτοχος θα έβγαζε στον
   * κόσμο και την ταυτότητα που ανέβηκε κατά λάθος.
   *
   * ⇒ Η **επιλογή** *(«ποια από τα αρχεία μου δημοσιεύω;»)* είναι ανθρώπινη πράξη που
   * **δεν υπάρχει ακόμη** και ανήκει στη **Φ3**, μαζί με την οθόνη της. Μέχρι τότε το
   * σύνολο είναι **κενό**, και η συμφιλίωση του ραφιού **το αποδεικνύει σε κάθε
   * γραφή**: όσο κανείς δεν διάλεξε, το δημόσιο ράφι **μένει άδειο**.
   *
   * ⚠️ Το κλειστό σχήμα `PublicListing` **δεν** αγγίζεται από αυτό: εδώ είναι
   * **είσοδος** του γραφέα, όχι περιεχόμενο αγγελίας — ίδιο πρότυπο με το
   * `agencyName?` της Α1.7.
   */
  readonly publishedMedia?: readonly PublicShelfSource[] | null;
  /**
   * **Η ταυτότητα του γραφείου — ΕΝΑ όρισμα για ΔΥΟ πεδία** (ADR-841 §7 Α1): έτσι η
   * επωνυμία δεν μπορεί να ταξιδέψει με ξένη ταυτότητα. Δες {@link PublicAgencyIdentity}.
   */
  readonly agency?: PublicAgencyIdentity | null;
}

/**
 * Ό,τι ξέρουμε για τον **τόπο** του ακινήτου — λυμένο από τον καλούντα, που είναι ο
 * μόνος που ξέρει από πού να το διαβάσει (κτίριο → έργο → επίπεδο Α).
 *
 * 🔑 **Η θέση ΔΕΝ ανήκει στο ακίνητο** (Α1): το ακίνητο προσθέτει **όροφο**. Γι' αυτό
 * είναι ξεχωριστό όρισμα και όχι πεδίο του {@link ProjectableProperty} — ο τύπος λέει
 * την ιεραρχία, δεν την περιγράφει σε σχόλιο.
 */
export interface PlaceKnowledge {
  /** Υποψήφιες θέσεις, από **οποιαδήποτε** πηγή. Νικά η ισχυρότερη (§14.3). */
  readonly candidates: readonly ListingPositionCandidate[];
  /**
   * **Σε ποιον τόπο του επιπέδου Α δείχνει** — ο δεσμός του §14.5, ή `null`.
   *
   * ⚠️ **Ξεχωριστό ΕΡΩΤΗΜΑ από τη θέση, αλλά ΙΔΙΑ γνώση.** Η θέση απαντά *«πού είναι
   * πάνω στον χάρτη;»*· ο δεσμός απαντά *«ποιο **πράγμα** είναι;»*. Δύο αγγελίες στο
   * ίδιο σημείο μπορεί να είναι δύο διαμερίσματα του **ίδιου** κτιρίου — και η
   * ταυτότητα είναι που το λέει, όχι οι συντεταγμένες. Ζουν όμως μαζί επειδή τα
   * **λύνει ο ίδιος καλών με το ίδιο ανέβασμα** της αλυσίδας της Α1.
   *
   * 🔴 **ΥΠΟΧΡΕΩΤΙΚΟ, και εκεί είναι όλο το νόημα** (Β3, 2026-08-11). Μέχρι σήμερα ο
   * δεσμός ζούσε ως **προαιρετικό** πεδίο του {@link ProjectableProperty}: ο ιδιώτης
   * το γέμιζε, ο επαγγελματίας **δεν είχε πού** να το γεμίσει (το έγγραφο
   * `properties` δεν το κουβαλά), και το αποτέλεσμα ήταν `place: null` για **κάθε**
   * αγγελία εταιρείας — δηλαδή `place-unresolved` για την **πλειοψηφία του
   * αποθέματος**, με το πεδίο **παρόν** και όλες τις πύλες **πράσινες**.
   *
   * 🔑 **Μία πηγή, όχι δύο με προτεραιότητα.** Ο πειρασμός ήταν να μείνει το πεδίο
   * στο ακίνητο **και** να προστεθεί εδώ, με κανόνα «*το ειδικότερο νικά*». Δύο
   * είσοδοι για ένα πεδίο εξόδου είναι το σχήμα του **ADR-749** — και μάλιστα στο
   * πεδίο που **ΕΙΝΑΙ** η μηχανή ταιριάσματος. Η ερώτηση *«ποιος τόπος;»* έχει τώρα
   * **έναν** τόπο που την απαντά, και ο τύπος **δεν μεταγλωττίζεται** αν ο καλών δεν
   * απαντήσει — ούτε καν με `undefined`.
   */
  readonly ref: PlaceRef | null;
}

/** Μία υποψήφια θέση, με την προέλευσή της. */
export type ListingPositionCandidate = Extract<ListingPosition, { kind: 'known' }>;
