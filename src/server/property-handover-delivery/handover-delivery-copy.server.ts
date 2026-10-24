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
import { fileDeliveryStateOf, type PlannedHandoverCopy } from '@/lib/property-handover/handover-delivery-plan';
import { isHandoverDeliverableDocument } from '@/lib/property-handover/handover-disposition';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { handoverCopyFileIdOf } from '@/lib/property-handover/property-handover-id';
import { buildProxyUrl } from '@/lib/storage/storage-object-url';
import { custodyKindOfScope } from '@/lib/workspace/custody-scope';
import { fileRecordBucket, fileStorageBucket } from '@/server/files/file-record-bucket';
import { copyProvenPairs, statObjects } from '@/server/storage/placement-copy';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { buildFinalizeFileRecordUpdate, buildPendingFileRecordData } from '@/services/file-record';
import { handoverDocRef } from '@/services/property-handover/property-handover-progress-write';
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

/** Οφείλει **ακόμη** η παράδοση αντιγραφή στον **ίδιο** παραλήπτη; — ανακλημένη (Φ-Δ.5) ή αλλαγή χεριών ⇒ όχι. */
function stillOwedTo(raw: unknown, ctx: HandoverCopyContext): boolean {
  const current = propertyHandoverFromDocument(raw, ctx.handover.id);
  return current !== null && fileDeliveryStateOf(current) !== null && current.recipient?.userId === ctx.recipientUserId;
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
  const proven = await copyProvenPairs(prepared.map((copy) => ({ source: copy.source, destinationName: copy.built.storagePath })), fileStorageBucket(placement));
  return prepared.filter((copy) => proven.has(copy.built.storagePath));
}

/**
 * **Η εγγραφή αρχείου που γεννιέται κατευθείαν `ready`** — τα bytes έχουν ήδη αποδειχτεί. Ο ΕΝΑΣ τρόπος για τα αντίγραφα
 * της παράδοσης (Φ-Γ1) **και** τα αντίτυπα του Πρωτοκόλλου (Φ-Γ2 Σ4): ποτέ δύο διατυπώσεις του «έτοιμου» σε δύο γραφείς.
 */
