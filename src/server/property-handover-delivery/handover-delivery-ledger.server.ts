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
 * ⛔ **Αμετάβλητο**: γραμμή γεννιέται με `tx.create` (ποτέ αντικατάσταση) και δεν αλλάζει ποτέ.
 */

import type { DocumentReference, Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { HANDOVER_DELIVERY_REVISION_CHAIN_LIMIT } from '@/config/property-handover-delivery-policy';
import type { HandoverDeliveredRow } from '@/lib/property-handover/handover-delivery-plan';
import { handoverDeliveryIdOf } from '@/lib/property-handover/property-handover-id';
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
}

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** Πεδίο προς πεδίο — μια αλλοιωμένη γραμμή **δεν** μετρά ως παράδοση (ο εκτελεστής θα ξαναδεί το αντίγραφο). */
function deliveredRowOf(raw: Record<string, unknown>): HandoverDeliveredRow | null {
  const sourceFileId = text(raw.sourceFileId);
  const copyFileId = text(raw.copyFileId);
  const crc32c = text(raw.crc32c);
  const { size } = raw;
  if (sourceFileId === null || copyFileId === null || crc32c === null || typeof size !== 'number') return null;
  return { sourceFileId, copyFileId, crc32c, size };
}

/** **Ό,τι έχει παραδοθεί** για αυτή την παράδοση. */
export async function readDeliveredRows(adminDb: AdminFirestore, handover: PropertyHandover): Promise<HandoverDeliveredRow[]> {
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

/** **Η γραμμή** — μέσα στη συναλλαγή που γεννά και το αντίγραφο (ποτέ το ένα χωρίς το άλλο). */
export function stageDeliveryLedgerRow(tx: Transaction, ref: DocumentReference, row: Omit<HandoverDeliveryLedgerRow, 'id'>): void {
  tx.create(ref, { id: ref.id, ...row });
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
