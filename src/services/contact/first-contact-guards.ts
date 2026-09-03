import 'server-only';

/**
 * @fileoverview **ΟΙ ΦΡΟΥΡΟΙ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ** — κανένας νέος κριτής, ούτε ένας.
 * @related services/contact/first-contact.service.ts · lib/owner-property/listing-custody.ts
 * @module services/contact/first-contact-guards
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — **EXTRACT**, ΟΧΙ ΨΑΛΙΔΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γραφέας ξεπέρασε τις **500 γραμμές** (N.7.1) όταν η χωρητικότητα έγινε
 * **συναλλαγή**. Η τομή **δεν έγινε στο μέγεθος** αλλά στην **ερώτηση**: εδώ ζουν οι
 * απαντήσεις στο *«υπάρχει ο στόχος, και δεν είσαι εσύ;»* και *«η ζήτηση που
 * επικαλείσαι είναι δική σου;»* — δύο ερωτήσεις με **κοινό** χαρακτηριστικό:
 *
 * 🔑 **ΚΑΜΙΑ τους δεν γεννά κριτή.** Και οι δύο **αναθέτουν** στον `listing-custody.ts`
 * (**CHECK 3.56**), και η δημοσίευση στο `buildPublicListing`. Το αρχείο είναι, κατά
 * κυριολεξία, *«ποιον ρωτάμε»* — και γι' αυτό διαβάζεται μόνο του.
 *
 * ⛔ **ΜΗΝ γράψεις εδώ σύγκριση ταυτότητας.** Αν βρεθείς να γράφεις
 * `authorUserId === …` ή `companyId === …`, η απάντηση υπάρχει ήδη: `mayAdminister`.
 *
 * **Layering**: server — Admin SDK ως **όρισμα**, ποτέ singleton· καμία ανάγνωση ρολογιού.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { ListingMatchFacts } from '@/lib/demand/demand-match-vocabulary';
import {
  custodyOf,
  mayAdminister,
  type ListingActor,
} from '@/lib/owner-property/listing-custody';
import {
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import { createModuleLogger } from '@/lib/telemetry';
import { composeMatchReason } from '@/services/contact/first-contact-projection';
import {
  refuseFirstContact as refuse,
  FIRST_CONTACT_UNAVAILABLE as UNAVAILABLE,
  type FirstContactRefusal as Refusal,
  type FirstContactUnavailable as Unavailable,
} from '@/services/contact/first-contact-vocabulary';
import { buildPublicListing } from '@/services/listings/public-listing-projection';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';
import type { FirstContactTarget, MatchReason } from '@/types/first-contact';
import type { OwnerProperty } from '@/types/owner-property';
import type { PropertyDemand } from '@/types/property-demand';

const logger = createModuleLogger('first-contact-guards');

// =============================================================================
// 1. ΟΙ ΦΡΟΥΡΟΙ ΤΟΥ ΣΤΟΧΟΥ — κανένας νέος κριτής
// =============================================================================

/**
 * Ο λόγος, ή γιατί δεν υπάρχει λόγος.
 *
 * ⚠️ **Το `'reason'` με `matchReason: null` ΔΕΝ είναι αποτυχία** — είναι το *«δεν το
 * ξέρουμε»*: πράξη χωρίς δηλωμένη ζήτηση, ή στόχος χωρίς αγγελία να συγκριθεί.
 */
export type MatchReasonResolution =
  | { readonly kind: 'reason'; readonly matchReason: MatchReason | null }
  | Refusal
  | Unavailable;

/** Ο στόχος στάθηκε — και, για αγγελία, τα γεγονότα που κρίνει το «γιατί». */
export interface ResolvedTarget {
  /** `null` για επαγγελματία: **δεν υπάρχει αγγελία να συγκριθεί** με τη ζήτηση. */
  readonly facts: ListingMatchFacts | null;
}

/**
 * **Υπάρχει ο στόχος, είναι ζωντανός, και ΔΕΝ είσαι εσύ;**
 *
 * 🔑 **Ο κριτής της θεματοφυλακής ΔΕΝ γράφεται εδώ** (CHECK 3.56): είναι το
 * `mayAdminister(custodyOf(…))` του `listing-custody.ts` — ο **ίδιος** που κρίνει την
 * επεξεργασία και την ανάθεση. Εδώ ρωτιέται **ανάποδα**: αν επιτρέπεσαι να τη
 * διαχειριστείς, τότε **είναι δική σου** και δεν έχεις κανέναν να πλησιάσεις.
 */
