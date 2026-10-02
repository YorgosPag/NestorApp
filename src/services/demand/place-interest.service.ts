/**
 * @fileoverview **ΠΟΙΟΣ ΕΙΝΑΙ «Ο ΙΔΙΟΚΤΗΤΗΣ»** — δύο μονοπάτια, μία απάντηση.
 * @related ADR-777 §7 (Α1 · Α12 · Α14) · §8.16 · SPEC-777B §12.6 · SPEC-777A §14.2
 * @module services/demand/place-interest.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΥΠΑΡΧΟΥΝ **ΔΥΟ** ΙΔΙΟΚΤΗΤΕΣ, ΚΑΙ ΤΟ ΔΟΛΩΜΑ ΟΦΕΙΛΕΙ ΝΑ ΦΤΑΝΕΙ ΚΑΙ ΣΤΟΥΣ ΔΥΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Πηγή | Απομόνωση | Ποιος είναι ο «κάτοχος» |
 * |---|---|---|
 * | `owner_properties` | `mode: 'userId'`, `authorUserId` | ο **άνθρωπος** (Α14 · §8.16 · §8.33) |
 * | `properties` | `mode: 'companyId'`, `companyId` | το **γραφείο** |
 *
 * ⚠️ **Δεν είναι λεπτομέρεια υλοποίησης — είναι το μισό κοινό.** Ο κ. Παπαδόπουλος με
 * το κλειστό κατάστημα ζει στην **πρώτη** γραμμή· ο μεσίτης με το χαρτοφυλάκιο στη
 * **δεύτερη**. Μια διαδρομή που ξέρει μόνο τη μία στέλνει το δόλωμα στους μισούς και
 * **φαίνεται να δουλεύει**.
 *
 * 🔑 **Ένας αναλυτής, δύο ονομασμένες περιπτώσεις, ΠΟΤΕ δύο διαδρομές.** Δύο διαδρομές
 * θα σήμαιναν δύο απαντήσεις στο ερώτημα *«τι επιτρέπεται να μάθει ο κάτοχος;»* — και
 * η δεύτερη θα ξεχνούσε το κατώφλι την ημέρα που θα άλλαζε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 «ΔΕΝ ΥΠΑΡΧΕΙ» ΚΑΙ «ΔΕΝ ΕΙΝΑΙ ΔΙΚΟ ΣΟΥ» ΑΠΑΝΤΩΝΤΑΙ **ΤΟ ΙΔΙΟ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ίδιο συμβόλαιο με το `/api/demand/competition`: μια ξεχωριστή άρνηση θα
 * **επιβεβαίωνε** ότι η ταυτότητα υπάρχει, δηλαδή θα διέρρεε το επίπεδο Β μέσω του
 * κωδικού λάθους. Εδώ είναι **βαρύτερο**: η ταυτότητα ακινήτου είναι μαντεύσιμη, και
 * μια διαρροή «υπάρχει/δεν υπάρχει» θα ήταν απογραφή ξένου χαρτοφυλακίου.
 *
 * **Layering**: service — Admin SDK + οι υπάρχουσες μηχανές προβολής. **Καμία κρίση**:
 * η ετυμηγορία ζει στο `lib/demand/demand-interest.ts`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { companyPropertyHolder } from '@/lib/places/place-detail-route';
import { projectListingShape } from '@/services/listings/public-listing-projection';
import {
  companyPropertyProjectionOf,
  lookupOwnedProjection,
  ownerPropertyProjectionOf,
  type CompanyProjectableProperty,
  type OwnedProjectionInput,
} from '@/services/listings/owned-listing-projection';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import type { OwnerProperty } from '@/types/owner-property';
import type { ListingMatchFacts } from '@/lib/demand/demand-match-vocabulary';
import type { PlaceSource } from '@/constants/place-sources';

// =============================================================================
// 1. ΤΟ ΑΠΟΤΕΛΕΣΜΑ — ονομασμένο, κλειστό
// =============================================================================

// Η ρίζα του λεξιλογίου ζει σε φύλλο (ADR-884 Κ1)· επανεξάγεται ώστε οι καταναλωτές να μην αλλάξουν.
export { PLACE_SOURCES, type PlaceSource } from '@/constants/place-sources';

/**
 * **Το ακίνητο του αιτούντος, προβεβλημένο** — ή τίποτα.
 *
 * ⚠️ `absent` σημαίνει *«δεν υπάρχει **ή** δεν είναι δικό σου»*, **σκόπιμα ενωμένα**.
 */
export type PlaceLookup =
  | { readonly kind: 'found'; readonly source: PlaceSource; readonly facts: ListingMatchFacts }
  | { readonly kind: 'absent' };

const ABSENT: PlaceLookup = { kind: 'absent' };

// =============================================================================
// 2. Ο ΕΝΤΟΠΙΣΜΟΣ
// =============================================================================

