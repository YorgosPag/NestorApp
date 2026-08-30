import 'server-only';

/**
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΟΥ ΑΙΤΗΜΑΤΟΣ ΑΝΑΘΕΣΗΣ** — Σ1 (ADR-827 §9.17).
 * @related types/mandate-request.ts · lib/owner-property/listing-custody.ts · services/mandate/agency-profile.service.ts
 * @module services/mandate/mandate-request.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΚΑΘΕ ΓΡΑΦΗ ΚΑΙ ΚΑΘΕ ΑΝΑΓΝΩΣΗ ΠΕΡΝΑ ΥΠΟΧΡΕΩΤΙΚΑ ΑΠΟ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `firestore.rules` δίνει στο `mandate_requests` **`read: false` ΚΑΙ
 * `write: false`** — και είναι το **αυστηρότερο** ζεύγος του έργου, επίτηδες. Ούτε
 * καν ο **ιδιώτης** δεν διαβάζει απευθείας το δικό του έγγραφο: η οθόνη του ρωτά
 * *«τι έχει φτάσει στο γραφείο;»*, και η απάντηση είναι το `disclosedTo(request)` —
 * **καθαρή συνάρτηση** που οφείλει να τρέξει στην **ίδια πλευρά** με τον συνθέτη της
 * προβολής, αλλιώς γεννιούνται δύο πηγές που μπορούν να διαφωνήσουν (§8.6).
 *
 * ⛔ **Αν βρεθείς να γράφεις `onSnapshot('mandate_requests')`, έχεις ήδη σπάσει το §8.2.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΙΔΕΜΠΟΤΗΣΙΑ ΤΟΥ Δ4 — STRIPE ΓΙΑ ΤΟ «ΟΣΟ ΕΚΚΡΕΜΕΙ», AUTODESK ΓΙΑ ΤΟ «ΜΕΤΑ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **ΜΙΑ αρχή, δύο συνέπειες**: *ταυτόσημο αίτημα σε ερώτημα που έχει ήδη απαντηθεί
 * **δεν είναι νέα πράξη**.*
 *
 * | Κατάσταση του ζεύγους *(ακίνητο × γραφείο)* | Ίδιοι όροι | Άλλοι όροι |
 * |---|---|---|
 * | κανένα αίτημα | **δημιουργία** | **δημιουργία** |
 * | υπάρχει `pending` | **`unchanged`** *(το ίδιο έγγραφο, ιδεμποτησία Stripe)* | `request-already-pending` |
 * | οποιοδήποτε `declined-final` | `request-declined-final` | **ίδιο** — ο κριτής έκλεισε την πόρτα |
 * | τελευταίο `declined-revisable` | **δημιουργία + `supersedesRequestId`** | **ίδιο** |
 * | τελευταίο `withdrawn` | **δημιουργία** *(«το ξανασκέφτηκα»)* | **δημιουργία** |
 * | υπάρχει `accepted` | ⇒ η αγγελία έχει εντολή ⇒ `listing-already-brokered` | ίδιο |
 *
 * 🔴 **ΠΡΟΣΕΞΕ ΤΗ ΓΡΑΜΜΗ ΤΟΥ `declined-revisable`: ΟΙ ΔΥΟ ΣΤΗΛΕΣ ΕΙΝΑΙ ΙΔΙΕΣ.** Εκεί
 * ακριβώς φεύγει ο Δ4 (`request-terms-unchanged`). Μετά από ρητό *«στείλε ξανά»*, οι
 * **ίδιοι** όροι είναι νόμιμη υποβολή — γιατί το δικαίωμα το έδωσε **ο κριτής**, και
 * δεν το υπολογίζουμε εμείς από τη διαφορά. Η μετάλλαξη *«κοίτα και τους όρους»* εδώ
 * **οφείλει να κοκκινίσει** (άγκυρα Χ).
 *
 * ⚠️ **ΓΙΑΤΙ `request-already-pending` ΚΑΙ ΟΧΙ ΣΙΩΠΗΛΗ ΕΝΗΜΕΡΩΣΗ των όρων**: το
 * εκκρεμές αίτημα μπορεί **αυτή τη στιγμή** να το διαβάζει ο μεσίτης. Έγγραφο που
 * αλλάζει κάτω από τα μάτια του κριτή είναι το ίδιο ελάττωμα με τη μετάλλαξη
 * απεσταλμένης επιστολής. Ο ιδιώτης **αποσύρει** και ξαναστέλνει — δύο ρητές πράξεις.
 *
 * ⚠️ **ΓΙΑΤΙ ΤΟ `withdrawn` ΔΕΝ ΜΕΤΡΑΕΙ**: την απόσυρση την έκανε ο **ίδιος**. Ο
 * κανόνας φυλά την **κρίση του γραφείου**, όχι την αναποφασιστικότητα του ιδιοκτήτη.
 *
 * ⚠️ **ΚΑΙ ΤΟ ΚΛΗΡΟΔΟΤΗΜΑ ΔΙΑΒΑΖΕΤΑΙ, ΔΕΝ ΑΓΝΟΕΙΤΑΙ**: έγγραφα γραμμένα πριν το §9.21
 * λένε `status: 'declined'` — ένα «όχι» χωρίς εξουσία δηλωμένη. Περνούν από το
 * `mandateRequestFromStored` και γίνονται **`declined-final`** *(fail-closed)*. Ένα
 * σιωπηλό πέταγμα θα έκανε το ιστορικό να φαίνεται **αδειανό**, δηλαδή θα άνοιγε την
 * πόρτα που δεν ξέρουμε αν έκλεισε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ ΔΕΝ ΕΧΕΙ `orderBy`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δύο φίλτρα **ισότητας** και **καμία** ταξινόμηση: η Firestore σερβίρει τέτοιο ερώτημα
 * από τα **μονοπεδιακά** ευρετήρια *(zigzag merge)*, ενώ ένα `orderBy('requestedAt')`
 * θα απαιτούσε **σύνθετο ευρετήριο** — δηλαδή νέα υποχρέωση στη **CHECK 3.15**, για
 * σύνολο που είναι εξ ορισμού **μια χούφτα** *(ένα `pending` + λίγες αναθεωρήσεις ανά
 * ζεύγος)*. Η ταξινόμηση γίνεται στη μνήμη, και ο λόγος γράφεται εδώ ώστε ο επόμενος
 * να μη «διορθώσει» τη λείπουσα `orderBy`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import {
  custodyOf,
  mayAdminister,
  type ListingActor,
} from '@/lib/owner-property/listing-custody';
import { generateMandateRequestId } from '@/services/enterprise-id-convenience';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';
import { readOwnerIdentity } from '@/services/mandate/mandate-owner-identity';
import type {
  MandateRequestDeclaration,
  MandateRequestRejection,
  MandateRequestWriteResult,
} from '@/services/mandate/mandate-request-vocabulary';
import {
  mandateRequestFromStored,
  mandateRequestInvariantViolations,
  readStoredRequestStatus,
  sameProposedTerms,
  type MandateRequest,
  type MandateRequestDocument,
  type ProposedMandateTerms,
} from '@/types/mandate-request';
import { mandateConflicts } from '@/lib/mandate/mandate-conflict';
import { bindingMandates, occupancyOf } from '@/types/owner-property-mandate';
import { mandatesOf } from '@/types/owner-property-mandate';
import type { OwnerProperty } from '@/types/owner-property';

const logger = createModuleLogger('mandate-request.service');

// =============================================================================
// 1. ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΩΝ ΑΡΝΗΣΕΩΝ — ζει σε ΔΙΚΟ ΤΟΥ αρχείο (ADR-834 §8)
// =============================================================================
//
// 🔑 **Μετακόμισε στο `mandate-request-vocabulary.ts`, και δεν ήταν καλλωπισμός**:
//    πελατικά αρχεία ζητούσαν το κλειστό σύνολο από **αυτόν** τον `server-only`
//    γραφέα. Δες την κεφαλίδα εκεί — το γιατί, με τη μέτρηση.
//
// ⛔ **ΜΗΝ ξαναγράψεις κωδικό άρνησης εδώ.** Ο τύπος θα «δούλευε»· η οθόνη που τον
//    ονομάζει, όχι — και ο άνθρωπος θα έβλεπε ωμό κωδικό.

// =============================================================================
// 2. Η ΠΡΑΞΗ
// =============================================================================

/**
 * **Ο ιδιώτης ζητά από το γραφείο να αναλάβει την αγγελία του.**
 *
 * ⚠️ **Η σειρά των φρουρών ΔΕΝ είναι αυθαίρετη**: πρώτα *«είναι δικό σου;»*, μετά
 * *«υπάρχει το γραφείο;»*. Αντίστροφα, ο καλών θα μάθαινε αν δημοσιεύεται ένας
 * οργανισμός **χωρίς** να έχει καν αγγελία — δηλαδή η πόρτα θα γινόταν ανιχνευτής
 * καταλόγου για οποιονδήποτε συνδεδεμένο.
 *
 * @param nowISO — η **περασμένη** στιγμή· κανένα ρολόι εδώ μέσα, ώστε τα άκρα να είναι
 *   δοκιμάσιμα (ίδιο ιδίωμα με `mandateFormBlockers` / `exceedsStatutoryTerm`).
 */
