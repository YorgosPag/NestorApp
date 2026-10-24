/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΔΙΑΤΗΡΗΣΗΣ ΑΡΧΕΙΟΥ (ADR-916 Φ-Δ.7α · ADR-864 §21.11)
 * =============================================================================
 *
 * **Η πράξη**: *«κράτα αυτά τα bytes — βάση ΚΑΙ κάδο — όσο μια απόδειξη τα χρειάζεται ακόμη»*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🧷 ΔΕΥΤΕΡΟΣ ΑΞΟΝΑΣ ΤΟΥ ΙΔΙΟΥ ΣΥΣΤΗΜΑΤΟΣ — ΟΧΙ ΔΕΥΤΕΡΟ ΣΥΣΤΗΜΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η δέσμευση (`hold`) είναι **μία** τη φορά και την κρίνει άνθρωπος. Η διατήρηση είναι **πολλαπλή** (κάθε απόδειξη που
 * περιμένει προσθέτει το id της — Purview: *«retention wins over deletion»*, πολλές διατηρήσεις **ενώνονται**) και την
 * τοποθετεί/αίρει **μόνο σύστημα**, πάνω σε γεγονός: ο καλών είναι ο γραφέας της απόδειξης, μέσα στη **δική του**
 * συναλλαγή. Κάθε πόρτα οριστικής διαγραφής τη βλέπει ήδη μέσω `isFileHeld` · ο κανόνας μέσω `holdAllowsHardDelete()`.
 *
 * 🔑 **Τα bytes ακολουθούν τη βάση** (ίδια αρχή με τη δέσμευση): τοποθέτηση = bytes **πρώτα**, βάση μετά· αποδέσμευση =
 * βάση **πρώτα**, bytes μετά (`reconcilePreservedBytes`). Ο GCS `temporaryHold` είναι **ένας** διακόπτης για όλους τους
 * κατόχους ⇒ ξεκλειδώνει **μόνο** όταν το έγγραφο δεν κρατά τίποτα (`keepsObjectBytesHeld`).
 *
 * ⚠️ **Χωρίς `FieldValue.arrayUnion`, επίτηδες**: ο καλών έχει **ήδη** διαβάσει το έγγραφο στη συναλλαγή του ⇒ ο νέος
 * πίνακας υπολογίζεται ρητά και γράφεται **μόνο** όταν αλλάζει (καμία εγγραφή στην επανάληψη, κανένα `updatedAt`:
 * η διατήρηση είναι σιωπηλή — το αρχείο δεν «τροποποιήθηκε»).
 *
 * @module services/file-record/file-preservation.service
 * @see lib/files/file-hold — `isPreserved` (ο καθαρός κριτής) · services/file-record/file-hold.service — η δέσμευση
 */

import 'server-only';

import type { DocumentData, DocumentReference, Transaction } from 'firebase-admin/firestore';

import { getErrorMessage } from '@/lib/error-utils';
import type { FILE_HOLD_FIELDS } from '@/lib/files/file-hold';
import type { FileStoragePlacementSubject } from '@/lib/files/file-storage-placement';
import { createModuleLogger } from '@/lib/telemetry';
import { fileRecordBucket } from '@/server/files/file-record-bucket';

import { keepsObjectBytesHeld, setTemporaryHold } from './file-hold.service';

const logger = createModuleLogger('FilePreservationService');

/** Το **ένα** πεδίο — μέλος του `FILE_HOLD_FIELDS`, άρα output-only στον κανόνα (`holdCustodyKeys()`). */
const PRESERVATION_FIELD = 'preservedFor' as const satisfies (typeof FILE_HOLD_FIELDS)[number];

/** Οι αποδείξεις που κρατά σήμερα — `null` ⇒ η τιμή είναι αλλοιωμένη (ο κριτής τη θεωρεί διατήρηση· ο γραφέας δεν την αγγίζει). */
function proofsOf(data: DocumentData | undefined): readonly string[] | null {
  const value: unknown = data?.[PRESERVATION_FIELD];
  if (value === undefined || value === null) return [];
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : null;
}

/**
 * **Βάλε την απόδειξη στη διατήρηση** — μέσα στη συναλλαγή που **γεννά** την απόδειξη, πάνω στο `current` που ο καλών
 * διάβασε στην **ίδια** συναλλαγή. Ιδεμπότητο. Επιστρέφει αν γράφτηκε. Έγγραφο που λείπει ⇒ τίποτα να διατηρηθεί.
 */
export function stagePreservation(tx: Transaction, ref: DocumentReference, current: DocumentData | undefined, proofId: string): boolean {
  if (current === undefined) return false;
  const proofs = proofsOf(current) ?? [];
  if (proofs.includes(proofId)) return false;
  tx.update(ref, { [PRESERVATION_FIELD]: [...proofs, proofId] });
  return true;
}

/**
 * **Βγάλε την απόδειξη από τη διατήρηση** — μέσα στη συναλλαγή που **ολοκληρώνει** την απόδειξη (ή διαπιστώνει ότι
 * δεν χρειάζεται πια). Ιδεμπότητο. Αλλοιωμένη τιμή ⇒ **δεν** αγγίζεται (fail-closed: μένει διατήρηση, με σφάλμα στο log).
 */
export function stagePreservationRelease(tx: Transaction, ref: DocumentReference, current: DocumentData | undefined, proofId: string): boolean {
  const proofs = proofsOf(current);
  if (proofs === null) {
    logger.error('Corrupt preservation value — left untouched (stays preserved)', { fileId: ref.id, proofId });
    return false;
  }
  if (!proofs.includes(proofId)) return false;
  tx.update(ref, { [PRESERVATION_FIELD]: proofs.filter((proof) => proof !== proofId) });
  return true;
}

/** Το ελάχιστο σχήμα για τα bytes — **πού** (θέση · κλειδί). */
interface PreservedObjectSubject extends FileStoragePlacementSubject {
  readonly storagePath?: unknown;
}

/**
 * **Κλείδωσε τα bytes** — GCS `temporaryHold`, **πριν** γραφτεί η βάση (bytes πρώτα). Πετά σε αποτυχία: ο καλών **δεν**
 * γεννά απόδειξη χωρίς διατήρηση (η επόμενη εκτέλεση ξαναδοκιμάζει).
 */
export async function preserveObjectBytes(subject: PreservedObjectSubject): Promise<void> {
  const { storagePath } = subject;
  if (typeof storagePath !== 'string' || storagePath === '') return;
  await setTemporaryHold(fileRecordBucket(subject), [storagePath], true);
}

/**
 * 🔑 **Τα bytes ακολουθούν τη βάση** — για **ένα** αντικείμενο: κλειδωμένο ανν το έγγραφο κρατά δέσμευση · record ·
 * διατήρηση. Καλείται μετά από **κάθε** πράξη διατήρησης (και όταν δεν άλλαξε τίποτα: μισή αποτυχία διορθώνεται εδώ).
 * Δεν πετά: αποτυχία ⇒ τα bytes μένουν όπως ήταν (στην ασφαλή πλευρά μετά από τοποθέτηση) και η επόμενη εκτέλεση συγκλίνει.
 */
export async function reconcilePreservedBytes(ref: DocumentReference): Promise<void> {
  try {
    const data = (await ref.get()).data();
    if (data === undefined || typeof data.storagePath !== 'string' || data.storagePath === '') return;
    await setTemporaryHold(fileRecordBucket(data), [data.storagePath], keepsObjectBytesHeld(data));
  } catch (error: unknown) {
    logger.warn('Preserved bytes not reconciled — the next run converges', { fileId: ref.id, error: getErrorMessage(error) });
  }
}
