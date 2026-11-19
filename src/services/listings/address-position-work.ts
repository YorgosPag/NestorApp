/**
 * **ΤΟ ΜΗΤΡΩΟ ΕΡΓΑΣΙΑΣ ΤΗΣ ΘΕΣΗΣ** — ποια οντότητα περιμένει θέση, πόσες φορές δοκιμάστηκε, πότε
 * ξαναδοκιμάζεται (ADR-332 §D33).
 *
 * 🏆 Πρότυπο **GitLab Geo registry**: η κατάσταση εργασίας ζει **έξω** από το μοντέλο, με `retry_at`
 * εκθετικής αναμονής, και είναι ασφαλής σε κατάρρευση — μια εκτέλεση που κόπηκε αφήνει την εγγραφή
 * οφειλόμενη, και η επόμενη την ξαναπαίρνει. Καμία κατάσταση «σε εξέλιξη»: τη μοναδικότητα της
 * εκτέλεσης την εγγυάται ήδη το lease της εργασίας (`cron-lease`).
 *
 * 🔑 **Υπάρχει ⇔ εκκρεμεί.** Η εγγραφή σβήνεται όταν η θέση κριθεί — μια λίστα που μόνο μεγαλώνει θα
 * ήταν δεύτερη αλήθεια δίπλα στο `positionSettled`.
 *
 * @module services/listings/address-position-work
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { positionRetryDelayMs } from '@/lib/geocoding/position-work';

/** Ό,τι κρατά το μητρώο για μία οντότητα. Χρόνοι σε ms (epoch) — συγκρίνονται, δεν εμφανίζονται. */
export interface AddressPositionWorkRecord {
  readonly collection: string;
  readonly docId: string;
  readonly companyId: string | null;
  /** Αναπάντητες δοκιμές ως τώρα (πάροχος μη διαθέσιμος · εξαντλημένη προθεσμία). */
  readonly attempts: number;
  /** Πότε οφείλεται η επόμενη δοκιμή. */
  readonly dueAt: number;
  readonly enqueuedAt: number;
  readonly lastAttemptAt: number | null;
}

/** Μία οντότητα που βρέθηκε να περιμένει θέση. */
export interface AddressPositionWorkTarget {
  readonly collection: string;
  readonly docId: string;
  readonly companyId: string | null;
}

/** Firestore `ALREADY_EXISTS` — το `create()` βρήκε ήδη εγγραφή. */
const ALREADY_EXISTS = 6;

function workDocId(collection: string, docId: string): string {
  return `${collection}__${docId}`;
}

export function addressPositionWorkRef(
  db: AdminFirestore,
  collection: string,
  docId: string,
): DocumentReference {
  return db.collection(COLLECTIONS.ADDRESS_POSITION_WORK).doc(workDocId(collection, docId));
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === ALREADY_EXISTS;
}

/**
 * Γράφει την οντότητα στο μητρώο, **οφειλόμενη τώρα** — ιδεμποτικά: αν υπάρχει ήδη, μένει όπως είναι,
 * ώστε ένας δεύτερος εντοπισμός να μη μηδενίζει την αναμονή μιας διεύθυνσης που ο πάροχος δεν προλαβαίνει.
 *
 * @returns `true` αν γράφτηκε τώρα, `false` αν ήταν ήδη εκεί.
 */
export async function enqueueAddressPositionWork(
  db: AdminFirestore,
  target: AddressPositionWorkTarget,
  now: number,
): Promise<boolean> {
  const record: AddressPositionWorkRecord = { ...target, attempts: 0, dueAt: now, enqueuedAt: now, lastAttemptAt: null };
  try {
    await addressPositionWorkRef(db, target.collection, target.docId).create(record);
    return true;
  } catch (error) {
    if (isAlreadyExists(error)) return false;
    throw error;
  }
}

/** Οι οφειλόμενες εγγραφές, οι παλαιότερες πρώτες. */
export async function listDueAddressPositionWork(
  db: AdminFirestore,
  now: number,
  limit: number,
): Promise<Array<{ readonly ref: DocumentReference; readonly record: AddressPositionWorkRecord }>> {
  // tenant-scope-exempt: εργασία της μηχανής για ΟΛΟΥΣ τους χώρους· κάθε εγγραφή φέρει το companyId της
  // οντότητας και ο γραφέας γράφει μόνο πάνω στο ΙΔΙΟ έγγραφο που δείχνει (καμία διασταύρωση χώρων).
  const snapshot = await db
    .collection(COLLECTIONS.ADDRESS_POSITION_WORK)
    .where('dueAt', '<=', now)
    .orderBy('dueAt', 'asc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => ({ ref: doc.ref, record: doc.data() as AddressPositionWorkRecord }));
}

/** Η δοκιμή δεν έφερε απάντηση ⇒ μία δοκιμή ακόμη, και η επόμενη μετά την αναμονή της βαθμίδας. */
export async function recordAddressPositionAttempt(
  ref: DocumentReference,
  record: AddressPositionWorkRecord,
  now: number,
): Promise<void> {
  const attempts = record.attempts + 1;
  await ref.update({ attempts, lastAttemptAt: now, dueAt: now + positionRetryDelayMs(attempts) });
}

/** Η θέση κρίθηκε (ή η οντότητα δεν υπάρχει πια) ⇒ η εγγραφή φεύγει. */
export async function settleAddressPositionWork(ref: DocumentReference): Promise<void> {
  await ref.delete();
}
