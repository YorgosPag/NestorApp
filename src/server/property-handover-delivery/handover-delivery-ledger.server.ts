import 'server-only';

/**
 * @fileoverview **ΤΟ ΚΑΘΟΛΙΚΟ ΠΑΡΑΔΟΣΗΣ** (transmittal) — ό,τι **έχει** παραδοθεί, και η αλυσίδα αναθεωρήσεων των πηγών
 * (ADR-916 Φ-Γ1 · Δ10 · Π1).
 * @related lib/property-handover/handover-delivery-plan.ts (η κρίση που το διαβάζει) · firestore.rules (`deny_all`)
 * @module server/property-handover-delivery/handover-delivery-ledger.server
 *
 * 🔑 **Γιατί καθολικό στο γραφείο και όχι μόνο τα αντίγραφα στον αγοραστή**: το αντίγραφο είναι **του αγοραστή** — μπορεί
 *    να το σβήσει (Δ2). Η απόδειξη ότι **παραδόθηκε**, με ποιο crc32c και πότε, ανήκει στον εκδότη και πρέπει να επιζεί.
 *    Από εδώ θα χτιστεί το σφραγισμένο Πρωτόκολλο Παράδοσης (Φ-Γ2).
 * ⛔ **Αμετάβλητο**: γραμμή γεννιέται με `tx.create` (ποτέ αντικατάσταση). **Μία και μόνη** εγγραφή **απόδειξης** μετά τη
 *    γέννηση (Φ-Γ2 Σ2): το `sha256` γεννιέται `null` και γράφεται **μία** φορά από τον κατακερματισμό — σε συναλλαγή που
 *    αρνείται αν η γραμμή δεν περιγράφει πια τα bytes που μετρήθηκαν (crc32c/μέγεθος), και δεν αντικαθιστά ποτέ υπάρχον.
 * 🧷 Φ-Δ.7β — **η μόνη άλλη εγγραφή**: το ημερολόγιο `recovery` της ανάκτησης από το soft delete. Δεν αγγίζει **ποτέ** πεδίο
 *    απόδειξης (crc32c · μέγεθος · γενιά · sha256)· υπάρχει για να μη μείνει ποτέ ορφανό αντικείμενο που επαναφέραμε.
 */

