import 'server-only';

/**
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ** — ADR-843 ΠΕ1–ΠΕ6.
 * @related types/first-contact.ts · first-contact-guards.ts · lib/contact/first-contact-capacity.ts
 * @module services/contact/first-contact.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΚΑΘΕ ΓΡΑΦΗ ΠΕΡΝΑ ΥΠΟΧΡΕΩΤΙΚΑ ΑΠΟ ΕΔΩ — ΤΡΕΙΣ ΛΟΓΟΙ, Ο ΤΡΙΤΟΣ ΕΙΝΑΙ ΝΕΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `firestore.rules` δίνει στο `first_contacts` **`read: false` ΚΑΙ `write: false`**.
 * Οι δύο πρώτοι λόγοι είναι του `mandate_requests` αυτούσιοι *(το ωμό έγγραφο λέει
 * περισσότερα από την πράξη· η αποκάλυψη **υπολογίζεται** και οφείλει να τρέξει στην
 * ίδια πλευρά με τον συνθέτη)*. Ο **τρίτος** είναι δικός του:
 *
 * > 🔴 **Η ΧΩΡΗΤΙΚΟΤΗΤΑ ΚΡΙΝΕΤΑΙ ΜΕΤΡΩΝΤΑΣ, ΚΑΙ ΚΑΝΟΝΑΣ FIRESTORE ΔΕΝ ΜΕΤΡΑ ΕΓΓΡΑΦΑ.**
 * > Πελάτης που γεννά ταυτότητες και γράφει μόνος του θα έγραφε την **ενδέκατη
 * > παράλληλα με τη δέκατη**, και το ΠΕ5 θα ήταν διακόσμηση. Ο γραφέας πρέπει να
 * > είναι **ΕΝΑΣ**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΣΕΙΡΑ ΤΩΝ ΦΡΟΥΡΩΝ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΥΦΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | # | Ερώτηση | Πού ζει | Γιατί εκεί |
 * |---|---|---|---|
 * | 1 | *«το έχεις ήδη κάνει;»* | `first-contact-admission` | **Ιδεμποτησία πρώτη** (Stripe): το δεύτερο πάτημα δεν επιτρέπεται **ούτε** να ξοδέψει δεύτερη θέση **ούτε** να ακούσει «γέμισε» για κάτι που **πέτυχε** |
 * | 2 | *«χωράει άλλη μία;»* | `first-contact-admission` | Η **μία** ανάγνωση έχει ήδη γίνει για το (1). Και όταν είσαι γεμάτος **καμία** πράξη δεν περνά ⇒ το «γέμισε» είναι η αληθινή **και** ενεργήσιμη απάντηση |
 * | 3 | *«υπάρχει ο στόχος, και δεν είσαι εσύ;»* | `first-contact-admission` | Πληρώνει ανάγνωση — δεν την πληρώνουμε για κάποιον που δεν μπορεί να πράξει |
 * | 4 | *«η ζήτηση που επικαλείσαι είναι δική σου;»* | **εδώ** | Ο **λόγος** γράφεται μόνο αφού ο **στόχος** σταθεί — και κρίνει ό,τι **δηλώθηκε**, όχι το αν γίνεσαι δεκτός |
 *
 * 🔴 **ΟΙ ΤΡΕΙΣ ΠΡΩΤΟΙ ΕΦΥΓΑΝ ΣΤΟ §10.18, ΚΑΙ Η ΣΕΙΡΑ ΤΟΥΣ ΤΑΞΙΔΕΨΕ ΜΑΖΙ ΤΟΥΣ.** Είναι
 * **μία** ερώτηση — *«γίνεσαι δεκτός;»* — και τη ρωτά πλέον **και η οθόνη**, πριν βάψει
 * το κουμπί. ⛔ **ΜΗΝ τους ξαναγράψεις εδώ**: αν βρεθείς να καλείς `loadSeekerContacts`
 * ή `resolveTarget` σε αυτό το αρχείο, φτιάχνεις **δεύτερη αυθεντία** για το
 * «επιτρέπεσαι» — και η οθόνη θα λέει άλλα από τον γραφέα την ημέρα που θα αποκλίνουν.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΚΑΜΙΑ `EntityAuditService.recordChange()` — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `first_contacts` **δεν είναι audit-tracked** (CHECK 3.17). Η πράξη **είναι ήδη
 * το ίχνος**: έγγραφο με ημερομηνία, δύο καταστάσεις, και `withdrawnAt` που κρατά το
 * **πότε**. Ένα δεύτερο βιβλίο δίπλα του θα ήταν **δεύτερη αλήθεια** για το ίδιο
 * γεγονός (ADR-749) — ακριβώς το σχήμα που το §10.5 απαγόρευσε ονομαστικά για το
 * `disclosure_log`.
 *
 * ⚠️ **Η ΑΚΜΗ ΤΟΥ ADR-834 ΔΕΝ ΓΕΝΝΙΕΤΑΙ ΕΔΩ.** Ο ένας στις Επαφές του άλλου γεννιέται
 * **μετά τη συμφωνία**, όχι με την πρώτη επαφή — και γράψιμο στο `CONTACTS` **ανάβει**
 * το CHECK 3.17, δηλαδή απαιτεί audit trail. Δική της πράξη, δικό της commit.
 */