export async function resolveTarget(
  adminDb: AdminFirestore,
  actor: ListingActor,
  target: FirstContactTarget,
  nowISO: string,
): Promise<ResolvedTarget | Refusal | Unavailable> {
  if (target.kind === 'professional') {
    // 🔑 **Ο ΙΔΙΟΣ κριτής, σε χώρο εταιρείας.** Ένα ωμό `companyId === companyId` εδώ
    //    θα ήταν **τέταρτο δόγμα εξουσιοδότησης** — και θα έπεφτε στην παγίδα του
    //    κενού μισθωτή που το `hasTenant` κλείνει ονομαστικά.
    if (mayAdminister({ kind: 'company', companyId: target.agencyCompanyId }, actor)) {
      return refuse('contact-own-target');
    }
    const agency = await lookupAgencyProfile(adminDb, target.agencyCompanyId);
    if (agency.outcome === 'unavailable') return UNAVAILABLE;
    if (agency.outcome === 'not-published') return refuse('target-absent');
    return { facts: null };
  }

  return resolveListingTarget(adminDb, actor, target.listingId, nowISO);
}

/**
 * **Η αγγελία, αν υπάρχει, είναι στην αγορά, και δεν είναι δική σου.**
 *
 * 🔴 **Η ΔΗΜΟΣΙΕΥΣΗ ΚΡΙΝΕΤΑΙ ΑΠΟ ΤΟΝ ΕΝΑ ΚΡΙΤΗ** — `buildPublicListing`, που
 * επιστρέφει `null` για ό,τι δεν έχει **καμία ζωντανή διάθεση στην αγορά**
 * (απόσυρση · ληγμένη ή εκκρεμής εντολή). Ένα δικό μας `lifecycle !== 'listed'` εδώ
 * θα ήταν **δεύτερο κριτήριο δημοσίευσης** δίπλα στο `isPubliclyListed`, που το
 * `public-listing-projection.ts` δηλώνει ρητά ότι *«γράφεται **ΜΙΑ** φορά»* — και
 * προειδοποιεί ότι τα δύο θα διαφωνούσαν **ακριβώς στην αντιπαροχή**.
 *
 * 🏆 **Και κερδίζουμε τα γεγονότα από την ίδια δουλειά**: η προβολή που κρίνει το
 * «είναι ζωντανή;» είναι **ακριβώς** αυτή που θα κρίνει το «γιατί ταιριάζει;».
 */
async function resolveListingTarget(
  adminDb: AdminFirestore,
  actor: ListingActor,
  listingId: string,
  nowISO: string,
): Promise<ResolvedTarget | Refusal | Unavailable> {
  const property = await readOwnerProperty(adminDb, listingId);
  if (property === null) return UNAVAILABLE;
  if (property === 'absent') return refuse('target-absent');

  if (mayAdminister(custodyOf(property), actor)) return refuse('contact-own-target');

  const place = placeKnowledgeFromOwnerProperty(property, nowISO);
  const listing = buildPublicListing(
    projectableFromOwnerProperty(property, nowISO),
    place,
    nowISO,
  );
  if (listing === null) return refuse('target-not-live');

  // 🔶 **Τα δύο δηλωμένα κενά ταξιδεύουν ΑΝΟΙΧΤΑ** (`availability` · `proximityMetres`):
  //    δεν αντλούνται σήμερα, και **δεν** γεμίζονται με εικασία. Ο συνθέτης του λόγου
  //    δεν τα διαβάζει — δες την κεφαλίδα του `first-contact-projection.ts`.
  return { facts: { listing, place: place.ref, availability: null, proximityMetres: {} } };
}

/**
 * **Το ακίνητο, ή γιατί δεν το έχουμε.**
 *
 * ⚠️ Τρεις απαντήσεις, ποτέ δύο: `null` = **βλάβη** *(δεν μάθαμε)*, `'absent'` = **δεν
 * υπάρχει**, αλλιώς το έγγραφο. Ένα `null` που σκέπαζε και τα δύο θα έλεγε στον
 * άνθρωπο «δεν υπάρχει» κάθε φορά που πέφτει η Firestore (N.12).
 */