/**
 * **Βρες το ακίνητο που ο αιτών έχει δικαίωμα να ρωτήσει, και πρόβαλέ το.**
 *
 * 🔑 **Η σειρά είναι «ο άνθρωπος πρώτα», και είναι απόφαση.** Οι δύο συλλογές έχουν
 * **ξένα** προθέματα ταυτότητας (`ownp_*` ⇄ `prop_*`), άρα σύγκρουση είναι πρακτικά
 * αδύνατη· αν όμως ποτέ συμβεί, νικά η **προσωπική** κατοχή — γιατί το να δείξεις σε
 * υπάλληλο εταιρείας δεδομένα που ανήκουν σε **ιδιώτη** είναι η χειρότερη από τις δύο
 * αστοχίες.
 *
 * 🔴 **ADR-817 — ΤΟ `companyId` ΕΓΙΝΕ `string | null`, ΚΑΙ Ο ΕΣΩΤΕΡΙΚΟΣ ΤΟ ΔΕΧΟΤΑΝ ΗΔΗ.**
 * Ο ιδιώτης δεν έχει εταιρεία. Ο αναγνώστης ιδιώτη (`owned-listing-projection`) δηλώνει **ήδη**
 * `companyId: string | null` (το απαιτεί το `ListingActor` του `listing-custody`) —
 * η **μόνη** υπογραφή που το στένευε ήταν αυτή εδώ, και ήταν σωστή όσο ο πολίτης
 * έπαιρνε `401` στο σύνορο και δεν έφτανε ποτέ.
 *
 * ⚠️ **ΧΩΡΙΣ ΕΤΑΙΡΕΙΑ, Η ΔΕΥΤΕΡΗ ΑΝΑΓΝΩΣΗ ΔΕΝ ΓΙΝΕΤΑΙ ΚΑΘΟΛΟΥ** — και δεν είναι
 * βελτιστοποίηση: ο αναγνώστης γραφείου φιλτράρει **κατά μισθωτή**, οπότε μια κλήση
 * με κενό/απόν `companyId` είναι ακριβώς το ερώτημα «δώσε μου ό,τι δεν ανήκει σε
 * κανέναν» που κυνηγά το **CHECK 3.35**. Ο ιδιώτης **δεν έχει** εταιρικά ακίνητα:
 * `absent` είναι η **σωστή** απάντηση, όχι υποβαθμισμένη.
 *
 * @param uid — ο συνδεδεμένος άνθρωπος (κατοχή ιδιώτη)
 * @param companyId — η **ενεργή** εταιρεία του, ή `null` για τον ιδιώτη (κατοχή γραφείου)
 */
export async function lookupOwnedPlace(
  db: AdminFirestore,
  propertyId: string,
  uid: string,
  companyId: string | null,
): Promise<PlaceLookup> {
  // Ο εντοπισμός με θεματοφυλακή ζει πλέον στο `owned-listing-projection` (ADR-898 Φ3β-3) — ίδια σειρά, ίδια άρνηση.
  const owned = await lookupOwnedProjection(db, propertyId, uid, companyId);
  return owned.kind === 'absent' ? ABSENT : { kind: 'found', source: owned.source, facts: toFacts(owned) };
}

/**
 * **Πού ζει αυτή η ταυτότητα, και ποιος κατέχει τον χώρο της** (ADR-849 §6δ Β2).
 *
 * ⛔ **ΔΕΝ ΕΙΝΑΙ ΕΞΟΥΣΙΟΔΟΤΗΣΗ.** Το «επιτρέπεται σε αυτόν;» το απαντά το
 * {@link lookupOwnedPlace} (με θεατή). Εδώ δεν υπάρχει θεατής: ρωτά ο **ανιχνευτής
 * απόκλισης προορισμών**, στον διακομιστή, για να ξαναχτίσει τον προορισμό μιας
 * ειδοποίησης από το SSoT του παραγωγού — ποτέ από το πρόθεμα `ownp_`/`prop_`.
 *
 * 🔑 **Ίδια σειρά με τον εντοπισμό** («ο άνθρωπος πρώτα») και **ίδιος κάτοχος με τους
 * σαρωτές**: `authorUserId` για τον ιδιώτη, {@link companyPropertyHolder} για το γραφείο.
 */
export type PlaceLocation =
  | { readonly kind: 'found'; readonly source: PlaceSource; readonly holderId: string }
  /** Ακίνητο γραφείου **χωρίς εταιρεία** — δεν έχει χώρο, άρα ούτε πόρτα. */
  | { readonly kind: 'unscoped' }
  | { readonly kind: 'absent' };

export async function locatePlace(db: AdminFirestore, propertyId: string): Promise<PlaceLocation> {
  const ownerSnap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(propertyId).get();
  const owner = ownerPropertyFromDocument(ownerSnap.data(), propertyId);
  if (owner !== null) {
    return { kind: 'found', source: 'owner-property', holderId: owner.authorUserId };
  }

  const companySnap = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  const company = companySnap.data();
  if (company === undefined) return { kind: 'absent' };

  const holderId = companyPropertyHolder(company);
  return holderId === null
    ? { kind: 'unscoped' }
    : { kind: 'found', source: 'company-property', holderId };
}

