import 'server-only';

/**
 * @fileoverview **ΤΑ ΣΥΜΦΡΑΖΟΜΕΝΑ ΜΙΑΣ ΣΥΝΟΜΙΛΙΑΣ** — «για ποιο πράγμα μιλάμε, και ανοίγει από εδώ;»
 * @related ADR-867 Β9γ · ADR-848 (ποτέ κουμπί προς το πουθενά) · services/mandate/mandate-detail.service.ts
 * @module services/network-messaging/thread-context
 *
 * 🔑 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: η συνομιλία απέκτησε **δική της** διεύθυνση (Β9γ), άρα ο άνθρωπος φτάνει εκεί
 * **χωρίς** να έχει περάσει από τη σελίδα της πράξης. Χωρίς συμφραζόμενα θα διάβαζε μηνύματα για
 * «κάτι». Το πρότυπο είναι ρητό: **Zillow** — το ακίνητο είναι σύνδεσμος **μέσα** στη συνομιλία·
 * **HubSpot/Intercom** — τρίτη στήλη με το συνδεδεμένο έγγραφο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ: ΣΥΝΔΕΣΜΟΣ ΜΟΝΟ ΣΕ ΟΠΟΙΟΝ ΑΝΟΙΓΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι HubSpot/Intercom δείχνουν πάντα το συνδεδεμένο έγγραφο — **δεν έχουν το πρόβλημά μας**: ένα
 * έγγραφο, ένας μισθωτής. Εδώ η **ίδια** αγγελία έχει δύο πλευρές σε **διαφορετικούς** χώρους, και
 * για αγγελία **ιδιώτη** η σελίδα της πράξης **στο γραφείο δεν υπάρχει** (`isPersonalCustody ⇒
 * not-yours`, `mandate-detail.service.ts` — σωστά: δεύτερος άξονας απομόνωσης απαγορεύεται
 * **ονομαστικά** στο `tenant-config.ts`).
 *
 * ⇒ Η κάρτα δίνει **όνομα πάντα** και **σύνδεσμο μόνο όταν ανοίγει**. Το αντίθετο ήταν ακριβώς το
 * ελάττωμα που βρήκε η ζωντανή επαλήθευση: υπόσχεση πόρτας που απαντά «δεν βρέθηκε» (ADR-848).
 *
 * ⚠️ **Ο κριτής ΔΕΝ αντιγράφεται**: ρωτιέται το ίδιο `isPersonalCustody` που κρίνει και η καρτέλα
 * της εντολής. Δεύτερο αντίγραφο θα απέκλινε την ημέρα που αλλάξει η έννοια της επιμέλειας (ADR-749).
 *
 * 🔒 **Ελαχιστοποίηση**: μόνο **τίτλος** — καμία τιμή, καμία διεύθυνση, κανένα πρόσωπο. Ο τίτλος
 * φαίνεται ήδη στα εισερχόμενα αιτήματα του γραφείου, άρα δεν αποκαλύπτεται τίποτα νέο.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { isPersonalCustody } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { actNetworkRefs } from '@/lib/network-messaging/act-network-refs';
import { actSubjectOf } from '@/lib/network-edge/edge-sources';
import type { NetworkThread } from '@/types/network-thread';
import type { NetworkThreadContext } from '@/types/network-wire';

import { actContextDestination } from './network-destination';
import { readThreadAsReader } from './thread-reader';

const logger = createModuleLogger('NetworkThreadContext');

/**
 * **Η συνομιλία όπως τη χρειάζεται η οθόνη της** — ή `null` (ξένο · ανύπαρκτο: **ίδια** απάντηση,
 * ADR-742). Ίδια υπογραφή με `readThreadPeople` ⇒ την τρέχει ο **ίδιος** handler
 * (`thread-reader-route.ts`), χωρίς δεύτερη διαδρομή-δίδυμο (CHECK 3.28).
 */