import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { canOpenAnotherContact } from '@/lib/contact/first-contact-capacity';
import type { ListingActor, ListingCustody } from '@/lib/owner-property/listing-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { admitFirstContact } from '@/services/contact/first-contact-admission';
import { resolveMatchReason } from '@/services/contact/first-contact-guards';
import { contactFromDocument } from '@/services/contact/first-contact-projection';
import {
  refuseFirstContact as refuse,
  FIRST_CONTACT_UNAVAILABLE as UNAVAILABLE,
  type FirstContactDeclaration,
  type FirstContactWithdrawResult,
  type FirstContactWriteResult,
} from '@/services/contact/first-contact-vocabulary';
import { generateFirstContactId } from '@/services/enterprise-id-convenience';
import {
  firstContactInvariantViolations,
  sameFirstContactTarget,
  shownToSeeker,
  type FirstContact,
  type FirstContactDocument,
  type MatchReason,
} from '@/types/first-contact';

const logger = createModuleLogger('first-contact.service');

// =============================================================================
// 1. Η ΠΡΑΞΗ — «σε πλησιάζω»
// =============================================================================

/**
 * **Ο ζητών κάνει την πρώτη κίνηση.**
 *
 * 🔑 **Η πρώτη κίνηση ανήκει σε αυτόν, και δεν είναι επιλογή σχεδίασης**: η αγγελία
 * δημοσιεύτηκε με ρητή πράξη· η **ζήτηση ποτέ**. Ο προσφέρων δεν έχει **σε ποιον** να
 * απευθυνθεί — δεν του το απαγορεύουμε, **δεν υπάρχει παραλήπτης** (ADR-843 §1).
 *
 * @param nowISO — η **περασμένη** στιγμή· κανένα ρολόι εδώ μέσα, ώστε τα άκρα να
 *   είναι δοκιμάσιμα. Ίδιο ιδίωμα με τον γραφέα του αιτήματος ανάθεσης.
 */
export async function openFirstContact(
  adminDb: AdminFirestore,
  actor: ListingActor,
  declaration: FirstContactDeclaration,
  nowISO: string,
): Promise<FirstContactWriteResult> {
  // 🔑 **ΟΙ ΤΡΕΙΣ ΠΡΩΤΟΙ ΦΡΟΥΡΟΙ ΗΤΑΝ ΜΙΑ ΕΡΩΤΗΣΗ, ΚΑΙ ΕΦΥΓΑΝ** (§10.18): *«γίνεσαι
  //    δεκτός;»*. Έφυγαν επειδή τη ρωτά πλέον **και η οθόνη, πριν βάψει το κουμπί** —
  //    και ό,τι μένει ενσωματωμένο μέσα σε πράξη **γραφής** είναι απρόσιτο σε κάθε
  //    άλλον. Ίδιο σχήμα με το §10.17, μία ερώτηση πιο πάνω.
  const admission = await admitFirstContact(adminDb, actor, declaration.target, nowISO);
  if (admission.kind !== 'admitted') return admission;

  const reason = await resolveMatchReason(
    adminDb, actor, declaration.demandId, admission.located.facts, nowISO,
  );
  if (reason.kind !== 'reason') return reason;

  return writeContact(
    adminDb, actor, declaration, admission.located.custody, reason.matchReason, nowISO,
  );
}

