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
 * | `owner_properties` | `mode: 'userId'`, `ownerUserId` | ο **άνθρωπος** (Α14 · §8.16) |
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
import { nowISO } from '@/lib/date-local';
import {
  projectListingShape,
  type PlaceKnowledge,
  type ProjectableProperty,
} from '@/services/listings/public-listing-projection';
import { collectPlaceKnowledge } from '@/services/listings/publish-public-listing';
import {
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import type { OwnerProperty } from '@/types/owner-property';
import type { ListingMatchFacts } from '@/lib/demand/demand-match-vocabulary';

// =============================================================================
// 1. ΤΟ ΑΠΟΤΕΛΕΣΜΑ — ονομασμένο, κλειστό
// =============================================================================

/** Από ποια πλευρά ήρθε το ακίνητο. **Ονομασμένο**, ώστε η αναφορά να μη μαντεύει. */
export const PLACE_SOURCES = ['owner-property', 'company-property'] as const;

export type PlaceSource = (typeof PLACE_SOURCES)[number];

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
 * @param uid — ο συνδεδεμένος άνθρωπος (κατοχή ιδιώτη)
 * @param companyId — η **ενεργή** εταιρεία του (κατοχή γραφείου)
 */
export async function lookupOwnedPlace(
  db: AdminFirestore,
  propertyId: string,
  uid: string,
  companyId: string,
): Promise<PlaceLookup> {
  const personal = await readOwnerProperty(db, propertyId, uid);
  if (personal !== null) {
    return { kind: 'found', source: 'owner-property', facts: personal };
  }

  const company = await readCompanyProperty(db, propertyId, companyId);
  return company === null
    ? ABSENT
    : { kind: 'found', source: 'company-property', facts: company };
}

/** Το ακίνητο του **ιδιώτη** — η δήλωσή του **είναι** η γνώση του τόπου (Α14). */
async function readOwnerProperty(
  db: AdminFirestore,
  propertyId: string,
  uid: string,
): Promise<ListingMatchFacts | null> {
  const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(propertyId).get();
  const property = snap.data() as OwnerProperty | undefined;
  if (property === undefined || property.ownerUserId !== uid) return null;

  return ownerPropertyFactsOf({ ...property, id: propertyId }, nowISO());
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
  return toFacts(
    { ...projectableFromOwnerProperty(property), id: property.id },
    placeKnowledgeFromOwnerProperty(property, at),
    at,
  );
}

/** Το ακίνητο του **γραφείου** — ο τόπος λύνεται ανεβαίνοντας την αλυσίδα της Α1. */
async function readCompanyProperty(
  db: AdminFirestore,
  propertyId: string,
  companyId: string,
): Promise<ListingMatchFacts | null> {
  const snap = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  const property = snap.data() as
    | (ProjectableProperty & {
        companyId?: string | null;
        buildingId?: string | null;
        projectId?: string | null;
      })
    | undefined;

  // ⚠️ Ο έλεγχος μισθωτή γίνεται **εδώ, σε ανάγνωση κατ' ευθείαν σε έγγραφο**: ένα
  // `.doc(id).get()` δεν περνά από `where`, άρα καμία πύλη ερωτήματος δεν θα τον
  // επέβαλλε για λογαριασμό μας (CHECK 3.35 κρίνει ερωτήματα, όχι αναγνώσεις εγγράφου).
  if (property === undefined || property.companyId !== companyId) return null;

  return companyPropertyFactsOf(db, { ...property, id: propertyId }, nowISO());
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
  property: ProjectableProperty & {
    buildingId?: string | null;
    projectId?: string | null;
  },
  at: string,
): Promise<ListingMatchFacts> {
  return toFacts(property, await collectPlaceKnowledge(db, property, at), at);
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
function toFacts(
  property: ProjectableProperty,
  place: PlaceKnowledge,
  at: string,
): ListingMatchFacts {
  return {
    listing: projectListingShape(property, place, at),
    place: place.ref,
    availability: null,
    proximityMetres: {},
  };
}
