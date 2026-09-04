import 'server-only';

/**
 * @fileoverview **ΟΙ ΦΡΟΥΡΟΙ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ** — κανένας νέος κριτής, ούτε ένας.
 * @related services/contact/first-contact.service.ts · lib/owner-property/listing-custody.ts
 * @related services/contact/first-contact-target-locator.ts *(ADR-843 §10.17 — ποιον φτάνει)*
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
 * ⛔ **ΟΥΤΕ ΤΟ «ΠΟΙΟΝ ΦΤΑΝΕΙ Η ΠΡΑΞΗ» — έφυγε κι αυτό** (§10.17). Ζούσε εδώ σε **δύο**
 * σημεία *(μία γραμμή ενσωματωμένη για τον επαγγελματία · ο επιλυτής για την αγγελία)*
 * και ήταν **απρόσιτο** από έξω, γιατί ήταν μπλεγμένο με εξουσιοδότηση και ζωντάνια.
 * Όταν το backfill του `offerer` χρειάστηκε την **ίδια** απάντηση, δεν είχε τι να
 * καλέσει. Τώρα ζει στο `first-contact-target-locator.ts` — και αν βρεθείς να γράφεις
 * εδώ `{ kind: 'company', companyId: … }`, **αυτό ακριβώς** ξαναφτιάχνεις.
 *
 * ⛔ **ΜΗΝ γράψεις εδώ σύγκριση ταυτότητας.** Αν βρεθείς να γράφεις
 * `authorUserId === …` ή `companyId === …`, η απάντηση υπάρχει ήδη: `mayAdminister`.
 *
 * **Layering**: server — Admin SDK ως **όρισμα**, ποτέ singleton· καμία ανάγνωση ρολογιού.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { ListingMatchFacts } from '@/lib/demand/demand-match-vocabulary';
import { custodyOf, mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { composeMatchReason } from '@/services/contact/first-contact-projection';
import {
  locateTarget,
  type LocatedTarget,
} from '@/services/contact/first-contact-target-locator';
import {
  refuseFirstContact as refuse,
  FIRST_CONTACT_UNAVAILABLE as UNAVAILABLE,
  type FirstContactRefusal as Refusal,
  type FirstContactUnavailable as Unavailable,
} from '@/services/contact/first-contact-vocabulary';
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

/**
 * **Υπάρχει ο στόχος, είναι ζωντανός, και ΔΕΝ είσαι εσύ;**
 *
 * 🔑 **Ο κριτής της θεματοφυλακής ΔΕΝ γράφεται εδώ** (CHECK 3.56): είναι το
 * `mayAdminister(custodyOf(…))` του `listing-custody.ts` — ο **ίδιος** που κρίνει την
 * επεξεργασία και την ανάθεση. Εδώ ρωτιέται **ανάποδα**: αν επιτρέπεσαι να τη
 * διαχειριστείς, τότε **είναι δική σου** και δεν έχεις κανέναν να πλησιάσεις.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΕΡΩΤΗΣΕΙΣ ΜΕ ΣΕΙΡΑ — ΚΑΙ Η ΣΕΙΡΑ ΤΟΥΣ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ (ADR-843 §10.17)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. *«ποιον φτάνει;»* → {@link locateTarget} — **έφυγε από εδώ**, γιατί τη χρειάζεται
 *    και το backfill του `offerer`, όπου δεν υπάρχει καν «καλών» να ρωτηθεί.
 * 2. *«επιτρέπεσαι;»* → `mayAdminister`, εδώ.
 * 3. *«είναι ζωντανός;»* → {@link targetIsNotLive}, εδώ — **δύο** διαφορετικές
 *    ερωτήσεις ανά είδος στόχου, με **δύο** διαφορετικές αρνήσεις.
 *
 * ⚠️ **Η σειρά 2 → 3 ΔΕΝ αντιστρέφεται.** Ο ιδιοκτήτης μιας βιτρίνας που **απέσυρε**
 * οφείλει να ακούσει *«είναι δικό σου»* και όχι *«δεν υπάρχει»* — και η αντίστροφη
 * σειρά θα πλήρωνε επιπλέον μία ανάγνωση για να δώσει **χειρότερη** απάντηση.
 */