// =============================================================================
// 2. Η ΓΡΑΦΗ — αμετάβλητα ΠΡΙΝ, χωρητικότητα ΜΕΣΑ ΣΤΗ ΣΥΝΑΛΛΑΓΗ
// =============================================================================

/**
 * **Συνθέτει, ΚΡΙΝΕΙ, και μόνο τότε γράφει.**
 *
 * 🔴 **Τα αμετάβλητα τρέχουν ΠΡΙΝ το `set`, και εδώ το κόστος του «μετά» είναι
 * μετρήσιμο**: άκυρη πράξη που γράφτηκε **δεν τη βλέπει κανείς** (`read: false`) αλλά
 * **μετράει στη χωρητικότητα** — δηλαδή κλέβει από τον άνθρωπο μία από τις δέκα
 * θέσεις του, σιωπηλά και για πάντα.
 *
 * 🔴 **`set` με ταυτότητα από το `enterprise-id` (N.6), ΠΟΤΕ `add`.** Ο γεννήτορας
 * `fcon_*` υπήρχε από το Στάδιο Α· αυτή η διαδρομή είναι ο **πρώτος του καταναλωτής**.
 *
 * ⚠️ **Η ταυτότητα γεννιέται ΠΡΙΝ τη συναλλαγή, και σωστά**: αν η συναλλαγή
 * **ξαναπροσπαθήσει**, γράφει το **ίδιο** έγγραφο στην **ίδια** διεύθυνση. Γεννήτορας
 * μέσα στη συναλλαγή θα παρήγαγε **νέα** ταυτότητα σε κάθε επανάληψη — δηλαδή
 * ταυτότητες που δεν γράφτηκαν ποτέ, και μια επανάληψη που «πετυχαίνει» δύο φορές.
 */
