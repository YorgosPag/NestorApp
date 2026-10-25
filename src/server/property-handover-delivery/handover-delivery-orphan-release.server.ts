import 'server-only';

/**
 * @fileoverview **ΑΡΣΗ ΔΙΑΤΗΡΗΣΗΣ ΟΡΦΑΝΩΝ BYTES + ΠΑΡΑΔΟΣΗ ΣΤΟΝ ORPHAN SWEEPER** (ADR-916 §5.24 · Ο24 · ADR-694).
 * @related lib/property-handover/handover-orphan-release-journal.ts (το ημερολόγιο) · services/file-record/file-hold.service.ts
 *          (`releaseTemporaryHoldIfSame` — ο ένας γραφέας του διακόπτη) · server/storage/orphan-candidate-mark.server.ts (το σημάδι)
 * @module server/property-handover-delivery/handover-delivery-orphan-release.server
 *
 * **Το πρόβλημα**: πηγή σβησμένη **εκτός** εφαρμογής ενώ τη διατηρούσε η απόδειξη (Φ-Δ.7α) ⇒ το GCS `temporaryHold` μένει, και
 * η συμφιλίωση «τα bytes ακολουθούν τη βάση» δεν βρίσκει βάση. **Το πρότυπο (Purview)**: η άρση **δεν** διαγράφει — το περιεχόμενο
 * γίνεται *eligible for the standard cleanup process*· *«retention/hold wins over deletion»*. Άρα: άρση **υπό συνθήκη** + σημάδι
 * υποψηφίου ⇒ ο **υπάρχων** sweeper (7 ημ. ωρίμανση · επανέλεγχος κηδεμονίας · max 50/εκτέλεση) μένει ο **μόνος** που σβήνει.
 *
 * 🔑 **Όλα υποχρεωτικά, αλλιώς «κράτα» με λόγο** (κλειστό λεξιλόγιο): η απόδειξη έκλεισε · καμία `FileRecord` δεν διεκδικεί · καμία
 *    άλλη οφειλόμενη απόδειξη δεν περιμένει τα ίδια bytes · κανένα σημάδι νόμιμης δέσμευσης · τα bytes είναι **τα δικά μας**.
 * 🛡️ **Ποτέ δεν πετά** — ανάγνωση που αποτυγχάνει ⇒ `unreadable` (κράτα, το δίχτυ ξαναρωτά).
 */

import type { Firestore as AdminFirestore, DocumentData } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { fileStoragePlacementOf } from '@/lib/files/file-storage-placement';
import { fileRecordIdOfPathSegments } from '@/lib/files/storage-orphan-candidate';
import { isSha256Hex } from '@/lib/hash/sha256';
import { stillOwedToRecipient } from '@/lib/property-handover/handover-delivery-plan';
import { orphanReleaseOf } from '@/lib/property-handover/handover-orphan-release-journal';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { fileStorageBucket } from '@/server/files/file-record-bucket';
import { markOrphanedFileObject } from '@/server/storage/orphan-candidate-mark.server';
import { releaseTemporaryHoldIfSame } from '@/services/file-record/file-hold.service';
import { missingFileHoldEvidence } from '@/services/file-record/file-orphan-hold-evidence';
import { handoverDocRef } from '@/services/property-handover/property-handover-progress-write';
import type { HandoverOrphanReleaseJournal, HandoverOrphanReleaseKeepReason, HandoverOrphanReleaseState } from '@/types/property-handover-orphan-release';

import {
  closureMarkOf,
  deliveryLedgerRef,
  deliverySourceRef,
  recoveryInFlight,
  sourceObjectOf,
  type HandoverSourceObject,
} from './handover-delivery-ledger.server';

const logger = createModuleLogger('PropertyHandoverOrphanRelease');

