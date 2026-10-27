import 'server-only';

/**
 * Project RFQs + «which counted BOQ line is out to tender right now» (ADR-330 §5.1 S3.2).
 *
 * An RFQ is OPEN while its status is outside `RFQ_LIFECYCLE_LOCKED_STATUSES` (draft · active) — the same
 * set that locks line edits (ADR-335), so «open» here and «editable» there cannot drift.
 * The BOQ link lives on the RFQ's `lines` sub-collection (`source === 'boq'`, ADR-327 Q29); legacy inline
 * `lines[]` never carried it.
 *
 * @module services/procurement/aggregators/project-boq-sourcing
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { RFQ_LIFECYCLE_LOCKED_STATUSES, type RFQ } from '@/subapps/procurement/types/rfq';
import type { RfqLine } from '@/subapps/procurement/types/rfq-line';
import type { BuyoutRfqRef } from '@/services/procurement/buyout/project-buyout';

/** Every RFQ of the project — the ONE read shared by the overview KPIs and the buyout view. */
export async function fetchProjectRfqs(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  projectId: string,
): Promise<RFQ[]> {
  const snap = await db
    .collection(COLLECTIONS.RFQS)
    .where('companyId', '==', companyId)
    .where('projectId', '==', projectId)
    .get();
  return snap.docs.map(doc => ({ ...(doc.data() as RFQ), id: doc.id }));
}

async function readBoqLinks(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  rfq: RFQ,
): Promise<BuyoutRfqRef[]> {
  const snap = await db
    .collection(COLLECTIONS.RFQS)
    .doc(rfq.id)
    .collection(COLLECTIONS.RFQ_LINES_SUB)
    .where('companyId', '==', companyId)
    .get();
  return snap.docs.flatMap(doc => {
    const line = doc.data() as RfqLine;
    return line.source === 'boq' && line.boqItemId
      ? [{ boqItemId: line.boqItemId, rfqId: rfq.id, rfqTitle: rfq.title }]
      : [];
  });
}

export async function fetchProjectBoqSourcing(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  projectId: string,
): Promise<BuyoutRfqRef[]> {
  const rfqs = await fetchProjectRfqs(db, companyId, projectId);
  const open = rfqs.filter(rfq => !RFQ_LIFECYCLE_LOCKED_STATUSES.has(rfq.status));
  const perRfq = await Promise.all(open.map(rfq => readBoqLinks(db, companyId, rfq)));
  return perRfq.flat();
}