export async function resolveTarget(
  adminDb: AdminFirestore,
  actor: ListingActor,
  target: FirstContactTarget,
  nowISO: string,
): Promise<LocatedTarget | Refusal | Unavailable> {
  const located = await locateTarget(adminDb, target, nowISO);
  if (located === null) return UNAVAILABLE;
  if (located === 'absent') return refuse('target-absent');

  if (mayAdminister(located.custody, actor)) return refuse('contact-own-target');

  const notLive = await targetIsNotLive(adminDb, target, located);
  return notLive ?? located;
}

/**
 * **Είναι ο στόχος ζωντανός;** — `null` όταν ναι, αλλιώς η **σωστή** άρνηση.
 *
 * 🔴 **ΔΥΟ ΕΡΩΤΗΣΕΙΣ, ΟΧΙ ΜΙΑ ΜΕ ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ** — γι' αυτό η ζωντάνια **δεν**
 * μετακόμισε στον εντοπιστή μαζί με τον παραλήπτη:
 *
 * | Είδος | Η ερώτηση | Η άρνηση | Γιατί αυτή |
 * |---|---|---|---|
 * | επαγγελματίας | «δημοσιεύτηκε η **βιτρίνα**;» | `target-absent` | **συγκάλυψη**: αδημοσίευτο και ανύπαρκτο είναι αδιάκριτα (§9.6) |
 * | αγγελία | «έχει **ζωντανή διάθεση**;» | `target-not-live` | ξεχωριστός κωδικός **επίτηδες**: «υπάρχει αλλά όχι τώρα» ≠ «δεν υπάρχει» |
 *
 * 🔑 **Καμία από τις δύο δεν γράφεται εδώ**: το `lookupAgencyProfile` κρίνει τη μία,
 * το `buildPublicListing` —μέσα στον επιλυτή— την άλλη. Αυτή η συνάρτηση **διαλέγει
 * ποιον να ρωτήσει**, τίποτε άλλο.
 *
 * ⚠️ **Και η ανάγνωση του γραφείου γίνεται ΕΔΩ, μετά το `mayAdminister`** — ακριβώς
 * όπου γινόταν πάντα. Ένα βήμα νωρίτερα θα ήταν μία ανάγνωση που πληρώνουμε για να
 * πούμε στον ιδιοκτήτη λάθος πράγμα.
 */
async function targetIsNotLive(
  adminDb: AdminFirestore,
  target: FirstContactTarget,
  located: LocatedTarget,
): Promise<Refusal | Unavailable | null> {
  switch (target.kind) {
    case 'professional': {
      const agency = await lookupAgencyProfile(adminDb, target.agencyCompanyId);
      if (agency.outcome === 'unavailable') return UNAVAILABLE;
      return agency.outcome === 'not-published' ? refuse('target-absent') : null;
    }
    case 'listing':
      // 🔴 Η ΔΗΜΟΣΙΕΥΣΗ ΚΡΙΝΕΤΑΙ ΑΠΟ ΤΟΝ ΕΝΑ ΚΡΙΤΗ — `buildPublicListing`, μέσα στον
      //    επιλυτή, για **αμφότερες** τις οικογένειες. Ένα δικό μας `lifecycle !== …`
      //    εδώ θα ήταν **δεύτερο** κριτήριο δημοσίευσης, και το
      //    `public-listing-projection.ts` προειδοποιεί ότι τα δύο θα διαφωνούσαν
      //    **ακριβώς στην αντιπαροχή**.
      return located.facts === null ? refuse('target-not-live') : null;
    default: {
      // Ένα τρίτο είδος στόχου κοκκινίζει ΕΔΩ: κάθε είδος οφείλει να δηλώσει τι
      // σημαίνει «ζωντανός» γι' αυτό — αλλιώς θα περνούσε σιωπηλά ως ζωντανό.
      const exhaustive: never = target;
      return exhaustive;
    }
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
