/**
 * =============================================================================
 * Η ΣΤΟΙΒΑ ΕΚΔΟΣΕΩΝ — η ΑΛΥΣΙΔΑ ΔΙΑΔΟΧΗΣ, διαβασμένη από τον διακομιστή (ADR-862 Φ0)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Ποιες είναι οι εκδόσεις αυτού του εγγράφου, και ποια ισχύει;»*
 *
 * 🔴 **ΕΝΑ ΜΟΝΤΕΛΟ ΕΚΔΟΣΕΩΝ, ΟΧΙ ΔΥΟ** (μετρημένο 2026-09-17): υπήρχε και δεύτερο — η
 * υποσυλλογή `files/{id}/versions` με επιτόπια αντικατάσταση (`file-version.service.ts`).
 * Ήταν **νεκρό στην παραγωγή** (κανένας κανόνας ⇒ deny-all, **0** έγγραφα) και ήταν η πηγή
 * του lost update (`getDoc`→`updateDoc` χωρίς συναλλαγή) και της παγίδας `?? 1` vs `?? 0`.
 * Καταργήθηκε. Η αλήθεια είναι η **διαδοχή** του ΕΝΟΣ γραφέα: κάθε έκδοση είναι ξεχωριστό
 * FileRecord, δεμένο με `supersededByFileId` (όπως οι «version stacks» του Autodesk Docs).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΑΚΟΛΟΥΘΕΙ ΤΟΥΣ ΔΕΣΜΟΥΣ, ΟΧΙ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΘΕΣΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Πέντε φωτογραφίες ενός ακινήτου έχουν την **ίδια** ταυτότητα θέσης — **δεν** είναι πέντε
 * εκδόσεις. Η ταυτότητα **κρίνει** μια διαδοχή· η στοίβα **διαβάζει** μόνο ό,τι κρίθηκε.
 *
 * 1. **Εμπρός** από το ζητούμενο στην **κεφαλή** (`supersededByFileId`).
 * 2. **Πίσω** από την κεφαλή σε κάθε προκάτοχο (ερώτημα `supersededByFileId == id`) —
 *    δένδρο, όχι λίστα: η δημοσίευση μοντέλου αρχειοθετεί **πολλούς** προκατόχους μαζί.
 * ⛔ Κύκλος ή βάθος > {@link MAX_STACK_DEPTH} ⇒ σταματά· ποτέ ατέρμων βρόχος σε αλλοιωμένα δεδομένα.
 *
 * @module services/iso19650/version-stack
 * @see services/iso19650/version-promotion — «Ορισμός ως τρέχουσας»
 */

import 'server-only';