export async function submitMandateRequest(
  adminDb: AdminFirestore,
  actor: ListingActor,
  declaration: MandateRequestDeclaration,
  nowISO: string,
): Promise<MandateRequestWriteResult> {
  const listing = await loadOwnListing(adminDb, actor, declaration.ownerPropertyId);
  if ('kind' in listing) return listing;

  const agency = await lookupAgencyProfile(adminDb, declaration.agencyCompanyId);
  if (agency.outcome === 'unavailable') return { kind: 'unavailable' };
  if (agency.outcome === 'not-published') {
    return { kind: 'rejected', reason: 'agency-absent' };
  }

  // 🔴 **Η ΣΥΓΚΡΟΥΣΗ ΚΡΙΝΕΤΑΙ ΕΔΩ** (ADR-832) — με τον **ίδιο** κριτή που θα τρέξει
  //    ξανά στην αποδοχή. Δύο φορές δεν είναι διπλότυπο: εδώ γλιτώνει τον άνθρωπο από
  //    αίτημα που θα απορριφθεί· εκεί φυλά τη γραφή από ό,τι άλλαξε στο ενδιάμεσο.
  const occupancyVerdict = mandateConflicts(
    {
      agencyCompanyId: declaration.agencyCompanyId,
      agreement: declaration.terms.agreement,
      scope: declaration.terms.scope,
      startsAt: declaration.terms.startsAt,
      expiresAt: declaration.terms.expiresAt,
    },
    bindingMandates(mandatesOf(listing)).map(occupancyOf),
  );
  // ⚠️ *«Δεν μπόρεσα να κρίνω»* φεύγει ως **503**, ποτέ ως άρνηση (N.12).
  if (occupancyVerdict.kind === 'undetermined') return { kind: 'unavailable' };
  if (occupancyVerdict.kind === 'conflicts') {
    return { kind: 'rejected', reason: 'listing-conflicting-mandate' };
  }

  const history = await loadPairHistory(adminDb, declaration);
  if (history === null) return { kind: 'unavailable' };

  const verdict = judgeAgainstHistory(history, declaration.terms);
  if (verdict.kind !== 'proceed') return verdict;

  // 🔴 **Ο ΕΝΑΣ ΚΡΙΤΗΣ ΤΑΥΤΟΤΗΤΑΣ** (ADR-834 §8) — ο **ίδιος** που θα ξανατρέξει στην
  //    αποδοχή, με τα φρέσκα. Μέχρι σήμερα έτρεχε **μόνο εκεί**: ο ιδιώτης υπέβαλλε
  //    χωρίς έλεγχο και η άρνηση έσκαγε σε **άλλον άνθρωπο**, μέρες αργότερα, ενώ ο
  //    μόνος που μπορούσε να τη λύσει δεν τη μάθαινε ποτέ (N.7.2 #1).
  //
  // ⚠️ **ΤΕΛΕΥΤΑΙΟΣ, ΚΑΙ Η ΘΕΣΗ ΕΙΝΑΙ ΑΠΟΦΑΣΗ — ΤΡΕΙΣ ΛΟΓΟΙ**:
  //    1. **Η σειρά των φρουρών από πάνω είναι συμβόλαιο** (δες την κεφαλίδα): πρώτα
  //       *«είναι δικό σου;»*, μετά *«υπάρχει το γραφείο;»*. Παρεμβολή στη μέση θα
  //       άλλαζε τι μαθαίνει ο καλών και με ποια σειρά.
  //    2. **Η ταυτότητα είναι προϋπόθεση της ΣΥΜΒΑΣΗΣ, όχι της εγκυρότητας του
  //       αιτήματος.** Άνθρωπος με μπαγιάτικο σύνδεσμο προς **ξένη** αγγελία πρέπει
  //       να μάθει *αυτό*, όχι να σταλεί να συμπληρώσει το προφίλ του άδικα.
  //    3. **Ιδεμποτησία**: το `unchanged` του Δ4 επιστρέφει **πριν** από εδώ, άρα το
  //       δεύτερο πάτημα δεν πληρώνει δεύτερη ανάγνωση — και δεν μπορεί να γυρίσει
  //       άρνηση για αίτημα που **υπάρχει ήδη**.
  const identity = await readOwnerIdentity(adminDb, actor.uid);
  // ⚠️ *«Δεν μπόρεσα να ρωτήσω»* φεύγει ως **503**, ποτέ ως «λείπει το ΑΦΜ σου»: θα
  //    έστελνε τον άνθρωπο να διορθώσει κάτι που είναι ήδη σωστό (N.12).
  if (identity.kind === 'unavailable') return { kind: 'unavailable' };
  if (identity.kind === 'incomplete') {
    return { kind: 'rejected', reason: 'identity-incomplete' };
  }

  return writeRequest(adminDb, actor, declaration, verdict.supersedes, nowISO);
}

