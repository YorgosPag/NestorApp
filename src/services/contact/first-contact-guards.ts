import 'server-only';

/**
 * @fileoverview **ΟΙ ΦΡΟΥΡΟΙ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ** — κανένας νέος κριτής, ούτε ένας.
 * @related services/contact/first-contact.service.ts · lib/owner-property/listing-custody.ts
 * @related services/listings/listing-resolver.ts *(ADR-843 §10.16 — οι δύο οικογένειες)*
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
 * ⛔ **ΚΑΙ ΜΗΝ ΓΡΑΨΕΙΣ ΕΔΩ ΟΝΟΜΑ ΣΥΛΛΟΓΗΣ ΑΓΓΕΛΙΩΝ.** Μέχρι τις 2026-09-04 αυτό το
 * αρχείο άνοιγε **το ίδιο** το `owner_properties` — και έτσι έγινε ο **μισός** μηχανισμός
 * του §10.15: κάθε πράξη προς αγγελία **γραφείου** έπαιρνε *«η αγγελία δεν υπάρχει»*.
 * Η ερώτηση *«ποια αγγελία;»* ζει τώρα σε **ένα** σημείο: `listing-resolver.ts`.
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
  type ListingCustody,
} from '@/lib/owner-property/listing-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { composeMatchReason } from '@/services/contact/first-contact-projection';
import {
  refuseFirstContact as refuse,
  FIRST_CONTACT_UNAVAILABLE as UNAVAILABLE,
  type FirstContactRefusal as Refusal,
  type FirstContactUnavailable as Unavailable,
} from '@/services/contact/first-contact-vocabulary';
import { resolveListing } from '@/services/listings/listing-resolver';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';
import type { FirstContactTarget, MatchReason } from '@/types/first-contact';
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
  /**
   * 🏆 **ΠΟΙΟΝ ΦΤΑΝΕΙ Η ΠΡΑΞΗ** — και γι' αυτό ταξιδεύει έξω από εδώ (ADR-843 §10.16).
   *
   * Ο κριτής **ήδη** υπολόγιζε τη θεματοφυλακή για να απαντήσει *«μήπως είσαι εσύ;»*,
   * και μετά **την πετούσε**. Έτσι η ερώτηση *«ποιες πράξεις είναι δικές μου;»*
   * έμενε να απαντηθεί δεύτερη φορά, από **άλλο** αρχείο, με **άλλο** τρόπο — και
   * εκείνη η δεύτερη απάντηση ήταν η μισή του §10.15.
   *
   * ⚠️ Δεν είναι «η εταιρεία του ζητούντος»: είναι ο **χώρος του στόχου**.
   */
  readonly custody: ListingCustody;
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
    //
    // 🏆 **Και η θεματοφυλακή γράφεται ΜΙΑ φορά, εδώ**: η βιτρίνα **είναι** χώρος
    //    εταιρείας. Δύο εκφράσεις του ίδιου πράγματος —μία για την άρνηση, μία για
    //    τη δρομολόγηση— θα ήταν ελεύθερες να αποκλίνουν.
    const custody: ListingCustody = { kind: 'company', companyId: target.agencyCompanyId };

    if (mayAdminister(custody, actor)) return refuse('contact-own-target');

    const agency = await lookupAgencyProfile(adminDb, target.agencyCompanyId);
    if (agency.outcome === 'unavailable') return UNAVAILABLE;
    if (agency.outcome === 'not-published') return refuse('target-absent');
    return { facts: null, custody };
  }

  return resolveListingTarget(adminDb, actor, target.listingId, nowISO);
}

/**
 * **Η αγγελία, αν υπάρχει, είναι στην αγορά, και δεν είναι δική σου.**
 *
 * 🔴 **ΚΑΙ ΟΙ ΔΥΟ ΟΙΚΟΓΕΝΕΙΕΣ, ΑΠΟ ΤΟΝ ΕΝΑ ΕΠΙΛΥΤΗ** (ADR-843 §10.16). Μέχρι τις
 * 2026-09-04 αυτή η συνάρτηση διάβαζε **η ίδια** το `owner_properties` — δηλαδή
 * απαντούσε *«δεν υπάρχει»* σε **6 από τις 8** ζωντανές αγγελίες, όσες ανήκουν στον
 * επαγγελματία. Το σχόλιο ακριβώς από κάτω έλεγε *«η δημοσίευση κρίνεται από τον ΕΝΑ
 * κριτή»* και ήταν **αληθές για τη μία οικογένεια**.
 *
 * 🔑 **Η θεραπεία δεν ήταν δεύτερο `if` — ήταν να πάψει αυτό το αρχείο να ξέρει τι
 * είναι «οικογένεια»**. Ο {@link resolveListing} απαντά με **έναν** τύπο, και ο
 * φρουρός βλέπει μόνο *«υπάρχει · ποιανού είναι · είναι στην αγορά»*.
 *
 * 🔴 **Η ΔΗΜΟΣΙΕΥΣΗ ΕΞΑΚΟΛΟΥΘΕΙ ΝΑ ΚΡΙΝΕΤΑΙ ΑΠΟ ΤΟΝ ΕΝΑ ΚΡΙΤΗ** — `buildPublicListing`,
 * που ο επιλυτής καλεί για **αμφότερες**. Ένα δικό μας `lifecycle !== 'listed'` εδώ θα
 * ήταν **δεύτερο κριτήριο δημοσίευσης** δίπλα στο `isPubliclyListed`, που το
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
  const resolved = await resolveListing(adminDb, listingId, nowISO);
  if (resolved === null) return UNAVAILABLE;
  if (resolved === 'absent') return refuse('target-absent');

  if (mayAdminister(resolved.custody, actor)) return refuse('contact-own-target');
  if (resolved.facts === null) return refuse('target-not-live');

  return { facts: resolved.facts, custody: resolved.custody };
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
