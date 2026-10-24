import 'server-only';

/**
 * @fileoverview **Η ΔΙΑΤΗΡΗΣΗ ΤΗΣ ΓΕΝΙΑΣ-ΠΗΓΗΣ ΩΣ ΤΗΝ ΑΠΟΔΕΙΞΗ — το δίχτυ** (ADR-916 Φ-Δ.7α · Ο13β πρόληψη).
 * @related services/file-record/file-preservation.service.ts (ο ΕΝΑΣ γραφέας) · handover-delivery-copy.server.ts (η
 *          τοποθέτηση, ατομικά με τη γραμμή) · handover-delivery-ledger.server.ts (η άρση, ατομικά με το sha256)
 * @module server/property-handover-delivery/handover-delivery-preservation.server
 *
 * 🔑 **Αναλλοίωτο**: *γραμμή καθολικού χωρίς sha256, σε παράδοση που ΟΦΕΙΛΕΤΑΙ ⇒ η πηγή της διατηρείται* — αλλιώς όχι.
 *    Οι δύο **κύριες** διαδρομές το κρατούν ατομικά (γέννηση γραμμής · εγγραφή sha256). Εδώ ζει η **συμφιλίωση** (Π5) για
 *    ό,τι δεν είναι γεγονός γραμμής:
 *    - η παράδοση **έπαψε να οφείλεται** (ανάκληση Φ-Δ.5 · ακύρωση πώλησης) ⇒ καμία απόδειξη δεν θα γραφτεί ποτέ ⇒ άρση·
 *    - γραμμή χωρίς διατήρηση (γεννήθηκε πριν τη Φ-Δ.7α · μισή αποτυχία) ⇒ τοποθέτηση.
 * 🔑 **Μόνο γραμμές χωρίς sha256**: η γραμμή με sha256 έχει ήδη αποδεσμεύσει την πηγή στην ίδια συναλλαγή — κανένα κόστος.
 * 🛡️ **Ποτέ δεν πετά**: αποτυχία γραμμής = `failed` + log· η επόμενη εκτέλεση (15′ ή νυχτερινό δίχτυ) συγκλίνει.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { getErrorMessage } from '@/lib/error-utils';
import { isSha256Hex } from '@/lib/hash/sha256';
import { createModuleLogger } from '@/lib/telemetry';
import {
  preserveObjectBytes,
  reconcilePreservedBytes,
  stagePreservation,
  stagePreservationRelease,
} from '@/services/file-record/file-preservation.service';
import type { PropertyHandover } from '@/types/property-handover';

import { deliveryLedgerRef, deliverySourceRef, ownSourceData, readDeliveredRows, type HandoverLedgerProof } from './handover-delivery-ledger.server';

const logger = createModuleLogger('PropertyHandoverPreservation');

export interface HandoverPreservationRun {
  readonly preserved: number;
  readonly released: number;
  readonly failed: number;
}

type RowOutcome = 'preserved' | 'released' | 'unchanged';

/**
 * Μία γραμμή: **ξαναδιαβάζεται** στη συναλλαγή (το sha256 μπορεί να γράφτηκε στο μεταξύ) και γράφεται μόνο η διαφορά.
 * Τοποθέτηση = bytes **πρώτα** (ίδια σειρά με την κύρια διαδρομή)· στο τέλος τα bytes ακολουθούν πάντα τη βάση.
 */
async function settleRow(adminDb: AdminFirestore, handover: PropertyHandover, sourceFileId: string, owed: boolean): Promise<RowOutcome> {
  const ledgerRef = deliveryLedgerRef(adminDb, handover.id, sourceFileId);
  const sourceRef = deliverySourceRef(adminDb, sourceFileId);
  if (owed) {
    const source = (await sourceRef.get()).data();
    if (source?.companyId === handover.companyId) await preserveObjectBytes(source);
  }
  const outcome = await adminDb.runTransaction(async (tx): Promise<RowOutcome> => {
    const [ledgerSnap, sourceSnap] = await Promise.all([tx.get(ledgerRef), tx.get(sourceRef)]);
    const ledger = ledgerSnap.data();
    const source = ownSourceData(sourceSnap.data(), ledger);
    const wanted = owed && ledger !== undefined && !isSha256Hex(ledger.sha256);
    if (wanted) return stagePreservation(tx, sourceRef, source, ledgerRef.id) ? 'preserved' : 'unchanged';
    return stagePreservationRelease(tx, sourceRef, source, ledgerRef.id) ? 'released' : 'unchanged';
  });
  await reconcilePreservedBytes(sourceRef);
  return outcome;
}

/**
 * **Συμφιλίωσε τη διατήρηση** των γραμμών χωρίς sha256 μιας παράδοσης — `owed` ⇒ διατήρηση, αλλιώς άρση. Ιδεμπότητο.
 */
export async function reconcileHandoverPreservation(
  adminDb: AdminFirestore,
  handover: PropertyHandover,
  rows: readonly HandoverLedgerProof[],
  owed: boolean,
): Promise<HandoverPreservationRun> {
  const run = { preserved: 0, released: 0, failed: 0 };
  for (const row of rows) {
    if (row.sha256 !== null) continue;
    try {
      const outcome = await settleRow(adminDb, handover, row.sourceFileId, owed);
      if (outcome !== 'unchanged') run[outcome] += 1;
    } catch (error) {
      run.failed += 1;
      logger.warn('Η διατήρηση πηγής δεν συμφιλιώθηκε — ξαναδοκιμάζεται', { handoverId: handover.id, sourceFileId: row.sourceFileId, error: getErrorMessage(error) });
    }
  }
  return run;
}

/**
 * **Η παράδοση δεν οφείλεται πια** (ανάκληση · ακύρωση) ⇒ καμία απόδειξη δεν θα γραφτεί ⇒ οι πηγές της βγαίνουν από τη
 * διατήρηση. Χωρίς ποτέ πρόοδο ή με `delivered` (κάθε γραμμή είχε ήδη sha256 — και καμία νέα δεν γεννιέται πια) ⇒
 * τίποτα να διαβαστεί. Ποτέ δεν πετά.
 */
export async function releaseUnowedHandoverPreservation(adminDb: AdminFirestore, handover: PropertyHandover): Promise<HandoverPreservationRun | null> {
  const state = handover.fileDelivery?.state;
  if (state === undefined || state === 'delivered') return null;
  try {
    return await reconcileHandoverPreservation(adminDb, handover, await readDeliveredRows(adminDb, handover), false);
  } catch (error) {
    logger.warn('Η άρση διατήρησης παράδοσης που δεν οφείλεται απέτυχε — το δίχτυ ξαναδοκιμάζει', { handoverId: handover.id, error: getErrorMessage(error) });
    return null;
  }
}
