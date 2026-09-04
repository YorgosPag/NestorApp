import 'server-only';

/**
 * @fileoverview **ΟΙ ΔΥΟ ΠΡΟΒΟΛΕΣ, ΚΑΙ ΤΟ «ΓΙΑΤΙ ΤΑΙΡΙΑΖΕΙ»** — ADR-843 §10.2.
 * @related types/first-contact.ts · lib/demand/demand-match-axes.ts · services/contact/first-contact.service.ts
 * @module services/contact/first-contact-projection
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΙ ΑΝΑΓΝΩΣΕΙΣ ΖΟΥΝ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟΝ ΠΕΛΑΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `first_contacts` είναι `read: false` **και** `write: false` (ADR-843 §10.5), και
 * ο **τρίτος** λόγος του — αυτός που το `mandate_requests` δεν έχει — είναι η
 * **χωρητικότητα**: το όριο κρίνεται **μετρώντας**, και κανόνας Firestore **δεν μετρά
 * έγγραφα**. Άρα ο μετρητής και ο γραφέας οφείλουν να είναι **ο ίδιος διακομιστής**.
 *
 * ⛔ **Αν βρεθείς να γράφεις `onSnapshot('first_contacts')`, έχεις ήδη σπάσει το §10.5.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΟΡΙΟ ΤΟΥ «ΓΙΑΤΙ»: ΤΑΞΙΔΕΥΟΥΝ ΟΙ **ΑΞΟΝΕΣ**, ΠΟΤΕ ΤΑ **ΜΕΓΕΘΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η μηχανή ταιριάσματος γυρίζει {@link DemandGaps} με **ακριβή** νούμερα
 * (`priceOverBy` · `areaShortBy` · …). Ο προσφέρων **ξέρει τη δική του τιμή** ⇒
 * `τιμή − priceOverBy` = **η οροφή προϋπολογισμού του ζητούντος, στο ευρώ**.
 *
 * 🔑 *Ο ζητών διάλεξε να αποκαλύψει **ποιος είναι**, όχι **πόσο μπορεί να δώσει**.*
 *
 * ⚠️ **Ο φρουρός είναι Η ΑΠΟΥΣΙΑ ΠΕΔΙΟΥ**: το {@link MatchReason} **δεν έχει θέση**
 * για μέγεθος. Γι' αυτό αυτό το αρχείο διαβάζει `blockers` και **πετά τα `gaps`** —
 * και η πράξη αυτή είναι **μία γραμμή**, σε **ένα** σημείο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΡΕΙΣ ΑΞΟΝΕΣ ΚΑΙ ΟΧΙ ΤΟ `matchDemandAgainstListing`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πλήρης μηχανή κρίνει **πέντε** οικογένειες. Οι δύο τελευταίες σήμερα δεν έχουν
 * είσοδο — και το λένε **ονομαστικά**:
 *
 * | Οικογένεια | Είσοδος σήμερα | Τι θα έβγαζε |
 * |---|---|---|
 * | κατηγορία · αριθμοί · χώρος | **υπάρχουν** | πραγματική κρίση |
 * | διαθεσιμότητα | `null` *(δεν αντλείται από το BIM)* | `availability-unknown` |
 * | γειτονιά (Ζ6) | `{}` *(δεν μετρώνται POI)* | `proximity-unknown` |
 *
 * 🔑 **Ένα εμπόδιο ΑΓΝΟΙΑΣ είναι ΔΙΚΟ ΜΑΣ χρέος, όχι αστοχία της αγγελίας.** Σταλμένο
 * στον προσφέροντα θα διαβαζόταν *«δεν σου ταιριάζει»* ενώ σημαίνει *«δεν ρωτήσαμε»* —
 * ακριβώς η διάκριση `never-asked` ⇄ `owner-declined` που το έργο τηρεί αλλού (Α5).
 *
 * ⇒ Ταξιδεύουν **μόνο** οι άξονες που **κριθήκαν**, και το {@link MatchReason.declaredAxes}
 * μετρά **τους ίδιους** — αλλιώς το *«αστοχεί σε 1 από 9»* θα μετρούσε παρονομαστή
 * που κανείς δεν εξέτασε.
 *
 * **Layering**: server — Admin SDK ως **όρισμα**, ποτέ singleton· καμία ανάγνωση ρολογιού.
 */