import type { DocumentData, DocumentReference, Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { HANDOVER_DELIVERY_RECOVERY_LEASE_MS, HANDOVER_DELIVERY_REVISION_CHAIN_LIMIT } from '@/config/property-handover-delivery-policy';
import { nowISO } from '@/lib/date-local';
import { isFileStoragePlacement, type FileStoragePlacement } from '@/lib/files/file-storage-placement';
import { isSha256Hex } from '@/lib/hash/sha256';
import type { HandoverDeliveredRow } from '@/lib/property-handover/handover-delivery-plan';
import { handoverDeliveryIdOf } from '@/lib/property-handover/property-handover-id';
import { reconcilePreservedBytes, stagePreservationRelease } from '@/services/file-record/file-preservation.service';
import type { PropertyHandover } from '@/types/property-handover';

/** Μία γραμμή, όπως αποθηκεύεται στο `property_handover_deliveries/{phdl_*}`. */
export interface HandoverDeliveryLedgerRow extends HandoverDeliveredRow {
  readonly id: string;
  readonly companyId: string;
  readonly propertyId: string;
  readonly handoverId: string;
  readonly recipientUserId: string;
  readonly dossierId: string;
  /** Η γενιά GCS της πηγής που αντιγράφηκε — **ακριβώς** αυτή μετρήθηκε. */
  readonly sourceGeneration: string;
  readonly revisionOfFileId: string | null;
  readonly deliveredAt: string;
  /** Σ2 — **πού** μετρήθηκε το `sha256`: στο αντίγραφο του αγοραστή, ή (αν εκείνο λείπει/άλλαξε) στη γενιά-πηγή. */
  readonly sha256Of: HandoverSha256Origin | null;
  readonly hashedAt: string | null;
  /** Φ-Δ.7β — **πού** ζούσαν τα bytes της πηγής, από τη γέννηση: η γραμμή εντοπίζει την πηγή και χωρίς την εγγραφή της. */
  readonly sourceObject: HandoverSourceObject | null;
  /** Φ-Δ.7β — το ημερολόγιο της ανάκτησης από το soft delete (`null` ⇒ δεν χρειάστηκε ποτέ). */
  readonly recovery: HandoverRecoveryJournal | null;
}

/**
 * Το αντίγραφο του αγοραστή (πρώτη επιλογή — αυτό κρατά) · η καρφωμένη γενιά-πηγή (ίδια bytes, ίδιο crc32c) · ή (Φ-Δ.7β) η
 * γενιά-πηγή **επαναφερμένη από το soft delete** για τη μέτρηση — ειλικρινής προέλευση, ποτέ σιωπηλή.
 */
export type HandoverSha256Origin = 'copy' | 'source' | 'restored-source';

/** Η θέση των bytes της πηγής — **θέση** (ο κάδος βγαίνει από το `fileStorageBucket`), ποτέ ωμό όνομα κάδου. */
export interface HandoverSourceObject {
  readonly placement: FileStoragePlacement;
  readonly path: string;
}

/** Φ-Δ.7β — μίσθωση (`startedAt`) · η γενιά που **εμείς** γεννήσαμε με την επαναφορά · πότε ξανασβήστηκε. */
export interface HandoverRecoveryJournal {
  readonly startedAt: string;
  readonly restoredGeneration: string | null;
  readonly settledAt: string | null;
}

/** Ό,τι διαβάζει ο εκτελεστής από μια γραμμή: η γραμμή της κρίσης **+** η γενιά-πηγή (εφεδρεία του κατακερματισμού). */
export interface HandoverLedgerProof extends HandoverDeliveredRow {
  readonly sourceGeneration: string | null;
  readonly sourceObject: HandoverSourceObject | null;
  readonly recovery: HandoverRecoveryJournal | null;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const sha256Text = (value: unknown): string | null => (isSha256Hex(value) ? value : null);
const fieldsOf = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** Αλλοιωμένος εντοπιστής ⇒ `null` (καμία ανάκτηση) — ποτέ μαντεψιά κάδου. */
function sourceObjectOf(raw: unknown): HandoverSourceObject | null {
  const fields = fieldsOf(raw);
  const path = text(fields?.path);
  return fields !== null && isFileStoragePlacement(fields.placement) && path !== null ? { placement: fields.placement, path } : null;
}

/** Αλλοιωμένο ημερολόγιο ⇒ `null`: η επόμενη εκτέλεση το ξαναγράφει από την αρχή (η επαναφορά είναι `ifGenerationMatch: 0`). */
function recoveryOf(raw: unknown): HandoverRecoveryJournal | null {
  const fields = fieldsOf(raw);
  const startedAt = text(fields?.startedAt);
  if (fields === null || startedAt === null) return null;
  return { startedAt, restoredGeneration: text(fields.restoredGeneration), settledAt: text(fields.settledAt) };
}

/** Πεδίο προς πεδίο — μια αλλοιωμένη γραμμή **δεν** μετρά ως παράδοση (ο εκτελεστής θα ξαναδεί το αντίγραφο). */
function deliveredRowOf(raw: Record<string, unknown>): HandoverLedgerProof | null {
  const sourceFileId = text(raw.sourceFileId);
  const copyFileId = text(raw.copyFileId);
  const crc32c = text(raw.crc32c);
  const { size } = raw;
  if (sourceFileId === null || copyFileId === null || crc32c === null || typeof size !== 'number') return null;
  return {
    sourceFileId, copyFileId, crc32c, size, sha256: sha256Text(raw.sha256), sourceGeneration: text(raw.sourceGeneration),
    sourceObject: sourceObjectOf(raw.sourceObject), recovery: recoveryOf(raw.recovery),
  };
}

/** **Ό,τι έχει παραδοθεί** για αυτή την παράδοση. */
export async function readDeliveredRows(adminDb: AdminFirestore, handover: PropertyHandover): Promise<HandoverLedgerProof[]> {
  const snapshot = await adminDb.collection(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES)
    .where('companyId', '==', handover.companyId)
    .where('handoverId', '==', handover.id)
    .get();
  return snapshot.docs.flatMap((doc) => {
    const row = deliveredRowOf(doc.data());
    return row === null ? [] : [row];
  });
}

/** Η θέση της γραμμής — ντετερμινιστική από `(παράδοση, πηγή)`. */
export function deliveryLedgerRef(adminDb: AdminFirestore, handoverId: string, sourceFileId: string): DocumentReference {
  return adminDb.collection(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES).doc(handoverDeliveryIdOf(handoverId, sourceFileId));
}

/** **Η γραμμή** — μέσα στη συναλλαγή που γεννά και το αντίγραφο (ποτέ το ένα χωρίς το άλλο). Γεννιέται χωρίς sha256. */
export function stageDeliveryLedgerRow(
  tx: Transaction,
  ref: DocumentReference,
  row: Omit<HandoverDeliveryLedgerRow, 'id' | 'sha256' | 'sha256Of' | 'hashedAt' | 'recovery'>,
): void {
  tx.create(ref, { id: ref.id, ...row, sha256: null, sha256Of: null, hashedAt: null, recovery: null });
}

/**
 * Φ-Δ.7β — η κατάσταση της ανάκτησης μετά τη διεκδίκηση: `claimed` (ξεκινά — `adoptSince` = η προηγούμενη μίσθωση που
 * ίσως πρόλαβε επαναφορά πριν κρασάρει) · `resume` (η επαναφορά έγινε, μένουν μέτρηση/επαναδιαγραφή) · `busy` · `settled`.
 */
export type DeliveryRecoveryClaim =
  | { readonly kind: 'claimed'; readonly adoptSince: string | null }
  | { readonly kind: 'resume'; readonly restoredGeneration: string }
  | { readonly kind: 'busy' | 'settled' | 'missing' };

/** Ενεργή μίσθωση = ξεκίνησε πριν από λιγότερο από `HANDOVER_DELIVERY_RECOVERY_LEASE_MS`. */
const leaseActive = (startedAt: string, now: number): boolean => now - Date.parse(startedAt) < HANDOVER_DELIVERY_RECOVERY_LEASE_MS;

/** **Διεκδικεί** την ανάκτηση μιας γραμμής — δύο ταυτόχρονες εκτελέσεις: η μία `claimed`, η άλλη `busy`. */
export async function claimDeliveryRecovery(adminDb: AdminFirestore, handoverId: string, sourceFileId: string): Promise<DeliveryRecoveryClaim> {
  const ref = deliveryLedgerRef(adminDb, handoverId, sourceFileId);
  return adminDb.runTransaction(async (tx): Promise<DeliveryRecoveryClaim> => {
    const data = (await tx.get(ref)).data();
    if (data === undefined) return { kind: 'missing' };
    const journal = recoveryOf(data.recovery);
    if (journal !== null && journal.settledAt !== null) return { kind: 'settled' };
    if (journal !== null && journal.restoredGeneration !== null) return { kind: 'resume', restoredGeneration: journal.restoredGeneration };
    if (journal !== null && leaseActive(journal.startedAt, Date.now())) return { kind: 'busy' };
    tx.update(ref, { recovery: { startedAt: nowISO(), restoredGeneration: null, settledAt: null } });
    return { kind: 'claimed', adoptSince: journal === null ? null : journal.startedAt };
  });
}

/** Καταγράφει τη γενιά που **γεννήσαμε** — από εδώ και πέρα κάθε εκτέλεση ξέρει τι (και μόνο τι) να ξανασβήσει. */
export async function recordRecoveryRestored(adminDb: AdminFirestore, handoverId: string, sourceFileId: string, generation: string): Promise<void> {
  await deliveryLedgerRef(adminDb, handoverId, sourceFileId).update({ 'recovery.restoredGeneration': generation });
}

/** Κλείνει την ανάκτηση — τίποτα δεν μένει ζωντανό από εμάς. */
export async function settleDeliveryRecovery(adminDb: AdminFirestore, handoverId: string, sourceFileId: string): Promise<void> {
  await deliveryLedgerRef(adminDb, handoverId, sourceFileId).update({ 'recovery.settledAt': nowISO() });
}

/** Η έκβαση της εγγραφής του sha256 — το **αποθηκευμένο** αποτύπωμα (δικό μας ή μιας ταυτόχρονης εκτέλεσης), ή άρνηση. */
export type DeliverySha256Write = { readonly kind: 'hashed'; readonly sha256: string } | { readonly kind: 'refused' };

export interface MeasuredDeliverySha256 extends Pick<HandoverDeliveredRow, 'sourceFileId' | 'crc32c' | 'size'> {
  readonly sha256: string;
  readonly origin: HandoverSha256Origin;
}

/**
 * 🧷 Φ-Δ.7α — **η γενιά-πηγή μιας γραμμής**: η εγγραφή αρχείου της εταιρείας, **μόνο** αν ανήκει στον ίδιο ενοικιαστή με
 * τη γραμμή (ποτέ διατήρηση/αποδέσμευση σε ξένο έγγραφο).
 */
export function deliverySourceRef(adminDb: AdminFirestore, sourceFileId: string): DocumentReference {
  return adminDb.collection(COLLECTIONS.FILES).doc(sourceFileId);
}

/** Το έγγραφο-πηγή, μόνο όταν είναι του ενοικιαστή της γραμμής — αλλιώς `undefined` (καμία εγγραφή σε αυτό). */
export function ownSourceData(source: DocumentData | undefined, ledger: DocumentData | undefined): DocumentData | undefined {
  return source !== undefined && ledger !== undefined && source.companyId === ledger.companyId ? source : undefined;
}

/**
 * **Γράφει το sha256 μιας γραμμής — μία φορά.** Μέσα σε συναλλαγή: υπάρχει ήδη ⇒ επιστρέφεται το αποθηκευμένο (ποτέ
 * αντικατάσταση)· η γραμμή λείπει ή περιγράφει **άλλα** bytes (crc32c/μέγεθος) από όσα μετρήθηκαν ⇒ `refused`.
 * 🧷 Φ-Δ.7α — με το sha256 η απόδειξη **υπάρχει**: στην **ίδια** συναλλαγή η πηγή βγαίνει από τη διατήρηση (και όταν το
 * αποτύπωμα το έγραψε ταυτόχρονη εκτέλεση) — μετά, τα bytes ακολουθούν τη βάση.
 */
export async function recordDeliverySha256(adminDb: AdminFirestore, handoverId: string, measured: MeasuredDeliverySha256): Promise<DeliverySha256Write> {
  const ref = deliveryLedgerRef(adminDb, handoverId, measured.sourceFileId);
  const sourceRef = deliverySourceRef(adminDb, measured.sourceFileId);
  const outcome = await adminDb.runTransaction(async (tx): Promise<DeliverySha256Write> => {
    const [ledgerSnap, sourceSnap] = await Promise.all([tx.get(ref), tx.get(sourceRef)]);
    const data = ledgerSnap.data();
    if (data === undefined || data.crc32c !== measured.crc32c || data.size !== measured.size) return { kind: 'refused' };
    const stored = sha256Text(data.sha256);
    stagePreservationRelease(tx, sourceRef, ownSourceData(sourceSnap.data(), data), ref.id);
    if (stored !== null) return { kind: 'hashed', sha256: stored };
    tx.update(ref, { sha256: measured.sha256, sha256Of: measured.origin, hashedAt: nowISO() });
    return { kind: 'hashed', sha256: measured.sha256 };
  });
  if (outcome.kind === 'hashed') await reconcilePreservedBytes(sourceRef);
  return outcome;
}

/** Ένα βήμα της αλυσίδας: πηγή → ο διάδοχός της, για όσες έχουν. */
async function successorsOf(adminDb: AdminFirestore, companyId: string, fileIds: readonly string[]): Promise<Map<string, string>> {
  if (fileIds.length === 0) return new Map();
  const files = adminDb.collection(COLLECTIONS.FILES);
  const snaps = await adminDb.getAll(...fileIds.map((id) => files.doc(id)));
  return new Map(snaps.flatMap((snap) => {
    const data = snap.data();
    const successor = data === undefined || data.companyId !== companyId ? null : text(data.supersededByFileId);
    return successor === null ? [] : [[snap.id, successor] as const];
  }));
}

/**
 * **Νέα πηγή → η παραδομένη προηγούμενη αναθεώρησή της.** Ακολουθεί το `supersededByFileId` από κάθε παραδομένη πηγή που
 * δεν είναι πια παραδοτέα, ως `HANDOVER_DELIVERY_REVISION_CHAIN_LIMIT` βήματα (A → B → C, όπου το B δεν παραδόθηκε ποτέ).
 */
export async function predecessorsOf(
  adminDb: AdminFirestore,
  companyId: string,
  delivered: readonly HandoverDeliveredRow[],
  deliverableIds: ReadonlySet<string>,
): Promise<ReadonlyMap<string, string>> {
  const result = new Map<string, string>();
  let frontier = new Map(delivered.filter((row) => !deliverableIds.has(row.sourceFileId)).map((row) => [row.sourceFileId, row.sourceFileId]));
  for (let step = 0; step < HANDOVER_DELIVERY_REVISION_CHAIN_LIMIT && frontier.size > 0; step += 1) {
    const successors = await successorsOf(adminDb, companyId, [...frontier.keys()]);
    const next = new Map<string, string>();
    for (const [current, origin] of frontier) {
      const successor = successors.get(current);
      if (successor === undefined) continue;
      if (deliverableIds.has(successor)) result.set(successor, origin);
      else next.set(successor, origin);
    }
    frontier = next;
  }
  return result;
}