/** Η γραμμή, όσο χρειάζεται η απόφαση. */
interface OrphanLine {
  readonly lineId: string;
  readonly handoverId: string;
  readonly sourceFileId: string;
  readonly companyId: string;
  readonly location: HandoverSourceObject;
  readonly crc32c: string;
  readonly size: number;
  readonly journal: HandoverOrphanReleaseJournal;
  readonly data: DocumentData;
}

/** `skipped` ⇒ καμία πρόθεση (ή ήδη τελική) — τίποτα να γίνει. */
export type OrphanReleaseRun = HandoverOrphanReleaseState | 'skipped';

/** Ανοιχτή γραμμή = χωρίς sha256 **και** χωρίς κλείσιμο. */
const lineOpen = (data: DocumentData): boolean => !isSha256Hex(data.sha256) && closureMarkOf(data.closure) === null;

/** Οφείλεται ακόμη η παράδοση της γραμμής στον παραλήπτη της; — το ίδιο SSoT με την πόρτα του κλεισίματος. */
async function stillOwed(adminDb: AdminFirestore, data: DocumentData): Promise<boolean> {
  const { handoverId, recipientUserId } = data;
  if (typeof handoverId !== 'string' || typeof recipientUserId !== 'string') return true;
  const handover = propertyHandoverFromDocument((await handoverDocRef(adminDb, handoverId).get()).data(), handoverId);
  return stillOwedToRecipient(handover, recipientUserId);
}

/** (2) Διεκδικεί κάποια `FileRecord` το όνομα; — η ίδια πηγή · ο κάτοχος κατά τον κανόνα `files` · όποια δείχνει το ίδιο path. */
async function claimReasonOf(adminDb: AdminFirestore, line: OrphanLine): Promise<HandoverOrphanReleaseKeepReason | null> {
  const { path, placement } = line.location;
  const ownerId = path.startsWith('companies/') ? fileRecordIdOfPathSegments(path.split('/')) : null;
  if (ownerId === null) return 'unrecognized-path';
  const files = adminDb.collection(COLLECTIONS.FILES);
  const [source, owner] = await Promise.all([deliverySourceRef(adminDb, line.sourceFileId).get(), files.doc(ownerId).get()]);
  if (source.exists || owner.exists) return 'claimed';
  const sharing = await adminDb.collection(COLLECTIONS.FILES)
    .where('companyId', '==', line.companyId)
    .where('storagePath', '==', path)
    .get();
  const samePlacement = (data: DocumentData): boolean => {
    try { return fileStoragePlacementOf(data) === placement; } catch { return true; } // άγνωστη θέση ⇒ διεκδικεί (fail-closed)
  };
  return sharing.docs.some((doc) => samePlacement(doc.data())) ? 'claimed' : null;
}

/** (3) Περιμένει **άλλη** οφειλόμενη απόδειξη τα ίδια bytes; */
async function openProofElsewhere(adminDb: AdminFirestore, line: OrphanLine): Promise<boolean> {
  const rows = await adminDb.collection(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES)
    .where('companyId', '==', line.companyId)
    .where('sourceFileId', '==', line.sourceFileId)
    .get();
  for (const doc of rows.docs) {
    if (doc.id !== line.lineId && lineOpen(doc.data()) && (await stillOwed(adminDb, doc.data()))) return true;
  }
  return false;
}

/** Οι συνθήκες 1–4 — `null` ⇒ ελεύθερο να λυθεί. */
async function keepReasonOf(adminDb: AdminFirestore, line: OrphanLine): Promise<HandoverOrphanReleaseKeepReason | null> {
  if (lineOpen(line.data) && (await stillOwed(adminDb, line.data))) return 'open-proof';
  const claim = await claimReasonOf(adminDb, line);
  if (claim !== null) return claim;
  if (await openProofElsewhere(adminDb, line)) return 'open-proof';
  return (await missingFileHoldEvidence(line.companyId, line.sourceFileId)) ? 'hold-evidence' : null;
}

