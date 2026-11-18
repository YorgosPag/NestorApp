/**
 * @fileoverview ADR-945 §7.5 — ο ΕΝΑΣ αναγνώστης και ο ΕΝΑΣ γραφέας του `document_issuance_requests` (deny-all — μόνο
 *   εδώ), και η όψη «αίτημα + οι προσφορές του» για την οθόνη.
 * @related issuance-request-schema.ts (σχήμα · ταυτότητες) · lib/document-validity/issuance-bidding.ts (ο μειωτής) ·
 *   issuance-request.service.ts (η πράξη, σε ΜΙΑ συναλλαγή με τις προσφορές)
 * @module services/document-registry/issuance-requests.server
 *
 * 🔑 **Ο κάτοχος ρωτιέται σε κάθε ανάγνωση** (`isOwnedByCustody`): ξένο ή χαλασμένο ≡ ανύπαρκτο — ποτέ μαντεψιά αιτήματος.
 * 🔑 Κάθε προσφορά είναι ανάθεση του **ίδιου** βιβλίου: διαβάζεται με τον ΙΔΙΟ κανόνα με τον γραφέα (`ownedIssuanceRecordOf`).
 */

import 'server-only';

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { issuanceStateOf, visibleIssuanceStage, type IssuanceAssignmentRecord, type IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceRequestRecord } from '@/lib/document-validity/issuance-bidding';
import { createModuleLogger } from '@/lib/telemetry';
import { custodyOnly, isOwnedByCustody, type CustodyScope } from '@/lib/workspace/custody-scope';
import type { RegistryPropertyScope } from './document-registry.types';
import { ownedIssuanceRecordOf } from './issuance-assignments.server';
import { issuanceRequestIdOf, issuanceRequestRecordOf, parseIssuanceRequest, type StoredIssuanceRequest } from './issuance-request-schema';

const logger = createModuleLogger('issuance-requests');

/** Ποιο αίτημα — (κάτοχος, ακίνητο, είδος): η ΜΙΑ ταυτότητα. */
export interface IssuanceRequestTarget {
  readonly owner: CustodyScope;
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
}

export function issuanceRequestRefOf(db: Firestore, target: IssuanceRequestTarget): DocumentReference {
  return db.collection(COLLECTIONS.DOCUMENT_ISSUANCE_REQUESTS).doc(issuanceRequestIdOf(target.owner, target.propertyId, target.documentKind));
}

function ownedRequestOf(raw: unknown, target: IssuanceRequestTarget, id: string): IssuanceRequestRecord | null {
  if (raw === undefined) return null;
  const stored = parseIssuanceRequest(raw);
  const mine = stored !== null && stored.id === id && isOwnedByCustody(custodyOnly(stored.owner), target.owner)
    && stored.propertyId === target.propertyId && stored.documentKind === target.documentKind;
  if (!mine) {
    logger.warn('Μη αναγνώσιμο ή ξένο αίτημα προσφορών — αγνοήθηκε', { requestId: id });
    return null;
  }
  return issuanceRequestRecordOf(stored);
}

/** Το αίτημα **αυτού** του κατόχου μέσα στη συναλλαγή — ξένο ή χαλασμένο ≡ κανένα. */
export async function readIssuanceRequestInTx(tx: Transaction, ref: DocumentReference, target: IssuanceRequestTarget): Promise<IssuanceRequestRecord | null> {
  return ownedRequestOf((await tx.get(ref)).data(), target, ref.id);
}

/** Το σχήμα του δίσκου: ο κάτοχος ως **επίπεδο** πεδίο (`companyId` ή `userId`, ποτέ και τα δύο). */
type StoredRequestDoc = Omit<StoredIssuanceRequest, 'owner'> & CustodyScope;

/** Γράφει το αίτημα στη συναλλαγή του καλούντα — καλείται **μετά** από κάθε ανάγνωση της. */
export function writeIssuanceRequestInTx(
  tx: Transaction,
  ref: DocumentReference,
  write: IssuanceRequestTarget & { readonly scope: RegistryPropertyScope; readonly record: IssuanceRequestRecord; readonly nowIso: string },
): void {
  const stored: StoredRequestDoc = {
    ...write.record,
    id: ref.id,
    ...custodyOnly(write.owner),
    propertyId: write.propertyId,
    scope: write.scope,
    documentKind: write.documentKind,
    updatedAt: write.nowIso,
  };
  tx.set(ref, stored);
}

/** Μία προσφορά όπως τη βλέπει η οθόνη — το στάδιο κρίνεται με τον ΙΔΙΟ πυρήνα (`issuanceStateOf`). */
export interface IssuanceBidView {
  readonly bidId: string;
  /** `null` = κλειστή (απορρίφθηκε · ακυρώθηκε · ολοκληρώθηκε) ή δεν γράφτηκε ακόμη. */
  readonly stage: IssuanceStage | null;
  readonly record: IssuanceAssignmentRecord | null;
}

export interface IssuanceRequestView {
  readonly request: IssuanceRequestRecord | null;
  readonly bids: readonly IssuanceBidView[];
}

/** Το αίτημα και οι προσφορές του **τρέχοντος** κύκλου, σε ένα `getAll` — για την οθόνη και το GET. */
export async function readIssuanceRequestView(db: Firestore, target: IssuanceRequestTarget, latestIssuedOn: string | null): Promise<IssuanceRequestView> {
  const ref = issuanceRequestRefOf(db, target);
  const request = ownedRequestOf((await ref.get()).data(), target, ref.id);
  if (request === null || request.bids.length === 0) return { request, bids: [] };
  const assignments = db.collection(COLLECTIONS.DOCUMENT_ISSUANCE_ASSIGNMENTS);
  const snapshots = await db.getAll(...request.bids.map((bid) => assignments.doc(bid.bidId)));
  const bids = snapshots.map((snapshot): IssuanceBidView => {
    const record = ownedIssuanceRecordOf(snapshot.data(), target.owner);
    return { bidId: snapshot.id, stage: visibleIssuanceStage(issuanceStateOf(record, latestIssuedOn)), record };
  });
  return { request, bids };
}