import type {
  Firestore as AdminFirestore,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { contactCapacityOf, type ContactCapacity } from '@/lib/contact/first-contact-capacity';
import {
  categoryBlockers,
  numericOutcome,
  spatialOutcome,
} from '@/lib/demand/demand-match-axes';
import { discloseDemand } from '@/lib/demand/demand-aggregate';
import type { ListingMatchFacts } from '@/lib/demand/demand-match-vocabulary';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import { createModuleLogger } from '@/lib/telemetry';
import type { PropertyDemand } from '@/types/property-demand';
import {
  disclosedToOfferer,
  firstContactFromStored,
  shownToSeeker,
  type FirstContact,
  type FirstContactDocument,
  type FirstContactForSeeker,
  type MatchReason,
} from '@/types/first-contact';
import type { FirstContactInboxEntry } from '@/services/contact/first-contact-vocabulary';

const logger = createModuleLogger('first-contact-projection');

// =============================================================================
// 1. ΤΟ «ΓΙΑΤΙ ΤΑΙΡΙΑΖΕΙ» — ΑΞΟΝΕΣ ΜΕΣΑ, ΜΕΓΕΘΗ ΣΤΟΝ ΚΑΔΟ
// =============================================================================

/**
 * **Οι άξονες που ο ζητών ΔΗΛΩΣΕ** — ο παρονομαστής του μηνύματος.
 *
 * 🔑 **Μετρά ΑΚΡΙΒΩΣ ό,τι κρίνει το {@link composeMatchReason}**, ούτε έναν παραπάνω.
 * Ένας παρονομαστής που περιλαμβάνει άξονες τους οποίους **δεν εξετάσαμε** κάνει το
 * *«αστοχεί σε 1 από 9»* να ακούγεται καλύτερο απ' ό,τι ξέρουμε — δηλαδή ψεύδεται
 * προς τα πάνω, ακριβώς εκεί που ο άνθρωπος παίρνει απόφαση.
 *
 * ⚠️ **Το είδος διάθεσης μετράει ΠΑΝΤΑ**: κενό `seeks` είναι αδύνατο (αμετάβλητο της
 * ζήτησης), άρα κάθε ζήτηση δηλώνει **τουλάχιστον έναν** άξονα.
 */
function declaredAxesOf(demand: PropertyDemand): number {
  const f = demand.features;
  const declared: readonly boolean[] = [
    true,
    f.types.length > 0,
    f.priceMax !== null || f.priceMin !== null,
    f.areaMin !== null || f.areaMax !== null,
    f.bedroomsMin !== null,
    f.floorMin !== null || f.floorMax !== null,
    demand.place.kind !== 'anywhere',
  ];

  return declared.filter(Boolean).length;
}

/**
 * **Γιατί αυτός ο άνθρωπος πλησίασε αυτή την αγγελία** — άξονες, ποτέ αριθμοί.
 *
 * 🔴 **ΤΟ `gaps` ΤΟΥ {@link numericOutcome} ΑΓΝΟΕΙΤΑΙ ΕΠΙΤΗΔΕΣ, ΚΑΙ ΕΙΝΑΙ ΤΟ
 * ΣΟΒΑΡΟΤΕΡΟ ΠΡΑΓΜΑ ΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ.** Δες την κεφαλίδα: η αφαίρεση δίνει την
 * οροφή προϋπολογισμού στο ευρώ. Μια «μικρή βελτίωση» που το προσθέτει στην προβολή
 * **δεν είναι λεπτομέρεια υλοποίησης — είναι απόφαση αποκάλυψης**, και θα την πλήρωνε
 * άνθρωπος που δεν θα το μάθαινε ποτέ.
 *
 * ⚠️ **Στιγμιότυπο, ΟΧΙ ζωντανός υπολογισμός**: καλείται **μία φορά**, τη στιγμή της
 * πράξης, και το αποτέλεσμα **γράφεται** στο έγγραφο. Η πράξη είναι γεγονός του
 * παρελθόντος με ημερομηνία (άρθρο 200 §1 Ν.4072/2012) — αν ο ζητών αλλάξει αύριο τα
 * κριτήριά του, το *«γιατί σε πλησίασα **τότε**»* δεν επιτρέπεται να αλλάξει.
 *
 * @param facts — η αγγελία **και** ο δεσμός τόπου. Η διαθεσιμότητα και οι αποστάσεις
 *   γειτονιάς **δεν** διαβάζονται από εδώ (δες την κεφαλίδα), οπότε ο καλών δεν
 *   χρειάζεται να τις μαντέψει.
 * @param nowISO — η **περασμένη** στιγμή· την κρίνει η φρεσκάδα της ζήτησης, ποτέ
 *   ρολόι μέσα στη συνάρτηση.
 * @returns `null` = *«δεν το ξέρουμε»* — **υπαρκτή και διαφορετική** απάντηση από το
 *   κενό `unmetAxes`, που σημαίνει *«ταιριάζει σε όλα όσα δήλωσε»*.
 */
export function composeMatchReason(
  demand: PropertyDemand,
  facts: ListingMatchFacts,
  nowISO: string,
): MatchReason | null {
  // 🔴 **Ο ΚΡΙΤΗΣ ΤΗΣ ΑΠΟΚΑΛΥΨΗΣ ΕΙΝΑΙ Ο ΈΝΑΣ** — ο ίδιος που κρίνει κάθε άλλη έξοδο
  //    του επιπέδου Β. Για το `approached-offerer` το κατώφλι είναι **1** — ο ίδιος ο
  //    άνθρωπος πάτησε το κουμπί — άρα η **μόνη** πόρτα που μένει κλειστή είναι
  //    η λογιστική του `censusDemands`: ζήτηση **κλειστή** ή **μπαγιάτικη**.
  //
  // 🔑 **Και είναι σωστό να σωπαίνει τότε**: το «γιατί ταιριάζει» είναι **ισχυρισμός
  //    για ζωντανή αναζήτηση**. Βγαλμένο από νεκρό ή παλιωμένο αρχείο είναι η
  //    **ψευδής διαβεβαίωση** που το §10.5 ονομάζει. Το `null` λέει *«δεν το ξέρουμε»*
  //    — και η πράξη **στέκει και χωρίς λόγο**: ο άνθρωπος συστήθηκε, και αυτό αρκεί.
  if (discloseDemand([demand], 'approached-offerer', nowISO).count === null) return null;

  const unmetAxes = [
    ...categoryBlockers(demand, facts.listing),
    // 🔴 **ΜΟΝΟ `blockers`.** Το `gaps` μένει εδώ και πεθαίνει εδώ.
    ...numericOutcome(demand, facts.listing).blockers,
    ...spatialOutcome(demand, facts).blockers,
  ];

  return { unmetAxes, declaredAxes: declaredAxesOf(demand) };
}

// =============================================================================
// 2. Η ΟΨΗ ΤΟΥ ΖΗΤΟΥΝΤΟΣ — οι πράξεις του, και ο ΧΩΡΟΣ που του μένει
// =============================================================================

/** Ό,τι βλέπει ο ζητών στην οθόνη *«οι επαφές μου»*. */
export interface SeekerContactView {
  readonly contacts: readonly FirstContactForSeeker[];
  /**
   * 🔑 **Ταξιδεύει ΜΑΖΙ με τις πράξεις, όχι σε δεύτερη κλήση.** Το *«απομένουν 3»*
   * και η λίστα που το παράγει πρέπει να είναι **η ίδια ανάγνωση** — αλλιώς η οθόνη
   * μπορεί να δείξει δέκα ανοιχτές και «απομένουν 2», και ο άνθρωπος να μετρήσει.
   */
  readonly capacity: ContactCapacity;
}

export type SeekerContactLoad =
  | { readonly kind: 'ready'; readonly view: SeekerContactView }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με «καμία επαφή» (N.12). */
  | { readonly kind: 'unavailable' };

/**
 * **Οι πράξεις ενός ανθρώπου, ΟΛΕΣ** — ανοιχτές και αποσυρμένες.
 *
 * ⚠️ **Καμία `orderBy`, και είναι απόφαση** (CHECK 3.15): ένα φίλτρο ισότητας χωρίς
 * ταξινόμηση σερβίρεται από **μονοπεδιακό** ευρετήριο, ενώ ένα `orderBy('createdAt')`
 * θα απαιτούσε **σύνθετο** — για σύνολο που το **ΠΕ5 φράζει στις δέκα ανοιχτές**. Η
 * ταξινόμηση γίνεται **στη μνήμη**, και ο λόγος γράφεται εδώ ώστε ο επόμενος να μη
 * «διορθώσει» τη λείπουσα `orderBy`.
 *
 * ⚠️ Οι **αποσυρμένες** δεν φιλτράρονται στο ερώτημα: τις χρειάζεται και η οθόνη
 * *(«τι έχω κάνει»)* και ο μετρητής *(που μετρά **μόνο** τις ανοιχτές, μόνος του)*.
 * Δύο ερωτήματα για το ίδιο σύνολο θα ήταν δύο αριθμοί που μπορούν να διαφωνήσουν.
 */
export async function readSeekerContacts(
  adminDb: AdminFirestore,
  seekerUserId: string,
): Promise<SeekerContactLoad> {
  const contacts = await loadSeekerContacts(adminDb, seekerUserId);
  if (contacts === null) return { kind: 'unavailable' };

  return {
    kind: 'ready',
    view: {
      contacts: byNewestFirst(contacts).map(shownToSeeker),
      capacity: contactCapacityOf(contacts),
    },
  };
}

/**
 * **Η ΜΙΑ ανάγνωση των πράξεων ενός ζητούντος** — και ο γραφέας καλεί **αυτήν**.
 *
 * 🔑 Εξάγεται ώστε η **χωρητικότητα** να κρίνεται από το **ίδιο** σύνολο που βλέπει
 * ο άνθρωπος. Δύο ερωτήματα με «σχεδόν ίδια» φίλτρα είναι δύο απαντήσεις στο ίδιο
 * ερώτημα (ADR-749), και η μία θα αποκλίνει προς την πλευρά που δέχεται την ενδέκατη.
 *
 * @returns `null` **μόνο** σε βλάβη — ποτέ κενός πίνακας ως «δεν ξέρω» (N.12).
 */
export async function loadSeekerContacts(
  adminDb: AdminFirestore,
  seekerUserId: string,
): Promise<readonly FirstContact[] | null> {
  try {
    const found = await adminDb
      .collection(COLLECTIONS.FIRST_CONTACTS)
      .where('seekerUserId', '==', seekerUserId)
      .get();

    return found.docs.map((doc) => contactFromDocument(doc.data() as FirstContactDocument, doc.id));
  } catch (error) {
    logger.error('[FIRST-CONTACT] Η ανάγνωση των πράξεων απέτυχε — άγνωστο, όχι κενό', {
      seekerUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// =============================================================================
// 3. Η ΟΨΗ ΤΟΥ ΠΡΟΣΦΕΡΟΝΤΟΣ — και η ΣΦΡΑΓΙΔΑ που οφείλει να μπει εδώ
// =============================================================================

export type OffererInboxLoad =
  | { readonly kind: 'ready'; readonly entries: readonly FirstContactInboxEntry[] }
  | { readonly kind: 'unavailable' };

/**
 * **Τα εισερχόμενα ενός στόχου** — αγγελίες *(κατά ταυτότητα)* ή βιτρίνα *(κατά χώρο)*.
 *
 * 🔴 **Η ΣΦΡΑΓΙΔΑ `seenAt` ΜΠΑΙΝΕΙ ΕΔΩ, ΚΑΙ ΟΧΙ ΣΕ ΟΘΟΝΗ ΛΕΠΤΟΜΕΡΕΙΑΣ — ΓΙΑΤΙ ΔΕΝ
 * ΥΠΑΡΧΕΙ ΟΘΟΝΗ ΛΕΠΤΟΜΕΡΕΙΑΣ.** Ο φρουρός **Κ7 #1** επιβάλλει τα στοιχεία του
 * ζητούντος να φαίνονται **ΔΙΠΛΑ, πάντα, χωρίς κλικ**. Άρα η στιγμή που ο προσφέρων
 * ανοίγει τη λίστα **είναι** η στιγμή που είδε το τηλέφωνο — και το `seenAt` είναι ο
 * **μόνος** λόγος που η οθόνη της απόσυρσης μπορεί να πει *«ό,τι είδε, το είδε»*
 * (Κ10) χωρίς να το μαντεύει.
 *
 * ⚠️ **Ταξινόμηση στη μνήμη** — δες {@link readSeekerContacts} για το γιατί (3.15).
 */
export async function readOffererInbox(
  adminDb: AdminFirestore,
  actor: ListingActor,
  nowISO: string,
): Promise<OffererInboxLoad> {
  const collected = await collectAddressedContacts(adminDb, actor);
  if (collected === null) return { kind: 'unavailable' };

  const stamped = await stampSeen(adminDb, collected, nowISO);

  return {
    kind: 'ready',
    entries: byNewestFirst(stamped).map((contact) => ({
      ...disclosedToOfferer(contact),
      seenAt: contact.seenAt,
    })),
  };
}

/**
 * **Όλα τα εισερχόμενα του προσφέροντος** — *«ποιες πράξεις απευθύνονται σε εμένα;»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΕΡΩΤΗΣΗ ΑΛΛΑΞΕ, ΚΑΙ ΓΙ' ΑΥΤΟ ΧΩΡΕΣΕ (ADR-843 §10.16)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι τις 2026-09-04 ρωτούσαμε **δύο** ερωτήσεις σε σειρά: *«ποιες αγγελίες είναι
 * δικές μου;»* και μετά *«ποιες πράξεις δείχνουν σε αυτές;»* — με `in` ερωτήματα των
 * **30** πάνω σε ταυτότητες. Είχε **δύο** ελαττώματα, και το δεύτερο ήταν αθεράπευτο:
 *
 * 1. 🔴 Η πρώτη ερώτηση σάρωνε **μόνο** το `owner_properties` ⇒ το εισερχόμενο του
 *    **γραφείου δεν έβρισκε ποτέ** τις δικές του αγγελίες (§10.15).
 * 2. 🔴 Και δεν αρκούσε να προστεθεί το `properties`: για το γραφείο, *«τα ακίνητά
 *    μου»* είναι **κάθε μονάδα κάθε κτιρίου κάθε έργου**. Εκατοντάδες έγγραφα, μετά
 *    δεκάδες ερωτήματα των 30 — **ανά άνοιγμα οθόνης**.
 *
 * 🔑 **Η θεραπεία δεν είναι καλύτερο ερώτημα — είναι ΑΛΛΗ ερώτηση.** Η πράξη κουβαλά
 * πλέον τον **παραλήπτη** της ({@link FirstContact.offerer}), γραμμένο από τον κριτή
 * τη στιγμή που τον υπολόγισε. Άρα εδώ ρωτιούνται **δύο ισότητες**, χωρίς σάρωση
 * αγγελιών, χωρίς chunking, και —το σημαντικότερο— **χωρίς αυτό το αρχείο να ξέρει
 * ότι υπάρχουν οικογένειες αγγελιών**. Μια τρίτη αύριο δεν το αφορά καθόλου.
 *
 * ⚠️ **Ο ιδιωτικός χώρος ΔΕΝ διευρύνεται**: το προσωπικό σκέλος απαντά **μόνο** στον
 * ίδιο, και το εταιρικό ρωτιέται **μόνο** από όποιον έχει πραγματική εταιρεία —
 * κενό `companyId` δεν είναι μισθωτής, είναι **απουσία** μισθωτή (`hasTenant`).
 *
 * 🔑 **Τα δύο σκέλη είναι ΞΕΝΑ μεταξύ τους**: μια πράξη έχει **έναν** παραλήπτη, και
 * η {@link ListingCustody} είναι διακριτή ένωση — άρα δεν υπάρχει έγγραφο που να
 * ταιριάζει και στα δύο. *(Πριν, μια πράξη προς αγγελία γραφείου ταίριαζε **και στα
 * δύο** ερωτήματα, και χρειαζόταν χάρτης-φρουρός για να μην εμφανιστεί δύο φορές.)*
 * Ο χάρτης **μένει** ως ζώνη-και-τιράντες (N.7.2 #4), όχι ως αναγκαιότητα.
 *
 * @returns `null` **μόνο** σε βλάβη — κενός πίνακας σημαίνει «κανείς» (N.12).
 */
async function collectAddressedContacts(
  adminDb: AdminFirestore,
  actor: ListingActor,
): Promise<readonly FirstContact[] | null> {
  const byId = new Map<string, FirstContact>();
  const contacts = adminDb.collection(COLLECTIONS.FIRST_CONTACTS);

  try {
    // tenant-scope-exempt: ο άξονας απομόνωσης του `first_contacts` είναι ο ΖΗΤΩΝ
    // (`seekerUserId`)· τα εισερχόμενα του προσφέροντος διασχίζουν εξ ορισμού πολλούς
    // ζητούντες. Η εμβέλεια είναι ο ΔΙΚΟΣ ΤΟΥ χώρος, από την ΑΠΟΔΕΙΞΗ — ποτέ από το δίκτυο.
    collect(byId, await contacts.where('offerer.userId', '==', actor.uid).get());

    if (actor.companyId !== null && actor.companyId.length > 0) {
      // tenant-scope-exempt: ίδιος λόγος — ο χώρος του γραφείου, από την απόδειξη.
      collect(byId, await contacts.where('offerer.companyId', '==', actor.companyId).get());
    }

    return [...byId.values()];
  } catch (error) {
    logger.error('[FIRST-CONTACT] Η ανάγνωση των εισερχομένων απέτυχε — άγνωστο, όχι κενό', {
      uid: actor.uid,
      companyId: actor.companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * **Μαζεύει σε χάρτη κατά ταυτότητα** — ζώνη και τιράντες για τα διπλότυπα.
 *
 * ⚠️ **Ήταν ΑΝΑΓΚΑΙΟΣ, τώρα είναι ΦΡΟΥΡΟΣ.** Όσο η εμβέλεια ρωτιόταν με δύο
 * ασύνδετα ερωτήματα *(«η αγγελία είναι δική του» **και** «ο χώρος είναι δικός
 * του»)*, μια πράξη προς αγγελία γραφείου ταίριαζε **και στα δύο** και θα φαινόταν
 * ως **δύο άνθρωποι**. Με τον έναν παραλήπτη ανά πράξη αυτό είναι πλέον αδύνατο —
 * ο χάρτης μένει γιατί το κόστος του είναι **μηδέν** και η ζημιά που απέτρεπε
 * **ανιχνεύσιμη μόνο από άνθρωπο**.
 */
function collect(
  into: Map<string, FirstContact>,
  snapshot: { readonly docs: readonly QueryDocumentSnapshot[] },
): void {
  for (const doc of snapshot.docs) {
    into.set(doc.id, contactFromDocument(doc.data() as FirstContactDocument, doc.id));
  }
}

/**
 * **Σφραγίζει το `seenAt` — ΜΙΑ φορά ανά πράξη.**
 *
 * 🔑 **Ιδεμποτεντ εκ σχεδιασμού, όχι με κλείδωμα**: γράφει **μόνο** όταν το `seenAt`
 * είναι `null`. Έτσι μια διπλή απόδοση της React ή ένα refresh είναι **αβλαβή**.
 * *Η πρώτη ματιά είναι το γεγονός*· η δέκατη δεν αλλάζει καμία απόφαση.
 *
 * ⚠️ **Δεν πετά ΠΟΤΕ.** Είναι **παρατήρηση**, όχι πράξη ανθρώπου: αστοχία εδώ δεν
 * επιτρέπεται να εμποδίσει τον προσφέροντα να **δει** ποιος τον πλησίασε. Και οι
 * επιστρεφόμενες πράξεις κρατούν τη **σφραγίδα της βάσης** μόνο αν η γραφή πέτυχε —
 * η οθόνη λέει την αλήθεια της βάσης, όχι την πρόθεσή μας.
 *
 * ⛔ **ΜΗΝ το κάνεις `update({ seenAt })` χωρίς τον έλεγχο**: θα μετακινούσε τη
 * σφραγίδα σε κάθε άνοιγμα, και το «πότε το είδε» θα ήταν πάντα «μόλις τώρα».
 */
async function stampSeen(
  adminDb: AdminFirestore,
  contacts: readonly FirstContact[],
  nowISO: string,
): Promise<readonly FirstContact[]> {
  const unseen = contacts.filter((contact) => contact.seenAt === null);
  if (unseen.length === 0) return contacts;

  try {
    const batch = adminDb.batch();
    for (const contact of unseen) {
      batch.update(
        adminDb.collection(COLLECTIONS.FIRST_CONTACTS).doc(contact.id),
        { seenAt: nowISO },
      );
    }
    await batch.commit();
  } catch (error) {
    logger.error('[FIRST-CONTACT] Η σφραγίδα ανάγνωσης απέτυχε — η προβολή μένει ΑΣΦΡΑΓΙΣΤΗ', {
      unseen: unseen.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return contacts;
  }

  return contacts.map((contact) => (contact.seenAt === null ? { ...contact, seenAt: nowISO } : contact));
}

// =============================================================================
// 4. ΚΟΙΝΑ — μία ανάγνωση εγγράφου, μία ταξινόμηση
// =============================================================================

/**
 * **Αποθηκευμένο → πράξη, με την επισκευή ΕΙΠΩΜΕΝΗ.**
 *
 * 🔴 Μια σιωπηλή μετάφραση είναι **αλλοίωση**: πράξη με μη αναγνώσιμη κατάσταση
 * διαβάζεται ως **αποσυρμένη** *(fail-closed — δες `readStoredLifecycle`)*, και ο
 * επόμενος αναγνώστης θα έβλεπε «την απέσυρε» χωρίς να μάθει ποτέ ότι **εμείς** δεν
 * καταλάβαμε το έγγραφο. Ο αδύναμος θα φορούσε τη βεβαιότητα του δυνατού.
 *
 * ⚠️ **Η ταυτότητα έρχεται από τον ΔΕΙΚΤΗ, όχι από το σώμα**: το `doc.id` είναι το
 * μόνο που δεν μπορεί να έχει αποκλίνει.
 */
export function contactFromDocument(stored: FirstContactDocument, docId: string): FirstContact {
  const { contact, repaired } = firstContactFromStored({ ...stored, id: docId });

  if (repaired === 'unreadable') {
    logger.error('[FIRST-CONTACT] Πράξη με ΜΗ ΑΝΑΓΝΩΣΙΜΗ κατάσταση — διαβάστηκε ως αποσυρμένη', {
      contactId: docId,
      storedLifecycle: String(stored.lifecycle),
    });
  }

  return contact;
}

/**
 * **Νεότερη πρώτη** — στη μνήμη, ποτέ στο ερώτημα (CHECK 3.15).
 *
 * ⚠️ Ο άξονας είναι το `createdAt`, δηλαδή **πότε έγινε η πράξη** — όχι πότε την
 * είδαμε ή πότε αποσύρθηκε. Η σειρά που βλέπει ο άνθρωπος είναι η σειρά που συνέβησαν.
 */
function byNewestFirst(contacts: readonly FirstContact[]): readonly FirstContact[] {
  return [...contacts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