import type { CollectionReference, Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { isOwnedByCustody, type CustodyScope } from '@/lib/workspace/custody-scope';
import { normalizeFileRecord } from '@/lib/files/file-record-read';
import type { FileRecord } from '@/types/file-record';

/** Ανώτατο πλήθος εκδόσεων που διαβάζονται — προστασία από κύκλους και αλλοιωμένα δεδομένα. */
const MAX_STACK_DEPTH = 200;

export type VersionStackRead =
  | { readonly kind: 'stack'; readonly headFileId: string; readonly versions: readonly FileRecord[] }
  | { readonly kind: 'not-found' };

/**
 * **Η σειρά της στοίβας** — καθαρή: κεφαλή πρώτη, μετά νεότερη → παλαιότερη.
 * ⚠️ Χρόνος που δεν διαβάζεται ⇒ στο **τέλος** (ποτέ «παλαιότερο από όλα» κατά σύμπτωση).
 */
function orderVersionStack(versions: readonly FileRecord[], headFileId: string): FileRecord[] {
  const millis = (record: FileRecord): number => normalizeToMillisOrNull(record.createdAt) ?? -Infinity;
  return [...versions].sort((a, b) => {
    if (a.id === headFileId) return -1;
    if (b.id === headFileId) return 1;
    return millis(b) - millis(a);
  });
}

/** Ένα έγγραφο του κατόχου, κανονικοποιημένο — ή `null` (απουσία **ή** ξένο: ίδια απάντηση). */
async function readOwned(owner: CustodyScope, fileId: string): Promise<FileRecord | null> {
  const snapshot = await filesOf(owner).doc(fileId).get();
  if (!snapshot.exists) return null;
  const record = normalizeFileRecord(snapshot.data(), snapshot.id);
  return record !== null && isOwnedByCustody({ ...record }, owner) ? record : null;
}

/** (1) Από το ζητούμενο στην κεφαλή. */
async function walkToHead(
  owner: CustodyScope,
  start: FileRecord,
  seen: Map<string, FileRecord>,
): Promise<FileRecord> {
  let current = start;
  while (current.supersededByFileId && seen.size < MAX_STACK_DEPTH) {
    if (seen.has(current.supersededByFileId)) break;
    const next = await readOwned(owner, current.supersededByFileId);
    if (next === null) break;
    seen.set(next.id, next);
    current = next;
  }
  return current;
}

/**
 * 🗂️ **Η συλλογή του διαμερίσματος** — `COLLECTIONS[FILE_COLLECTION[kind]]` **στο σημείο κλήσης**
 * (ADR-866): συνάρτηση-περιτύλιγμα θα τύφλωνε τις πύλες 3.15 / 3.35.
 */
function filesOf(owner: CustodyScope): CollectionReference {
  const kind = owner.userId !== undefined ? 'personal' : 'company';
  return getAdminFirestore().collection(COLLECTIONS[FILE_COLLECTION[kind]]);
}

/**
 * **Το ερώτημα προκατόχων, ανά διαμέρισμα** — ένας κλάδος ανά κάτοχο, με **κυριολεκτικό** όνομα
 * πεδίου.
 *
 * 🔴 **ΟΧΙ δυναμικό `where(ownerField, '==', ownerId)`**: οι πύλες δεικτών (3.15) και μισθωτή
 * (3.35) διαβάζουν το `where(...)` **κυριολεκτικά** — υπολογισμένο όνομα πεδίου τις κάνει να μη
 * βλέπουν κανένα φίλτρο, δηλαδή «πράσινο επειδή κανείς δεν κοίταξε». Δύο γραμμές είναι φθηνότερες
 * από μια πύλη που σιωπά.
 *
 * ⚠️ Απαιτεί σύνθετο δείκτη **ανά διαμέρισμα**: `files (companyId, supersededByFileId)` ·
 * `files_personal (supersededByFileId, userId)`. Ερώτημα Admin SDK ⇒ **αόρατο** στη 3.15
 * (ADR-866 §2.6.9 Β7) ⇒ οι δείκτες γράφτηκαν **με το χέρι**.
 */
function predecessorQuery(owner: CustodyScope, supersededByFileId: string): Query {
  return owner.userId !== undefined
    ? getAdminFirestore()
        .collection(COLLECTIONS[FILE_COLLECTION.personal])
        .where('userId', '==', owner.userId)
        .where('supersededByFileId', '==', supersededByFileId)
    : getAdminFirestore()
        .collection(COLLECTIONS[FILE_COLLECTION.company])
        .where('companyId', '==', owner.companyId)
        .where('supersededByFileId', '==', supersededByFileId);
}

/** (2) Από την κεφαλή σε κάθε προκάτοχο — πλάτος πρώτα. */
async function collectPredecessors(
  owner: CustodyScope,
  headFileId: string,
  seen: Map<string, FileRecord>,
): Promise<void> {
  const queue = [headFileId];
  while (queue.length > 0 && seen.size < MAX_STACK_DEPTH) {
    const id = queue.shift() as string;
    const snapshot = await predecessorQuery(owner, id).get();
    for (const doc of snapshot.docs) {
      if (seen.has(doc.id)) continue;
      const record = normalizeFileRecord(doc.data(), doc.id);
      if (record === null) continue;
      seen.set(record.id, record);
      queue.push(record.id);
    }
  }
}

/**
 * **Η στοίβα εκδόσεων του αρχείου.** Η ορατότητα κάθε έκδοσης **δεν** κρίνεται εδώ — την
 * κρίνει ο καλών με τον `decideContainerAccess` (ιστορικό ⇒ `historyRequested: true`).
 *
 * 🔑 **Ο κάτοχος, όχι ο μισθωτής** (ADR-866 2β.3β): εταιρεία `{ companyId }` **ή** άνθρωπος
 * `{ userId }`. Η στοίβα **δεν** διασχίζει ποτέ διαμερίσματα — ο δεσμός `supersededByFileId`
 * ακολουθείται μόνο μέσα στον χώρο του κατόχου.
 *
 * ⚠️ Το {@link MAX_STACK_DEPTH} είναι φρένο **ανάγνωσης** (κύκλοι · αλλοιωμένα δεδομένα), **ποτέ**
 * πολιτική διατήρησης: πολιτική λήξης εκδόσεων στον προσωπικό χώρο δεν έχει αποφασιστεί
 * (ADR-866 §2.6.10 Γ, Ε-Φ0-2).
 */
export async function readVersionStack(owner: CustodyScope, fileId: string): Promise<VersionStackRead> {
  const start = await readOwned(owner, fileId);
  if (start === null) return { kind: 'not-found' };

  const seen = new Map<string, FileRecord>([[start.id, start]]);
  const head = await walkToHead(owner, start, seen);
  await collectPredecessors(owner, head.id, seen);

  return { kind: 'stack', headFileId: head.id, versions: orderVersionStack([...seen.values()], head.id) };
}
