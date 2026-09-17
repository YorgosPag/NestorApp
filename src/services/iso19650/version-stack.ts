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

import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
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

/** Ένα έγγραφο του μισθωτή, κανονικοποιημένο — ή `null` (απουσία **ή** ξένος: ίδια απάντηση). */
async function readOwned(companyId: string, fileId: string): Promise<FileRecord | null> {
  const snapshot = await getAdminFirestore().collection(COLLECTIONS.FILES).doc(fileId).get();
  if (!snapshot.exists) return null;
  const record = normalizeFileRecord(snapshot.data(), snapshot.id);
  return record !== null && isPayloadOwnedByCompany(record, companyId) ? record : null;
}

/** (1) Από το ζητούμενο στην κεφαλή. */
async function walkToHead(
  companyId: string,
  start: FileRecord,
  seen: Map<string, FileRecord>,
): Promise<FileRecord> {
  let current = start;
  while (current.supersededByFileId && seen.size < MAX_STACK_DEPTH) {
    if (seen.has(current.supersededByFileId)) break;
    const next = await readOwned(companyId, current.supersededByFileId);
    if (next === null) break;
    seen.set(next.id, next);
    current = next;
  }
  return current;
}

/** (2) Από την κεφαλή σε κάθε προκάτοχο — πλάτος πρώτα. */
async function collectPredecessors(
  companyId: string,
  headFileId: string,
  seen: Map<string, FileRecord>,
): Promise<void> {
  const files = getAdminFirestore().collection(COLLECTIONS.FILES);
  const queue = [headFileId];
  while (queue.length > 0 && seen.size < MAX_STACK_DEPTH) {
    const id = queue.shift() as string;
    const snapshot = await files
      .where('companyId', '==', companyId)
      .where('supersededByFileId', '==', id)
      .get();
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
 */
export async function readVersionStack(companyId: string, fileId: string): Promise<VersionStackRead> {
  const start = await readOwned(companyId, fileId);
  if (start === null) return { kind: 'not-found' };

  const seen = new Map<string, FileRecord>([[start.id, start]]);
  const head = await walkToHead(companyId, start, seen);
  await collectPredecessors(companyId, head.id, seen);

  return { kind: 'stack', headFileId: head.id, versions: orderVersionStack([...seen.values()], head.id) };
}