async function writeContact(
  adminDb: AdminFirestore,
  actor: ListingActor,
  declaration: FirstContactDeclaration,
  offerer: ListingCustody,
  matchReason: MatchReason | null,
  nowISO: string,
): Promise<FirstContactWriteResult> {
  const contact: FirstContact = {
    id: generateFirstContactId(),
    seekerUserId: actor.uid,
    target: declaration.target,
    // 🏆 **Ο παραλήπτης γράφεται ΤΩΡΑ, από τον κριτή που τον υπολόγισε ήδη** (§10.16).
    //    Καμία νέα ανάγνωση, καμία δεύτερη κρίση θεματοφυλακής — δες
    //    `FirstContact.offerer` για το γιατί δεν ζει ως ερώτημα σε χρόνο ανάγνωσης.
    offerer,
    demandId: declaration.demandId,
    disclosure: declaration.disclosure,
    matchReason,
    lifecycle: 'open',
    createdAt: nowISO,
    withdrawnAt: null,
    seenAt: null,
  };

  const violations = firstContactInvariantViolations(contact);
  if (violations.length > 0) return { kind: 'invalid', violations };

  try {
    return await adminDb.runTransaction((tx) => commitIfStillRoom(adminDb, tx, contact));
  } catch (error) {
    logger.error('[FIRST-CONTACT] Η γραφή απέτυχε', {
      contactId: contact.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

/**
 * 🔴 **ΤΟ ΟΡΙΟ ΚΡΙΝΕΤΑΙ ΞΑΝΑ **ΜΕΣΑ** ΣΤΗ ΣΥΝΑΛΛΑΓΗ — ΚΑΙ ΕΙΝΑΙ Η ΜΟΝΗ ΘΕΣΗ ΠΟΥ ΜΕΤΡΑΕΙ.**
 *
 * Ο έλεγχος του {@link openFirstContact} είναι *«μέτρησε, μετά γράψε»*: δύο αιτήματα
 * του **ίδιου** ανθρώπου σε δύο συνδέσεις μετρούν **και τα δύο εννιά** και γράφουν
 * **και τα δύο** — η ενδέκατη περνά παράλληλα με τη δέκατη, ακριβώς το σενάριο για το
 * οποίο ο κανόνας Firestore απορρίφθηκε (§10.5 λόγος #3). Το να λύναμε το ένα και όχι
 * το άλλο θα ήταν **η ίδια τρύπα, μια βαθμίδα πιο μέσα**.
 *
 * 🔑 **Ζώνη ΚΑΙ τιράντες (N.7.2 #4), όχι διπλότυπο**: ο **πρώτος** έλεγχος υπάρχει για
 * τον **άνθρωπο** *(απαντά «γέμισε» χωρίς να πληρώσει ανάγνωση αγγελίας και ζήτησης)*·
 * αυτός εδώ υπάρχει για την **αλήθεια**. Και οι δύο ρωτούν τον **ίδιο** μετρητή
 * ({@link canOpenAnotherContact}) — δεν υπάρχει δεύτερη διατύπωση του ορίου.
 *
 * ⚠️ **Η ιδεμποτησία ξαναρωτιέται κι αυτή**, γιατί δύο ταυτόχρονα πατήματα στο **ίδιο**
 * κουμπί είναι το πιθανότερο σενάριο απ' όλα: χωρίς αυτό θα γεννιόνταν **δύο** πράξεις
 * για την ίδια γνωριμία, και ο προσφέρων θα έβλεπε τον ίδιο άνθρωπο δύο φορές.
 */
async function commitIfStillRoom(
  adminDb: AdminFirestore,
  tx: Transaction,
  contact: FirstContact,
): Promise<FirstContactWriteResult> {
  const contacts = adminDb.collection(COLLECTIONS.FIRST_CONTACTS);
  const snapshot = await tx.get(contacts.where('seekerUserId', '==', contact.seekerUserId));
  const existing = snapshot.docs.map(
    (doc) => contactFromDocument(doc.data() as FirstContactDocument, doc.id),
  );

  const already = existing.find(
    (open) => open.lifecycle === 'open' && sameFirstContactTarget(open.target, contact.target),
  );
  if (already !== undefined) return { kind: 'unchanged', contact: shownToSeeker(already) };

  if (!canOpenAnotherContact(existing)) return refuse('capacity-full');

  tx.set(contacts.doc(contact.id), contact);
  return { kind: 'created', contact: shownToSeeker(contact) };
}

// =============================================================================
// 3. Η ΑΠΟΣΥΡΣΗ — ΜΙΑ πράξη για δύο σκοπούς (ΠΕ5 + ΠΕ6)
// =============================================================================

/**
 * **«Δεν με ενδιαφέρει πια.»**
 *
 * 🔑 **Το «κλείνω για να ελευθερώσω θέση» και το «αποσύρω» είναι Η ΙΔΙΑ ΠΡΑΞΗ**, και
 * υλοποιούνται **μία φορά**. Δύο καταστάσεις για τον ίδιο άξονα θα ήταν δεύτερη
 * αλήθεια (ADR-749) και θα ξαναγεννούσαν το φάντασμα που το ΠΕ5 εξαφάνισε: πράξη που
 * **δείχνει** κλειστή και **συμπεριφέρεται** ανοιχτή.
 *
 * ⛔ **ΚΑΙ Η ΟΘΟΝΗ ΔΕΝ ΛΕΕΙ «ΔΙΑΓΡΑΦΟΝΤΑΙ ΤΑ ΣΤΟΙΧΕΙΑ ΣΟΥ»** (Κ10). Ο γραφέας
 * σταματά την **πρόσβαση από εδώ** — τα στοιχεία παύουν να μπαίνουν στην προβολή του
 * προσφέροντος ({@link disclosedToOfferer}). Ο άλλος μπορεί να έχει το τηλέφωνο σε
 * χαρτί: *«ό,τι είδε, το είδε»*. Μια υπόσχεση που δεν μπορούμε να κρατήσουμε είναι
 * **χειρότερη** από καμία.
 *
 * ⚠️ **Η ΙΣΤΟΡΙΑ ΜΕΝΕΙ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΔΙΚΗ ΜΑΣ**: ο στόχος, ο χρόνος και το γεγονός
 * δεν σβήνονται. Αν αύριο ο ένας πει *«με παρενόχλησε»* ή ο άλλος *«συμφωνήσαμε»*, το
 * σβήσιμο αφήνει **και τους δύο** χωρίς τίποτα να δείξουν.
 */
export async function withdrawFirstContact(
  adminDb: AdminFirestore,
  actor: ListingActor,
  contactId: string,
  nowISO: string,
): Promise<FirstContactWithdrawResult> {
  const found = await readContactDocument(adminDb, contactId);
  if (found === null) return UNAVAILABLE;
  // ⚠️ **«Δεν υπάρχει» και «δεν είναι δική σου» απαντούν ΤΑΥΤΟΣΗΜΑ.** Ξεχωριστό «δεν
  //    επιτρέπεσαι» θα **επιβεβαίωνε την ύπαρξη** ξένης πράξης σε όποιον μαντεύει
  //    ταυτότητες — ίδιο ιδίωμα με το `listing-absent` της γειτονικής πόρτας.
  if (found === 'absent' || found.seekerUserId !== actor.uid) return { kind: 'absent' };

  // 🔑 Δεύτερη απόσυρση **δεν μετακινεί τη σφραγίδα**: το ΠΕ6 κρατά **πότε**, και το
  //    «πότε» είναι η **πρώτη** φορά. Επιτυχία, όχι σφάλμα.
  if (found.lifecycle === 'withdrawn') {
    return { kind: 'unchanged', contact: shownToSeeker(found) };
  }

  return commitWithdrawal(adminDb, found, nowISO);
}

/**
 * **Η σφραγίδα της απόσυρσης** — αμετάβλητα **ΠΡΙΝ**, γραφή μετά.
 *
 * ⚠️ **Άκυρη ΜΕΤΑ την αλλαγή σημαίνει ότι το αποθηκευμένο έγγραφο ήταν ΗΔΗ χαλασμένο.**
 * Δεν το «διορθώνουμε» σιωπηλά — και δεν αφήνουμε τον άνθρωπο δεμένο σε πράξη που δεν
 * λύνεται: το `failed` του λέει *«ξαναδοκίμασε»*, και ο λόγος μένει στο ημερολόγιο.
 *
 * 🔑 **Γράφονται ΜΟΝΟ τα δύο πεδία που αλλάζουν** (`update`, όχι `set`): μια ολική
 * επανεγγραφή θα ξανάγραφε και τη **γνωστοποίηση**, δηλαδή θα μπορούσε να επαναφέρει
 * στοιχεία που στο ενδιάμεσο άλλαξαν αλλού.
 */
async function commitWithdrawal(
  adminDb: AdminFirestore,
  open: FirstContact,
  nowISO: string,
): Promise<FirstContactWithdrawResult> {
  const withdrawn: FirstContact = { ...open, lifecycle: 'withdrawn', withdrawnAt: nowISO };

  const violations = firstContactInvariantViolations(withdrawn);
  if (violations.length > 0) {
    logger.error('[FIRST-CONTACT] Η απόσυρση θα παρήγαγε ΑΚΥΡΗ πράξη', {
      contactId: open.id,
      violations,
    });
    return { kind: 'failed' };
  }

  try {
    await adminDb
      .collection(COLLECTIONS.FIRST_CONTACTS)
      .doc(open.id)
      .update({ lifecycle: 'withdrawn', withdrawnAt: nowISO });
    return { kind: 'withdrawn', contact: shownToSeeker(withdrawn) };
  } catch (error) {
    logger.error('[FIRST-CONTACT] Η απόσυρση απέτυχε', {
      contactId: open.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

/** Ίδιο τρίπτυχο με τους άλλους δύο αναγνώστες: βλάβη ≠ απουσία (N.12). */
async function readContactDocument(
  adminDb: AdminFirestore,
  contactId: string,
): Promise<FirstContact | 'absent' | null> {
  try {
    const snapshot = await adminDb.collection(COLLECTIONS.FIRST_CONTACTS).doc(contactId).get();
    return snapshot.exists
      ? contactFromDocument(snapshot.data() as FirstContactDocument, snapshot.id)
      : 'absent';
  } catch (error) {
    logger.error('[FIRST-CONTACT] Η ανάγνωση της πράξης απέτυχε — άγνωστο, όχι κενό', {
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