// =============================================================================
// 3. ΟΙ ΦΡΟΥΡΟΙ — καθένας με τον δικό του κριτή, κανένας νέος
// =============================================================================

/**
 * **Η αγγελία, αν σου ανήκει και μπορεί να ανατεθεί** — αλλιώς η έτοιμη άρνηση.
 *
 * 🔑 **Ο κριτής της κατοχής ΔΕΝ γράφεται εδώ**: είναι το `mayAdminister(custodyOf(…))`
 * του `listing-custody.ts` (**CHECK 3.56**), ο **ίδιος** που κρίνει την επεξεργασία και
 * την απόσυρση. Δεύτερος έλεγχος εδώ θα ήταν τέταρτο δόγμα εξουσιοδότησης.
 *
 * ⚠️ **«Δεν υπάρχει» και «δεν είναι δικό σου» απαντούν ΤΑΥΤΟΣΗΜΑ.** Ένα ξεχωριστό
 * `403` θα **επιβεβαίωνε την ύπαρξη** ξένου εγγράφου — το ίδιο ιδίωμα που ήδη τηρεί
 * το `respond.ts` για το `absent`.
 */
async function loadOwnListing(
  adminDb: AdminFirestore,
  actor: ListingActor,
  ownerPropertyId: string,
): Promise<OwnerProperty | { readonly kind: 'rejected'; readonly reason: MandateRequestRejection } | { readonly kind: 'unavailable' }> {
  let snapshot;
  try {
    snapshot = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId).get();
  } catch (error) {
    logger.error('[MANDATE-REQUEST] Η ανάγνωση της αγγελίας απέτυχε — άγνωστο, όχι κενό', {
      ownerPropertyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'unavailable' };
  }

  if (!snapshot.exists) return { kind: 'rejected', reason: 'listing-absent' };
  const property = snapshot.data() as OwnerProperty;

  if (!mayAdminister(custodyOf(property), actor)) {
    return { kind: 'rejected', reason: 'listing-absent' };
  }
  if (property.lifecycle !== 'listed') {
    return { kind: 'rejected', reason: 'listing-not-live' };
  }
  // 🔴 **Ο ΕΛΕΓΧΟΣ «ΕΧΕΙ ΗΔΗ ΓΡΑΦΕΙΟ;» ΕΦΥΓΕ ΑΠΟ ΕΔΩ** (ADR-832), και δεν
  //    αντικαταστάθηκε από ισοδύναμο: **δεν υπήρχε ισοδύναμο**. Έγραφε
  //    `mandate.kind !== 'self'` — δηλαδή απέρριπτε κάθε δεύτερη ανάθεση **χωρίς να
  //    ρωτήσει το είδος της εντολής**, και μαζί με τη δεύτερη *αποκλειστική* (σωστά)
  //    απέρριπτε και τη δεύτερη **απλή** (λάθος), και την εντολή **άλλης πράξης**
  //    (λάθος), και τη **διαδοχική** (λάθος). Τρία στα τέσσερα.
  //
  // 🔑 Ο πραγματικός κριτής χρειάζεται **τους όρους που προτείνονται** — είδος,
  //    διάστημα, πράξεις — που εδώ δεν είναι γνωστοί. Τρέχει στο
  //    {@link judgeAgainstOccupancy}, μετά τη φόρτωση.
  return property;
}

