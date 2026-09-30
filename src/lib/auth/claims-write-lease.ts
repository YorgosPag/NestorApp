import 'server-only';

/**
 * @fileoverview **ΕΝΑΣ ΓΡΑΦΕΑΣ CLAIMS ΤΗ ΦΟΡΑ, ΑΝΑ ΑΝΘΡΩΠΟ** — ADR-894 §10.7 · ADR-360.
 * @related lib/auth/set-claims-with-mirror (ο ΜΟΝΟΣ καταναλωτής) · `firestore.rules` → `users/{uid}/security`
 *   (`read, write: if false`) · lib/cron/cron-lease (ίδιο πρότυπο συναλλαγής, άλλο πρόβλημα: αποδοτικότητα, όχι ορθότητα)
 * @module lib/auth/claims-write-lease
 *
 * 🔴 **ΤΟ ΚΕΝΟ**: το `setCustomUserClaims` αντικαθιστά **ολόκληρο** το σύνολο και η Firebase **δεν** έχει
 * compare-and-set. Ο συγχρονισμός των ανακλήσεων διαβάζει τα τρέχοντα claims και τα ξαναγράφει· αν ανάμεσα γραφτεί
 * **αλλαγή ρόλου**, θα ξαναέγραφε τον **παλιό** ρόλο — σιωπηλά, και ίσως ως **επαναφορά δικαιωμάτων** που μόλις
 * αφαιρέθηκαν. Το ίδιο ίσχυε ήδη ανάμεσα σε δύο οποιουσδήποτε γραφείς που διαβάζουν-και-γράφουν (MFA · πρόσκληση).
 *
 * 🔑 **Η ΛΥΣΗ — σειριοποίηση στο ΣΤΕΝΩΜΑ**: όλα τα claims περνούν από το `setClaimsWithMirror` ⇒ ένα lease ανά
 * άνθρωπο εκεί σειριοποιεί **κάθε** διαδρομή, και νέα διαδρομή το κληρονομεί χωρίς να το ξέρει. Απόκτηση/απελευθέρωση
 * σε **συναλλαγή** Firestore (ατομικό «ελεύθερο; πάρ' το»)· κάτοχος = `generateOperationId()`·
 * λήξη ώστε ένας κατεστραμμένος κάτοχος να μην κλειδώνει για
 * πάντα· απελευθέρωση **μόνο** από τον κάτοχο.
 * ⚠️ Lease χωρίς fencing token έχει θεωρητικό παράθυρο όταν ο κάτοχος παγώσει **περισσότερο** από τη λήξη (15″) —
 * γι' αυτό η λήξη είναι ~10× η διάρκεια μιας εγγραφής claims. Σε αποτυχία απόκτησης ⇒ **ρίχνει** (fail-closed): μια
 * εγγραφή claims που αποτυγχάνει ορατά είναι καλύτερη από μια που σβήνει σιωπηλά την αλλαγή άλλου.
 */

import { Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { generateOperationId } from '@/services/enterprise-id.service';

const logger = createModuleLogger('claims-write-lease');

/** Σταθερό id, ένα ανά άνθρωπο — δεν είναι οντότητα (ίδιο πρότυπο με το `revoked_sign_ins`). */
export const CLAIMS_WRITE_LEASE_DOC_ID = 'claims_write_lease';

/** Λήξη: ~10× μιας εγγραφής claims (Auth + καθρέφτης ≈ 1–2″). */
export const CLAIMS_WRITE_LEASE_TTL_MS = 15_000;

/** Πόσο περιμένει ένας δεύτερος γραφέας — ώστε να περιμένει και την εκπνοή ενός εγκαταλειμμένου lease. */
const ACQUIRE_TIMEOUT_MS = CLAIMS_WRITE_LEASE_TTL_MS + 5_000;
const RETRY_DELAY_MS = 100;

export class ClaimsWriteLeaseTimeout extends Error {
  constructor(uid: string) {
    super(`claims write lease busy for ${uid}`);
    this.name = 'ClaimsWriteLeaseTimeout';
  }
}

function leaseRef(uid: string) {
  return getAdminFirestore()
    .collection(COLLECTIONS.USERS).doc(uid)
    .collection(SUBCOLLECTIONS.USER_SECURITY).doc(CLAIMS_WRITE_LEASE_DOC_ID);
}

/** Μία απόπειρα: ελεύθερο ή ληγμένο ⇒ δικό μου. */
async function tryAcquire(uid: string, holder: string, nowMs: number): Promise<boolean> {
  const ref = leaseRef(uid);
  return getAdminFirestore().runTransaction(async (tx) => {
    const expiresAt: unknown = (await tx.get(ref)).data()?.expiresAt;
    if (expiresAt instanceof Timestamp && expiresAt.toMillis() > nowMs) return false;
    tx.set(ref, { holder, expiresAt: Timestamp.fromMillis(nowMs + CLAIMS_WRITE_LEASE_TTL_MS) });
    return true;
  });
}

/**
 * Απελευθέρωση **μόνο** αν το κρατάμε ακόμη (αλλιώς θα ελευθερώναμε το lease του επόμενου). Δεν ρίχνει: η εγγραφή
 * claims **έγινε**· ένα lease που δεν ελευθερώθηκε απλώς λήγει.
 */
async function release(uid: string, holder: string): Promise<void> {
  const ref = leaseRef(uid);
  try {
    await getAdminFirestore().runTransaction(async (tx) => {
      if ((await tx.get(ref)).data()?.holder === holder) tx.delete(ref);
    });
  } catch (error: unknown) {
    logger.warn('Το lease εγγραφής claims δεν ελευθερώθηκε — λήγει μόνο του', { uid, error: getErrorMessage(error) });
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Εκτελεί το `work` κρατώντας το lease εγγραφής claims του ανθρώπου. Δεύτερος ταυτόχρονος γραφέας **περιμένει**.
 * ⛔ ΜΗΝ το καλέσεις εμφωλευμένα για τον ίδιο άνθρωπο (αδιέξοδο ως τη λήξη): οι εσωτερικές διαδρομές του γραφέα
 * δουλεύουν **ήδη κάτω** από το lease.
 */
export async function withClaimsWriteLease<T>(uid: string, work: () => Promise<T>, now: () => number = Date.now): Promise<T> {
  const holder = generateOperationId();
  const deadline = now() + ACQUIRE_TIMEOUT_MS;
  while (!(await tryAcquire(uid, holder, now()))) {
    if (now() >= deadline) throw new ClaimsWriteLeaseTimeout(uid);
    await sleep(RETRY_DELAY_MS);
  }
  try {
    return await work();
  } finally {
    await release(uid, holder);
  }
}
