import 'server-only';

/**
 * @fileoverview **ΠΟΥ ΖΟΥΝ ΑΚΟΜΗ ΤΑ ΠΑΡΑΔΟΜΕΝΑ BYTES** — οι υποψήφιες θέσεις μιας γραμμής καθολικού και η **μέτρηση** «αποδείξιμη
 *               · ανακτώμενη · οριστικά χαμένη» (ADR-916 Φ-Γ2 Σ2 · Φ-Δ.7β · Φ-Δ.7γ).
 * @related handover-delivery-hash.server.ts (ο κατακερματισμός — μετρά τις ζωντανές υποψήφιες) ·
 *          handover-delivery-recovery.server.ts (η ανάκτηση από το soft delete) ·
 *          lib/property-handover/handover-line-closure.ts (η κρίση πάνω στη μέτρηση)
 * @module server/property-handover-delivery/handover-delivery-evidence.server
 *
 * 🔑 **Μία μέτρηση, δύο ερωτήσεις**: ο κατακερματισμός ρωτά «ποια ζωντανή θέση κρατά τα bytes της γραμμής;» και η πόρτα του
 *    κλεισίματος ρωτά «υπάρχει **καμία** ελπίδα να μετρηθούν;». Αν απαντούσαν δύο κώδικες, η πόρτα θα μπορούσε να κλείσει
 *    γραμμή που ο κατακερματισμός θα αποδείκνυε στην επόμενη εκτέλεση.
 * 🔴 **Ποτέ ξένα bytes**: θέση γίνεται δεκτή **μόνο** αν η γενιά της έχει το crc32c **και** το μέγεθος της γραμμής (και, για
 *    την πηγή, την καρφωμένη γενιά). Εγγραφή **ξένου** ενοικιαστή ⇒ καμία θέση (ποτέ εφεδρεία πάνω από άρνηση ενοικιαστή).
 * 🔒 **Μόνο ανάγνωση**: εδώ δεν επαναφέρεται, δεν γράφεται, δεν σβήνεται τίποτα.
 */

import type { Bucket, File } from '@google-cloud/storage';
import type { DocumentData } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { fileRecordBucket, fileStorageBucket } from '@/server/files/file-record-bucket';
import { statObjects } from '@/server/storage/placement-copy';
import { statSoftDeleted } from '@/server/storage/soft-deleted-object.server';
import type { HandoverLineEvidence } from '@/types/property-handover-line-closure';

import { handoverCopyRecordRef, type HandoverCopyContext } from './handover-delivery-copy.server';
import type { HandoverLedgerProof, HandoverSha256Origin } from './handover-delivery-ledger.server';

export type HandoverEvidenceContext = Pick<HandoverCopyContext, 'adminDb' | 'handover' | 'recipientUserId'>;

/** Πού ζει ένα αντικείμενο: κάδος + όνομα. */
interface StoredLocation {
  readonly bucket: Bucket;
  readonly path: string;
}

/** Μία θέση που **ίσως** κρατά τα παραδομένα bytes. `generation` ⇒ μόνο αυτή η γενιά γίνεται δεκτή. */
export interface HashCandidate {
  readonly origin: HandoverSha256Origin;
  readonly location: StoredLocation | null;
  readonly generation: string | null;
}

/** Η θέση των bytes μιας εγγραφής — `null` αν λείπει η εγγραφή ή η διαδρομή της. */
function locationOfRecord(record: DocumentData | undefined): StoredLocation | null {
  const path: unknown = record?.storagePath;
  if (record === undefined || typeof path !== 'string' || path === '') return null;
  return { bucket: fileRecordBucket(record), path };
}

/**
 * Η θέση της **πηγής**: από την εγγραφή της εταιρείας· αν η εγγραφή **λείπει** (σβήστηκε εκτός εφαρμογής), από τον
 * εντοπιστή της γραμμής (Φ-Δ.7β) — η καρφωμένη γενιά εγγυάται ότι μετριούνται μόνο τα ίδια bytes.
 */
function sourceLocationOf(ctx: HandoverEvidenceContext, row: HandoverLedgerProof, source: DocumentData | undefined): StoredLocation | null {
  // Χωρίς γνωστή γενιά-πηγή δεν αποδεικνύεται ποια bytes παραδόθηκαν ⇒ καμία εφεδρεία.
  if (row.sourceGeneration === null) return null;
  if (source !== undefined) return source.companyId === ctx.handover.companyId ? locationOfRecord(source) : null;
  const located = row.sourceObject;
  return located === null ? null : { bucket: fileStorageBucket(located.placement), path: located.path };
}

