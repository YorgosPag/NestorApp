import 'server-only';

/**
 * @fileoverview **ΕΝΑ ΑΡΧΕΙΟ ΣΤΟΝ ΦΑΚΕΛΟ ΤΟΥ ΑΓΟΡΑΣΤΗ** — bytes → απόδειξη → εγγραφή + καθολικό (ADR-916 Φ-Γ1 · Δ2 · Π2).
 * @related server/storage/placement-copy.ts (ο ΕΝΑΣ μηχανισμός αντιγραφής) · services/file-record (ο ΕΝΑΣ builder) ·
 *          handover-delivery-ledger.server.ts (η απόδειξη του γραφείου)
 * @module server/property-handover-delivery/handover-delivery-copy.server
 *
 * 🔴 **Η σειρά είναι το συμβόλαιο** — ποτέ εγγραφή χωρίς bytes:
 *   1. **rewrite** των bytes στο ντετερμινιστικό κλειδί του αγοραστή (καρφωμένη γενιά πηγής, χωρίς download token)·
 *   2. **απόδειξη**: crc32c + μέγεθος του αντιγράφου, όπως τα μέτρησε το GCS, ίδια με της πηγής·
 *   3. **μία συναλλαγή**: η εγγραφή αρχείου γεννιέται **κατευθείαν** `ready` **μαζί** με τη γραμμή του καθολικού·
 *   4. μετά το commit: η γραμμή ιστορικού του αρχείου (`handover_receive`).
 * Διακοπή μετά το 1 ⇒ η επόμενη εκτέλεση βρίσκει πανομοιότυπο αντικείμενο, **δεν** ξανααντιγράφει, γράφει την εγγραφή.
 *
 * 🔑 **Γέννηση personal χωρίς CDE** (CHECK 3.87): το αντίγραφο είναι **του αγοραστή** — καμία φάση ISO, καμία ορατότητα
 * γραφείου, κανένα πεδίο της πηγής πέρα από όσα περιγράφουν το έγγραφο (τομέας · κατηγορία · σκοπός · ετικέτα).
 */

