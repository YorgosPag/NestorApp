import 'server-only';

import admin from 'firebase-admin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { PurchaseOrder } from '@/types/procurement/purchase-order';
import type { RFQ } from '../types/rfq';

/**
 * Read-only PO guard for the RFQ lifecycle — ADR-335 Q3.
 *
 * Lives in its own module (not inside rfq-lifecycle-service) because the RFQ
 * lifecycle owns RFQ documents only; the purchase_orders collection belongs to
 * the procurement PO domain and is read here purely as a gate.
 */
export async function rfqHasActivePurchaseOrder(
  companyId: string,
  rfq: RFQ,
): Promise<boolean> {
  if (!rfq.winnerQuoteId) return false;
  const db = admin.firestore();
  const poSnap = await db
    .collection(COLLECTIONS.PURCHASE_ORDERS)
    .where('companyId', '==', companyId)
    .where('sourceQuoteId', '==', rfq.winnerQuoteId)
    .get();
  return poSnap.docs.some((d) => {
    const po = d.data() as PurchaseOrder;
    return po.status !== 'cancelled';
  });
}