export async function readThreadContext(
  adminDb: AdminFirestore,
  threadId: string,
  callerUid: string,
): Promise<NetworkThreadContext | null> {
  const found = await readThreadAsReader(adminDb, threadId, callerUid);
  if (found === null) return null;

  const { thread, audience } = found;
  // 🔑 **Η ΠΛΕΥΡΑ ΕΙΝΑΙ ΓΡΑΜΜΕΝΗ, ΔΕΝ ΣΥΜΠΕΡΑΙΝΕΤΑΙ**: τη λέει η **γραμμή ακροατηρίου** — ο ίδιος
  //    πίνακας που τροφοδοτεί τον κατάλογο. Ένα δεύτερο `uid === counterpartUid` εδώ θα ήταν
  //    δεύτερος κριτής για το ίδιο ερώτημα, και θα διαφωνούσε με τη λίστα (ADR-749).
  const side = audience.find((entry) => entry.uid === callerUid)?.side ?? 'person';

  if (thread.topic.kind !== 'act') {
    // Νήμα σχέσης (Β8): δεν έχει πράξη — η οθόνη δείχνει **μόνο** τη συνομιλία, χωρίς κάρτα.
    return { side, teamId: null, subjectTitle: null, subjectHref: null };
  }

  // ⚠️ Η ομάδα έρχεται από τον **διακομιστή**, όχι από τον πελάτη: το `actSeed` είναι εσωτερικός
  //    (`<ακίνητο>:<γραφείο>`) και η μορφή του δεν γίνεται συμβόλαιο οθόνης (ίδιο επιχείρημα με το
  //    `href`, `types/network-wire.ts`). Ο ιδιοκτήτης **δεν** διαχειρίζεται ομάδα ⇒ `null`.
  const teamId = side === 'host' ? actNetworkRefs(thread.topic.actSeed).teamId : null;
  const subject = await readSubject(adminDb, thread.topic);
  const surface = actContextDestination(thread.topic, threadId, callerUid);
  const page = surface?.actions[0]?.url ?? null;

  // 🔑 **Ο ΣΥΝΔΕΣΜΟΣ ΜΟΝΟ ΟΤΑΝ ΑΝΟΙΓΕΙ — ΚΑΙ Η ΕΡΩΤΗΣΗ ΕΙΝΑΙ ΑΝΑ ΠΛΕΥΡΑ.**
  //
  // ⚠️ Η προσωπική επιμέλεια κλείνει **μόνο** τη σελίδα του **γραφείου** (`isPersonalCustody ⇒
  //    not-yours`). Ο ιδιοκτήτης ανοίγει **πάντα** τη δική του αγγελία — ένας κοινός έλεγχος και
  //    για τους δύο θα τον άφηνε χωρίς σύνδεσμο ακριβώς εκεί όπου έχει κάθε δικαίωμα.
  //    (Το έπιασε η άγκυρα Σ-1, όχι η ανάγνωση του κώδικα.)
  // ⚠️ `subject === null` ⇒ δεν ξέρουμε ⇒ **δεν υποσχόμαστε**.
  const blocked = subject === null || (side === 'host' && subject.personalCustody);

  return {
    side,
    teamId,
    subjectTitle: subject?.title ?? null,
    subjectHref: blocked ? null : page,
  };
}

/**
 * Ο τίτλος της αγγελίας και η **επιμέλειά** της — μία ανάγνωση, δύο απαντήσεις.
 *
 * ⚠️ Επιστρέφει **γεγονός** (`personalCustody`), όχι κρίση (`openable`): ποιος αποκλείεται είναι
 * ερώτηση της **πλευράς**, και ανήκει στον καλούντα.
 *
 * ⛔ **ΚΑΝΕΝΑ `actSeed.split(':')` ΕΔΩ.** Ποιο είναι το αντικείμενο μιας πράξης το ξέρει **μόνο** το
 * μητρώο πηγών ακμής (`actSubjectOf`, ADR-867 §3) — ένα δεύτερο parsing θα έκανε τη μορφή του
 * σπόρου συμβόλαιο, και θα έσπαγε σιωπηλά την ημέρα που θα αποκτούσε τρίτο μέρος.
 */
async function readSubject(
  adminDb: AdminFirestore,
  topic: Extract<NetworkThread['topic'], { kind: 'act' }>,
): Promise<{ readonly title: string; readonly personalCustody: boolean } | null> {
  const subject = actSubjectOf(topic.actKind, topic.actSeed);
  if (subject === null) return null;
  const { ownerPropertyId } = subject;

  try {
    const snapshot = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId).get();
    const property = ownerPropertyFromDocument(snapshot.data(), snapshot.id);
    if (property === null) return null;
    return { title: property.title, personalCustody: isPersonalCustody(property) };
  } catch (error) {
    // ⚠️ **Όχι αποτυχία**: μια αναλαμπή της βάσης δεν επιτρέπεται να κρύψει τη συνομιλία. Η κάρτα
    //    λείπει, η βλάβη **ονομάζεται** — ίδιο δόγμα με το `segmentOf` που αντικατέστησε το Β9γ.
    logger.error('[THREAD] Τα συμφραζόμενα της συνομιλίας δεν διαβάστηκαν', {
      data: { ownerPropertyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