/** (5)+(6) Άρση υπό συνθήκη και σημάδι υποψηφίου — `null` ⇒ η metageneration άλλαξε (μένει `pending`). */
async function releaseAndMark(line: OrphanLine): Promise<{ readonly state: HandoverOrphanReleaseState; readonly reason: HandoverOrphanReleaseKeepReason | null } | null> {
  const { path, placement } = line.location;
  const released = await releaseTemporaryHoldIfSame(fileStorageBucket(placement), path, { crc32c: line.crc32c, size: line.size });
  if (released === 'raced') return null;
  if (released === 'gone') return { state: 'gone', reason: null };
  if (released === 'foreign-object') return { state: 'kept', reason: 'foreign-object' };
  await markOrphanedFileObject({ placement, path, size: line.size, fileId: line.sourceFileId });
  return { state: 'released', reason: null };
}

/** Η γραμμή με πρόθεση που χρειάζεται απόφαση — αλλιώς `null`. */
function orphanLineOf(lineId: string, handoverId: string, sourceFileId: string, data: DocumentData | undefined): OrphanLine | null {
  const journal = data === undefined ? null : orphanReleaseOf(data.orphanRelease);
  if (data === undefined || journal === null || journal.state === 'released' || journal.state === 'gone') return null;
  const location = sourceObjectOf(data.sourceObject);
  const { companyId, crc32c, size } = data;
  if (location === null || typeof companyId !== 'string' || typeof crc32c !== 'string' || typeof size !== 'number') return null;
  return { lineId, handoverId, sourceFileId, companyId, location, crc32c, size, journal, data };
}

/**
 * **Λύσε τη διατήρηση των ορφανών bytes μιας γραμμής** — ιδεμπότητο, ποτέ δεν πετά. Το καλούν οι τρεις διαδρομές που κλείνουν
 * γραμμή (μετά τη συναλλαγή τους) **και** το δίχτυ, για ημερολόγια που μένουν επαναλήψιμα.
 */
export async function releaseOrphanedSourceBytes(adminDb: AdminFirestore, handoverId: string, sourceFileId: string): Promise<OrphanReleaseRun> {
  const ref = deliveryLedgerRef(adminDb, handoverId, sourceFileId);
  try {
    const line = orphanLineOf(ref.id, handoverId, sourceFileId, (await ref.get()).data());
    if (line === null) return 'skipped';
    // Φ-Δ.7β σε εξέλιξη — η δική μας επαναφερμένη γενιά θα ξανασβηστεί από εμάς· η απόφαση περιμένει το κλείσιμό της.
    if (recoveryInFlight(line.data.recovery)) return 'pending';
    const reason = await keepReasonOf(adminDb, line).catch((error: unknown): HandoverOrphanReleaseKeepReason => {
      logger.warn('Ορφανά bytes: ανάγνωση απέτυχε — κρατιούνται (Ο24)', { lineId: line.lineId, error: getErrorMessage(error) });
      return 'unreadable';
    });
    // Σφάλμα ΜΕΤΑ την απόφαση (GCS · σημάδι) ⇒ καμία καταγραφή: μένει `pending` και το δίχτυ ξαναπερνά (η άρση είναι ιδεμπότητη).
    const outcome = reason === null ? await releaseAndMark(line) : { state: 'kept' as const, reason };
    if (outcome === null) return 'pending';
    // Ολόκληρο το ημερολόγιο (όχι dotted πεδία): ένα αλλοιωμένο `orphanRelease` ξαναγράφεται καθαρό.
    const settledAt = nowISO();
    await ref.update({ orphanRelease: { ...outcome, since: line.journal.since || settledAt, settledAt } });
    logger.warn('Ορφανά bytes πηγής παράδοσης (Ο24)', { lineId: line.lineId, path: line.location.path, ...outcome });
    return outcome.state;
  } catch (error: unknown) {
    logger.warn('Ορφανά bytes: η απόφαση δεν καταγράφηκε — το δίχτυ ξαναδοκιμάζει (Ο24)', { lineId: ref.id, error: getErrorMessage(error) });
    return 'pending';
  }
}