import type { DocumentReference, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { File } from '@google-cloud/storage';

import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { fileStoragePlacementOf, type FileStoragePlacement } from '@/lib/files/file-storage-placement';
import { placementForNewFile } from '@/lib/files/new-file-placement';
import { FieldValue } from '@/lib/firebaseAdmin';
import type { PlannedHandoverCopy } from '@/lib/property-handover/handover-delivery-plan';
import { handoverCopyFileIdOf } from '@/lib/property-handover/property-handover-id';
import { buildProxyUrl } from '@/lib/storage/storage-object-url';
import { custodyKindOfScope } from '@/lib/workspace/custody-scope';
import { fileRecordBucket, fileStorageBucket } from '@/server/files/file-record-bucket';
import { copyPairs, missingPairsIn, sameObject, statObjects } from '@/server/storage/placement-copy';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { buildFinalizeFileRecordUpdate, buildPendingFileRecordData } from '@/services/file-record';
import type { DeliverableHandoverFile } from '@/services/property-handover/property-handover-set.server';
import type { PropertyHandover } from '@/types/property-handover';

import { deliveryLedgerRef, stageDeliveryLedgerRow, type HandoverLedgerProof } from './handover-delivery-ledger.server';
import { handoverEntityKey, type HandoverDossierTargets } from './handover-delivery-dossiers.server';

/** Ο δρών της παράδοσης στο ιστορικό — ονομασμένος αυτοματισμός, ποτέ ο αγοραστής (δεν το ανέβασε εκείνος). */
export const HANDOVER_DELIVERY_ACTOR = 'system:property-handover';

export interface HandoverDeliverableItem {
  readonly sourceFileId: string;
  readonly file: DeliverableHandoverFile;
}

export interface HandoverCopyContext {
  readonly adminDb: AdminFirestore;
  readonly handover: PropertyHandover;
  readonly recipientUserId: string;
  readonly targets: HandoverDossierTargets;
}

/** Ένα αρχείο έτοιμο για αντιγραφή — πηγή μετρημένη, προορισμός χτισμένος από τον ΕΝΑ builder. */
interface PreparedCopy {
  readonly item: HandoverDeliverableItem;
  readonly source: File;
  readonly placement: FileStoragePlacement;
  readonly dossierId: string;
  readonly built: ReturnType<typeof buildPendingFileRecordData>;
  readonly revisionOfFileId: string | null;
}

/** Η εγγραφή του αντιγράφου στο personal διαμέρισμα του αγοραστή — η ΜΙΑ θέση (αντιγραφή · κατακερματισμός Σ2). */
export function handoverCopyRecordRef(adminDb: AdminFirestore, recipientUserId: string, copyFileId: string): DocumentReference {
  return adminDb.collection(COLLECTIONS[FILE_COLLECTION[custodyKindOfScope({ userId: recipientUserId })]]).doc(copyFileId);
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);
const texts = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : undefined;

async function prepareCopy(ctx: HandoverCopyContext, planned: PlannedHandoverCopy<HandoverDeliverableItem>): Promise<PreparedCopy> {
  const item = planned.deliverable;
  const data = item.file.doc.data();
  const storagePath = text(data.storagePath);
  const dossierId = ctx.targets.byEntity.get(handoverEntityKey(item.file.candidate.entityType, text(data.entityId) ?? ''));
  if (storagePath === undefined) throw new Error(`File ${item.sourceFileId} has no storagePath`);
  if (dossierId === undefined) throw new Error(`No destination dossier for file ${item.sourceFileId}`);
  const [source] = await statObjects(fileRecordBucket(data), [storagePath]);
  if (source === undefined || source.metadata.crc32c === undefined) throw new Error(`Missing bytes for file ${item.sourceFileId}`);
  const placement = placementForNewFile({ kind: 'handover-copy', sourcePlacement: fileStoragePlacementOf(data) });
  const { candidate } = item.file;
  const built = buildPendingFileRecordData({
    userId: ctx.recipientUserId, entityType: ENTITY_TYPES.PROPERTY_DOSSIER, entityId: dossierId,
    domain: candidate.domain, category: candidate.category, purpose: candidate.purpose,
    originalFilename: text(data.originalFilename) ?? item.file.preview.displayName,
    contentType: text(data.contentType) ?? 'application/octet-stream', ext: text(data.ext),
    entityLabel: text(data.entityLabel), descriptors: texts(data.descriptors), createdBy: HANDOVER_DELIVERY_ACTOR,
    uploaderName: ctx.targets.main.origin?.issuerName ?? undefined, storagePlacement: placement,
    fileId: handoverCopyFileIdOf(ctx.handover.id, item.sourceFileId),
    handoverOrigin: {
      handoverId: ctx.handover.id, sourceFileId: item.sourceFileId, issuerCompanyId: ctx.handover.companyId,
      crc32c: source.metadata.crc32c, size: Number(source.metadata.size), revisionOfFileId: planned.revisionOfFileId,
    },
  });
  return { item, source, placement, dossierId, built, revisionOfFileId: planned.revisionOfFileId };
}

/** Bytes → απόδειξη, για μία θέση. Επιστρέφει όσα **αποδείχτηκαν** πανομοιότυπα στον προορισμό. */
async function copyAndProve(prepared: readonly PreparedCopy[], placement: FileStoragePlacement): Promise<PreparedCopy[]> {
  const target = fileStorageBucket(placement);
  const pairs = prepared.map((copy) => ({ source: copy.source, destinationName: copy.built.storagePath }));
  await copyPairs(await missingPairsIn(target, pairs), target);
  const present = new Map((await statObjects(target, pairs.map((pair) => pair.destinationName))).map((file) => [file.name, file] as const));
  return prepared.filter((copy) => {
    const destination = present.get(copy.built.storagePath);
    return destination !== undefined && sameObject(copy.source, destination);
  });
}

/**
 * Εγγραφή `ready` + γραμμή καθολικού, **ατομικά**. Η επανάληψη βρίσκει και τα δύο και δεν γράφει τίποτα· αν λείπει
 * **ένα** από τα δύο (π.χ. γραμμή χειροκίνητα σβησμένη), γεννιέται **μόνο** αυτό — η απόδειξη θεραπεύεται, ποτέ διπλή.
 */
async function commitCopy(ctx: HandoverCopyContext, copy: PreparedCopy): Promise<HandoverLedgerProof> {
  const { built, source, item } = copy;
  const custody = { userId: ctx.recipientUserId };
  const recordRef = handoverCopyRecordRef(ctx.adminDb, ctx.recipientUserId, built.fileId);
  const sourceGeneration = String(source.metadata.generation ?? '');
  const row: HandoverLedgerProof = {
    sourceFileId: item.sourceFileId, copyFileId: built.fileId, crc32c: String(source.metadata.crc32c), size: Number(source.metadata.size),
    sha256: null, sourceGeneration,
  };
  const ledgerRef = deliveryLedgerRef(ctx.adminDb, ctx.handover.id, item.sourceFileId);
  await ctx.adminDb.runTransaction(async (tx) => {
    const [recordSnap, ledgerSnap] = await Promise.all([tx.get(recordRef), tx.get(ledgerRef)]);
    if (!recordSnap.exists) tx.create(recordRef, {
      ...built.recordBase,
      ...buildFinalizeFileRecordUpdate({
        sizeBytes: row.size, downloadUrl: buildProxyUrl(built.storagePath, copy.placement),
        hash: text(item.file.doc.data().hash), nextStatus: FILE_STATUS.READY,
      }),
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    if (!ledgerSnap.exists) stageDeliveryLedgerRow(tx, ledgerRef, {
      sourceFileId: row.sourceFileId, copyFileId: row.copyFileId, crc32c: row.crc32c, size: row.size,
      companyId: ctx.handover.companyId, propertyId: ctx.handover.propertyId, handoverId: ctx.handover.id,
      recipientUserId: ctx.recipientUserId, dossierId: copy.dossierId, sourceGeneration,
      revisionOfFileId: copy.revisionOfFileId, deliveredAt: nowISO(),
    });
  });
  await recordFileAudit({
    fileId: built.fileId, action: 'handover_receive', performedBy: HANDOVER_DELIVERY_ACTOR, ...custody,
    metadata: { handoverId: ctx.handover.id, sourceFileId: item.sourceFileId, issuerCompanyId: ctx.handover.companyId },
  });
  return row;
}

export interface HandoverCopyBatchResult {
  readonly rows: readonly HandoverLedgerProof[];
  readonly failed: number;
  readonly lastError: string | null;
}

/**
 * **Μία δέσμη** — κάθε αρχείο κρίνεται χωριστά: η αποτυχία ενός **δεν** σταματά τα άλλα (μετριέται, ξαναδοκιμάζεται στην
 * επόμενη εκτέλεση). Τα bytes ανά θέση σε μία κλήση `copyPairs` (8 ταυτόχρονα).
 */
export async function copyHandoverBatch(
  ctx: HandoverCopyContext,
  planned: readonly PlannedHandoverCopy<HandoverDeliverableItem>[],
): Promise<HandoverCopyBatchResult> {
  const errors: string[] = [];
  const prepared = (await Promise.all(planned.map((entry) => prepareCopy(ctx, entry).catch((error: unknown) => {
    errors.push(error instanceof Error ? error.message : String(error));
    return null;
  })))).filter((copy): copy is PreparedCopy => copy !== null);
  const placements = [...new Set(prepared.map((copy) => copy.placement))];
  const proven = (await Promise.all(placements.map((placement) => copyAndProve(prepared.filter((copy) => copy.placement === placement), placement)))).flat();
  if (proven.length < prepared.length) errors.push(`${prepared.length - proven.length} αντίγραφα δεν αποδείχτηκαν πανομοιότυπα`);
  const rows: HandoverLedgerProof[] = [];
  for (const copy of proven) {
    try {
      rows.push(await commitCopy(ctx, copy));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { rows, failed: planned.length - rows.length, lastError: errors.at(-1) ?? null };
}