async function readOwnerProperty(
  adminDb: AdminFirestore,
  listingId: string,
): Promise<OwnerProperty | 'absent' | null> {
  try {
    const snapshot = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(listingId).get();
    return snapshot.exists ? (snapshot.data() as OwnerProperty) : 'absent';
  } catch (error) {
    logger.error('[FIRST-CONTACT] Η ανάγνωση της αγγελίας απέτυχε — άγνωστο, όχι κενό', {
      listingId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// =============================================================================
// 2. ΤΟ «ΓΙΑΤΙ» — μόνο από ΔΙΚΗ ΣΟΥ ζήτηση
// =============================================================================

/**
 * **Ο λόγος, αν υπάρχει πηγή γι' αυτόν.**
 *
 * 🔑 **`null` σημαίνει «δεν το ξέρουμε», και είναι ΥΠΑΡΚΤΗ απάντηση**: η αγγελία είναι
 * δημόσια και ο καθένας πατά το κουμπί χωρίς να έχει δηλώσει ποτέ ζήτηση. Η οθόνη
 * οφείλει να πει *«δεν το ξέρουμε»* αντί *«ταιριάζει σε όλα»* — **δεν** είναι το ίδιο.
 *
 * 🔴 **Η ΖΗΤΗΣΗ ΕΛΕΓΧΕΤΑΙ ΜΕ ΤΟΝ ΕΝΑ ΚΡΙΤΗ, ΚΑΙ Η ΕΠΑΝΑΧΡΗΣΗ ΕΙΝΑΙ ΔΟΜΙΚΗ**: η
 * {@link PropertyDemand} φέρει **τα ίδια δύο πεδία χώρου** (`authorUserId` ·
 * `authorCompanyId`) με την αγγελία, και η ερώτηση είναι **η ίδια** — *«επιτρέπεται σε
 * αυτόν τον άνθρωπο να διαχειριστεί ό,τι ζει σε αυτόν τον χώρο;»*. Ένα ωμό
 * `demand.authorUserId !== actor.uid` θα ήταν **δεύτερη αυθεντία** (CHECK 3.56) και θα
 * έχανε τον ιδιωτικό/εταιρικό διαχωρισμό που ο κριτής ήδη κρατά.
 *
 * ⚠️ **Λόγος χωρίς πηγή δεν γράφεται ΠΟΤΕ**: το αμετάβλητο `contact-reason-without-demand`
 * το επιβάλλει, αλλά εδώ αποτρέπεται **στη ρίζα** — ισχυρισμός που κανείς δεν μπορεί
 * να ελέγξει θα έφτανε στον προσφέροντα ως **γεγονός**.
 */
export async function resolveMatchReason(
  adminDb: AdminFirestore,
  actor: ListingActor,
  demandId: string | null,
  facts: ListingMatchFacts | null,
  nowISO: string,
): Promise<MatchReasonResolution> {
  if (demandId === null) return { kind: 'reason', matchReason: null };

  const demand = await readDemand(adminDb, demandId);
  if (demand === null) return UNAVAILABLE;
  if (demand === 'absent' || !mayAdminister(custodyOf(demand), actor)) {
    return refuse('demand-absent');
  }

  // ⚠️ Στόχος **επαγγελματίας** δεν έχει αγγελία να συγκριθεί ⇒ ο λόγος μένει `null`,
  //    ενώ το `demandId` γράφεται. Το αμετάβλητο απαγορεύει το αντίστροφο, ποτέ αυτό.
  return {
    kind: 'reason',
    matchReason: facts === null ? null : composeMatchReason(demand, facts, nowISO),
  };
}

/** Ίδιο τρίπτυχο με το {@link readOwnerProperty}: βλάβη ≠ απουσία (N.12). */
async function readDemand(
  adminDb: AdminFirestore,
  demandId: string,
): Promise<PropertyDemand | 'absent' | null> {
  try {
    const snapshot = await adminDb.collection(COLLECTIONS.PROPERTY_DEMANDS).doc(demandId).get();
    return snapshot.exists ? (snapshot.data() as PropertyDemand) : 'absent';
  } catch (error) {
    logger.error('[FIRST-CONTACT] Η ανάγνωση της ζήτησης απέτυχε — άγνωστο, όχι κενό', {
      demandId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