/**
 * **Ακίνητο ιδιώτη → τα γεγονότα που κρίνει η μηχανή.**
 *
 * 🔑 **Εξάγεται ώστε ο ειδοποιητής να ΜΗΝ ξαναγράψει την προβολή.** Ο
 * {@link announceInterestToOwners} σαρώνει πολλά ακίνητα χωρίς έλεγχο κατοχής (ο
 * κάτοχος είναι **το πεδίο** που διαβάζει), αλλά η μετάφραση προς τα γεγονότα οφείλει
 * να είναι **η ίδια** — αλλιώς το πάνελ και το email θα μπορούσαν να δείξουν
 * **διαφορετικό αριθμό για το ίδιο ακίνητο**, που είναι η χειρότερη δυνατή απόκλιση:
 * και οι δύο θα φαίνονταν σωστοί.
 *
 * ⚠️ Η **στιγμή** περνιέται ως όρισμα ώστε ένα πέρασμα πάνω σε N ακίνητα να κρίνεται
 * με **μία** ανάγνωση ρολογιού — ίδιο συμβόλαιο με το `writeListingProjection`.
 */
export function ownerPropertyFactsOf(
  property: OwnerProperty,
  at: string,
): ListingMatchFacts {
  return toFacts(ownerPropertyProjectionOf(property, at));
}

/**
 * **Ακίνητο γραφείου → τα γεγονότα που κρίνει η μηχανή.**
 *
 * Το αδελφό του {@link ownerPropertyFactsOf}, και εξάγεται για **τον ίδιο ακριβώς
 * λόγο**: ο ειδοποιητής της εταιρείας σαρώνει πολλά ακίνητα, και η μετάφραση προς
 * τα γεγονότα οφείλει να είναι **η ίδια** με του πάνελ. Δύο μεταφράσεις θα
 * μπορούσαν να δείξουν **διαφορετικό αριθμό για το ίδιο ακίνητο** — η χειρότερη
 * δυνατή απόκλιση, γιατί και οι δύο θα φαίνονταν σωστοί.
 *
 * ⚠️ **Ασύγχρονο, σε αντίθεση με το `ownerPropertyFactsOf`, και δεν είναι
 * ασυνέπεια**: ο ιδιώτης **δηλώνει** ο ίδιος τον τόπο (η δήλωσή του *είναι* η
 * γνώση), ενώ το ακίνητο του γραφείου τον κληρονομεί ανεβαίνοντας την αλυσίδα
 * κτίριο → έργο. Άρα εδώ υπάρχει **πραγματική** ανάγνωση, και το κόστος της είναι
 * ο λόγος που ο σαρωτής έχει όριο.
 *
 * ⚠️ **Η στιγμή περνιέται ως όρισμα** ώστε ένα πέρασμα πάνω σε N ακίνητα να
 * κρίνεται με **μία** ανάγνωση ρολογιού.
 */
export async function companyPropertyFactsOf(
  db: AdminFirestore,
  property: CompanyProjectableProperty,
  at: string,
): Promise<ListingMatchFacts> {
  return toFacts(await companyPropertyProjectionOf(db, property, at));
}

/**
 * Ακίνητο + τόπος → **τα γεγονότα που κρίνει η μηχανή**.
 *
 * 🔴 **Καλεί το {@link projectListingShape}, ΟΧΙ το `buildPublicListing` — και αυτός
 * είναι όλος ο λόγος που η διάσπαση έγινε.** Το δόλωμα του §12.6 απευθύνεται σε
 * ιδιοκτήτη που **δεν έχει ανεβάσει αγγελία**: με την πύλη δημοσίευσης μπροστά, το
 * μοναδικό ακίνητο που μας ενδιαφέρει θα επέστρεφε `null` και το χαρακτηριστικό θα
 * ανέφερε **«0 ζητούν»** — σιωπηλά και μονίμως.
 *
 * ⛔ **Το αποτέλεσμα ΔΕΝ γράφεται πουθενά.** Είναι εφήμερο, στη μνήμη του διακομιστή,
 * και βγαίνει από εδώ **μόνο** ως λογοκριμένο πλήθος.
 *
 * 🔶 **Τα δύο δηλωμένα κενά ταξιδεύουν ανοιχτά** (`availability` · `proximityMetres`):
 * η διαθεσιμότητα δεν αντλείται ακόμη από το BIM και οι αποστάσεις POI δεν μετρώνται.
 * Η μηχανή τα λέει **ονομαστικά** (`availability-unknown` / `proximity-unknown`) αντί
 * να υποθέσει — και γι' αυτό **δεν** γεμίζονται εδώ με εικασίες.
 */
function toFacts({ property, place, at }: OwnedProjectionInput): ListingMatchFacts {
  return {
    listing: projectListingShape(property, place, at),
    place: place.ref,
    availability: null,
    proximityMetres: {},
  };
}