/**
 * **Τι έχει ήδη συμβεί ανάμεσα σε αυτό το ακίνητο και αυτό το γραφείο.**
 *
 * Δύο φίλτρα ισότητας, **καμία** ταξινόμηση — δες την κεφαλίδα για το γιατί. Το
 * `agencyCompanyId` είναι **και** το πεδίο μισθωτή της συλλογής
 * (`tenant-config.ts`, **CHECK 3.35**), οπότε το ερώτημα είναι εμβέλειας εξ ορισμού.
 *
 * @returns `null` **μόνο** σε βλάβη — ποτέ κενός πίνακας ως «δεν ξέρω» (N.12).
 */
async function loadPairHistory(
  adminDb: AdminFirestore,
  declaration: MandateRequestDeclaration,
): Promise<readonly MandateRequest[] | null> {
  try {
    const found = await adminDb
      .collection(COLLECTIONS.MANDATE_REQUESTS)
      .where('agencyCompanyId', '==', declaration.agencyCompanyId)
      .where('ownerPropertyId', '==', declaration.ownerPropertyId)
      .get();

    return found.docs.map((doc) => {
      const stored = doc.data() as MandateRequestDocument;
      const reading = readStoredRequestStatus(stored.status);

      // 🔴 **Η ΕΠΙΣΚΕΥΗ ΛΕΓΕΤΑΙ.** Μια σιωπηλή μετάφραση είναι αλλοίωση: ο επόμενος
      //    αναγνώστης θα έβλεπε «τελικό όχι» χωρίς να μάθει ποτέ ότι το έγγραφο ήταν
      //    χαλασμένο — και θα το χρέωνε στον μεσίτη.
      if (reading.repaired === 'unreadable') {
        logger.error('[MANDATE-REQUEST] Αίτημα με ΜΗ ΑΝΑΓΝΩΣΙΜΗ κατάσταση — διαβάστηκε ως τελικό όχι', {
          requestId: doc.id,
          storedStatus: String(stored.status),
        });
      }

      return mandateRequestFromStored(stored);
    });
  } catch (error) {
    logger.error('[MANDATE-REQUEST] Η ανάγνωση του ιστορικού απέτυχε — άγνωστο, όχι κενό', {
      agencyCompanyId: declaration.agencyCompanyId,
      ownerPropertyId: declaration.ownerPropertyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * **Είναι αυτή νέα ερώτηση;** — η καρδιά του Δ4, καθαρή και δοκιμάσιμη.
 *
 * ⚠️ **Καμία ανάγνωση, κανένα ρολόι**: παίρνει το ιστορικό και τους όρους, δίνει
 * ετυμηγορία. Έτσι ολόκληρος ο πίνακας της κεφαλίδας ελέγχεται **χωρίς Firestore**.
 */
function judgeAgainstHistory(
  history: readonly MandateRequest[],
  terms: ProposedMandateTerms,
):
  | { readonly kind: 'proceed'; readonly supersedes: string | null }
  | { readonly kind: 'unchanged'; readonly request: MandateRequest }
  | { readonly kind: 'rejected'; readonly reason: MandateRequestRejection } {
  // 🔴 Η αποδοχή ελέγχεται ΠΡΩΤΗ και **ανεξάρτητα από την αγγελία**: ο έλεγχος
  //    `mandate.kind !== 'self'` είναι ο κύριος δρόμος, αυτός εδώ το δίχτυ (N.7.2 #4).
  //    Αν η αποδοχή έγραψε το αίτημα αλλά η εντολή δεν προσγειώθηκε, το ζεύγος
  //    εξακολουθεί να είναι δεσμευμένο.
  if (history.some((request) => request.status === 'accepted')) {
    return { kind: 'rejected', reason: 'listing-already-brokered' };
  }

  const pending = history.find((request) => request.status === 'pending');
  if (pending !== undefined) {
    return sameProposedTerms(pending.terms, terms)
      ? { kind: 'unchanged', request: pending }
      : { kind: 'rejected', reason: 'request-already-pending' };
  }

  // 🔴 **ΤΟ ΤΕΛΙΚΟ «ΟΧΙ» ΚΛΕΙΝΕΙ ΤΗΝ ΠΟΡΤΑ ΑΝΕΞΑΡΤΗΤΑ ΑΠΟ ΤΟΥΣ ΟΡΟΥΣ** — εδώ φεύγει
  //    ο Δ4. Ρωτιέται *«σου έδωσε δικαίωμα;»*, ποτέ *«άλλαξες κάτι;»*.
  //
  // ⚠️ **ΟΠΟΙΟΔΗΠΟΤΕ `declined-final`, όχι το ΤΕΛΕΥΤΑΙΟ.** Μια αλυσίδα δεν μπορεί να
  //    προχωρήσει πέρα από ένα τελικό όχι — αν υπάρχει έστω ένα, κάθε μεταγενέστερο
  //    αίτημα γεννήθηκε **παρακάμπτοντας** αυτόν εδώ τον κριτή, δηλαδή το έγγραφο λέει
  //    ότι κάτι έσπασε. Το «τελικό» σημαίνει τελικό: fail-closed, ποτέ «μα το επόμενο
  //    ήταν πιο ήπιο».
  if (history.some((request) => request.status === 'declined-final')) {
    return { kind: 'rejected', reason: 'request-declined-final' };
  }

  const revisable = latestRevisableDecline(history);
  // 🔑 **Καμία σύγκριση όρων εδώ, και είναι το όλο νόημα**: μετά από ρητό «στείλε
  //    ξανά», οι **ίδιοι** όροι περνούν. Άγκυρα Χ — η μετάλλαξη που ξαναφέρνει το
  //    `sameProposedTerms` σε αυτή τη γραμμή οφείλει να κοκκινίσει.
  return { kind: 'proceed', supersedes: revisable?.id ?? null };
}

/**
 * **Η τελευταία άρνηση ΜΕ ΔΙΚΑΙΩΜΑ ΕΠΑΝΥΠΟΒΟΛΗΣ** — `null` όταν δεν υπάρχει.
 *
 * 🔑 **Ο ρόλος της είναι ΜΟΝΟ ο δείκτης της αλυσίδας** (`supersedesRequestId`), όχι η
 * κρίση: το «περνά ή δεν περνά» το απάντησε ήδη ο έλεγχος του `declined-final` πιο
 * πάνω. Γι' αυτό επιστρέφει έγγραφο και όχι ετυμηγορία — μια συνάρτηση που έκρινε
 * **και** ονομάτιζε θα ήταν δύο ερωτήματα σε μία υπογραφή.
 *
 * ⚠️ Ταξινομεί κατά `decidedAt` και **όχι** κατά `requestedAt`: κρίνεται η **στιγμή
 * της απόφασης**, γιατί αυτή είναι που ο ιδιώτης καλείται να αναθεωρήσει. Δύο
 * αιτήματα μπορούν να έχουν γεννηθεί με άλλη σειρά από αυτήν που απαντήθηκαν.
 *
 * ⚠️ **Δεν φιλτράρει `withdrawn`**, γιατί δεν χρειάζεται: η απόσυρση δεν είναι
 * **άρνηση του γραφείου** και δεν έχει `decidedAt` κριτή να αναθεωρηθεί. Το φίλτρο
 * είναι ονομαστικό πάνω στη μία κατάσταση που δίνει δικαίωμα.
 */
function latestRevisableDecline(
  history: readonly MandateRequest[],
): MandateRequest | null {
  const revisable = history
    .filter((request) => request.status === 'declined-revisable')
    .sort((a, b) => Date.parse(b.decidedAt ?? '') - Date.parse(a.decidedAt ?? ''));

  return revisable[0] ?? null;
}

// =============================================================================
// 4. Η ΓΡΑΦΗ — αμετάβλητα ΠΡΙΝ, ποτέ μετά
// =============================================================================

/**
 * **Συνθέτει, ΚΡΙΝΕΙ, και μόνο τότε γράφει.**
 *
 * 🔴 **Τα αμετάβλητα τρέχουν ΠΡΙΝ το `setDoc`, και είναι το όλο νόημα.** Ένα άκυρο
 * έγγραφο που γράφτηκε και «θα καθαριστεί μετά» είναι νομικό κείμενο με ημερομηνία
 * στη βάση — και το `read: false` σημαίνει ότι **κανείς δεν θα το δει** για να το
 * διορθώσει.
 *
 * 🔴 **`setDoc` με ταυτότητα από το `enterprise-id` (N.6), ΠΟΤΕ `addDoc`.** Ο
 * γεννήτορας `mreq_*` υπήρχε στην κλάση από τη Φάση Α· αυτή η διαδρομή είναι ο πρώτος
 * του καταναλωτής.
 */
async function writeRequest(
  adminDb: AdminFirestore,
  actor: ListingActor,
  declaration: MandateRequestDeclaration,
  supersedesRequestId: string | null,
  nowISO: string,
): Promise<MandateRequestWriteResult> {
  const request: MandateRequest = {
    id: generateMandateRequestId(),
    ownerPropertyId: declaration.ownerPropertyId,
    requestedByUserId: actor.uid,
    agencyCompanyId: declaration.agencyCompanyId,
    // ⚠️ Καρφωμένο, και σωστά: αυτή η πόρτα δέχεται **μόνο** τον ιδιοκτήτη. Το
    //    `'agency'` θα το γράψει η **αντίστροφη** πράξη (το γραφείο προσεγγίζει), που
    //    έχει άλλον φρουρό και δεν υπάρχει ακόμη.
    initiatedBy: 'owner',
    status: 'pending',
    terms: declaration.terms,
    requestedAt: nowISO,
    seenAt: null,
    decidedAt: null,
    // 🔑 §8.4 — η `cont_*` γεννιέται **μόνο** με την αποδοχή. Το αμετάβλητο
    //    `request-contact-inconsistent` το επιβάλλει, οπότε αυτό εδώ **δεν είναι
    //    σύμβαση σε σχόλιο**: μια αλλαγή σε `'cont_x'` θα κοκκίνιζε παρακάτω.
    clientContactId: null,
    supersedesRequestId,
  };

  const violations = mandateRequestInvariantViolations(request, nowISO);
  if (violations.length > 0) return { kind: 'invalid', violations };

  try {
    await adminDb.collection(COLLECTIONS.MANDATE_REQUESTS).doc(request.id).set(request);
    return { kind: 'created', request };
  } catch (error) {
    logger.error('[MANDATE-REQUEST] Η γραφή απέτυχε', {
      requestId: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}