/** Οι υποψήφιες κάθε γραμμής — εγγραφές μόνο του **σωστού** κατόχου (αγοραστής · μισθωτής), με **μία** ανάγνωση. */
export async function candidatesOf(ctx: HandoverEvidenceContext, rows: readonly HandoverLedgerProof[]): Promise<Map<string, HashCandidate[]>> {
  if (rows.length === 0) return new Map();
  const files = ctx.adminDb.collection(COLLECTIONS.FILES);
  const snaps = await ctx.adminDb.getAll(
    ...rows.map((row) => handoverCopyRecordRef(ctx.adminDb, ctx.recipientUserId, row.copyFileId)),
    ...rows.map((row) => files.doc(row.sourceFileId)),
  );
  return new Map(rows.map((row, i) => {
    const copy = snaps[i]?.data();
    const source = snaps[rows.length + i]?.data();
    return [row.sourceFileId, [
      { origin: 'copy', location: copy?.userId === ctx.recipientUserId ? locationOfRecord(copy) : null, generation: null },
      { origin: 'source', location: sourceLocationOf(ctx, row, source), generation: row.sourceGeneration },
    ]];
  }));
}

/**
 * **Η ζωντανή γενιά μιας υποψήφιας — μόνο αν κρατά τα bytes της γραμμής** (crc32c + μέγεθος, γενιά αν ζητήθηκε). `null` ⇒
 * λείπει ή είναι άλλα bytes. Σφάλμα δικτύου **πετά**: «δεν ξέρω» δεν είναι ποτέ «λείπει».
 */
export async function liveRowBytes(row: HandoverLedgerProof, candidate: HashCandidate): Promise<File | null> {
  if (candidate.location === null) return null;
  const [file] = await statObjects(candidate.location.bucket, [candidate.location.path]);
  if (file === undefined) return null;
  const { crc32c, size, generation } = file.metadata;
  if (crc32c !== row.crc32c || Number(size) !== row.size) return null;
  return candidate.generation !== null && String(generation) !== candidate.generation ? null : file;
}

/**
 * Ανοιχτό ημερολόγιο **με γενιά που γεννήσαμε** — η επαναφορά έγινε και μένουν μέτρηση/επαναδιαγραφή. Μια σκέτη μίσθωση
 * (χωρίς γενιά) **δεν** μετρά: μένει ανοιχτή π.χ. όταν ξένο ζωντανό αντικείμενο έπιασε το όνομα, και θα κρατούσε τη γραμμή
 * «σε ανάκτηση» για πάντα· εκεί αποφασίζει η soft-deleted γενιά, που είναι η αλήθεια.
 */
const recoveryOpen = (row: HandoverLedgerProof): boolean =>
  row.recovery !== null && row.recovery.settledAt === null && row.recovery.restoredGeneration !== null;

/** Η soft-deleted γενιά-πηγή κρατά ακόμη τα bytes της γραμμής; — η Φ-Δ.7β μπορεί ακόμη να τα αποδείξει. */
async function softDeletedSourceHolds(row: HandoverLedgerProof): Promise<boolean> {
  if (row.sourceObject === null || row.sourceGeneration === null) return false;
  const deleted = await statSoftDeleted(fileStorageBucket(row.sourceObject.placement), row.sourceObject.path, row.sourceGeneration);
  return deleted !== null && deleted.metadata.crc32c === row.crc32c && Number(deleted.metadata.size) === row.size;
}

/**
 * **Η μέτρηση μιας γραμμής, τώρα** (Φ-Δ.7γ). `lost` **μόνο** όταν τίποτα δεν μπορεί πια να αποδείξει τα bytes: καμία ζωντανή
 * υποψήφια, κανένα ανοιχτό ημερολόγιο, και η soft-deleted γενιά δεν υπάρχει (ή η γραμμή δεν κατέγραψε ποτέ πού ήταν η πηγή).
 * Ό,τι άλλο ⇒ η απόδειξη ίσως έρθει μόνη της. Σφάλμα δικτύου **πετά** — ο καλών δεν κλείνει τίποτα στα τυφλά.
 */
export async function probeDeliveredRow(row: HandoverLedgerProof, candidates: readonly HashCandidate[]): Promise<HandoverLineEvidence> {
  if (row.sha256 !== null) return { kind: 'proven' };
  if (row.closure !== null) return { kind: 'closed' };
  for (const candidate of candidates) {
    if ((await liveRowBytes(row, candidate)) !== null) return { kind: 'provable' };
  }
  if (recoveryOpen(row)) return { kind: 'recovering' };
  if (row.sourceObject === null || row.sourceGeneration === null) return { kind: 'lost', cause: 'source-unlocated' };
  return (await softDeletedSourceHolds(row)) ? { kind: 'recovering' } : { kind: 'lost', cause: 'bytes-gone' };
}