export function readyFileRecordData(
  built: ReturnType<typeof buildPendingFileRecordData>,
  ready: { readonly sizeBytes: number; readonly placement: FileStoragePlacement; readonly hash: string | undefined },
): Record<string, unknown> {
  return {
    ...built.recordBase,
    ...buildFinalizeFileRecordUpdate({
      sizeBytes: ready.sizeBytes, downloadUrl: buildProxyUrl(built.storagePath, ready.placement), hash: ready.hash, nextStatus: FILE_STATUS.READY,
    }),
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Εγγραφή `ready` + γραμμή καθολικού, **ατομικά**. Η επανάληψη βρίσκει και τα δύο και δεν γράφει τίποτα· αν λείπει
 * **ένα** από τα δύο (π.χ. γραμμή χειροκίνητα σβησμένη), γεννιέται **μόνο** αυτό — η απόδειξη θεραπεύεται, ποτέ διπλή.
 *
 * ⚖️ Φ-Δ.4 — **η πηγή ξαναδιαβάζεται ΜΕΣΑ στη συναλλαγή**: μια απόφαση «μένει εσωτερικό» που δεσμεύτηκε αφού διαβάστηκε
 * το σύνολο **νικά** την αντιγραφή (`withdrawn`). Ο γραφέας της απόφασης διαβάζει τη **ίδια** θέση καθολικού στη δική του
 * συναλλαγή ⇒ οι δύο σειριοποιούνται: ή η απόφαση βλέπει την παράδοση (`already-delivered`), ή η αντιγραφή βλέπει την απόφαση.
 * ↩️ Φ-Δ.5 — **και η παράδοση ξαναδιαβάζεται**: μια ανάκληση που δεσμεύτηκε αφού ξεκίνησε η δέσμη **νικά** την αντιγραφή
 * (`withdrawn`)· η ανάκληση γράφει το **ίδιο** έγγραφο ⇒ σειριοποίηση. Η θεραπεία μιας **ήδη** παραδομένης απόδειξης
 * ολοκληρώνεται πάντα (ό,τι παραδόθηκε μένει, Δ5).
 */
async function commitCopy(ctx: HandoverCopyContext, copy: PreparedCopy): Promise<HandoverLedgerProof | 'withdrawn'> {
  const { built, source, item } = copy;
  const custody = { userId: ctx.recipientUserId };
  const recordRef = handoverCopyRecordRef(ctx.adminDb, ctx.recipientUserId, built.fileId);
  const sourceGeneration = String(source.metadata.generation ?? '');
  const row: HandoverLedgerProof = {
    sourceFileId: item.sourceFileId, copyFileId: built.fileId, crc32c: String(source.metadata.crc32c), size: Number(source.metadata.size),
    sha256: null, sourceGeneration,
  };
  const ledgerRef = deliveryLedgerRef(ctx.adminDb, ctx.handover.id, item.sourceFileId);
  const committed = await ctx.adminDb.runTransaction(async (tx) => {
    const [recordSnap, ledgerSnap, sourceSnap, handoverSnap] = await Promise.all([
      tx.get(recordRef), tx.get(ledgerRef), tx.get(item.file.doc.ref), tx.get(handoverDocRef(ctx.adminDb, ctx.handover.id)),
    ]);
    // Θεραπεία (υπάρχει ήδη ένα από τα δύο) = ήταν παραδομένο ⇒ η απόδειξη ολοκληρώνεται πάντα (Δ5: ό,τι παραδόθηκε μένει).
    const healing = recordSnap.exists || ledgerSnap.exists;
    if (!healing && (!isHandoverDeliverableDocument(sourceSnap.data()) || !stillOwedTo(handoverSnap.data(), ctx))) return false;
    if (!recordSnap.exists) {
      tx.create(recordRef, readyFileRecordData(built, { sizeBytes: row.size, placement: copy.placement, hash: text(item.file.doc.data().hash) }));
    }
    if (!ledgerSnap.exists) stageDeliveryLedgerRow(tx, ledgerRef, {
      sourceFileId: row.sourceFileId, copyFileId: row.copyFileId, crc32c: row.crc32c, size: row.size,
      companyId: ctx.handover.companyId, propertyId: ctx.handover.propertyId, handoverId: ctx.handover.id,
      recipientUserId: ctx.recipientUserId, dossierId: copy.dossierId, sourceGeneration,
      revisionOfFileId: copy.revisionOfFileId, deliveredAt: nowISO(),
    });
    return true;
  });
  if (!committed) {
    // Τα bytes γράφτηκαν ήδη στο κλειδί του αγοραστή χωρίς εγγραφή — αόρατα, αλλά δεν τα αφήνουμε (καλύτερη προσπάθεια).
    await fileStorageBucket(copy.placement).file(built.storagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
    return 'withdrawn';
  }
  await recordFileAudit({
    fileId: built.fileId, action: 'handover_receive', performedBy: HANDOVER_DELIVERY_ACTOR, ...custody,
    metadata: { handoverId: ctx.handover.id, sourceFileId: item.sourceFileId, issuerCompanyId: ctx.handover.companyId },
  });
  return row;
}

export interface HandoverCopyBatchResult {
  readonly rows: readonly HandoverLedgerProof[];
  /** Φ-Δ.4 — δεν είναι πια παραδοτέα (απόφαση γραφείου μέσα στο παράθυρο) — **ούτε** αποτυχία **ούτε** παράδοση. */
  readonly withdrawn: number;
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
  let withdrawn = 0;
  for (const copy of proven) {
    try {
      const outcome = await commitCopy(ctx, copy);
      if (outcome === 'withdrawn') withdrawn += 1;
      else rows.push(outcome);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { rows, withdrawn, failed: planned.length - rows.length - withdrawn, lastError: errors.at(-1) ?? null };
}
